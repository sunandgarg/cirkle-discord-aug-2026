import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import {
  MessageSquareText, Briefcase, GraduationCap, Shield,
  ArrowRight, CheckCircle2, Plane, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import cirkLogo from "@/assets/cirkle-logo.png";

/* ─── Journey stops for airplane roadmap ─── */
const JOURNEY = [
  { label: "IIT Community", status: "live", caption: "Students + alumni, one verified network", color: "bg-primary" },
  { label: "Premier Institutes", status: "next", caption: "NITs, IIMs, BITS & more", color: "bg-primary/60" },
  { label: "Corporate Circles", status: "soon", caption: "Company alumni networks", color: "bg-muted" },
  { label: "Global Niches", status: "soon", caption: "Sports, arts, regional groups", color: "bg-muted" },
];

const FEATURES = [
  { icon: MessageSquareText, title: "Community Forum", desc: "Real conversations. Real people. WhatsApp-like simplicity." },
  { icon: GraduationCap, title: "Consult", desc: "Talk to verified experts." },
  { icon: Briefcase, title: "Jobs", desc: "Community-driven opportunities." },
  { icon: Shield, title: "Verified Only", desc: "Every member email-verified." },
];

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const journeyRef = useRef<HTMLDivElement>(null);

  // Airplane scroll animation — moves along a wave path
  const { scrollYProgress } = useScroll({ target: journeyRef, offset: ["start end", "end start"] });
  const planeX = useTransform(scrollYProgress, [0, 0.3, 0.5, 0.7, 1], ["5%", "25%", "50%", "75%", "90%"]);
  const planeY = useTransform(scrollYProgress, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], ["0px", "-20px", "8px", "-16px", "4px", "-12px", "0px"]);
  const planeRotate = useTransform(scrollYProgress, [0, 0.2, 0.4, 0.6, 0.8, 1], [0, -8, 5, -6, 3, 0]);

  useEffect(() => {
    if (!loading && user) navigate("/cirkle-forum");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user) return null;

  const goAuth = () => navigate("/auth");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── Hero — immersive, tall, no top nav bar ─── */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-5 py-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          {/* Logo + badge */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src={cirkLogo} alt="Cirkle" className="w-12 h-12 rounded-xl shadow-sm" />
            <span className="text-2xl font-bold tracking-tight text-foreground">Cirkle</span>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-primary/8 text-primary text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6 border border-primary/10">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            Live — IIT Community
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6 text-foreground">
            Your Community.<br />
            Your Network.<br />
            <span className="text-primary">Your Career.</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed">
            A community-first networking forum + job platform — starting with IITs, expanding to many more communities.
          </p>

          <Button size="lg" onClick={goAuth} className="rounded-xl px-10 h-13 text-sm font-semibold gap-2 shadow-md hover:shadow-lg transition-all">
            <Zap className="w-4 h-4" /> Enter my community
          </Button>

          <div className="mt-8 flex items-center justify-center gap-5 text-xs text-muted-foreground/50">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary/40" /> Free forever</span>
            <span className="w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary/40" /> Email verified</span>
          </div>
        </div>
      </section>

      {/* ─── Features — compact grid ─── */}
      <section className="py-10 px-5 border-y border-border/40">
        <div className="max-w-2xl mx-auto">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40 mb-4 text-center">What you get</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/20 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center mx-auto mb-2.5">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-xs font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-[10px] text-muted-foreground leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Airplane Journey Roadmap ─── */}
      <section ref={journeyRef} className="py-16 px-5 relative overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-center">Our Journey</h2>
          <p className="text-sm text-muted-foreground text-center mb-10">Start with one community. Perfect it. Expand.</p>

          {/* SVG wave path + animated plane */}
          <div className="relative h-24 mb-8">
            {/* Background track */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 80" preserveAspectRatio="none">
              <path d="M0,40 C100,10 200,70 300,35 C400,0 500,60 600,30 C700,0 800,50 800,40" stroke="hsl(var(--border))" strokeWidth="2" fill="none" strokeDasharray="6 4" />
              <motion.path d="M0,40 C100,10 200,70 300,35 C400,0 500,60 600,30 C700,0 800,50 800,40"
                stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none"
                style={{ pathLength: scrollYProgress }} />
            </svg>

            {/* Animated plane */}
            <motion.div
              style={{ left: planeX, y: planeY, rotate: planeRotate }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
            >
              <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg shadow-primary/30">
                <Plane className="w-5 h-5" />
              </div>
            </motion.div>
          </div>

          {/* Journey stops */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {JOURNEY.map((stop, i) => (
              <motion.div
                key={stop.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-xl p-3.5 border transition-all ${
                  stop.status === "live" ? "bg-card border-primary/25 shadow-sm ring-1 ring-primary/10" :
                  stop.status === "next" ? "bg-card border-border" :
                  "bg-muted/20 border-border/40 opacity-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className={`w-2 h-2 rounded-full ${stop.color}`} />
                  <span className="text-xs font-semibold text-foreground">{stop.label}</span>
                  {stop.status === "live" && (
                    <span className="text-[8px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase ml-auto">Live</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">{stop.caption}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="py-14 px-5">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-xl font-bold tracking-tight mb-3">
            Ready to find your <span className="text-primary">circle</span>?
          </h2>
          <p className="text-sm text-muted-foreground mb-6">Verification required. Always free.</p>
          <Button size="lg" onClick={goAuth} className="rounded-xl px-8 h-12 text-sm font-semibold gap-2">
            <Zap className="w-4 h-4" /> Enter my community
          </Button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-5 px-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={cirkLogo} alt="Cirkle" className="w-5 h-5 rounded" />
            <span className="text-sm font-semibold text-foreground">Cirkle</span>
          </div>
          <p className="text-[10px] text-muted-foreground/40">© 2026 Cirkle</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
