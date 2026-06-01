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

function getReportFileKind(file: File) {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return { kind: "pdf", contentType: "application/pdf" };
  }
  if (file.type === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) {
    return { kind: "html", contentType: "text/html; charset=utf-8" };
  }
  return null;
}

async function uploadReportFile(supabase: Awaited<ReturnType<typeof getSupabaseClient>>, file: File, fecha: string) {
  const fileKind = getReportFileKind(file);
  if (!fileKind) throw new Error("archivo PDF o HTML requerido");

  const cleanName = slugifyFileName(file.name || `radiografia.${fileKind.kind}`);
  const path = `${fecha}/${crypto.randomUUID()}-${cleanName}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("radiografias")
    .upload(path, bytes, { cacheControl: "3600", contentType: fileKind.contentType, upsert: false });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from("radiografias").getPublicUrl(path);
  return { public_url: publicData.publicUrl, storage_path: path, ...fileKind };
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
      const url = new URL(req.url);
      const id = String(body.id || url.searchParams.get("id") || "").trim();
      if (!id) {
        return Response.json({ error: "id requerido" }, { status: 400, headers: corsHeaders });
      }

      const { data: current, error: currentError } = await supabase
        .from("radiografias")
        .select("id, titulo, provincia, localidad, pdf_url, storage_path, file_name")
        .eq("id", id)
        .single();

      if (currentError) throw currentError;

      const { error: deleteError } = await supabase.from("radiografias").delete().eq("id", id);
      if (deleteError) throw deleteError;

      const storagePath = current?.storage_path || getStoragePathFromPublicUrl(current?.pdf_url);
      if (storagePath) {
        await supabase.storage.from("radiografias").remove([storagePath]);
      }

      await supabase.from("admin_upload_events").insert({
        titulo: current?.titulo,
        provincia: current?.provincia,
        localidad: current?.localidad,
        pdf_url: current?.pdf_url,
        radiografia_id: current?.id,
        action: "delete",
        storage_path: storagePath,
        file_name: current?.file_name,
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
    const hasReportFile = file instanceof File && file.size > 0;
    const fileKind = hasReportFile ? getReportFileKind(file as File) : null;
    const reportFile = fileKind ? file as File : null;

    if (!titulo || !provincia || !fecha) {
      return Response.json({ error: "titulo, provincia y fecha son requeridos" }, { status: 400, headers: corsHeaders });
    }

    if (req.method === "POST") {
      if (!reportFile || !fileKind) {
        return Response.json({ error: "archivo PDF o HTML requerido" }, { status: 400, headers: corsHeaders });
      }

      const uploaded = await uploadReportFile(supabase, reportFile, fecha);
      const pdf_url = uploaded.kind === "pdf" ? uploaded.public_url : null;
      const html_url = uploaded.kind === "html" ? uploaded.public_url : null;
      const { data: report, error: insertError } = await supabase
        .from("radiografias")
        .insert({
          titulo,
          provincia,
          localidad,
          fecha,
          html_url,
          pdf_url,
          storage_path: uploaded.storage_path,
          file_name: reportFile.name,
          file_size: reportFile.size,
          mime_type: uploaded.contentType,
        })
        .select("id, titulo, provincia, localidad, fecha, html_url, pdf_url, storage_path, file_name, file_size, mime_type")
        .single();

      if (insertError) throw insertError;

      await supabase.from("admin_upload_events").insert({
        titulo,
        provincia,
        localidad,
        pdf_url,
        radiografia_id: report.id,
        action: "create",
        storage_path: uploaded.storage_path,
        file_name: reportFile.name,
        uploaded_by: "edge_admin",
        user_agent: req.headers.get("user-agent"),
      });

      return Response.json({ report, html_url, pdf_url }, { headers: corsHeaders });
    }

    if (!id) {
      return Response.json({ error: "id requerido" }, { status: 400, headers: corsHeaders });
    }

    if (hasReportFile && !fileKind) {
      return Response.json({ error: "archivo PDF o HTML requerido" }, { status: 400, headers: corsHeaders });
    }

    const { data: current, error: currentError } = await supabase
      .from("radiografias")
      .select("id, html_url, pdf_url, storage_path")
      .eq("id", id)
      .single();

    if (currentError) throw currentError;

    let html_url = current?.html_url || null;
    let pdf_url = current?.pdf_url || null;
    let storage_path = current?.storage_path || null;
    let file_name: string | undefined;
    let file_size: number | undefined;
    let mime_type: string | undefined;
    let oldStoragePath: string | null = null;
    if (reportFile && fileKind) {
      oldStoragePath = storage_path || getStoragePathFromPublicUrl(pdf_url || html_url);
      const uploaded = await uploadReportFile(supabase, reportFile, fecha);
      html_url = uploaded.kind === "html" ? uploaded.public_url : null;
      pdf_url = uploaded.kind === "pdf" ? uploaded.public_url : null;
      storage_path = uploaded.storage_path;
      file_name = reportFile.name;
      file_size = reportFile.size;
      mime_type = uploaded.contentType;
    }

    const updatePayload: Record<string, unknown> = { titulo, provincia, localidad, fecha, html_url, pdf_url, storage_path };
    if (reportFile && fileKind) {
      updatePayload.file_name = file_name;
      updatePayload.file_size = file_size;
      updatePayload.mime_type = mime_type;
    }

    const { data: report, error: updateError } = await supabase
      .from("radiografias")
      .update(updatePayload)
      .eq("id", id)
      .select("id, titulo, provincia, localidad, fecha, html_url, pdf_url, storage_path, file_name, file_size, mime_type")
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
      radiografia_id: id,
      action: reportFile ? "update_with_file" : "update_metadata",
      storage_path,
      file_name: file_name || report.file_name,
      uploaded_by: "edge_admin_update",
      user_agent: req.headers.get("user-agent"),
    });

    return Response.json({ report, html_url, pdf_url }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
