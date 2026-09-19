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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "nota-periodistica.pdf";
}

function storagePathFromUrl(value: unknown) {
  const url = String(value || "");
  const marker = "/storage/v1/object/public/noticias/";
  const index = url.indexOf(marker);
  return index === -1 ? "" : decodeURIComponent(url.slice(index + marker.length));
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
    const file = form.get("pdf_nota");
    if (!id || !(file instanceof File)) return Response.json({ error: "id y PDF requeridos" }, { status: 400, headers });
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return Response.json({ error: "La nota debe ser un archivo PDF." }, { status: 400, headers });
    }
    if (file.size > 35 * 1024 * 1024) return Response.json({ error: "El PDF supera el máximo de 35 MB." }, { status: 413, headers });

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const { data: current, error: currentError } = await supabase
      .from("noticias")
      .select("id, estado, pdf_url, pdf_storage_path")
      .eq("id", id)
      .single();
    if (currentError) throw currentError;
    if (current.estado !== "draft") return Response.json({ error: "Solo se puede reemplazar el PDF de un borrador." }, { status: 409, headers });

    const path = `news/${id}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("noticias")
      .upload(path, await file.arrayBuffer(), { contentType: "application/pdf", cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage.from("noticias").getPublicUrl(path);
    const { data: news, error: updateError } = await supabase
      .from("noticias")
      .update({ pdf_url: publicUrl.publicUrl, pdf_storage_path: path, pdf_file_name: file.name, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, pdf_url, pdf_file_name")
      .single();
    if (updateError) throw updateError;

    const oldPath = current.pdf_storage_path || storagePathFromUrl(current.pdf_url);
    if (oldPath) await supabase.storage.from("noticias").remove([oldPath]);
    return Response.json({ news }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers });
  }
});
