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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
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

function isMissingColumnError(error: unknown, column: string) {
  const message = String((error as { message?: unknown } | null)?.message || "");
  const code = String((error as { code?: unknown } | null)?.code || "");
  return code === "42703" || (message.includes(column) && message.includes("does not exist"));
}

function reportsQuery(supabase: any, columns: string) {
  return supabase
    .from("radiografias")
    .select(columns)
    .order("created_at", { ascending: false })
    .limit(250);
}

async function fetchReports(supabase: any) {
  const baseColumns = "id, titulo, provincia, localidad, fecha, html_url, pdf_url, storage_path, file_name, file_size, mime_type, created_at, updated_at";
  const withPrivacy = `${baseColumns}, is_private`;
  let result = await reportsQuery(supabase, withPrivacy);
  if (isMissingColumnError(result.error, "is_private")) {
    result = await reportsQuery(supabase, baseColumns);
  }
  return result;
}

function rangeStart(range: string) {
  const daysByRange: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
  const days = daysByRange[range];
  if (!days) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchPagedRows(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>,
  maxRows = 50_000,
) {
  const pageSize = 1_000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const result = await buildQuery(from, from + pageSize - 1);
    if (result.error) return { data: rows, error: result.error, truncated: false };
    const pageRows = result.data || [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) return { data: rows, error: null, truncated: false };
  }
  return { data: rows, error: null, truncated: true };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "GET") {
      return Response.json({ error: "method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const expectedAdminKey = Deno.env.get("ADMIN_UPLOAD_KEY") || "";
    const providedAdminKey = req.headers.get("x-admin-key") || "";
    const adminLimit = checkRateLimit(`admin-dashboard:${clientIp(req)}:${providedAdminKey.slice(0, 8)}`, 30, 60 * 1000);
    if (!adminLimit.ok) {
      return Response.json(
        { error: "rate_limited", message: "Demasiadas solicitudes al panel." },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(adminLimit.retryAfter) } },
      );
    }

    if (!expectedAdminKey || providedAdminKey !== expectedAdminKey) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const requestUrl = new URL(req.url);
    const requestedRange = requestUrl.searchParams.get("range") || "30d";
    const selectedRange = ["7d", "30d", "90d", "365d", "all"].includes(requestedRange) ? requestedRange : "30d";
    const since = rangeStart(selectedRange);

    const dateFiltered = (query: any, column = "created_at") => since ? query.gte(column, since) : query;

    const [reports, downloads, contacts, profiles, events, metrics] = await Promise.all([
      fetchReports(supabase),
      fetchPagedRows((from, to) => dateFiltered(
        supabase
          .from("pdf_downloads")
          .select("id, visitor_id, radiografia_id, pdf_url, email, phone, full_name, lugar, provincia, localidad, downloaded_at, created_at")
          .order("created_at", { ascending: false }),
      ).range(from, to), 10_000),
      fetchPagedRows((from, to) => supabase
        .from("contactos")
        .select("id, visitor_id, auth_user_id, email, phone, full_name, organization, social_provider, phone_validation_status, consent_terms, created_at, last_seen_at")
        .order("last_seen_at", { ascending: false })
        .range(from, to), 10_000),
      fetchPagedRows((from, to) => supabase
        .from("visitor_profiles")
        .select("visitor_id, auth_user_id, email, phone, full_name, organization, social_provider, first_seen_at, last_seen_at, visit_count, tags")
        .order("last_seen_at", { ascending: false })
        .range(from, to), 10_000),
      fetchPagedRows((from, to) => dateFiltered(
        supabase
          .from("visitor_events")
          .select("id, client_event_id, visitor_id, session_id, event_type, page, path, metadata, user_agent, ip_address, geo_city, geo_region, geo_country, geo_country_code, geo_timezone, capture_method, referrer, referrer_host, landing_page, traffic_source, traffic_medium, traffic_campaign, traffic_campaign_id, traffic_content, traffic_term, click_id_type, click_id, device_type, browser_name, browser_version, os_name, os_version, language, client_timezone, viewport_width, viewport_height, screen_width, screen_height, connection_type, connection_downlink, is_returning, isp, network_org, asn, created_at")
          .order("created_at", { ascending: false }),
      ).range(from, to), 50_000),
      supabase
        .from("pdf_download_metrics")
        .select("radiografia_id, titulo, lugar, provincia, localidad, dia, descargas, usuarios_unicos, telefonos_unicos, ultima_descarga")
        .order("ultima_descarga", { ascending: false })
        .limit(12),
    ]);

    for (const result of [reports, downloads, contacts, profiles, events, metrics]) {
      if (result.error) throw result.error;
    }

    const allEvents = events.data || [];
    const enrichedEvents = enrichEvents(allEvents, reports.data || []);
    const sessions = buildSessions(enrichedEvents);
    const humanSessions = sessions.filter((session) => session.device_type !== "bot");
    const humanEvents = enrichedEvents.filter((event) => event.device_type !== "bot");
    const humanVisitorIds = new Set(humanSessions.map((session) => String(session.visitor_id || "")).filter(Boolean));
    const audience = buildAudience({
      reports: reports.data || [],
      contacts: contacts.data || [],
      profiles: profiles.data || [],
      events: enrichedEvents,
      downloads: downloads.data || [],
    });
    const enrichedDownloads = enrichDownloads(downloads.data || [], reports.data || []);
    const pageConsumption = buildPageConsumption(humanEvents);
    const contentConsumption = buildContentConsumption(humanEvents, downloads.data || [], reports.data || []);
    const locationConsumption = buildLocationConsumption(humanEvents);
    const acquisitionConsumption = buildAcquisitionConsumption(humanSessions);
    const deviceConsumption = buildDeviceConsumption(sessions);
    const territoryContentConsumption = buildTerritoryContentConsumption(enrichedEvents, reports.data || []);
    const campaignConsumption = buildCampaignConsumption(humanSessions);
    const identifiedCount = audience.filter((person) => person.full_name || person.phone || person.email).length;
    const visitCount = humanEvents.filter((event) => event.event_type === "page_view").length;
    const returningCount = humanSessions.filter((session) => session.is_returning).length;
    const exportType = requestUrl.searchParams.get("export");

    if (exportType === "audience") {
      return new Response(buildAudienceWorkbook(
        audience,
        pageConsumption,
        contentConsumption,
        locationConsumption,
        acquisitionConsumption,
        deviceConsumption,
        territoryContentConsumption,
        sessions,
      ), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="audiencia-consultora-diagonales-${new Date().toISOString().slice(0, 10)}.xls"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return Response.json(
      {
        reports: reports.data || [],
        downloads: enrichedDownloads.slice(0, 40),
        contacts: (contacts.data || []).slice(0, 250),
        profiles: (profiles.data || []).slice(0, 250),
        audience,
        events: enrichedEvents.slice(0, 40),
        sessions: sessions.slice(0, 60),
        page_consumption: pageConsumption,
        content_consumption: contentConsumption,
        location_consumption: locationConsumption,
        acquisition_consumption: acquisitionConsumption,
        device_consumption: deviceConsumption,
        territory_content_consumption: territoryContentConsumption,
        campaign_consumption: campaignConsumption,
        metrics: metrics.data || [],
        coverage: {
          range: selectedRange,
          since,
          events_loaded: allEvents.length,
          events_truncated: Boolean(events.truncated),
          downloads_loaded: downloads.data?.length || 0,
          generated_at: new Date().toISOString(),
        },
        totals: {
          reports: reports.data?.length || 0,
          downloads: downloads.data?.length || 0,
          contacts: contacts.data?.length || 0,
          identified: identifiedCount,
          audience: identifiedCount,
          all_audience: audience.length,
          pages: pageConsumption.length,
          locations: locationConsumption.length,
          events: visitCount,
          all_events: allEvents.length,
          visits: visitCount,
          sessions: humanSessions.length,
          unique_visitors: humanVisitorIds.size,
          returning_sessions: returningCount,
          bot_sessions: sessions.length - humanSessions.length,
          content_actions: humanEvents.filter((event) => ["report_open", "open_graph", "request_pdf", "report_access_requested", "download_report"].includes(String(event.event_type))).length,
        },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});

type AudienceInput = {
  reports: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
  profiles: Record<string, unknown>[];
  events: Record<string, unknown>[];
  downloads: Record<string, unknown>[];
};

function eventMetadata(event: Record<string, unknown>) {
  return (event.metadata || {}) as Record<string, unknown>;
}

function pageTitle(event: Record<string, unknown>) {
  const metadata = eventMetadata(event);
  return String(
    metadata.page_title
      || metadata.document_title
      || (event.event_type === "page_view" ? metadata.title : "")
      || event.page
      || event.path
      || "Pagina no identificada",
  );
}

function pagePath(event: Record<string, unknown>) {
  const metadata = eventMetadata(event);
  return String(metadata.path || event.path || metadata.url || event.page || "");
}

function hasGeo(event: Record<string, unknown>) {
  return Boolean(event.geo_city || event.geo_region || event.geo_country || event.geo_country_code);
}

function geoLabel(event: Record<string, unknown>) {
  const country = event.geo_country || event.geo_country_code;
  return [event.geo_city, event.geo_region, country].filter(Boolean).join(", ");
}

function eventField(event: Record<string, unknown>, field: string) {
  const metadata = eventMetadata(event);
  return event[field] ?? metadata[field] ?? null;
}

function eventContact(event: Record<string, unknown>) {
  return (eventMetadata(event).contact || {}) as Record<string, unknown>;
}

function inferClientFromUserAgent(value: unknown) {
  const ua = String(value || "");
  const isBot = /bot|crawler|spider|headless|preview|facebookexternalhit|whatsapp/i.test(ua);
  const isTablet = /iPad|Tablet|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = /Mobi|iPhone|iPod|Android/i.test(ua);
  const browser = /Edg\//i.test(ua) ? "Microsoft Edge"
    : /SamsungBrowser\//i.test(ua) ? "Samsung Internet"
    : /(?:Chrome|CriOS)\//i.test(ua) ? "Chrome"
    : /(?:Firefox|FxiOS)\//i.test(ua) ? "Firefox"
    : /Version\/[\d.]+.*Safari/i.test(ua) ? "Safari"
    : isBot ? "Bot" : "Other";
  const os = /Windows NT/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android"
    : /(?:iPhone OS|CPU OS)/i.test(ua) ? "iOS"
    : /Mac OS X/i.test(ua) ? "macOS"
    : /CrOS/i.test(ua) ? "ChromeOS"
    : /Linux/i.test(ua) ? "Linux" : "Other";
  return {
    device_type: isBot ? "bot" : isTablet ? "tablet" : isMobile ? "mobile" : "desktop",
    browser_name: browser,
    os_name: os,
  };
}

function sessionIdentifier(event: Record<string, unknown>) {
  return String(eventField(event, "session_id") || "");
}

function buildSessions(events: Record<string, unknown>[]) {
  const sessions = new Map<string, Record<string, unknown>>();

  for (const event of events) {
    const visitorId = String(event.visitor_id || "");
    const sessionId = sessionIdentifier(event);
    if (!visitorId || !sessionId) continue;
    const key = `${visitorId}:${sessionId}`;
    const at = String(event.created_at || "");
    if (!sessions.has(key)) {
      sessions.set(key, {
        key,
        session_id: sessionId,
        visitor_id: visitorId,
        first_at: at || null,
        last_at: at || null,
        first_event_at: at || null,
        events: 0,
        page_views: 0,
        content_actions: 0,
        conversions: 0,
        pages_set: new Set<string>(),
        page_engagement: new Map<string, number>(),
        traffic_source: eventField(event, "traffic_source") || "direct",
        traffic_medium: eventField(event, "traffic_medium") || "none",
        traffic_campaign: eventField(event, "traffic_campaign") || null,
        traffic_content: eventField(event, "traffic_content") || null,
        traffic_term: eventField(event, "traffic_term") || null,
        click_id_type: eventField(event, "click_id_type") || null,
        landing_page: eventField(event, "landing_page") || event.path || null,
        referrer_host: eventField(event, "referrer_host") || null,
        device_type: eventField(event, "device_type") || "unknown",
        browser_name: eventField(event, "browser_name") || "Unknown",
        os_name: eventField(event, "os_name") || "Unknown",
        language: eventField(event, "language") || null,
        client_timezone: eventField(event, "client_timezone") || null,
        connection_type: eventField(event, "connection_type") || null,
        is_returning: Boolean(eventField(event, "is_returning")),
        geo_city: event.geo_city || null,
        geo_region: event.geo_region || null,
        geo_country: event.geo_country || event.geo_country_code || null,
        ip_address: event.ip_address || null,
        isp: event.isp || null,
        network_org: event.network_org || null,
        asn: event.asn || null,
        full_name: null,
        email: null,
        phone: null,
        organization: null,
        auth_user_id: null,
        identity_method: "anonymous",
      });
    }

    const session = sessions.get(key)!;
    session.events = Number(session.events || 0) + 1;
    if (at && (!session.first_at || at < String(session.first_at))) {
      session.first_at = at;
      session.first_event_at = at;
      session.traffic_source = eventField(event, "traffic_source") || session.traffic_source;
      session.traffic_medium = eventField(event, "traffic_medium") || session.traffic_medium;
      session.traffic_campaign = eventField(event, "traffic_campaign") || session.traffic_campaign;
      session.traffic_content = eventField(event, "traffic_content") || session.traffic_content;
      session.traffic_term = eventField(event, "traffic_term") || session.traffic_term;
      session.landing_page = eventField(event, "landing_page") || event.path || session.landing_page;
      session.referrer_host = eventField(event, "referrer_host") || session.referrer_host;
    }
    if (at && (!session.last_at || at > String(session.last_at))) session.last_at = at;

    const path = pagePath(event);
    if (path) (session.pages_set as Set<string>).add(path);
    if (event.event_type === "page_view") session.page_views = Number(session.page_views || 0) + 1;
    if (["report_open", "open_graph", "request_pdf", "report_access_requested", "download_report"].includes(String(event.event_type))) {
      session.content_actions = Number(session.content_actions || 0) + 1;
    }
    if (["lead_form_submitted", "share_lead_submitted", "report_access_requested", "download_report"].includes(String(event.event_type))) {
      session.conversions = Number(session.conversions || 0) + 1;
    }
    if (["engagement_ping", "read_session"].includes(String(event.event_type))) {
      const metadata = eventMetadata(event);
      const seconds = Number(metadata.active_seconds || metadata.seconds || 0);
      const pageKey = path || String(event.page || "unknown");
      const engagement = session.page_engagement as Map<string, number>;
      engagement.set(pageKey, Math.max(engagement.get(pageKey) || 0, seconds));
    }

    const contact = eventContact(event);
    for (const field of ["full_name", "email", "phone", "organization", "auth_user_id", "identity_method"]) {
      if (!session[field] && contact[field]) session[field] = contact[field];
    }
    if (contact.auth_user_id) session.identity_method = "google";
    else if (contact.phone || contact.email) session.identity_method = "phone_or_form";

    if (!session.geo_city && event.geo_city) session.geo_city = event.geo_city;
    if (!session.geo_region && event.geo_region) session.geo_region = event.geo_region;
    if (!session.geo_country && (event.geo_country || event.geo_country_code)) session.geo_country = event.geo_country || event.geo_country_code;
    if (!session.ip_address && event.ip_address) session.ip_address = event.ip_address;
    if (!session.isp && event.isp) session.isp = event.isp;
    if (!session.network_org && event.network_org) session.network_org = event.network_org;
    if (!session.asn && event.asn) session.asn = event.asn;
    session.is_returning = Boolean(session.is_returning || eventField(event, "is_returning"));
  }

  return Array.from(sessions.values())
    .map(({ key: _key, pages_set, page_engagement, ...session }) => {
      const start = new Date(String(session.first_at || "")).getTime();
      const end = new Date(String(session.last_at || "")).getTime();
      const engagedSeconds = Array.from((page_engagement as Map<string, number>).values()).reduce((sum, seconds) => sum + seconds, 0);
      return {
        ...session,
        pages: (pages_set as Set<string>).size,
        engaged_seconds: Math.round(engagedSeconds),
        elapsed_seconds: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 1000)) : 0,
        identified: Boolean(session.full_name || session.email || session.phone || session.auth_user_id),
        location: [session.geo_city, session.geo_region, session.geo_country].filter(Boolean).join(", ") || "Sin zona",
      };
    })
    .sort((a, b) => String(b.last_at || "").localeCompare(String(a.last_at || "")));
}

function buildAcquisitionConsumption(sessions: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>>();
  for (const session of sessions) {
    const source = String(session.traffic_source || "direct");
    const medium = String(session.traffic_medium || "none");
    const campaign = String(session.traffic_campaign || "");
    const key = `${source}|${medium}|${campaign}`;
    if (!groups.has(key)) {
      groups.set(key, {
        source,
        medium,
        campaign: campaign || null,
        sessions: 0,
        page_views: 0,
        content_actions: 0,
        conversions: 0,
        identified_sessions: 0,
        visitors_set: new Set<string>(),
        last_at: null,
      });
    }
    const group = groups.get(key)!;
    group.sessions = Number(group.sessions || 0) + 1;
    group.page_views = Number(group.page_views || 0) + Number(session.page_views || 0);
    group.content_actions = Number(group.content_actions || 0) + Number(session.content_actions || 0);
    group.conversions = Number(group.conversions || 0) + (Number(session.conversions || 0) > 0 ? 1 : 0);
    group.identified_sessions = Number(group.identified_sessions || 0) + (session.identified ? 1 : 0);
    if (session.visitor_id) (group.visitors_set as Set<string>).add(String(session.visitor_id));
    if (session.last_at && (!group.last_at || String(session.last_at) > String(group.last_at))) group.last_at = session.last_at;
  }
  return Array.from(groups.values())
    .map(({ visitors_set, ...group }) => ({
      ...group,
      unique_visitors: (visitors_set as Set<string>).size,
      conversion_rate: Number(group.sessions || 0) ? Math.round((Number(group.conversions || 0) / Number(group.sessions)) * 1000) / 10 : 0,
    }))
    .sort((a, b) => Number(b.sessions || 0) - Number(a.sessions || 0))
    .slice(0, 30);
}

function buildDeviceConsumption(sessions: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>>();
  for (const session of sessions) {
    const device = String(session.device_type || "unknown");
    const browser = String(session.browser_name || "Unknown");
    const os = String(session.os_name || "Unknown");
    const key = `${device}|${browser}|${os}`;
    if (!groups.has(key)) {
      groups.set(key, { device, browser, os, sessions: 0, page_views: 0, engaged_seconds: 0, conversions: 0, visitors_set: new Set<string>() });
    }
    const group = groups.get(key)!;
    group.sessions = Number(group.sessions || 0) + 1;
    group.page_views = Number(group.page_views || 0) + Number(session.page_views || 0);
    group.engaged_seconds = Number(group.engaged_seconds || 0) + Number(session.engaged_seconds || 0);
    group.conversions = Number(group.conversions || 0) + (Number(session.conversions || 0) > 0 ? 1 : 0);
    if (session.visitor_id) (group.visitors_set as Set<string>).add(String(session.visitor_id));
  }
  return Array.from(groups.values())
    .map(({ visitors_set, ...group }) => ({
      ...group,
      unique_visitors: (visitors_set as Set<string>).size,
      avg_engaged_seconds: Number(group.sessions || 0) ? Math.round(Number(group.engaged_seconds || 0) / Number(group.sessions)) : 0,
    }))
    .sort((a, b) => Number(b.sessions || 0) - Number(a.sessions || 0))
    .slice(0, 30);
}

function buildTerritoryContentConsumption(events: Record<string, unknown>[], reports: Record<string, unknown>[]) {
  const reportTitles = new Map(reports.map((report) => [String(report.id || ""), report.titulo]));
  const groups = new Map<string, Record<string, unknown>>();
  for (const event of events) {
    if (eventField(event, "device_type") === "bot") continue;
    if (!["report_open", "open_graph", "request_pdf", "report_access_requested", "download_report"].includes(String(event.event_type))) continue;
    const metadata = eventMetadata(event);
    const reportId = String(metadata.radiografia_id || "");
    const title = String(metadata.title || (reportId ? reportTitles.get(reportId) : "") || metadata.pdf_url || metadata.html_url || "Contenido no identificado");
    const location = geoLabel(event) || "Zona no detectada";
    const key = `${location}|${reportId || title}`;
    if (!groups.has(key)) {
      groups.set(key, {
        location,
        city: event.geo_city || null,
        region: event.geo_region || null,
        country: event.geo_country || event.geo_country_code || null,
        radiografia_id: reportId || null,
        title,
        interactions: 0,
        report_open: 0,
        open_graph: 0,
        request_pdf: 0,
        download_report: 0,
        visitors_set: new Set<string>(),
        sessions_set: new Set<string>(),
        last_at: null,
      });
    }
    const group = groups.get(key)!;
    group.interactions = Number(group.interactions || 0) + 1;
    if (event.event_type === "report_open") group.report_open = Number(group.report_open || 0) + 1;
    if (event.event_type === "open_graph") group.open_graph = Number(group.open_graph || 0) + 1;
    if (["request_pdf", "report_access_requested"].includes(String(event.event_type))) group.request_pdf = Number(group.request_pdf || 0) + 1;
    if (event.event_type === "download_report") group.download_report = Number(group.download_report || 0) + 1;
    if (event.visitor_id) (group.visitors_set as Set<string>).add(String(event.visitor_id));
    const sessionId = sessionIdentifier(event);
    if (sessionId) (group.sessions_set as Set<string>).add(sessionId);
    if (event.created_at && (!group.last_at || String(event.created_at) > String(group.last_at))) group.last_at = event.created_at;
  }
  return Array.from(groups.values())
    .map(({ visitors_set, sessions_set, ...group }) => ({
      ...group,
      unique_visitors: (visitors_set as Set<string>).size,
      sessions: (sessions_set as Set<string>).size,
      interest_score:
        Number(group.report_open || 0)
        + Number(group.open_graph || 0) * 2
        + Number(group.request_pdf || 0) * 3
        + Number(group.download_report || 0) * 4,
    }))
    .sort((a, b) => Number(b.interest_score || 0) - Number(a.interest_score || 0))
    .slice(0, 60);
}

function buildCampaignConsumption(sessions: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>>();
  for (const session of sessions) {
    const campaign = String(session.traffic_campaign || "");
    const term = String(session.traffic_term || "");
    const content = String(session.traffic_content || "");
    const clickType = String(session.click_id_type || "");
    if (!campaign && !term && !content && !clickType) continue;
    const key = `${session.traffic_source || "direct"}|${campaign}|${term}|${content}|${clickType}`;
    if (!groups.has(key)) {
      groups.set(key, {
        source: session.traffic_source || "direct",
        medium: session.traffic_medium || "none",
        campaign: campaign || null,
        term: term || null,
        content: content || null,
        click_id_type: clickType || null,
        sessions: 0,
        page_views: 0,
        content_actions: 0,
        conversions: 0,
      });
    }
    const group = groups.get(key)!;
    group.sessions = Number(group.sessions || 0) + 1;
    group.page_views = Number(group.page_views || 0) + Number(session.page_views || 0);
    group.content_actions = Number(group.content_actions || 0) + Number(session.content_actions || 0);
    group.conversions = Number(group.conversions || 0) + (Number(session.conversions || 0) > 0 ? 1 : 0);
  }
  return Array.from(groups.values())
    .sort((a, b) => Number(b.sessions || 0) - Number(a.sessions || 0))
    .slice(0, 40);
}

function buildPageConsumption(events: Record<string, unknown>[]) {
  const pages = new Map<string, Record<string, unknown>>();

  for (const event of events) {
    if (eventField(event, "device_type") === "bot") continue;
    if (!["page_view", "read_session"].includes(String(event.event_type))) continue;
    const key = pagePath(event);
    if (!key) continue;
    if (!pages.has(key)) {
      pages.set(key, {
        key,
        page: event.page || null,
        path: key,
        title: pageTitle(event),
        page_views: 0,
        unique_visitors_set: new Set<string>(),
        read_sessions: 0,
        total_seconds: 0,
        max_scroll_depth: 0,
        last_seen_at: null,
      });
    }

    const page = pages.get(key)!;
    const metadata = eventMetadata(event);
    if (event.event_type === "page_view") page.page_views = Number(page.page_views || 0) + 1;
    if (event.visitor_id) (page.unique_visitors_set as Set<string>).add(String(event.visitor_id));
    if (event.event_type === "read_session") {
      page.read_sessions = Number(page.read_sessions || 0) + 1;
      page.total_seconds = Number(page.total_seconds || 0) + Number(metadata.active_seconds || metadata.seconds || 0);
      page.max_scroll_depth = Math.max(Number(page.max_scroll_depth || 0), Number(metadata.scroll_depth || 0));
    }
    if (event.created_at && (!page.last_seen_at || String(event.created_at) > String(page.last_seen_at))) {
      page.last_seen_at = event.created_at;
    }
  }

  return Array.from(pages.values())
    .map(({ unique_visitors_set, ...page }) => ({
      ...page,
      unique_visitors: (unique_visitors_set as Set<string>).size,
      avg_read_seconds: Number(page.read_sessions || 0)
        ? Math.round(Number(page.total_seconds || 0) / Number(page.read_sessions || 1))
        : 0,
    }))
    .sort((a, b) => Number(b.page_views || 0) - Number(a.page_views || 0))
    .slice(0, 20);
}

function buildContentConsumption(
  events: Record<string, unknown>[],
  downloads: Record<string, unknown>[],
  reports: Record<string, unknown>[],
) {
  const reportTitles = new Map(reports.map((report) => [String(report.id || ""), report.titulo]));
  const content = new Map<string, Record<string, unknown>>();

  const ensureContent = (reportId: string, title: string) => {
    const key = reportId || title;
    if (!key) return null;
    if (!content.has(key)) {
      content.set(key, {
        key,
        radiografia_id: reportId || null,
        title: title || "Radiografia no identificada",
        report_open: 0,
        open_graph: 0,
        request_pdf: 0,
        download_report: 0,
        unique_visitors_set: new Set<string>(),
        last_at: null,
      });
    }
    return content.get(key)!;
  };

  for (const event of events) {
    if (eventField(event, "device_type") === "bot") continue;
    if (!["report_open", "open_graph", "request_pdf", "report_access_requested", "download_report"].includes(String(event.event_type))) continue;
    const metadata = eventMetadata(event);
    const reportId = String(metadata.radiografia_id || "");
    const title = String(metadata.title || (reportId ? reportTitles.get(reportId) : "") || metadata.pdf_url || metadata.html_url || "");
    const item = ensureContent(reportId, title);
    if (!item) continue;

    if (event.event_type === "report_open") item.report_open = Number(item.report_open || 0) + 1;
    if (event.event_type === "open_graph") item.open_graph = Number(item.open_graph || 0) + 1;
    if (event.event_type === "request_pdf" || event.event_type === "report_access_requested") item.request_pdf = Number(item.request_pdf || 0) + 1;
    if (event.event_type === "download_report") item.download_report = Number(item.download_report || 0) + 1;
    if (event.visitor_id) (item.unique_visitors_set as Set<string>).add(String(event.visitor_id));
    if (event.created_at && (!item.last_at || String(event.created_at) > String(item.last_at))) item.last_at = event.created_at;
  }

  for (const download of downloads) {
    const reportId = String(download.radiografia_id || "");
    const title = String((reportId ? reportTitles.get(reportId) : "") || download.pdf_url || "PDF sin radiografia vinculada");
    const item = ensureContent(reportId, title);
    if (!item) continue;
    item.download_rows = Number(item.download_rows || 0) + 1;
    item.download_report = Math.max(Number(item.download_report || 0), Number(item.download_rows || 0));
    if (download.visitor_id) (item.unique_visitors_set as Set<string>).add(String(download.visitor_id));
    const at = download.downloaded_at || download.created_at;
    if (at && (!item.last_at || String(at) > String(item.last_at))) item.last_at = at;
  }

  return Array.from(content.values())
    .map(({ unique_visitors_set, ...item }) => ({
      ...item,
      download_rows: undefined,
      unique_visitors: (unique_visitors_set as Set<string>).size,
      total_consumption:
        Number(item.report_open || 0)
        + Number(item.open_graph || 0)
        + Number(item.request_pdf || 0)
        + Number(item.download_report || 0),
    }))
    .sort((a, b) => Number(b.total_consumption || 0) - Number(a.total_consumption || 0))
    .slice(0, 20);
}

function buildLocationConsumption(events: Record<string, unknown>[]) {
  const locations = new Map<string, Record<string, unknown>>();

  for (const event of events) {
    if (eventField(event, "device_type") === "bot") continue;
    if (!hasGeo(event) && !event.ip_address) continue;
    const label = geoLabel(event) || "IP sin ciudad detectada";
    const key = label || String(event.ip_address || "");
    if (!locations.has(key)) {
      locations.set(key, {
        key,
        label,
        city: event.geo_city || null,
        region: event.geo_region || null,
        country: event.geo_country || event.geo_country_code || null,
        events: 0,
        page_views: 0,
        unique_visitors_set: new Set<string>(),
        ips_set: new Set<string>(),
        last_seen_at: null,
      });
    }

    const location = locations.get(key)!;
    location.events = Number(location.events || 0) + 1;
    if (event.event_type === "page_view") location.page_views = Number(location.page_views || 0) + 1;
    if (event.visitor_id) (location.unique_visitors_set as Set<string>).add(String(event.visitor_id));
    if (event.ip_address) (location.ips_set as Set<string>).add(String(event.ip_address));
    if (event.created_at && (!location.last_seen_at || String(event.created_at) > String(location.last_seen_at))) {
      location.last_seen_at = event.created_at;
    }
  }

  return Array.from(locations.values())
    .map(({ unique_visitors_set, ips_set, ...location }) => ({
      ...location,
      unique_visitors: (unique_visitors_set as Set<string>).size,
      unique_ips: (ips_set as Set<string>).size,
    }))
    .sort((a, b) => Number(b.unique_visitors || 0) - Number(a.unique_visitors || 0) || Number(b.events || 0) - Number(a.events || 0))
    .slice(0, 20);
}

function buildAudience({ reports, contacts, profiles, events, downloads }: AudienceInput) {
  const people = new Map<string, Record<string, unknown>>();
  const reportTitles = new Map(reports.map((report) => [String(report.id || ""), report.titulo]));
  const identityByVisitor = new Map<string, string>();
  for (const source of [...profiles, ...contacts]) {
    const visitorId = String(source.visitor_id || "");
    const authUserId = String(source.auth_user_id || "");
    if (visitorId && authUserId) identityByVisitor.set(visitorId, `auth:${authUserId}`);
  }

  const ensurePerson = (visitorId: string) => {
    const personKey = identityByVisitor.get(visitorId) || `visitor:${visitorId}`;
    if (!people.has(personKey)) {
      people.set(personKey, {
        person_key: personKey,
        visitor_id: visitorId,
        visitor_ids: new Set<string>(),
        session_ids: new Set<string>(),
        auth_user_id: null,
        social_provider: null,
        identity_method: "anonymous",
        email: null,
        phone: null,
        full_name: null,
        organization: null,
        phone_validation_status: null,
        first_seen_at: null,
        last_seen_at: null,
        visit_count: 0,
        report_views: 0,
        report_requests: 0,
        downloads: 0,
        page_views: 0,
        last_interest_at: null,
        ip_address: null,
        geo_city: null,
        geo_region: null,
        geo_country: null,
        geo_country_code: null,
        geo_timezone: null,
        last_network_at: null,
        last_geo_at: null,
        traffic_source: null,
        traffic_medium: null,
        traffic_campaign: null,
        landing_page: null,
        referrer_host: null,
        device_type: null,
        browser_name: null,
        os_name: null,
        language: null,
        client_timezone: null,
        connection_type: null,
        isp: null,
        network_org: null,
        asn: null,
        is_returning: false,
        page_journey: [],
        content_journey: [],
        interested_reports: [],
      });
    }
    const person = people.get(personKey)!;
    (person.visitor_ids as Set<string>).add(visitorId);
    return person;
  };

  const mergeContact = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const key of ["email", "phone", "full_name", "organization", "phone_validation_status", "auth_user_id", "social_provider"]) {
      if (!target[key] && source[key]) target[key] = source[key];
    }
    if (target.auth_user_id) target.identity_method = "google";
    else if (target.phone || target.email) target.identity_method = "phone_or_form";
    if (source.first_seen_at && (!target.first_seen_at || String(source.first_seen_at) < String(target.first_seen_at))) {
      target.first_seen_at = source.first_seen_at;
    }
    if (source.last_seen_at && (!target.last_seen_at || String(source.last_seen_at) > String(target.last_seen_at))) {
      target.last_seen_at = source.last_seen_at;
    }
    if (typeof source.visit_count === "number") target.visit_count = source.visit_count;
  };

  for (const profile of profiles) {
    const visitorId = String(profile.visitor_id || "");
    if (!visitorId) continue;
    mergeContact(ensurePerson(visitorId), profile);
  }

  for (const contact of contacts) {
    const visitorId = String(contact.visitor_id || "");
    if (!visitorId) continue;
    mergeContact(ensurePerson(visitorId), contact);
  }

  const addInterest = (person: Record<string, unknown>, report: Record<string, unknown>, at?: unknown) => {
    const reportId = report.radiografia_id || null;
    const title = report.title || report.titulo || (reportId ? reportTitles.get(String(reportId)) : null) || report.radiografia_title || report.pdf_url || report.html_url;
    if (title || reportId) {
      const list = person.interested_reports as Record<string, unknown>[];
      const key = String(title || reportId || "");
      if (!list.some((item) => item.key === key)) {
        list.push({ key, radiografia_id: reportId, title, html_url: report.html_url || null, pdf_url: report.pdf_url || null });
      }
    }
    if (at && (!person.last_interest_at || String(at) > String(person.last_interest_at))) {
      person.last_interest_at = at;
    }
  };

  const addPageVisit = (person: Record<string, unknown>, event: Record<string, unknown>) => {
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const path = String(metadata.path || event.path || "");
    const pageKey = path || String(event.page || metadata.page_key || "");
    if (!pageKey) return;

    const list = person.page_journey as Record<string, unknown>[];
    let pageVisit = list.find((item) => item.key === pageKey);
    if (!pageVisit) {
      pageVisit = {
        key: pageKey,
        page: event.page || metadata.page_key || null,
        path: path || null,
        title: pageTitle(event),
        count: 0,
        total_seconds: 0,
        max_scroll_depth: null,
        first_at: event.created_at || null,
        last_at: event.created_at || null,
      };
      list.push(pageVisit);
    }

    if (event.event_type === "page_view") {
      pageVisit.count = Number(pageVisit.count || 0) + 1;
    }
    if (event.event_type === "read_session") {
      pageVisit.total_seconds = Number(pageVisit.total_seconds || 0) + Number(metadata.active_seconds || metadata.seconds || 0);
      const scrollDepth = Number(metadata.scroll_depth || 0);
      pageVisit.max_scroll_depth = Math.max(Number(pageVisit.max_scroll_depth || 0), scrollDepth);
    }
    if (event.created_at && (!pageVisit.first_at || String(event.created_at) < String(pageVisit.first_at))) {
      pageVisit.first_at = event.created_at;
    }
    if (event.created_at && (!pageVisit.last_at || String(event.created_at) > String(pageVisit.last_at))) {
      pageVisit.last_at = event.created_at;
    }
  };

  const addContentVisit = (person: Record<string, unknown>, event: Record<string, unknown>) => {
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const reportId = String(metadata.radiografia_id || "");
    const title = String(metadata.title || (reportId ? reportTitles.get(reportId) : "") || metadata.pdf_url || metadata.html_url || "");
    if (!reportId && !title) return;

    const list = person.content_journey as Record<string, unknown>[];
    const key = reportId || title;
    let content = list.find((item) => item.key === key);
    if (!content) {
      content = {
        key,
        radiografia_id: reportId || null,
        title: title || "Radiografia no identificada",
        report_open: 0,
        open_graph: 0,
        request_pdf: 0,
        download_report: 0,
        last_action: null,
        last_at: null,
      };
      list.push(content);
    }

    if (event.event_type === "report_open") content.report_open = Number(content.report_open || 0) + 1;
    if (event.event_type === "open_graph") content.open_graph = Number(content.open_graph || 0) + 1;
    if (event.event_type === "request_pdf" || event.event_type === "report_access_requested") {
      content.request_pdf = Number(content.request_pdf || 0) + 1;
    }
    if (event.event_type === "download_report") content.download_report = Number(content.download_report || 0) + 1;
    if (event.created_at && (!content.last_at || String(event.created_at) > String(content.last_at))) {
      content.last_at = event.created_at;
      content.last_action = event.event_type;
    }
  };

  for (const event of events) {
    if (eventField(event, "device_type") === "bot") continue;
    const visitorId = String(event.visitor_id || "");
    if (!visitorId) continue;
    const person = ensurePerson(visitorId);
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const contact = (metadata.contact || {}) as Record<string, unknown>;
    mergeContact(person, contact);
    const currentSessionId = sessionIdentifier(event);
    if (currentSessionId) (person.session_ids as Set<string>).add(currentSessionId);
    if (event.event_type === "page_view") {
      person.page_views = Number(person.page_views || 0) + 1;
    }
    if (event.event_type === "page_view" || event.event_type === "read_session") {
      addPageVisit(person, event);
    }
    if (event.ip_address && (!person.last_network_at || String(event.created_at || "") > String(person.last_network_at))) {
      person.ip_address = event.ip_address;
      person.isp = event.isp || person.isp || null;
      person.network_org = event.network_org || person.network_org || null;
      person.asn = event.asn || person.asn || null;
      person.connection_type = eventField(event, "connection_type") || person.connection_type || null;
      person.last_network_at = event.created_at || null;
    }
    if (hasGeo(event) && (!person.last_geo_at || String(event.created_at || "") > String(person.last_geo_at))) {
      person.geo_city = event.geo_city || null;
      person.geo_region = event.geo_region || null;
      person.geo_country = event.geo_country || null;
      person.geo_country_code = event.geo_country_code || null;
      person.geo_timezone = event.geo_timezone || null;
      person.last_geo_at = event.created_at || null;
    }
    if (!person.traffic_source || !person.first_event_at || String(event.created_at || "") < String(person.first_event_at)) {
      person.first_event_at = event.created_at || null;
      person.traffic_source = eventField(event, "traffic_source") || "direct";
      person.traffic_medium = eventField(event, "traffic_medium") || "none";
      person.traffic_campaign = eventField(event, "traffic_campaign") || null;
      person.landing_page = eventField(event, "landing_page") || event.path || null;
      person.referrer_host = eventField(event, "referrer_host") || null;
    }
    if (!person.last_device_at || String(event.created_at || "") > String(person.last_device_at)) {
      person.device_type = eventField(event, "device_type") || person.device_type || null;
      person.browser_name = eventField(event, "browser_name") || person.browser_name || null;
      person.os_name = eventField(event, "os_name") || person.os_name || null;
      person.language = eventField(event, "language") || person.language || null;
      person.client_timezone = eventField(event, "client_timezone") || person.client_timezone || null;
      person.last_device_at = event.created_at || null;
    }
    person.is_returning = Boolean(person.is_returning || eventField(event, "is_returning"));
    if (event.event_type === "report_open") {
      person.report_views = Number(person.report_views || 0) + 1;
      addInterest(person, metadata, event.created_at);
    }
    if (event.event_type === "report_access_requested") {
      person.report_requests = Number(person.report_requests || 0) + 1;
      addInterest(person, metadata, event.created_at);
    }
    if (event.event_type === "download_report") {
      person.downloads = Number(person.downloads || 0) + 1;
      addInterest(person, metadata, event.created_at);
    }
    if (["report_open", "open_graph", "request_pdf", "report_access_requested", "download_report"].includes(String(event.event_type))) {
      addContentVisit(person, event);
    }
  }

  for (const download of downloads) {
    const visitorId = String(download.visitor_id || "");
    if (!visitorId) continue;
    const person = ensurePerson(visitorId);
    mergeContact(person, download);
    person.downloads = Math.max(Number(person.downloads || 0), 1);
    addInterest(person, download, download.downloaded_at || download.created_at);
    addContentVisit(person, {
      event_type: "download_report",
      metadata: {
        radiografia_id: download.radiografia_id || null,
        title: download.radiografia_id ? reportTitles.get(String(download.radiografia_id)) : null,
        pdf_url: download.pdf_url || null,
      },
      created_at: download.downloaded_at || download.created_at,
    });
  }

  return Array.from(people.values())
    .map(({ visitor_ids, session_ids, ...person }) => ({
      ...person,
      visitor_ids: Array.from(visitor_ids as Set<string>),
      device_count: (visitor_ids as Set<string>).size,
      session_count: (session_ids as Set<string>).size,
      visit_count: Number(person.page_views || 0) || Number(person.visit_count || 0),
      page_journey: (person.page_journey as Record<string, unknown>[])
        .map(({ key: _key, ...item }) => item)
        .sort((a, b) => String(a.first_at || "").localeCompare(String(b.first_at || ""))),
      content_journey: (person.content_journey as Record<string, unknown>[])
        .map(({ key: _key, ...item }) => item)
        .sort((a, b) => String(b.last_at || "").localeCompare(String(a.last_at || ""))),
      interested_reports: (person.interested_reports as Record<string, unknown>[]).map(({ key: _key, ...item }) => item),
    }))
    .sort((a, b) => {
      const aIdentified = Boolean(a.full_name || a.phone || a.email);
      const bIdentified = Boolean(b.full_name || b.phone || b.email);
      if (aIdentified !== bIdentified) return aIdentified ? -1 : 1;

      const aOrder = aIdentified
        ? a.last_interest_at || a.last_seen_at || a.first_seen_at || ""
        : a.first_seen_at || a.last_seen_at || a.last_interest_at || "";
      const bOrder = bIdentified
        ? b.last_interest_at || b.last_seen_at || b.first_seen_at || ""
        : b.first_seen_at || b.last_seen_at || b.last_interest_at || "";
      return String(bOrder).localeCompare(String(aOrder));
    });
}

