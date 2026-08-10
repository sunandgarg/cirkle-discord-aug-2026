import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

interface MaskedContentProps {
  children: ReactNode;
}

const MaskedContent = ({ children }: MaskedContentProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[60vh]">
      <div className="blur-md opacity-40 pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-8 max-w-sm mx-4 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Verification Required</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Verify your identity to access community discussions and connect with members.
          </p>
          <Button className="w-full rounded-xl h-11 text-sm font-semibold" onClick={() => navigate("/iit-verify")}>
            Verify Now
          </Button>
          <p className="text-[11px] text-muted-foreground mt-3">Takes less than 2 minutes</p>
        </div>
      </div>
    </div>
  );
};

export default MaskedContent;
