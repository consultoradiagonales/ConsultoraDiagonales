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
    const code = String(body.code || "").trim();
    const verificationId = String(body.verification_id || "").trim();

    if (!phone || !code || !verificationId) {
      return Response.json({ verified: false, error: "phone, code and verification_id are required" }, { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data, error } = await supabase
      .from("whatsapp_verifications")
      .select("id, phone, code_hash, expires_at, attempts, status")
      .eq("id", verificationId)
      .eq("phone", phone)
      .single();

    if (error || !data) return Response.json({ verified: false }, { headers: corsHeaders });

    const expired = new Date(data.expires_at).getTime() < Date.now();
    const locked = data.attempts >= 5 || data.status === "verified";
    const pepper = Deno.env.get("WHATSAPP_CODE_PEPPER") || "";
    const codeHash = await sha256(`${code}:${phone}:${pepper}`);
    const verified = !expired && !locked && codeHash === data.code_hash;

    await supabase
      .from("whatsapp_verifications")
      .update({
        attempts: data.attempts + 1,
        status: verified ? "verified" : expired ? "expired" : "pending",
        verified_at: verified ? new Date().toISOString() : null,
      })
      .eq("id", verificationId);

    return Response.json({ verified }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ verified: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});