function enrichEvents(events: Record<string, unknown>[], reports: Record<string, unknown>[]) {
  const reportTitles = new Map(reports.map((report) => [String(report.id || ""), report.titulo]));
  const networkByVisitor = new Map<string, Record<string, unknown>>();

  for (const event of events) {
    const visitorId = String(event.visitor_id || "");
    if (!visitorId || (!event.ip_address && !hasGeo(event))) continue;
    const current = networkByVisitor.get(visitorId) || {
      ip_address: null,
      geo_city: null,
      geo_region: null,
      geo_country: null,
      geo_country_code: null,
      geo_timezone: null,
      isp: null,
      network_org: null,
      asn: null,
    };

    if (!current.ip_address && event.ip_address) current.ip_address = event.ip_address;
    if (hasGeo(event) && !hasGeo(current)) {
      current.geo_city = event.geo_city || null;
      current.geo_region = event.geo_region || null;
      current.geo_country = event.geo_country || null;
      current.geo_country_code = event.geo_country_code || null;
      current.geo_timezone = event.geo_timezone || null;
    }
    if (!current.isp && event.isp) current.isp = event.isp;
    if (!current.network_org && event.network_org) current.network_org = event.network_org;
    if (!current.asn && event.asn) current.asn = event.asn;
    networkByVisitor.set(visitorId, current);
  }

  return events.map((event) => {
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const reportId = String(metadata.radiografia_id || "");
    const knownNetwork = networkByVisitor.get(String(event.visitor_id || ""));
    const inferredClient = inferClientFromUserAgent(event.user_agent);
    return {
      ...event,
      session_id: event.session_id || metadata.session_id || null,
      traffic_source: event.traffic_source || metadata.traffic_source || "direct",
      traffic_medium: event.traffic_medium || metadata.traffic_medium || "none",
      traffic_campaign: event.traffic_campaign || metadata.traffic_campaign || null,
      traffic_content: event.traffic_content || metadata.traffic_content || null,
      traffic_term: event.traffic_term || metadata.traffic_term || null,
      landing_page: event.landing_page || metadata.landing_page || null,
      referrer_host: event.referrer_host || metadata.referrer_host || null,
      device_type: event.device_type || metadata.device_type || inferredClient.device_type,
      browser_name: event.browser_name || metadata.browser_name || inferredClient.browser_name,
      os_name: event.os_name || metadata.os_name || inferredClient.os_name,
      ip_address: event.ip_address || knownNetwork?.ip_address || null,
      geo_city: event.geo_city || knownNetwork?.geo_city || null,
      geo_region: event.geo_region || knownNetwork?.geo_region || null,
      geo_country: event.geo_country || knownNetwork?.geo_country || null,
      geo_country_code: event.geo_country_code || knownNetwork?.geo_country_code || null,
      geo_timezone: event.geo_timezone || knownNetwork?.geo_timezone || null,
      isp: event.isp || knownNetwork?.isp || null,
      network_org: event.network_org || knownNetwork?.network_org || null,
      asn: event.asn || knownNetwork?.asn || null,
      network_inferred: !event.ip_address && Boolean(knownNetwork?.ip_address),
      radiografia_title: metadata.title || (reportId ? reportTitles.get(reportId) : null) || null,
    };
  });
}

