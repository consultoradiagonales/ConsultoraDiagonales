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
    || req.headers.get("x-real-ip")
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

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > 12_000) return { truncated: true };
  return value as Record<string, unknown>;
}

function headerGeo(req: Request) {
  const city = cleanText(req.headers.get("cf-ipcity"), 120);
  const region = cleanText(req.headers.get("cf-region"), 120);
  const countryCode = cleanText(req.headers.get("cf-ipcountry"), 8);
  if (!city && !region && !countryCode) return null;
  return {
    city: city || null,
    region: region || null,
    country: null,
    countryCode: countryCode || null,
    timezone: null,
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
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,country_code,timezone`, {
      headers: { "accept": "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.success) return null;
    const city = cleanText(data.city, 120);
    const region = cleanText(data.region, 120);
    const country = cleanText(data.country, 120);
    const countryCode = cleanText(data.country_code, 8);
    const timezone = cleanText(data.timezone?.id || data.timezone, 120);
    if (!city && !region && !country && !countryCode) return null;
    return {
      city: city || null,
      region: region || null,
      country: country || null,
      countryCode: countryCode || null,
      timezone: timezone || null,
    };
  } catch (_) {
    return null;
  }
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
    let captureMethod = geo ? "edge_headers" : "edge_ip_only";
    if (!geo && ip) {
      const previous = await supabase
        .from("visitor_events")
        .select("geo_city, geo_region, geo_country, geo_country_code, geo_timezone")
        .eq("ip_address", ip)
        .not("geo_country_code", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previous.data) {
        geo = {
          city: previous.data.geo_city,
          region: previous.data.geo_region,
          country: previous.data.geo_country,
          countryCode: previous.data.geo_country_code,
          timezone: previous.data.geo_timezone,
        };
        captureMethod = "cached_ip_geo";
      }
    }

    if (!geo && ip) {
      geo = await lookupGeoByIp(ip);
      if (geo) captureMethod = "ip_lookup";
    }

    const event = {
      visitor_id: visitorId,
      event_type: eventType,
      page: cleanText(body.page, 120) || null,
      path: cleanText(body.path, 500) || null,
      metadata: cleanMetadata(body.metadata),
      user_agent: cleanText(req.headers.get("user-agent") || body.user_agent, 1000) || null,
      ip_address: ip || null,
      geo_city: geo?.city || null,
      geo_region: geo?.region || null,
      geo_country: geo?.country || null,
      geo_country_code: geo?.countryCode || null,
      geo_timezone: geo?.timezone || null,
      capture_method: captureMethod,
    };

    const { error } = await supabase.from("visitor_events").insert(event);
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
