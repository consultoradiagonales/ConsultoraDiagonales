const allowedOrigins = new Set([
  "https://consultoradiagonales.com.ar",
  "https://www.consultoradiagonales.com.ar",
  "https://consultoradiagonales.github.io",
]);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://consultoradiagonales.com.ar",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("true-client-ip")
    || req.headers.get("x-real-ip")
    || req.headers.get("x-client-ip")
    || req.headers.get("fly-client-ip")
    || ""
  ).split(",")[0].trim();
}

function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (current.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { ok: true, retryAfter: 0 };
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanInteger(value: unknown, minimum = 0, maximum = 100_000) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return null;
  return Math.max(minimum, Math.min(maximum, number));
}

function cleanNumber(value: unknown, minimum = 0, maximum = 100_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(minimum, Math.min(maximum, number));
}

function cleanBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return null;
}

function headerValue(req: Request, names: string[]) {
  for (const name of names) {
    const value = req.headers.get(name);
    if (!value) continue;
    try {
      return decodeURIComponent(value.replace(/\+/g, " ")).trim();
    } catch (_) {
      return value.trim();
    }
  }
  return "";
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > 12_000) return { truncated: true };
  return value as Record<string, unknown>;
}

function headerGeo(req: Request) {
  const city = cleanText(headerValue(req, ["cf-ipcity", "x-vercel-ip-city", "x-city", "x-appengine-city"]), 120);
  const region = cleanText(headerValue(req, ["cf-region", "x-vercel-ip-country-region", "x-region", "x-appengine-region"]), 120);
  const country = cleanText(headerValue(req, ["cf-country", "x-country", "x-appengine-country-name"]), 120);
  const countryCode = cleanText(headerValue(req, ["cf-ipcountry", "x-vercel-ip-country", "x-country-code", "x-appengine-country"]), 8);
  const timezone = cleanText(headerValue(req, ["cf-timezone", "x-timezone"]), 120);
  if (!city && !region && !country && !countryCode && !timezone) return null;
  return {
    city: city || null,
    region: region || null,
    country: country || null,
    countryCode: countryCode || null,
    timezone: timezone || null,
  };
}

function isPublicIp(ip: string) {
  if (!ip || ip === "unknown") return false;
  if (ip.includes(":")) return true;
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  return true;
}

async function lookupGeoByIp(ip: string) {
  if (!isPublicIp(ip)) return null;
  const providers = [
    `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,country_code,timezone,connection`,
    `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
    `https://ipinfo.io/${encodeURIComponent(ip)}/json`,
  ];

  for (const url of providers) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1600);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "accept": "application/json" },
      });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.success === false || data?.error) continue;

      const city = cleanText(data.city, 120);
      const region = cleanText(data.region || data.region_name, 120);
      const country = cleanText(data.country || data.country_name, 120);
      const countryCode = cleanText(data.country_code || data.countryCode || data.country, 8);
      const timezone = cleanText(data.timezone?.id || data.timezone, 120);
      const rawOrganization = cleanText(data.connection?.org || data.org || data.organization, 220);
      const rawAsn = cleanText(data.connection?.asn || data.asn || rawOrganization.match(/^AS\d+/i)?.[0], 80);
      const isp = cleanText(data.connection?.isp || data.isp || data.org, 220);
      const organization = rawOrganization.replace(/^AS\d+\s*/i, "") || isp;
      if (!city && !region && !country && !countryCode && !isp && !rawAsn) continue;
      return {
        city: city || null,
        region: region || null,
        country: country || null,
        countryCode: countryCode || null,
        timezone: timezone || null,
        isp: isp || null,
        organization: organization || null,
        asn: rawAsn || null,
      };
    } catch (_) {
      continue;
    }
  }

  return null;
}

