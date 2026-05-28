const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const body = await req.json();
    const phone = String(body.phone || "").trim();
    const visitorId = String(body.visitor_id || "").trim();

    if (!phone || !visitorId) {
      return Response.json({ error: "phone and visitor_id are required" }, { status: 400, headers: corsHeaders });
    }

    const to = normalizeWhatsappPhone(phone);
    if (to.length < 10) {
      return Response.json({ error: "invalid WhatsApp phone" }, { status: 400, headers: corsHeaders });
    }

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!token || !phoneNumberId) {
      return Response.json({ error: "WhatsApp secrets are not configured" }, { status: 500, headers: corsHeaders });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const pepper = Deno.env.get("WHATSAPP_CODE_PEPPER") || "";
    const codeHash = await sha256(`${code}:${phone}:${pepper}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data, error } = await supabase
      .from("whatsapp_verifications")
      .insert({
        visitor_id: visitorId,
        phone,
        code_hash: codeHash,
        channel: "whatsapp",
        purpose: body.purpose || "pdf_download",
        status: "pending",
        sent_at: new Date().toISOString(),
      })
      .select("id")
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
      const message = await whatsappResponse.text();
      throw new Error(`WhatsApp API error: ${message}`);
    }

    return Response.json({ verification_id: data.id, sent: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
