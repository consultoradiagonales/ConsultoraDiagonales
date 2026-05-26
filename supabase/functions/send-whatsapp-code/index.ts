const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (token && phoneNumberId) {
      const whatsappResponse = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace(/\D/g, ""),
          type: "text",
          text: {
            body: `Tu código de Consultora Diagonales es ${code}.`,
          },
        }),
      });

      if (!whatsappResponse.ok) {
        const message = await whatsappResponse.text();
        throw new Error(`WhatsApp API error: ${message}`);
      }
    }

    return Response.json({ verification_id: data.id, sent: Boolean(token && phoneNumberId) }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
