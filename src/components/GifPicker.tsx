import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GifResult {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const GifPicker = ({ onSelect, onClose }: GifPickerProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<"gifs" | "stickers">("gifs");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchGifs = useCallback(async (q: string, type: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("giphy-search", {
        body: { q, type, limit: 20 },
      });
      if (error) throw error;
      setResults(data?.results || []);
      setHasSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending on mount and tab change
  useEffect(() => {
    searchGifs("", activeTab);
  }, [searchGifs, activeTab]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGifs(value, activeTab), 400);
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in w-full max-w-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-0">
          <button
            onClick={() => { setActiveTab("gifs"); setQuery(""); }}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${activeTab === "gifs" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            GIFs
          </button>
          <button
            onClick={() => { setActiveTab("stickers"); setQuery(""); }}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${activeTab === "stickers" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Stickers
          </button>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="h-8 pl-8 text-xs bg-secondary border-border rounded-lg"
            autoFocus
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 px-2 pb-2 max-h-60 overflow-y-auto">
        {loading && (
          <div className="col-span-2 flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && results.map((gif) => (
          <button
            key={gif.id}
            onClick={() => onSelect(gif.url)}
            className={`rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all ${activeTab === "stickers" ? "bg-transparent p-2" : ""}`}
          >
            <img
              src={gif.preview}
              alt={gif.title}
              className={`w-full object-cover ${activeTab === "stickers" ? "h-20 object-contain" : "h-24 object-cover"}`}
              loading="lazy"
            />
          </button>
        ))}
        {!loading && hasSearched && results.length === 0 && (
          <div className="col-span-2 py-6 text-center text-xs text-muted-foreground">
            No {activeTab} found
          </div>
        )}
      </div>
      <div className="px-3 py-1 border-t border-border">
        <p className="text-[9px] text-muted-foreground text-right">Powered by GIPHY</p>
      </div>
    </div>
  );
};

export default GifPicker;
