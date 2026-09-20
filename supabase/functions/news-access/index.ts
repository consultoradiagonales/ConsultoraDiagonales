const allowedOrigins = new Set([
  "https://consultoradiagonales.com.ar",
  "https://www.consultoradiagonales.com.ar",
  "https://consultoradiagonales.github.io",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://consultoradiagonales.com.ar",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
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
  if (req.method !== "GET") return Response.json({ error: "method not allowed" }, { status: 405, headers });

  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("news") || "").trim();
    if (!id) return Response.json({ error: "news requerido" }, { status: 400, headers });
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const { data: news, error } = await supabase
      .from("noticias")
      .select("id, estado, pdf_url, pdf_storage_path, pdf_file_name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!news || !["featured", "archived"].includes(String(news.estado))) {
      return Response.json({ error: "nota no disponible" }, { status: 404, headers });
    }
    const storagePath = news.pdf_storage_path || storagePathFromUrl(news.pdf_url);
    if (!storagePath) return Response.json({ error: "PDF no disponible" }, { status: 404, headers });
    const { data: file, error: downloadError } = await supabase.storage.from("noticias").download(storagePath);
    if (downloadError || !file) throw downloadError || new Error("PDF no disponible");
    return new Response(await file.arrayBuffer(), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${String(news.pdf_file_name || "nota-periodistica.pdf").replace(/[\"\\\r\n]/g, "-")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers });
  }
});
