import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowOther?: boolean;
  className?: string;
}

const SearchableSelect = ({ options, value, onChange, placeholder = "Select...", allowOther = true, className }: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isOther, setIsOther] = useState(false);
  const [otherValue, setOtherValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Check if current value is a custom "other" value
  useEffect(() => {
    if (value && !options.includes(value)) {
      setIsOther(true);
      setOtherValue(value);
    }
  }, [value, options]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOther(false);
    setOpen(false);
  };

  const handleOther = () => {
    setIsOther(true);
    setOpen(false);
  };

  if (isOther) {
    return (
      <div className="flex gap-2">
        <Input
          value={otherValue}
          onChange={e => { setOtherValue(e.target.value); onChange(e.target.value); }}
          placeholder="Type custom value..."
          className={cn("bg-secondary border-border flex-1", className)}
        />
        <button
          type="button"
          onClick={() => { setIsOther(false); setOtherValue(""); onChange(""); }}
          className="text-xs text-muted-foreground hover:text-foreground px-2"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[100]" align="start" sideOffset={4}>
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 h-9 text-sm bg-background border-border"
            />
          </div>
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No results</p>
          )}
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelect(opt)}
              className={cn(
                "flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-md hover:bg-accent transition-colors",
                value === opt && "bg-accent font-medium"
              )}
            >
              {value === opt && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              <span className={value === opt ? "" : "pl-5"}>{opt}</span>
            </button>
          ))}
          {allowOther && (
            <button
              type="button"
              onClick={handleOther}
              className="flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-md hover:bg-accent transition-colors text-primary font-medium border-t border-border mt-1 pt-2"
            >
              <span className="pl-5">+ Other (custom)</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableSelect;
