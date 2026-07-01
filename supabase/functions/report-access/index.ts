const allowedOrigins = new Set([
  "https://consultoradiagonales.com.ar",
  "https://www.consultoradiagonales.com.ar",
  "https://consultoradiagonales.github.io",
]);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://consultoradiagonales.com.ar",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

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

function isPrivateReport(report: Record<string, unknown> | null) {
  return report?.is_private === true || String(report?.is_private || "").toLowerCase() === "true";
}

function getStoragePathFromPublicUrl(value: unknown) {
  const url = String(value || "");
  const marker = "/storage/v1/object/public/radiografias/";
  const index = url.indexOf(marker);
  if (index === -1) return "";
  return decodeURIComponent(url.slice(index + marker.length));
}

function pickStoragePath(report: Record<string, unknown>, target: string) {
  if (target === "html") return getStoragePathFromPublicUrl(report.html_url);
  if (target === "pdf") return getStoragePathFromPublicUrl(report.pdf_url);
  return "";
}

async function hasRegisteredAccess(supabase: any, visitorId: string) {
  if (!visitorId) return false;
  const { data, error } = await supabase
    .from("contactos")
    .select("visitor_id, phone, phone_validation_status, consent_terms")
    .eq("visitor_id", visitorId)
    .not("phone", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.phone) return false;
  const status = String(data.phone_validation_status || "").toLowerCase();
  return Boolean(data.consent_terms) && ["phone_verified", "gmail_verified", "gmail_pending", "pending"].includes(status);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "GET") {
      return Response.json({ error: "method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const reportId = String(url.searchParams.get("report") || url.searchParams.get("id") || "").trim();
    const target = String(url.searchParams.get("target") || "pdf").trim().toLowerCase();
    const visitorId = String(url.searchParams.get("visitor_id") || "").trim();
    if (!reportId || !["pdf", "html"].includes(target)) {
      return Response.json({ error: "report y target son requeridos" }, { status: 400, headers: corsHeaders });
    }

    const limit = checkRateLimit(`report-access:${clientIp(req)}:${reportId}:${target}`, 60, 60 * 1000);
    if (!limit.ok) {
      return Response.json(
        { error: "rate_limited", message: "Demasiados intentos de apertura." },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(limit.retryAfter) } },
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data: report, error: reportError } = await supabase
      .from("radiografias")
      .select("id, titulo, is_private, pdf_url, html_url, storage_path")
      .eq("id", reportId)
      .maybeSingle();

    if (reportError) throw reportError;
    if (!report) return Response.json({ error: "radiografia no encontrada" }, { status: 404, headers: corsHeaders });

    if (isPrivateReport(report) && !(await hasRegisteredAccess(supabase, visitorId))) {
      return Response.json({ error: "registration_required" }, { status: 403, headers: corsHeaders });
    }

    const storagePath = pickStoragePath(report, target);
    if (!storagePath) {
      return Response.json({ error: "archivo no disponible" }, { status: 404, headers: corsHeaders });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from("radiografias")
      .createSignedUrl(storagePath, 90);

    if (signedError) throw signedError;
    return Response.redirect(signed.signedUrl, 302);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
