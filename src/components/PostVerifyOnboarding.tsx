import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, ArrowLeft, User, GraduationCap, Briefcase, Sparkles } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { locations } from "@/data/locationsList";
import { companies } from "@/data/companiesList";
import { COURSE_SPECIALISATIONS, ALL_COURSES, getSpecialisations } from "@/data/courseSpecialisations";

const YEARS = Array.from({ length: 56 }, (_, i) => String(2035 - i));

type Step = "name" | "degree" | "specialisation" | "year" | "optional" | "done";
const STEP_ORDER: Step[] = ["name", "degree", "specialisation", "year", "optional"];

interface PostVerifyOnboardingProps {
  derivedIit?: string;
  onComplete: () => void;
}

const PostVerifyOnboarding = ({ derivedIit, onComplete }: PostVerifyOnboardingProps) => {
  const { user, profile, refetchProfile } = useAuth();
  const [step, setStep] = useState<Step>("name");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(profile?.name || "");
  const iit = derivedIit || profile?.iit_name || "";
  const [degree, setDegree] = useState("");
  const [specialisation, setSpecialisation] = useState("");
  const [year, setYear] = useState("");
  const [location, setLocation] = useState(profile?.location || "");
  const [linkedin, setLinkedin] = useState("");
  const [company, setCompany] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsText, setTermsText] = useState("I agree to the Cirkle Terms of Service and Privacy Policy.");

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "terms_text").maybeSingle()
      .then(({ data }) => { if (data?.value) setTermsText(data.value); });
  }, []);

  const stepIdx = STEP_ORDER.indexOf(step as any);
  const totalSteps = STEP_ORDER.length;

  const specialisations = useMemo(() => getSpecialisations(degree), [degree]);

  useEffect(() => {
    if (profile?.name && step === "name") {
      setName(profile.name);
    }
  }, [profile]);

  // Reset specialisation when degree changes
  useEffect(() => {
    setSpecialisation("");
  }, [degree]);

  const canProceed = () => {
    switch (step) {
      case "name": return name.trim().length >= 2;
      case "degree": return !!degree;
      case "specialisation": return !!specialisation;
      case "year": return !!year;
      case "optional": return acceptedTerms;
      default: return true;
    }
  };

  const handleNext = () => {
    if (stepIdx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[stepIdx + 1]);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (stepIdx > 0) setStep(STEP_ORDER[stepIdx - 1]);
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Education first - so we have an ID for primary_education_id
      let primaryEduId: string | null = null;
      const { data: existingEdu } = await supabase
        .from("education")
        .select("id")
        .eq("user_id", user.id)
        .eq("institution", iit)
        .maybeSingle();

      if (existingEdu) {
        await supabase.from("education").update({
          degree, branch_area: specialisation, passing_year: year,
        }).eq("id", existingEdu.id);
        primaryEduId = existingEdu.id;
      } else {
        const { data: newEdu, error: eduErr } = await supabase.from("education").insert({
          user_id: user.id, institution: iit, degree, branch_area: specialisation, passing_year: year,
        }).select("id").single();
        if (eduErr) throw eduErr;
        primaryEduId = newEdu?.id ?? null;
      }

      // 2. Profile update - single atomic write including primary_education_id and linkedin
      const socialLinks: Record<string, string> = {};
      if (linkedin.trim()) socialLinks.linkedin = linkedin.trim();

      const profileUpdate: any = {
        name: name.trim(),
        iit_name: iit,
        is_verified: true,
        location: location || null,
        onboarding_completed: true,
      };
      if (primaryEduId) profileUpdate.primary_education_id = primaryEduId;
      if (Object.keys(socialLinks).length > 0) profileUpdate.social_links = socialLinks;

      const { error: profileError } = await supabase
        .from("profiles").update(profileUpdate).eq("user_id", user.id);
      if (profileError) throw profileError;

      // 3. Optional company
      if (company.trim()) {
        await supabase.from("professional_experience").insert({
          user_id: user.id,
          company_name: company.trim(),
          is_current: true,
        });
      }

      await refetchProfile();
      toast.success("Profile complete! Welcome to Cirkle 🎉");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">You're all set!</h2>
          <p className="text-muted-foreground">Welcome to your IIT community.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Progress */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        {stepIdx > 0 && (
          <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex gap-1.5 flex-1">
          {STEP_ORDER.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${stepIdx >= i ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{stepIdx + 1}/{totalSteps}</span>
      </div>

      <div className="flex-1 px-4 pb-8 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          {/* Locked IIT badge */}
          {iit && (
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{iit}</span>
              <span className="text-xs text-muted-foreground">(verified)</span>
            </div>
          )}

          {step === "name" && (
            <div className="animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">What's your full name?</h2>
              <p className="text-sm text-muted-foreground mb-6">This will be visible to other community members</p>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Rahul Sharma" className="h-12 rounded-xl bg-secondary border-border" autoFocus />
            </div>
          )}

          {step === "degree" && (
            <div className="animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">Select your degree</h2>
              <p className="text-sm text-muted-foreground mb-6">Your primary course of study</p>
              <div className="grid grid-cols-3 gap-2">
                {ALL_COURSES.map(d => (
                  <button key={d} onClick={() => setDegree(d)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all press-scale ${
                      degree === d ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground hover:border-primary/30"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "specialisation" && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{degree}</span>
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">Select your specialisation</h2>
              <p className="text-sm text-muted-foreground mb-6">Your branch or area of focus</p>
              <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto scrollbar-hide">
                {specialisations.map(b => (
                  <button key={b} onClick={() => setSpecialisation(b)}
                    className={`p-3 rounded-xl border text-sm font-medium text-left transition-all press-scale ${
                      specialisation === b ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground hover:border-primary/30"
                    }`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "year" && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-foreground mb-1">Batch / Passout year</h2>
              <p className="text-sm text-muted-foreground mb-6">When do/did you graduate?</p>
              <div className="grid grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
                {YEARS.map(y => (
                  <button key={y} onClick={() => setYear(y)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all press-scale ${
                      year === y ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground hover:border-primary/30"
                    }`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "optional" && (
            <div className="animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">Optional details</h2>
              <p className="text-sm text-muted-foreground mb-6">Add anything useful now, or leave fields blank and continue.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Location</label>
                  <SearchableSelect
                    options={locations}
                    value={location}
                    onChange={setLocation}
                    placeholder="Search city worldwide..."
                    allowOther={true}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">LinkedIn URL</label>
                  <Input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="h-11 rounded-xl bg-secondary border-border" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Current Company</label>
                  <SearchableSelect
                    options={companies}
                    value={company}
                    onChange={setCompany}
                    placeholder="Search company..."
                    allowOther={true}
                    className="rounded-xl"
                  />
                </div>

                {/* Terms acceptance */}
                <label className="flex items-start gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground leading-snug">{termsText}</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action */}
      {(step as string) !== "done" && (
        <div className="px-4 pb-6 safe-bottom">
          <div className="max-w-lg mx-auto">
            <Button
              className="w-full h-12 rounded-xl font-semibold gap-2"
              onClick={handleNext}
              disabled={!canProceed() || loading}
            >
              {loading ? "Saving..." : step === "optional" ? "Complete Profile" : "Continue"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostVerifyOnboarding;
