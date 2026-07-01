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
    "Access-Control-Allow-Methods": "POST, PATCH, DELETE, OPTIONS",
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

function cleanLegacyPrivateMarker(value: string) {
  return String(value || "")
    .replaceAll("[[CD_PRIVATE]]", "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isMissingColumnError(error: unknown, column: string) {
  const message = String((error as { message?: unknown } | null)?.message || "");
  const code = String((error as { code?: unknown } | null)?.code || "");
  return code === "42703" || (message.includes(column) && message.includes("does not exist"));
}

async function hasPrivateColumn(supabase: Awaited<ReturnType<typeof getSupabaseClient>>) {
  const { error } = await supabase.from("radiografias").select("is_private").limit(1);
  if (isMissingColumnError(error, "is_private")) return false;
  if (error) throw error;
  return true;
}

function reportSelect(includePrivacy: boolean) {
  const columns = "id, titulo, provincia, localidad, fecha, html_url, pdf_url, storage_path, file_name, file_size, mime_type";
  return includePrivacy ? `${columns}, is_private` : columns;
}

async function getSupabaseClient() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
}

async function sanitizePdfMetadata(bytes: ArrayBuffer, title: string) {
  const { PDFDocument } = await import("https://esm.sh/pdf-lib@1.17.1");
  const pdf = await PDFDocument.load(bytes, {
    updateMetadata: false,
    ignoreEncryption: true,
  });

  pdf.setTitle(title || "Radiografia Consultora Diagonales");
  pdf.setAuthor("Consultora Diagonales");
  pdf.setSubject("");
  pdf.setKeywords([]);
  pdf.setCreator("Consultora Diagonales");
  pdf.setProducer("Consultora Diagonales");
  pdf.setCreationDate(new Date(0));
  pdf.setModificationDate(new Date(0));

  return await pdf.save({
    useObjectStreams: false,
    addDefaultPage: false,
  });
}

