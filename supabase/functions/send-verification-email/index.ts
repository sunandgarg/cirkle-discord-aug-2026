import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Mask a phone number: show first 1 digit, last 1 digit, rest asterisks */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "***";
  return phone[0] + "*".repeat(phone.length - 2) + phone[phone.length - 1];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, iit_name, user_id } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const normalizedEmail = email.trim().toLowerCase();

    // ─── BUSINESS RULE: Check if email already verified by another user ───
    if (user_id) {
      const { data: existingVerification } = await supabase
        .from("verifications")
        .select("user_id, locked_to_phone, verified_status")
        .eq("iit_email_normalized", normalizedEmail)
        .eq("verified_status", "VERIFIED")
        .maybeSingle();

      if (existingVerification && existingVerification.user_id !== user_id) {
        const maskedPhone = maskPhone(existingVerification.locked_to_phone || "");
        return new Response(
          JSON.stringify({
            error: `This IIT email is already verified with phone ${maskedPhone}. Please log in with that number or contact support to update it.`,
            code: "EMAIL_ALREADY_LINKED",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // ─── BUSINESS RULE: Check if user already has a verified email ───
      const { data: userVerification } = await supabase
        .from("verifications")
        .select("iit_email_normalized, verified_status")
        .eq("user_id", user_id)
        .eq("verified_status", "VERIFIED")
        .maybeSingle();

      if (userVerification && userVerification.iit_email_normalized !== normalizedEmail) {
        return new Response(
          JSON.stringify({
            error: `Your account is already verified with ${userVerification.iit_email_normalized}. To change your verified email, please contact support.`,
            code: "USER_ALREADY_VERIFIED",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // If already verified with the SAME email, just return success
      if (userVerification && userVerification.iit_email_normalized === normalizedEmail) {
        return new Response(
          JSON.stringify({ success: true, message: "Already verified", already_verified: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check for test mode
    const { data: testModeSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "verification_test_mode")
      .maybeSingle();

    const isTestMode = testModeSetting?.value === "true";

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Store code in database
    const { error: insertError } = await supabase.from("verification_codes").insert({
      email: normalizedEmail,
      code,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to generate code" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // In test mode, skip actual email sending
    if (isTestMode) {
      console.log(`[TEST MODE] Code for ${normalizedEmail}: ${code}`);
      return new Response(
        JSON.stringify({ success: true, message: "Code sent (test mode)", test_code: code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verification code for ${normalizedEmail}: ${code} (IIT: ${iit_name})`);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent to your email" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
