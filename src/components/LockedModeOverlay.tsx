import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const LockedModeOverlay = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Verification Required</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Verify your IIT email to unlock the full Cirkle experience — forum, network, jobs, and more.
        </p>
        <Button
          size="lg"
          className="w-full rounded-xl h-12 text-sm font-semibold"
          onClick={() => navigate("/iit-verify")}
        >
          <ShieldCheck className="w-4 h-4 mr-2" />
          Verify Now
        </Button>
        <button
          onClick={() => navigate("/settings")}
          className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Go to Settings instead
        </button>
      </div>
    </div>
  );
};

export default LockedModeOverlay;
