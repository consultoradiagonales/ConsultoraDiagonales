const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

function slugifyFileName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return Response.json({ error: "method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const expectedAdminKey = Deno.env.get("ADMIN_UPLOAD_KEY") || "";
    const providedAdminKey = req.headers.get("x-admin-key") || "";

    if (!expectedAdminKey || providedAdminKey !== expectedAdminKey) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const formData = await req.formData();
    const file = formData.get("archivo");
    const titulo = String(formData.get("titulo") || "").trim();
    const provincia = String(formData.get("provincia") || "").trim();
    const localidad = String(formData.get("localidad") || "").trim();
    const fecha = String(formData.get("fecha") || "").trim();

    const isPdf = file instanceof File && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!isPdf) {
      return Response.json({ error: "archivo PDF requerido" }, { status: 400, headers: corsHeaders });
    }

    if (!titulo || !provincia || !fecha) {
      return Response.json({ error: "titulo, provincia y fecha son requeridos" }, { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const cleanName = slugifyFileName(file.name || "radiografia.pdf");
    const path = `${fecha}/${crypto.randomUUID()}-${cleanName}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("radiografias")
      .upload(path, bytes, { cacheControl: "3600", contentType: "application/pdf", upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from("radiografias").getPublicUrl(path);
    const pdf_url = publicData.publicUrl;

    const { data: report, error: insertError } = await supabase
      .from("radiografias")
      .insert({ titulo, provincia, localidad, fecha, pdf_url })
      .select("id, titulo, provincia, localidad, fecha, pdf_url")
      .single();

    if (insertError) throw insertError;

    await supabase.from("admin_upload_events").insert({
      titulo,
      provincia,
      localidad,
      pdf_url,
      uploaded_by: "edge_admin",
      user_agent: req.headers.get("user-agent"),
    });

    return Response.json({ report, pdf_url }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
