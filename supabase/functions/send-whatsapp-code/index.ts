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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function rateLimitedResponse(retryAfter: number, headers: HeadersInit) {
  return Response.json(
    { error: "rate_limited", message: "Demasiadas solicitudes. Intenta de nuevo mas tarde." },
    { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } },
  );
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeWhatsappPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function buildWhatsappPayload(to: string, code: string) {
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
  const templateLanguage = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "es_AR";

  if (templateName) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: code }],
          },
        ],
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: `Tu codigo de Consultora Diagonales es ${code}.`,
    },
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return Response.json({ error: "method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();
    const visitorId = String(body.visitor_id || "").trim();

    if (!phone || !visitorId) {
      return Response.json({ error: "phone and visitor_id are required" }, { status: 400, headers: corsHeaders });
    }

    const to = normalizeWhatsappPhone(phone);
    if (to.length < 10) {
      return Response.json({ error: "invalid WhatsApp phone" }, { status: 400, headers: corsHeaders });
    }

    const ipLimit = checkRateLimit(`send-wa:ip:${clientIp(req)}`, 10, 60 * 60 * 1000);
    if (!ipLimit.ok) return rateLimitedResponse(ipLimit.retryAfter, corsHeaders);
    const phoneLimit = checkRateLimit(`send-wa:phone:${to}`, 3, 10 * 60 * 1000);
    if (!phoneLimit.ok) return rateLimitedResponse(phoneLimit.retryAfter, corsHeaders);

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!token || !phoneNumberId) {
      return Response.json({ error: "WhatsApp secrets are not configured" }, { status: 500, headers: corsHeaders });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const pepper = Deno.env.get("WHATSAPP_CODE_PEPPER") || "";
    const codeHash = await sha256(`${code}:${to}:${pepper}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data, error } = await supabase
      .from("whatsapp_verifications")
      .insert({
        visitor_id: visitorId,
        phone: to,
        code_hash: codeHash,
        channel: "whatsapp",
        purpose: body.purpose || "pdf_download",
        status: "pending",
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .select("id, expires_at")
      .single();

    if (error) throw error;

    const graphVersion = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";
    const whatsappResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildWhatsappPayload(to, code)),
    });

    if (!whatsappResponse.ok) {
      await supabase.from("whatsapp_verifications").update({ status: "failed" }).eq("id", data.id);
      await whatsappResponse.text();
      throw new Error("WhatsApp API error");
    }

    await supabase.from("contactos").upsert(
      {
        visitor_id: visitorId,
        phone: to,
        email: body.email || null,
        full_name: body.full_name || null,
        access_reason: body.purpose || "pdf_download",
        phone_validation_status: "pending",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "visitor_id" },
    );

    return Response.json({ verification_id: data.id, sent: true, expires_at: data.expires_at }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