function sanitizeHtmlBytes(bytes: ArrayBuffer) {
  const source = new Uint8Array(bytes);
  let html = "";
  try {
    html = new TextDecoder("utf-8", { fatal: true }).decode(source);
  } catch (_) {
    html = new TextDecoder("windows-1252").decode(source);
  }

  if (/<meta[^>]+charset=/i.test(html)) {
    html = html.replace(/<meta[^>]+charset=["']?[^"'>\s]+["']?[^>]*>/i, '<meta charset="UTF-8">');
  } else if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (match) => `${match}\n    <meta charset="UTF-8">`);
  } else {
    html = `<!doctype html><html lang="es"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  }

  return new TextEncoder().encode(html);
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

async function uploadReportFile(supabase: Awaited<ReturnType<typeof getSupabaseClient>>, file: File, fecha: string, titulo: string) {
  const fileKind = getReportFileKind(file);
  if (!fileKind) throw new Error("archivo PDF o HTML requerido");

  const cleanName = slugifyFileName(file.name || `radiografia.${fileKind.kind}`);
  const path = `${fecha}/${crypto.randomUUID()}-${cleanName}`;
  const originalBytes = await file.arrayBuffer();
  const bytes = fileKind.kind === "pdf"
    ? await sanitizePdfMetadata(originalBytes, titulo)
    : sanitizeHtmlBytes(originalBytes);

  const { error: uploadError } = await supabase.storage
    .from("radiografias")
    .upload(path, bytes, { cacheControl: "3600", contentType: fileKind.contentType, upsert: false });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from("radiografias").getPublicUrl(path);
  return { public_url: publicData.publicUrl, storage_path: path, ...fileKind };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
      return Response.json({ error: "method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const adminKey = req.headers.get("x-admin-key") || "";
    const adminLimit = checkRateLimit(`admin-upload:${clientIp(req)}:${adminKey.slice(0, 8)}`, 10, 60 * 1000);
    if (!adminLimit.ok) {
      return Response.json(
        { error: "rate_limited", message: "Demasiadas operaciones administrativas." },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(adminLimit.retryAfter) } },
      );
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
    const provincia = cleanLegacyPrivateMarker(String(formData.get("provincia") || "").trim());
    const localidad = cleanLegacyPrivateMarker(String(formData.get("localidad") || "").trim());
    const fecha = String(formData.get("fecha") || "").trim();
    const rawIsPrivate = formData.get("is_private");
    const hasPrivacyUpdate = rawIsPrivate !== null;
    const isPrivate = ["true", "1", "si", "sí", "yes"].includes(String(rawIsPrivate || "").trim().toLowerCase());
    const hasReportFile = file instanceof File && file.size > 0;
    const fileKind = hasReportFile ? getReportFileKind(file as File) : null;
    const reportFile = fileKind ? file as File : null;
    const privateColumnExists = await hasPrivateColumn(supabase);

    if (isPrivate && !privateColumnExists) {
      return Response.json(
        { error: "La base de datos todavia no tiene la columna is_private. Ejecuta la migracion antes de marcar radiografias privadas." },
        { status: 409, headers: corsHeaders },
      );
    }

    if (req.method === "PATCH" && id && hasPrivacyUpdate && !titulo && !provincia && !fecha && !hasReportFile) {
      if (!privateColumnExists) {
        const { data: current, error: currentError } = await supabase
          .from("radiografias")
          .select(reportSelect(false))
          .eq("id", id)
          .single();

        if (currentError) throw currentError;

        const { data: report, error: updateError } = await supabase
          .from("radiografias")
          .update({
            provincia: cleanLegacyPrivateMarker(current?.provincia || ""),
            localidad: cleanLegacyPrivateMarker(current?.localidad || ""),
          })
          .eq("id", id)
          .select(reportSelect(false))
          .single();

        if (updateError) throw updateError;

        await supabase.from("admin_upload_events").insert({
          titulo: report?.titulo || null,
          provincia: report?.provincia || null,
          localidad: report?.localidad || null,
          pdf_url: report?.pdf_url || null,
          radiografia_id: id,
          action: "mark_public",
          storage_path: report?.storage_path || null,
          file_name: report?.file_name || null,
          uploaded_by: "edge_admin",
          user_agent: req.headers.get("user-agent"),
        });

        return Response.json({ report: { ...report, is_private: false } }, { headers: corsHeaders });
      }

      const { data: report, error: updateError } = await supabase
        .from("radiografias")
        .update({ is_private: isPrivate })
        .eq("id", id)
        .select(reportSelect(true))
        .single();

      if (updateError) throw updateError;

      await supabase.from("admin_upload_events").insert({
        titulo: report?.titulo || null,
        provincia: report?.provincia || null,
        localidad: report?.localidad || null,
        pdf_url: report?.pdf_url || null,
        radiografia_id: id,
        action: isPrivate ? "mark_private" : "mark_public",
        storage_path: report?.storage_path || null,
        file_name: report?.file_name || null,
        uploaded_by: "edge_admin",
        user_agent: req.headers.get("user-agent"),
      });

      return Response.json({ report }, { headers: corsHeaders });
    }

    if (!titulo || !provincia || !fecha) {
      return Response.json({ error: "titulo, provincia y fecha son requeridos" }, { status: 400, headers: corsHeaders });
    }

    if (req.method === "POST") {
      if (!reportFile || !fileKind) {
        return Response.json({ error: "archivo PDF o HTML requerido" }, { status: 400, headers: corsHeaders });
      }

      const uploaded = await uploadReportFile(supabase, reportFile, fecha, titulo);
      const pdf_url = uploaded.kind === "pdf" ? uploaded.public_url : null;
      const html_url = uploaded.kind === "html" ? uploaded.public_url : null;
      const insertPayload: Record<string, unknown> = {
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
      };
      if (privateColumnExists) insertPayload.is_private = isPrivate;

      const { data: report, error: insertError } = await supabase
        .from("radiografias")
        .insert(insertPayload)
        .select(reportSelect(privateColumnExists))
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

      return Response.json({ report: privateColumnExists ? report : { ...report, is_private: false }, html_url, pdf_url }, { headers: corsHeaders });
    }

    if (!id) {
      return Response.json({ error: "id requerido" }, { status: 400, headers: corsHeaders });
    }

    if (hasReportFile && !fileKind) {
      return Response.json({ error: "archivo PDF o HTML requerido" }, { status: 400, headers: corsHeaders });
    }

    const { data: current, error: currentError } = await supabase
      .from("radiografias")
      .select("id, html_url, pdf_url, storage_path, mime_type")
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
      const currentKind = String(current?.mime_type || "").includes("html") ? "html" : String(current?.mime_type || "").includes("pdf") ? "pdf" : null;
      oldStoragePath = currentKind === fileKind.kind ? storage_path || getStoragePathFromPublicUrl(fileKind.kind === "pdf" ? pdf_url : html_url) : null;
      const uploaded = await uploadReportFile(supabase, reportFile, fecha, titulo);
      if (uploaded.kind === "html") html_url = uploaded.public_url;
      if (uploaded.kind === "pdf") pdf_url = uploaded.public_url;
      storage_path = uploaded.storage_path;
      file_name = reportFile.name;
      file_size = reportFile.size;
      mime_type = uploaded.contentType;
    }

    const updatePayload: Record<string, unknown> = { titulo, provincia, localidad, fecha, html_url, pdf_url, storage_path };
    if (hasPrivacyUpdate && privateColumnExists) updatePayload.is_private = isPrivate;
    if (reportFile && fileKind) {
      updatePayload.file_name = file_name;
      updatePayload.file_size = file_size;
      updatePayload.mime_type = mime_type;
    }

    const { data: report, error: updateError } = await supabase
      .from("radiografias")
      .update(updatePayload)
      .eq("id", id)
      .select(reportSelect(privateColumnExists))
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

    return Response.json({ report: privateColumnExists ? report : { ...report, is_private: false }, html_url, pdf_url }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
