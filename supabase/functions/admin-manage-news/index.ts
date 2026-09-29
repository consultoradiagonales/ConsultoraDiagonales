const allowedOrigins = new Set([
  "https://consultoradiagonales.com.ar",
  "https://www.consultoradiagonales.com.ar",
  "https://consultoradiagonales.github.io",
]);

type JsonRecord = Record<string, unknown>;

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://consultoradiagonales.com.ar",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function cleanText(value: unknown, limit = 12_000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, limit);
}

function cleanKeywords(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values.map((item) => cleanText(item, 60)).filter(Boolean))].slice(0, 12);
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

function safeHttpsUrl(value: unknown) {
  const raw = cleanText(value, 2_000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : "";
  } catch (_) {
    return "";
  }
}

function normalizeSocialUrl(value: unknown) {
  const raw = safeHttpsUrl(value);
  if (!raw) return null;
  const url = new URL(raw);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (["x.com", "twitter.com", "mobile.twitter.com"].includes(host) && parts.length >= 3 && parts[1] === "status" && /^\d{5,}$/.test(parts[2])) {
    const handle = parts[0].replace(/[^A-Za-z0-9_]/g, "");
    if (!handle) return null;
    return { provider: "x", url: `https://x.com/${handle}/status/${parts[2]}` };
  }
  if (host === "instagram.com" && parts.length >= 2 && ["p", "reel", "tv"].includes(parts[0]) && /^[A-Za-z0-9_-]{5,}$/.test(parts[1])) {
    return { provider: "instagram", url: `https://www.instagram.com/${parts[0]}/${parts[1]}/` };
  }
  return null;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeContent(value: unknown, allowIncomplete = false) {
  if (!Array.isArray(value)) throw new Error("El contenido editorial debe ser una lista de bloques.");
  if (value.length > 80) throw new Error("La nota supera el máximo de 80 bloques.");

  return value.map((raw, index) => {
    const block = asRecord(raw);
    const type = cleanText(block.type, 24).toLowerCase();
    if (type === "paragraph") {
      const text = cleanText(block.text, 16_000);
      if (!text && !allowIncomplete) throw new Error(`El bloque ${index + 1} no tiene texto.`);
      return { type, text };
    }
    if (type === "heading") {
      const text = cleanText(block.text, 220);
      if (!text && !allowIncomplete) throw new Error(`El subtítulo ${index + 1} está vacío.`);
      return { type, text };
    }
    if (type === "quote") {
      const text = cleanText(block.text, 1_200);
      const cite = cleanText(block.cite, 180);
      if (!text && !allowIncomplete) throw new Error(`La cita ${index + 1} está vacía.`);
      return { type, text, ...(cite ? { cite } : {}) };
    }
    if (type === "image") {
      const url = safeHttpsUrl(block.url);
      const alt = cleanText(block.alt, 300);
      const caption = cleanText(block.caption, 600);
      if ((!url || !alt) && !allowIncomplete) throw new Error(`La imagen ${index + 1} necesita archivo y texto alternativo.`);
      return { type, url, alt, ...(caption ? { caption } : {}) };
    }
    if (type === "embed") {
      const embed = normalizeSocialUrl(block.url);
      if (!embed && !allowIncomplete) throw new Error(`El enlace social ${index + 1} debe ser una publicación válida de X o Instagram.`);
      if (!embed) return { type, provider: cleanText(block.provider, 20), url: cleanText(block.url, 2_000) };
      return { type, ...embed };
    }
    throw new Error(`El tipo de bloque ${index + 1} no es válido.`);
  });
}

function plainTextFromContent(content: Array<JsonRecord>) {
  return content
    .filter((block) => ["paragraph", "heading", "quote"].includes(String(block.type)))
    .map((block) => String(block.text || ""))
    .join("\n\n")
    .slice(0, 12_000);
}

function readingTime(content: Array<JsonRecord>) {
  const words = plainTextFromContent(content).split(/\s+/).filter(Boolean).length;
  return words ? Math.max(1, Math.ceil(words / 220)) : null;
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

function payloadFrom(body: JsonRecord, allowIncomplete = false) {
  const titulo = cleanText(body.titulo, 150);
  const subtitulo = cleanText(body.subtitulo, 320);
  const seccion = cleanText(body.seccion, 80) || "Actualidad";
  const fecha = cleanText(body.fecha, 16) || new Date().toISOString().slice(0, 10);
  const contenido = normalizeContent(body.contenido || [], allowIncomplete);
  const seoTitle = cleanText(body.seo_title, 70) || titulo;
  const seoDescription = cleanText(body.seo_description, 180) || subtitulo;
  const imageUrl = safeHttpsUrl(body.imagen_url);
  const imageAlt = cleanText(body.imagen_alt, 300);
  const imageCaption = cleanText(body.imagen_epigrafe, 600);

  if ((!titulo || !subtitulo) && !allowIncomplete) throw new Error("Completá el titular y la bajada de la nota.");
  if (imageUrl && !imageAlt && !allowIncomplete) throw new Error("La foto de portada necesita texto alternativo.");

  return {
    titulo,
    subtitulo,
    seccion,
    url: "nota-web",
    fecha,
    radiografia_id: cleanText(body.radiografia_id, 80) || null,
    contenido,
    cuerpo: plainTextFromContent(contenido),
    imagen_url: imageUrl || null,
    imagen_alt: imageAlt || null,
    imagen_epigrafe: imageCaption || null,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    seo_keywords: cleanKeywords(body.seo_keywords),
    autor: cleanText(body.autor, 120) || "Consultora Diagonales",
    lectura_minutos: readingTime(contenido),
    updated_at: new Date().toISOString(),
  };
}

const newsFields = "id, slug, titulo, subtitulo, seccion, fecha, radiografia_id, estado, published_at, pdf_url, pdf_file_name, imagen_url, imagen_alt, imagen_epigrafe, contenido, cuerpo, seo_title, seo_description, seo_keywords, autor, lectura_minutos, created_at, updated_at";

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
        .select(newsFields)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      return Response.json({ news: data || [] }, { headers });
    }

    const body = asRecord(await req.json().catch(() => ({})));
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
      const { data: candidate, error: candidateError } = await supabase
        .from("noticias")
        .select("titulo, subtitulo, imagen_url, imagen_alt, contenido")
        .eq("id", id)
        .single();
      if (candidateError) throw candidateError;
      normalizeContent(candidate.contenido || []);
      if (!cleanText(candidate.titulo, 150) || !cleanText(candidate.subtitulo, 320)) {
        return Response.json({ error: "Completá el titular y la bajada antes de publicar." }, { status: 400, headers });
      }
      if (safeHttpsUrl(candidate.imagen_url) && !cleanText(candidate.imagen_alt, 300)) {
        return Response.json({ error: "La foto de portada necesita texto alternativo." }, { status: 400, headers });
      }
      const { data, error } = await supabase.rpc("publish_noticia", { p_noticia_id: id });
      if (error) throw error;
      return Response.json({ news: data }, { headers });
    }

    if (action === "duplicate") {
      if (!id) return Response.json({ error: "id requerido" }, { status: 400, headers });
      const { data: source, error: sourceError } = await supabase.from("noticias").select(newsFields).eq("id", id).single();
      if (sourceError) throw sourceError;
      const slug = await uniqueSlug(supabase, `${source.slug || source.titulo}-actualizacion`);
      const { data, error } = await supabase
        .from("noticias")
        .insert({
          titulo: source.titulo,
          subtitulo: source.subtitulo,
          seccion: source.seccion,
          fecha: new Date().toISOString().slice(0, 10),
          radiografia_id: source.radiografia_id,
          contenido: source.contenido || [],
          cuerpo: source.cuerpo || "",
          imagen_url: source.imagen_url,
          imagen_alt: source.imagen_alt,
          imagen_epigrafe: source.imagen_epigrafe,
          seo_title: source.seo_title,
          seo_description: source.seo_description,
          seo_keywords: source.seo_keywords || [],
          autor: source.autor || "Consultora Diagonales",
          lectura_minutos: source.lectura_minutos,
          slug,
          estado: "draft",
          url: "nota-web",
        })
        .select(newsFields)
        .single();
      if (error) throw error;
      return Response.json({ news: data }, { headers });
    }

    if (action !== "save") return Response.json({ error: "acción no válida" }, { status: 400, headers });

    const payload = payloadFrom(body, true);
    if (id) {
      const { data: current, error: currentError } = await supabase
        .from("noticias")
        .select("id, estado")
        .eq("id", id)
        .single();
      if (currentError) throw currentError;
      if (current.estado !== "draft") return Response.json({ error: "Para actualizar una nota publicada, creá una actualización en borrador." }, { status: 409, headers });
      const slug = await uniqueSlug(supabase, cleanText(body.slug, 100) || payload.titulo, id);
      const { data, error } = await supabase
        .from("noticias")
        .update({ ...payload, slug })
        .eq("id", id)
        .select(newsFields)
        .single();
      if (error) throw error;
      return Response.json({ news: data }, { headers });
    }

    const slug = await uniqueSlug(supabase, cleanText(body.slug, 100) || payload.titulo);
    const { data, error } = await supabase
      .from("noticias")
      .insert({ ...payload, slug, estado: "draft" })
      .select(newsFields)
      .single();
    if (error) throw error;
    return Response.json({ news: data }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers });
  }
});
