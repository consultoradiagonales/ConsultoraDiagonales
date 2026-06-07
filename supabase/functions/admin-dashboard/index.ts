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

    const [reports, downloads, contacts, profiles, events, metrics] = await Promise.all([
      supabase
        .from("radiografias")
        .select("id, titulo, provincia, localidad, fecha, html_url, pdf_url, storage_path, file_name, file_size, mime_type, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("pdf_downloads")
        .select("id, visitor_id, radiografia_id, pdf_url, email, phone, full_name, lugar, provincia, localidad, downloaded_at, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("contactos")
        .select("id, visitor_id, email, phone, full_name, organization, phone_validation_status, created_at, last_seen_at")
        .order("last_seen_at", { ascending: false })
        .limit(250),
      supabase
        .from("visitor_profiles")
        .select("visitor_id, email, phone, full_name, organization, first_seen_at, last_seen_at, visit_count, tags")
        .order("last_seen_at", { ascending: false })
        .limit(250),
      supabase
        .from("visitor_events")
        .select("id, visitor_id, event_type, page, path, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("pdf_download_metrics")
        .select("radiografia_id, titulo, lugar, provincia, localidad, dia, descargas, usuarios_unicos, telefonos_unicos, ultima_descarga")
        .order("ultima_descarga", { ascending: false })
        .limit(12),
    ]);

    for (const result of [reports, downloads, contacts, profiles, events, metrics]) {
      if (result.error) throw result.error;
    }

    const audience = buildAudience({
      reports: reports.data || [],
      contacts: contacts.data || [],
      profiles: profiles.data || [],
      events: events.data || [],
      downloads: downloads.data || [],
    });

    return Response.json(
      {
        reports: reports.data || [],
        downloads: downloads.data || [],
        contacts: contacts.data || [],
        profiles: profiles.data || [],
        audience,
        events: (events.data || []).slice(0, 20),
        metrics: metrics.data || [],
        totals: {
          reports: reports.data?.length || 0,
          downloads: downloads.data?.length || 0,
          contacts: contacts.data?.length || 0,
          audience: audience.length,
          events: events.data?.length || 0,
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

function buildAudience({ reports, contacts, profiles, events, downloads }: AudienceInput) {
  const people = new Map<string, Record<string, unknown>>();
  const reportTitles = new Map(reports.map((report) => [String(report.id || ""), report.titulo]));

  const ensurePerson = (visitorId: string) => {
    if (!people.has(visitorId)) {
      people.set(visitorId, {
        visitor_id: visitorId,
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
        last_interest_at: null,
        interested_reports: [],
      });
    }
    return people.get(visitorId)!;
  };

  const mergeContact = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const key of ["email", "phone", "full_name", "organization", "phone_validation_status"]) {
      if (!target[key] && source[key]) target[key] = source[key];
    }
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

  for (const event of events) {
    const visitorId = String(event.visitor_id || "");
    if (!visitorId) continue;
    const person = ensurePerson(visitorId);
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const contact = (metadata.contact || {}) as Record<string, unknown>;
    mergeContact(person, contact);
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
  }

  for (const download of downloads) {
    const visitorId = String(download.visitor_id || "");
    if (!visitorId) continue;
    const person = ensurePerson(visitorId);
    mergeContact(person, download);
    person.downloads = Math.max(Number(person.downloads || 0), 1);
    addInterest(person, download, download.downloaded_at || download.created_at);
  }

  return Array.from(people.values())
    .map((person) => ({
      ...person,
      interested_reports: (person.interested_reports as Record<string, unknown>[]).map(({ key: _key, ...item }) => item),
    }))
    .sort((a, b) => String(b.last_interest_at || b.last_seen_at || "").localeCompare(String(a.last_interest_at || a.last_seen_at || "")));
}
