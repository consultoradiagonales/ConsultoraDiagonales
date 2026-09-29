const allowedOrigins = new Set([
  "https://consultoradiagonales.com.ar",
  "https://www.consultoradiagonales.com.ar",
  "https://consultoradiagonales.github.io",
]);

const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://consultoradiagonales.com.ar",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function matchesImageSignature(bytes: Uint8Array, mime: string) {
  const has = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (mime === "image/jpeg") return has(0xff, 0xd8, 0xff);
  if (mime === "image/png") return has(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mime === "image/webp") return has(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (mime === "image/avif") {
    const brand = new TextDecoder().decode(bytes.slice(4, 24));
    return brand.includes("ftyp") && /(avif|avis)/.test(brand);
  }
  return false;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405, headers });

  const expectedKey = Deno.env.get("ADMIN_UPLOAD_KEY") || "";
  if (!expectedKey || req.headers.get("x-admin-key") !== expectedKey) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  try {
    const form = await req.formData();
    const id = String(form.get("id") || "").trim();
    const kind = String(form.get("kind") || "inline").trim();
    const file = form.get("image");
    if (!id || !(file instanceof File)) return Response.json({ error: "id e imagen requeridos" }, { status: 400, headers });
    if (!["cover", "inline"].includes(kind)) return Response.json({ error: "tipo de imagen inválido" }, { status: 400, headers });
    if (!imageTypes.has(file.type)) return Response.json({ error: "Usá una imagen JPG, PNG, WebP o AVIF." }, { status: 415, headers });
    if (file.size < 32 || file.size > 10 * 1024 * 1024) return Response.json({ error: "La imagen debe pesar entre 32 bytes y 10 MB." }, { status: 413, headers });

    const body = await file.arrayBuffer();
    if (!matchesImageSignature(new Uint8Array(body), file.type)) {
      return Response.json({ error: "El archivo no coincide con el formato de imagen informado." }, { status: 415, headers });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const { data: news, error: newsError } = await supabase
      .from("noticias")
      .select("id, estado")
      .eq("id", id)
      .single();
    if (newsError) throw newsError;
    if (news.estado !== "draft") return Response.json({ error: "Solo se pueden cargar imágenes en un borrador." }, { status: 409, headers });

    const extension = imageTypes.get(file.type) || "img";
    const path = `news/${id}/${kind}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("noticias-media")
      .upload(path, body, { contentType: file.type, cacheControl: "31536000, immutable", upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage.from("noticias-media").getPublicUrl(path);
    return Response.json({ media: { path, url: publicUrl.publicUrl, mime: file.type, kind } }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers });
  }
});