function parseClient(userAgent: string, req: Request) {
  const ua = userAgent || "";
  const platformHint = cleanText(req.headers.get("sec-ch-ua-platform"), 80).replaceAll('"', "");
  const mobileHint = cleanText(req.headers.get("sec-ch-ua-mobile"), 10);
  const browserMatchers = [
    { name: "Microsoft Edge", pattern: /Edg\/([\d.]+)/i },
    { name: "Opera", pattern: /(?:OPR|Opera)\/([\d.]+)/i },
    { name: "Samsung Internet", pattern: /SamsungBrowser\/([\d.]+)/i },
    { name: "Chrome", pattern: /(?:Chrome|CriOS)\/([\d.]+)/i },
    { name: "Firefox", pattern: /(?:Firefox|FxiOS)\/([\d.]+)/i },
    { name: "Safari", pattern: /Version\/([\d.]+).*Safari/i },
  ];
  const browser = browserMatchers.find((candidate) => candidate.pattern.test(ua));
  const browserVersion = browser ? ua.match(browser.pattern)?.[1] || "" : "";

  let osName = platformHint;
  let osVersion = "";
  const osMatchers = [
    { name: "Windows", pattern: /Windows NT ([\d.]+)/i },
    { name: "Android", pattern: /Android ([\d.]+)/i },
    { name: "iOS", pattern: /(?:iPhone OS|CPU OS) ([\d_]+)/i },
    { name: "macOS", pattern: /Mac OS X ([\d_]+)/i },
    { name: "ChromeOS", pattern: /CrOS [^ ]+ ([\d.]+)/i },
    { name: "Linux", pattern: /Linux/i },
  ];
  const os = osMatchers.find((candidate) => candidate.pattern.test(ua));
  if (os) {
    osName = os.name;
    osVersion = ua.match(os.pattern)?.[1]?.replaceAll("_", ".") || "";
  }

  const isBot = /bot|crawler|spider|headless|preview|facebookexternalhit|whatsapp/i.test(ua);
  const isTablet = /iPad|Tablet|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = mobileHint === "?1" || /Mobi|iPhone|iPod|Android/i.test(ua);
  const deviceType = isBot ? "bot" : isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  return {
    deviceType,
    browserName: browser?.name || (isBot ? "Bot" : "Other"),
    browserVersion: browserVersion || null,
    osName: osName || "Other",
    osVersion: osVersion || null,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const ip = clientIp(req);
    const rate = checkRateLimit(`visitor-event:${ip || "unknown"}`, 120, 60 * 1000);
    if (!rate.ok) {
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(rate.retryAfter) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const visitorId = cleanText(body.visitor_id, 180);
    const eventType = cleanText(body.event_type, 80);
    if (!visitorId || !eventType) {
      return Response.json({ error: "visitor_id and event_type are required" }, { status: 400, headers: corsHeaders });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    let geo = headerGeo(req);
    let network: { isp: string | null; organization: string | null; asn: string | null } | null = null;
    let captureMethod = geo ? "edge_headers" : "edge_ip_only";
    if (ip) {
      const previous = await supabase
        .from("visitor_events")
        .select("geo_city, geo_region, geo_country, geo_country_code, geo_timezone, isp, network_org, asn")
        .eq("ip_address", ip)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previous.data) {
        if (!geo && (previous.data.geo_country_code || previous.data.geo_country)) {
          geo = {
            city: previous.data.geo_city,
            region: previous.data.geo_region,
            country: previous.data.geo_country,
            countryCode: previous.data.geo_country_code,
            timezone: previous.data.geo_timezone,
          };
        }
        if (previous.data.isp || previous.data.network_org || previous.data.asn) {
          network = {
            isp: previous.data.isp,
            organization: previous.data.network_org,
            asn: previous.data.asn,
          };
        }
        if (geo || network) captureMethod = "cached_ip_enrichment";
      }
    }

    if ((!geo || !network) && ip) {
      const lookup = await lookupGeoByIp(ip);
      if (lookup) {
        geo ||= {
          city: lookup.city,
          region: lookup.region,
          country: lookup.country,
          countryCode: lookup.countryCode,
          timezone: lookup.timezone,
        };
        network ||= {
          isp: lookup.isp,
          organization: lookup.organization,
          asn: lookup.asn,
        };
        captureMethod = "ip_lookup";
      }
    }

    const metadata = cleanMetadata(body.metadata);
    const meta = metadata as Record<string, unknown>;
    const userAgent = cleanText(req.headers.get("user-agent") || body.user_agent, 1000);
    const client = parseClient(userAgent, req);

    const event = {
      client_event_id: cleanText(body.client_event_id, 36) || null,
      visitor_id: visitorId,
      event_type: eventType,
      page: cleanText(body.page, 120) || null,
      path: cleanText(body.path, 500) || null,
      metadata,
      user_agent: userAgent || null,
      ip_address: ip || null,
      geo_city: geo?.city || null,
      geo_region: geo?.region || null,
      geo_country: geo?.country || null,
      geo_country_code: geo?.countryCode || null,
      geo_timezone: geo?.timezone || null,
      capture_method: captureMethod,
      session_id: cleanText(meta.session_id, 180) || null,
      referrer: cleanText(meta.referrer, 1000) || null,
      referrer_host: cleanText(meta.referrer_host, 255) || null,
      landing_page: cleanText(meta.landing_page, 1000) || null,
      traffic_source: cleanText(meta.traffic_source, 160) || "direct",
      traffic_medium: cleanText(meta.traffic_medium, 120) || "none",
      traffic_campaign: cleanText(meta.traffic_campaign, 300) || null,
      traffic_campaign_id: cleanText(meta.traffic_campaign_id, 300) || null,
      traffic_content: cleanText(meta.traffic_content, 300) || null,
      traffic_term: cleanText(meta.traffic_term, 300) || null,
      click_id_type: cleanText(meta.click_id_type, 40) || null,
      click_id: cleanText(meta.click_id, 500) || null,
      device_type: client.deviceType,
      browser_name: client.browserName,
      browser_version: client.browserVersion,
      os_name: client.osName,
      os_version: client.osVersion,
      language: cleanText(meta.language, 40) || null,
      client_timezone: cleanText(meta.client_timezone, 120) || null,
      viewport_width: cleanInteger(meta.viewport_width),
      viewport_height: cleanInteger(meta.viewport_height),
      screen_width: cleanInteger(meta.screen_width),
      screen_height: cleanInteger(meta.screen_height),
      connection_type: cleanText(meta.connection_type, 40) || null,
      connection_downlink: cleanNumber(meta.connection_downlink),
      is_returning: cleanBoolean(meta.is_returning),
      isp: network?.isp || null,
      network_org: network?.organization || null,
      asn: network?.asn || null,
    };

    const { error } = await supabase
      .from("visitor_events")
      .upsert(event, { onConflict: "client_event_id", ignoreDuplicates: true });
    if (error) throw error;

    try {
      await supabase.rpc("register_visitor_touch", { p_visitor_id: visitorId });
    } catch (_) {
      // El evento ya fue guardado; el contador auxiliar no debe invalidar la captura.
    }
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
