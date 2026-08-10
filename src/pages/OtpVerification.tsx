import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const SUPER_ADMIN_PHONE = "8700602524";

const OtpVerification = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const phone = (location.state as any)?.phone || "";
  const countryCode = (location.state as any)?.countryCode || "+91";

  // Once auth state propagates, route based on verification/onboarding status
  useEffect(() => {
    if (!authComplete || !user) return;
    // If profile not loaded yet, wait for it
    if (profile === undefined) return;
    if (!profile?.is_verified) {
      navigate("/iit-verify", { replace: true });
    } else if (!profile?.onboarding_completed) {
      // AppLayout will render the onboarding wizard
      navigate("/cirkle-forum", { replace: true });
    } else {
      navigate("/cirkle-forum", { replace: true });
    }
  }, [authComplete, user, profile, navigate]);

  // Fetch test mode setting
  const { data: testMode } = useQuery({
    queryKey: ["app-setting-test-mode"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "test_mode").maybeSingle();
      return data?.value === "true";
    },
    staleTime: 60000,
  });

  const TEST_OTP = "123456";
  const isTestMode = testMode !== false; // default true

  if (!phone) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <ShieldCheck className="w-16 h-16 text-primary mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Session Expired</h1>
        <p className="text-sm text-muted-foreground mb-6 text-center">Please go back and enter your phone number again.</p>
        <Button onClick={() => navigate("/auth")} className="rounded-xl">Go to Login</Button>
      </div>
    );
  }

  const handleVerify = async () => {
    if (otp.length !== 6) { toast.error("Please enter the full 6-digit OTP"); return; }

    if (!isTestMode) {
      // Production guard: hardcoded-password auth path is dev-only.
      toast.error("SMS verification is not available right now. Please try again later.");
      return;
    }
    if (otp !== TEST_OTP) { toast.error("Invalid OTP. Use test code: 123456"); return; }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const isSuperAdmin = cleanPhone === SUPER_ADMIN_PHONE;
      const email = isSuperAdmin ? "admin@cirkle.world" : `${cleanPhone}@cirkle.world`;
      const password = isSuperAdmin ? "admin123456" : `cirkle_${cleanPhone}_secure`;
      const displayName = isSuperAdmin ? "SUNAND GARG" : `User ${cleanPhone.slice(-4)}`;

      // Try login first
      let session = null;
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        // Sign up
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { name: displayName, phone: cleanPhone } },
        });
        if (signUpError) throw signUpError;
        
        if (!signUpData.session) {
          // Try login again after signup
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({ email, password });
          if (retryError) throw retryError;
          session = retryData.session;
        } else {
          session = signUpData.session;
        }
      } else {
        session = loginData.session;
      }

      // Ensure the phone number is always present on the account metadata
      if (!(session?.user?.user_metadata as any)?.phone) {
        await supabase.auth.updateUser({ data: { phone: cleanPhone, phone_country_code: countryCode, phone_full: `${countryCode}${cleanPhone}` } });
      }

      // If super admin, use ensure_super_admin RPC (non-blocking, runs with service role)
      if (isSuperAdmin && session?.user?.id) {
        supabase.rpc("ensure_super_admin", { p_user_id: session.user.id }).then(() => {});
      }


      toast.success("Verified successfully!");
      // Don't navigate directly - set flag and let useEffect handle it
      // once auth state propagates
      setAuthComplete(true);
    } catch (err: any) {
      console.error("Auth error:", err);
      toast.error(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-6 pt-12 pb-4">
        <button onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
          <ShieldCheck className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground text-center">Verify OTP</h1>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Enter the 6-digit code sent to <span className="text-foreground font-medium">{countryCode} {phone}</span>
        </p>
        {isTestMode && (
          <div className="mt-6 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 w-full max-w-xs text-center">
            <p className="text-xs text-primary font-semibold">🧪 TEST MODE</p>
            <p className="text-2xl font-mono font-bold text-foreground tracking-[0.5em] mt-1">{TEST_OTP}</p>
          </div>
        )}
        <div className="mt-8">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot key={index} index={index} className="w-12 h-14 text-lg font-bold text-foreground bg-secondary border-border rounded-xl" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button size="lg" className="w-full max-w-xs h-12 text-base font-semibold rounded-xl mt-8" onClick={handleVerify} disabled={loading || otp.length !== 6}>
          {loading ? "Verifying..." : "Verify & Continue"}
        </Button>
        <button className="text-sm text-primary mt-4 hover:underline">Resend OTP</button>
      </div>
    </div>
  );
};

export default OtpVerification;
