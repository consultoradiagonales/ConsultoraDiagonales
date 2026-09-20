const allowedOrigins = new Set([
  "https://consultoradiagonales.com.ar",
  "https://www.consultoradiagonales.com.ar",
  "https://consultoradiagonales.github.io",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://consultoradiagonales.com.ar",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function cleanText(value: unknown, limit = 12_000) {
  return String(value || "").trim().slice(0, limit);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90) || "noticia";
}

async function uniqueSlug(supabase: any, desired: string, ignoreId = "") {
  const base = slugify(desired);
  let candidate = base;
  let suffix = 2;
  while (true) {
    let query = supabase.from("noticias").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) query = query.neq("id", ignoreId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return candidate;
    candidate = `${base.slice(0, 84)}-${suffix}`;
    suffix += 1;
  }
}

function payloadFrom(body: Record<string, unknown>) {
  const titulo = cleanText(body.titulo, 70);
  const subtitulo = cleanText(body.subtitulo, 180);
  const seccion = cleanText(body.seccion, 80) || "Política";
  const fecha = cleanText(body.fecha, 16);
  const radiografiaId = cleanText(body.radiografia_id, 80);

  if (!titulo || !subtitulo || !radiografiaId) {
    throw new Error("Completá título, bajada y radiografía.");
  }

  if (titulo.length < 20 || subtitulo.length < 50) {
    throw new Error("El titular y la bajada SEO necesitan más detalle.");
  }

  return {
    titulo,
    subtitulo,
    seccion,
    url: "pdf-nota",
    fecha: fecha || new Date().toISOString().slice(0, 10),
    radiografia_id: radiografiaId,
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  const expectedKey = Deno.env.get("ADMIN_UPLOAD_KEY") || "";
  if (!expectedKey || req.headers.get("x-admin-key") !== expectedKey) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("noticias")
        .select("id, slug, titulo, subtitulo, seccion, fecha, radiografia_id, estado, published_at, pdf_url, pdf_file_name, imagen_url, created_at, updated_at")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      return Response.json({ news: data || [] }, { headers });
    }

    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action, 30);
    const id = cleanText(body.id, 80);

    if (action === "delete") {
      if (!id) return Response.json({ error: "id requerido" }, { status: 400, headers });
      const { error } = await supabase.from("noticias").delete().eq("id", id).eq("estado", "draft");
      if (error) throw error;
      return Response.json({ ok: true }, { headers });
    }

    if (action === "publish") {
      if (!id) return Response.json({ error: "id requerido" }, { status: 400, headers });
      const { data, error } = await supabase.rpc("publish_noticia", { p_noticia_id: id });
      if (error) throw error;
      return Response.json({ news: data }, { headers });
    }

    if (action !== "save") {
      return Response.json({ error: "acción no válida" }, { status: 400, headers });
    }

    const payload = payloadFrom(body);
    if (id) {
      const { data: current, error: currentError } = await supabase
        .from("noticias")
        .select("id, estado, slug")
        .eq("id", id)
        .single();
      if (currentError) throw currentError;
      if (current.estado !== "draft") {
        return Response.json({ error: "Solo se pueden editar noticias en borrador." }, { status: 409, headers });
      }
      const slug = await uniqueSlug(supabase, cleanText(body.slug, 100) || payload.titulo, id);
      const { data, error } = await supabase
        .from("noticias")
        .update({ ...payload, slug })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return Response.json({ news: data }, { headers });
    }

    const slug = await uniqueSlug(supabase, cleanText(body.slug, 100) || payload.titulo);
    const { data, error } = await supabase
      .from("noticias")
      .insert({ ...payload, slug, estado: "draft" })
      .select()
      .single();
    if (error) throw error;
    return Response.json({ news: data }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers });
  }
});
