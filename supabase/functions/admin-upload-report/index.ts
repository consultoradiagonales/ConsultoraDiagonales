const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, PATCH, DELETE, OPTIONS",
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

function getStoragePathFromPublicUrl(pdfUrl?: string | null) {
  if (!pdfUrl) return null;
  const marker = "/storage/v1/object/public/radiografias/";
  const index = pdfUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(pdfUrl.slice(index + marker.length));
}

async function getSupabaseClient() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
}

function requireAdmin(req: Request) {
  const expectedAdminKey = Deno.env.get("ADMIN_UPLOAD_KEY") || "";
  const providedAdminKey = req.headers.get("x-admin-key") || "";
  return Boolean(expectedAdminKey && providedAdminKey === expectedAdminKey);
}

async function uploadPdf(supabase: Awaited<ReturnType<typeof getSupabaseClient>>, file: File, fecha: string) {
  const cleanName = slugifyFileName(file.name || "radiografia.pdf");
  const path = `${fecha}/${crypto.randomUUID()}-${cleanName}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("radiografias")
    .upload(path, bytes, { cacheControl: "3600", contentType: "application/pdf", upsert: false });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from("radiografias").getPublicUrl(path);
  return { pdf_url: publicData.publicUrl, path };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
      return Response.json({ error: "method not allowed" }, { status: 405, headers: corsHeaders });
    }

    if (!requireAdmin(req)) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabase = await getSupabaseClient();

    if (req.method === "DELETE") {
      const body = await req.json().catch(() => ({}));
      const id = String(body.id || "").trim();
      if (!id) {
        return Response.json({ error: "id requerido" }, { status: 400, headers: corsHeaders });
      }

      const { data: current, error: currentError } = await supabase
        .from("radiografias")
        .select("id, titulo, provincia, localidad, pdf_url")
        .eq("id", id)
        .single();

      if (currentError) throw currentError;

      const { error: deleteError } = await supabase.from("radiografias").delete().eq("id", id);
      if (deleteError) throw deleteError;

      const storagePath = getStoragePathFromPublicUrl(current?.pdf_url);
      if (storagePath) {
        await supabase.storage.from("radiografias").remove([storagePath]);
      }

      await supabase.from("admin_upload_events").insert({
        titulo: current?.titulo,
        provincia: current?.provincia,
        localidad: current?.localidad,
        pdf_url: current?.pdf_url,
        uploaded_by: "edge_admin_delete",
        user_agent: req.headers.get("user-agent"),
      });

      return Response.json({ ok: true, id }, { headers: corsHeaders });
    }

    const formData = await req.formData();
    const id = String(formData.get("id") || "").trim();
    const file = formData.get("archivo");
    const titulo = String(formData.get("titulo") || "").trim();
    const provincia = String(formData.get("provincia") || "").trim();
    const localidad = String(formData.get("localidad") || "").trim();
    const fecha = String(formData.get("fecha") || "").trim();
    const hasPdf = file instanceof File && file.size > 0;
    const isPdf = hasPdf && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));

    if (!titulo || !provincia || !fecha) {
      return Response.json({ error: "titulo, provincia y fecha son requeridos" }, { status: 400, headers: corsHeaders });
    }

    if (req.method === "POST") {
      if (!isPdf) {
        return Response.json({ error: "archivo PDF requerido" }, { status: 400, headers: corsHeaders });
      }

      const { pdf_url } = await uploadPdf(supabase, file, fecha);
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
    }

    if (!id) {
      return Response.json({ error: "id requerido" }, { status: 400, headers: corsHeaders });
    }

    if (hasPdf && !isPdf) {
      return Response.json({ error: "archivo PDF requerido" }, { status: 400, headers: corsHeaders });
    }

    const { data: current, error: currentError } = await supabase
      .from("radiografias")
      .select("id, pdf_url")
      .eq("id", id)
      .single();

    if (currentError) throw currentError;

    let pdf_url = current?.pdf_url || null;
    let oldStoragePath: string | null = null;
    if (isPdf) {
      oldStoragePath = getStoragePathFromPublicUrl(pdf_url);
      const uploaded = await uploadPdf(supabase, file, fecha);
      pdf_url = uploaded.pdf_url;
    }

    const { data: report, error: updateError } = await supabase
      .from("radiografias")
      .update({ titulo, provincia, localidad, fecha, pdf_url })
      .eq("id", id)
      .select("id, titulo, provincia, localidad, fecha, pdf_url")
      .single();

    if (updateError) throw updateError;

    if (oldStoragePath) {
      await supabase.storage.from("radiografias").remove([oldStoragePath]);
    }

    await supabase.from("admin_upload_events").insert({
      titulo,
      provincia,
      localidad,
      pdf_url,
      uploaded_by: "edge_admin_update",
      user_agent: req.headers.get("user-agent"),
    });

    return Response.json({ report, pdf_url }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
