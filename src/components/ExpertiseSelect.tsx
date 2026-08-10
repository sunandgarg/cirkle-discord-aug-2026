import { useState } from "react";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import { expertiseCategories } from "@/data/dropdownOptions";
import { cn } from "@/lib/utils";

interface ExpertiseSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  className?: string;
}

const ExpertiseSelect = ({ value, onChange, max = 15, className }: ExpertiseSelectProps) => {
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const filtered = search
    ? expertiseCategories.filter(c => c.toLowerCase().includes(search.toLowerCase()) && !value.includes(c))
    : expertiseCategories.filter(c => !value.includes(c));

  const addTag = (tag: string) => {
    if (value.length >= max) return;
    if (!value.includes(tag)) {
      onChange([...value, tag]);
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter(v => v !== tag));
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !value.includes(trimmed) && value.length < max) {
      onChange([...value, trimmed]);
      setCustomInput("");
      setShowCustom(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {value.length < max && (
        <>
          {/* Search */}
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search expertise..."
            className="bg-secondary border-border h-9 text-sm"
          />

          {/* Available options */}
          <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto">
            {filtered.slice(0, 20).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => addTag(cat)}
                className="px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                + {cat}
              </button>
            ))}
          </div>

          {/* Custom input */}
          {showCustom ? (
            <div className="flex gap-2">
              <Input
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
                placeholder="Type custom expertise..."
                className="bg-secondary border-border h-9 text-sm flex-1"
                autoFocus
              />
              <button type="button" onClick={addCustom} className="text-xs text-primary font-medium px-2">Add</button>
              <button type="button" onClick={() => { setShowCustom(false); setCustomInput(""); }} className="text-xs text-muted-foreground px-1">✕</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
            >
              <Plus className="w-3 h-3" /> Add custom
            </button>
          )}

          <p className="text-[10px] text-muted-foreground">{value.length}/{max} selected</p>
        </>
      )}
    </div>
  );
};

export default ExpertiseSelect;
