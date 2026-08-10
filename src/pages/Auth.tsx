import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CountryCodeSelect, { COUNTRY_CODES, type CountryOption } from "@/components/CountryCodeSelect";


const isValidPhone = (code: string, digits: string) =>
  code === "+91" ? digits.length === 10 : digits.length >= 6 && digits.length <= 15;

const Auth = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [country, setCountry] = useState<CountryOption>(COUNTRY_CODES[0]);
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  // Redirect already-logged-in users
  useEffect(() => {
    if (!authLoading && user) {
      if (!(user.user_metadata as any)?.phone) {
        navigate("/phone-verify", { replace: true });
      } else if (!profile?.is_verified) {
        navigate("/iit-verify", { replace: true });
      } else {
        navigate("/cirkle-forum", { replace: true });
      }
    }
  }, [user, profile?.is_verified, authLoading, navigate]);

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, "").slice(0, 15));
  };

  const handleContinue = () => {
    if (!isValidPhone(country.code, phone)) {
      toast.error(country.code === "+91" ? "Please enter a valid 10-digit mobile number" : "Please enter a valid mobile number");
      return;
    }
    navigate("/otp-verify", { state: { phone, countryCode: country.code } });
  };


  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error("Google sign-in failed");
      console.error(error);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Avatar grid background - dark image only */}
      <div className="flex-1 relative overflow-hidden min-h-0 bg-[hsl(216_28%_5%)]">
        <div className="grid grid-cols-4 gap-1 p-1 opacity-60">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg"
              style={{
                backgroundImage: `url(https://i.pravatar.cc/150?img=${i + 1})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "grayscale(100%) blur(1px) brightness(0.35) contrast(1.2)",
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-transparent" />
      </div>

      {/* Login form */}
      <div className="relative z-10 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 -mt-16 flex-shrink-0">
        <h1 className="text-3xl font-bold text-foreground">Welcome</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Sign up or login to your account</p>

        <div className="flex items-center gap-2 mb-4">
          {/* Country code selector (supports custom "Other" codes) */}
          <CountryCodeSelect value={country} onChange={setCountry} />
          <Input
            type="tel"
            inputMode="numeric"
            placeholder={country.code === "+91" ? "Enter 10-digit number" : "Enter mobile number"}
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl focus:border-primary flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            maxLength={15}
          />
        </div>

        {/* Digit count indicator */}
        <p className={`text-xs mb-2 ${isValidPhone(country.code, phone) ? "text-green-500" : "text-muted-foreground"}`}>
          {country.code === "+91" ? `${phone.length}/10 digits` : `${phone.length} digits`}
        </p>


        <Button
          size="lg"
          className="w-full h-12 text-base font-semibold rounded-xl"
          onClick={handleContinue}
          disabled={loading || phone.length !== 10}
        >
          Continue
        </Button>

        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">Or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full h-12 rounded-xl bg-secondary border border-border flex items-center justify-center gap-2 text-foreground hover:bg-accent transition-colors press-scale"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span className="text-sm font-medium">Google</span>
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By continuing, you agree to our{" "}
          <button onClick={() => setShowTerms(true)} className="underline text-muted-foreground hover:text-foreground transition-colors">T&C</button> &{" "}
          <button onClick={() => setShowPrivacy(true)} className="underline text-muted-foreground hover:text-foreground transition-colors">Privacy policy</button>
        </p>
      </div>




      {/* Terms Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Terms & Conditions</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground space-y-3">
            <p><strong>1. Acceptance of Terms</strong><br />By accessing and using Cirkle, you agree to be bound by these Terms and Conditions.</p>
            <p><strong>2. User Account</strong><br />You must provide accurate information during registration. You are responsible for maintaining the confidentiality of your account.</p>
            <p><strong>3. Community Guidelines</strong><br />Users must maintain respectful communication. Harassment, spam, and inappropriate content are strictly prohibited.</p>
            <p><strong>4. Intellectual Property</strong><br />Content posted on Cirkle remains the property of the original creator. By posting, you grant Cirkle a non-exclusive license to display your content.</p>
            <p><strong>5. Privacy</strong><br />Your data is handled in accordance with our Privacy Policy. We do not sell personal data to third parties.</p>
            <p><strong>6. Termination</strong><br />Cirkle reserves the right to terminate accounts that violate these terms without prior notice.</p>
            <p><strong>7. Limitation of Liability</strong><br />Cirkle is provided "as is" without warranties. We are not liable for any indirect damages arising from use of the platform.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Dialog */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Privacy Policy</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground space-y-3">
            <p><strong>1. Data Collection</strong><br />We collect your phone number, profile information, and usage data to provide our services.</p>
            <p><strong>2. Data Usage</strong><br />Your data is used to personalize your experience, facilitate connections, and improve our platform.</p>
            <p><strong>3. Data Sharing</strong><br />We do not sell your personal data. Information is shared only with your consent or as required by law.</p>
            <p><strong>4. Data Security</strong><br />We implement industry-standard security measures to protect your data including encryption and secure storage.</p>
            <p><strong>5. Your Rights</strong><br />You can access, update, or delete your personal data at any time through your profile settings.</p>
            <p><strong>6. Cookies</strong><br />We use cookies to enhance your browsing experience and analyze platform usage.</p>
            <p><strong>7. Contact</strong><br />For privacy-related inquiries, contact us at privacy@cirkle.world</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
