const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "GET") {
      return Response.json({ error: "method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const expectedAdminKey = Deno.env.get("ADMIN_UPLOAD_KEY") || "";
    const providedAdminKey = req.headers.get("x-admin-key") || "";

    if (!expectedAdminKey || providedAdminKey !== expectedAdminKey) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const [reports, downloads, contacts, events, metrics] = await Promise.all([
      supabase
        .from("radiografias")
        .select("id, titulo, provincia, localidad, fecha, pdf_url, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("pdf_downloads")
        .select("id, radiografia_id, pdf_url, email, phone, full_name, lugar, provincia, localidad, downloaded_at, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("contactos")
        .select("id, visitor_id, email, phone, full_name, organization, phone_validation_status, created_at, last_seen_at")
        .order("last_seen_at", { ascending: false })
        .limit(12),
      supabase
        .from("visitor_events")
        .select("id, visitor_id, event_type, page, path, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("pdf_download_metrics")
        .select("radiografia_id, titulo, lugar, provincia, localidad, dia, descargas, usuarios_unicos, telefonos_unicos, ultima_descarga")
        .order("ultima_descarga", { ascending: false })
        .limit(12),
    ]);

    for (const result of [reports, downloads, contacts, events, metrics]) {
      if (result.error) throw result.error;
    }

    return Response.json(
      {
        reports: reports.data || [],
        downloads: downloads.data || [],
        contacts: contacts.data || [],
        events: events.data || [],
        metrics: metrics.data || [],
        totals: {
          reports: reports.data?.length || 0,
          downloads: downloads.data?.length || 0,
          contacts: contacts.data?.length || 0,
          events: events.data?.length || 0,
        },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
