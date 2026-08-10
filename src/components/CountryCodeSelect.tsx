import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

export type CountryOption = { code: string; flag: string; name: string };

export const COUNTRY_CODES: CountryOption[] = [
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+1", flag: "🇺🇸", name: "USA" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
  { code: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "+63", flag: "🇵🇭", name: "Philippines" },
];

interface Props {
  value: CountryOption;
  onChange: (c: CountryOption) => void;
}

const CountryCodeSelect = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState("");

  const applyCustom = () => {
    const digits = custom.replace(/\D/g, "").slice(0, 4);
    if (!digits) return;
    onChange({ code: `+${digits}`, flag: "🌍", name: "Other" });
    setCustom("");
    setShowCustom(false);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 px-3 rounded-xl bg-secondary border border-border flex items-center gap-1.5 flex-shrink-0 hover:bg-accent transition-colors"
      >
        <span className="text-lg">{value.flag}</span>
        <span className="text-foreground text-sm font-medium">{value.code}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShowCustom(false); }}>
        <DialogContent className="max-w-sm max-h-[70vh]">
          <DialogHeader><DialogTitle>Select Country</DialogTitle></DialogHeader>
          <div className="space-y-1 overflow-y-auto max-h-[45vh]">
            {COUNTRY_CODES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  value.code === c.code ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <span className="text-sm font-medium text-foreground flex-1 text-left">{c.name}</span>
                <span className="text-sm text-muted-foreground">{c.code}</span>
              </button>
            ))}
          </div>

          {/* Other - custom dialing code */}
          <div className="border-t border-border pt-3">
            {showCustom ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">+</span>
                <Input
                  autoFocus
                  inputMode="numeric"
                  placeholder="Country code (e.g. 352)"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                  className="h-11 rounded-xl bg-secondary border-border flex-1"
                />
                <Button className="h-11 rounded-xl" onClick={applyCustom} disabled={!custom}>Use</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <span className="text-xl">🌍</span>
                <span className="text-sm font-medium text-foreground flex-1 text-left">Other - enter your own code</span>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CountryCodeSelect;