function enrichDownloads(downloads: Record<string, unknown>[], reports: Record<string, unknown>[]) {
  const reportTitles = new Map(reports.map((report) => [String(report.id || ""), report.titulo]));
  return downloads.map((download) => ({
    ...download,
    radiografia_title: download.radiografia_id
      ? reportTitles.get(String(download.radiografia_id))
      : null,
  }));
}

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function workbookCell(value: unknown, type = "String") {
  return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
}

function buildAudienceWorkbookLegacy(audience: Record<string, unknown>[]) {
  const headers = [
    "Nombre y apellido",
    "Teléfono",
    "Correo electrónico",
    "Organización",
    "Cantidad de visitas",
    "IP",
    "Ciudad",
    "Provincia / región",
    "País",
    "Radiografías consultadas",
    "Primera visita",
    "Última actividad",
  ];

  const rows = audience.map((person) => {
    const reports = ((person.interested_reports || []) as Record<string, unknown>[])
      .map((report) => report.title)
      .filter(Boolean)
      .join(" | ");
    return [
      person.full_name || "Visitante sin nombre registrado",
      person.phone || "",
      person.email || "",
      person.organization || "",
      Number(person.visit_count || 0),
      person.ip_address || "",
      person.geo_city || "",
      person.geo_region || "",
      person.geo_country || person.geo_country_code || "",
      reports,
      person.first_seen_at || "",
      person.last_interest_at || person.last_seen_at || "",
    ];
  });

  const headerXml = headers.map((header) => workbookCell(header)).join("");
  const rowXml = rows.map((row) =>
    `<Row>${row.map((value, index) => workbookCell(value, index === 4 ? "Number" : "String")).join("")}</Row>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Audiencia">
  <Table>
   <Row>${headerXml}</Row>
   ${rowXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

function buildWorksheet(name: string, headers: string[], rows: unknown[][], numericColumns: number[] = []) {
  const headerXml = headers.map((header) => workbookCell(header)).join("");
  const rowXml = rows.map((row) =>
    `<Row>${row.map((value, index) => workbookCell(value, numericColumns.includes(index) ? "Number" : "String")).join("")}</Row>`
  ).join("");
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table><Row>${headerXml}</Row>${rowXml}</Table></Worksheet>`;
}

function buildAudienceWorkbook(
  audience: Record<string, unknown>[],
  pages: Record<string, unknown>[] = [],
  content: Record<string, unknown>[] = [],
  locations: Record<string, unknown>[] = [],
  acquisition: Record<string, unknown>[] = [],
  devices: Record<string, unknown>[] = [],
  territoryContent: Record<string, unknown>[] = [],
  sessions: Record<string, unknown>[] = [],
) {
  const audienceRows = audience.map((person) => {
    const reports = ((person.interested_reports || []) as Record<string, unknown>[])
      .map((report) => report.title)
      .filter(Boolean)
      .join(" | ");
    const pageJourney = ((person.page_journey || []) as Record<string, unknown>[])
      .map((item) => `${item.title || item.path || item.page} (${item.count || 0})`)
      .join(" > ");
    const contentJourney = ((person.content_journey || []) as Record<string, unknown>[])
      .map((item) => `${item.title || "Contenido"}: PDF ${item.download_report || 0}, graficos ${item.open_graph || 0}`)
      .join(" | ");
    return [
      person.full_name || "Visitante sin nombre registrado",
      person.phone || "",
      person.email || "",
      person.organization || "",
      person.identity_method || "anonymous",
      Number(person.visit_count || 0),
      Number(person.session_count || 0),
      Number(person.device_count || 0),
      person.is_returning ? "Si" : "No",
      person.ip_address || "",
      person.isp || "",
      person.network_org || "",
      person.asn || "",
      person.geo_city || "",
      person.geo_region || "",
      person.geo_country || person.geo_country_code || "",
      person.traffic_source || "",
      person.traffic_medium || "",
      person.traffic_campaign || "",
      person.landing_page || "",
      person.referrer_host || "",
      person.device_type || "",
      person.browser_name || "",
      person.os_name || "",
      person.language || "",
      person.client_timezone || "",
      person.connection_type || "",
      reports,
      pageJourney,
      contentJourney,
      person.first_seen_at || "",
      person.last_interest_at || person.last_seen_at || "",
    ];
  });

  const pageRows = pages.map((item) => [
    item.title || item.path || "",
    item.path || "",
    Number(item.page_views || 0),
    Number(item.unique_visitors || 0),
    Number(item.avg_read_seconds || 0),
    Number(item.max_scroll_depth || 0),
    item.last_seen_at || "",
  ]);

  const contentRows = content.map((item) => [
    item.title || "",
    Number(item.total_consumption || 0),
    Number(item.unique_visitors || 0),
    Number(item.report_open || 0),
    Number(item.open_graph || 0),
    Number(item.request_pdf || 0),
    Number(item.download_report || 0),
    item.last_at || "",
  ]);

  const locationRows = locations.map((item) => [
    item.label || "",
    item.city || "",
    item.region || "",
    item.country || "",
    Number(item.unique_visitors || 0),
    Number(item.page_views || 0),
    Number(item.events || 0),
    Number(item.unique_ips || 0),
    item.last_seen_at || "",
  ]);

  const acquisitionRows = acquisition.map((item) => [
    item.source || "",
    item.medium || "",
    item.campaign || "",
    Number(item.sessions || 0),
    Number(item.unique_visitors || 0),
    Number(item.page_views || 0),
    Number(item.content_actions || 0),
    Number(item.conversions || 0),
    Number(item.conversion_rate || 0),
    item.last_at || "",
  ]);

  const deviceRows = devices.map((item) => [
    item.device || "",
    item.browser || "",
    item.os || "",
    Number(item.sessions || 0),
    Number(item.unique_visitors || 0),
    Number(item.page_views || 0),
    Number(item.avg_engaged_seconds || 0),
    Number(item.conversions || 0),
  ]);

  const territoryContentRows = territoryContent.map((item) => [
    item.location || "",
    item.city || "",
    item.region || "",
    item.country || "",
    item.title || "",
    Number(item.unique_visitors || 0),
    Number(item.sessions || 0),
    Number(item.interactions || 0),
    Number(item.report_open || 0),
    Number(item.open_graph || 0),
    Number(item.request_pdf || 0),
    Number(item.download_report || 0),
    Number(item.interest_score || 0),
    item.last_at || "",
  ]);

  const sessionRows = sessions.map((item) => [
    item.session_id || "",
    item.visitor_id || "",
    item.identity_method || "anonymous",
    item.full_name || "",
    item.email || "",
    item.phone || "",
    item.traffic_source || "",
    item.traffic_medium || "",
    item.traffic_campaign || "",
    item.landing_page || "",
    item.referrer_host || "",
    item.location || "",
    item.ip_address || "",
    item.isp || "",
    item.asn || "",
    item.device_type || "",
    item.browser_name || "",
    item.os_name || "",
    Number(item.page_views || 0),
    Number(item.pages || 0),
    Number(item.engaged_seconds || 0),
    Number(item.content_actions || 0),
    Number(item.conversions || 0),
    item.is_returning ? "Si" : "No",
    item.first_at || "",
    item.last_at || "",
  ]);

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 ${buildWorksheet("Audiencia", [
    "Nombre y apellido",
    "Telefono",
    "Correo electronico",
    "Organizacion",
    "Metodo de identificacion",
    "Cantidad de visitas",
    "Sesiones",
    "Dispositivos / navegadores",
    "Recurrente",
    "IP",
    "ISP",
    "Organizacion de red",
    "ASN",
    "Ciudad",
    "Provincia / region",
    "Pais",
    "Fuente",
    "Medio",
    "Campana",
    "Pagina de entrada",
    "Referente",
    "Dispositivo",
    "Navegador",
    "Sistema operativo",
    "Idioma",
    "Zona horaria",
    "Tipo de conexion",
    "Radiografias consultadas",
    "Paginas recorridas",
    "Consumo de contenidos",
    "Primera visita",
    "Ultima actividad",
  ], audienceRows, [5, 6, 7])}
 ${buildWorksheet("Paginas", [
    "Pagina",
    "Ruta",
    "Vistas",
    "Visitantes unicos",
    "Segundos promedio",
    "Scroll maximo",
    "Ultima actividad",
  ], pageRows, [2, 3, 4, 5])}
 ${buildWorksheet("Contenidos", [
    "Contenido",
    "Consumos totales",
    "Visitantes unicos",
    "Aperturas de informe",
    "Graficos",
    "Pedidos de PDF",
    "Consumos PDF",
    "Ultima actividad",
  ], contentRows, [1, 2, 3, 4, 5, 6])}
 ${buildWorksheet("Origen", [
    "Zona",
    "Ciudad",
    "Provincia / region",
    "Pais",
    "Visitantes unicos",
    "Vistas de pagina",
    "Eventos",
    "IPs unicas",
    "Ultima actividad",
  ], locationRows, [4, 5, 6, 7])}
 ${buildWorksheet("Adquisicion", [
    "Fuente",
    "Medio",
    "Campana",
    "Sesiones",
    "Visitantes unicos",
    "Vistas",
    "Interacciones con contenido",
    "Sesiones convertidas",
    "Conversion %",
    "Ultima actividad",
  ], acquisitionRows, [3, 4, 5, 6, 7, 8])}
 ${buildWorksheet("Dispositivos", [
    "Dispositivo",
    "Navegador",
    "Sistema operativo",
    "Sesiones",
    "Visitantes unicos",
    "Vistas",
    "Segundos activos promedio",
    "Sesiones convertidas",
  ], deviceRows, [3, 4, 5, 6, 7])}
 ${buildWorksheet("Territorio x contenido", [
    "Zona",
    "Ciudad",
    "Provincia / region",
    "Pais",
    "Radiografia",
    "Visitantes unicos",
    "Sesiones",
    "Interacciones",
    "Aperturas",
    "Graficos",
    "Pedidos PDF",
    "Consumos PDF",
    "Puntaje de interes",
    "Ultima actividad",
  ], territoryContentRows, [5, 6, 7, 8, 9, 10, 11, 12])}
 ${buildWorksheet("Sesiones", [
    "ID sesion",
    "ID visitante",
    "Identificacion",
    "Nombre",
    "Email",
    "Telefono",
    "Fuente",
    "Medio",
    "Campana",
    "Entrada",
    "Referente",
    "Zona",
    "IP",
    "ISP",
    "ASN",
    "Dispositivo",
    "Navegador",
    "Sistema operativo",
    "Vistas",
    "Paginas distintas",
    "Segundos activos",
    "Interacciones",
    "Conversiones",
    "Recurrente",
    "Inicio",
    "Ultima actividad",
  ], sessionRows, [18, 19, 20, 21, 22])}
</Workbook>`;
}
