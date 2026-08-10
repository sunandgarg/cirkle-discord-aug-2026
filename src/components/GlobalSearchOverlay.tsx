import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Hash, User, Briefcase, Calendar, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: string;
  type: "post" | "user" | "job" | "event" | "forum";
  title: string;
  subtitle?: string;
}

interface GlobalSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelect?: (result: SearchResult) => void;
}

const TYPE_ICONS: Record<string, any> = {
  post: MessageSquare,
  user: User,
  job: Briefcase,
  event: Calendar,
  forum: Hash,
};

const TYPE_LABELS: Record<string, string> = {
  post: "Posts",
  user: "People",
  job: "Jobs",
  event: "Events",
  forum: "Forums",
};

export const GlobalSearchOverlay = ({ open, onClose, onSelect }: GlobalSearchOverlayProps) => {
  const [query, setQuery] = useState("");
  const [recentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("recent_searches") || "[]").slice(0, 10);
    } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [open]);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const saveSearch = useCallback((term: string) => {
    try {
      const recent = JSON.parse(localStorage.getItem("recent_searches") || "[]");
      const updated = [term, ...recent.filter((s: string) => s !== term)].slice(0, 10);
      localStorage.setItem("recent_searches", JSON.stringify(updated));
    } catch { /* ignore */ }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                saveSearch(query.trim());
              }
            }}
            placeholder="Search posts, people, jobs, events…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border font-mono">
            ESC
          </kbd>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent touch-target" aria-label="Close search">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Results / empty state */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="p-4">
              {recentSearches.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent</p>
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(term)}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </>
              )}
              {recentSearches.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Start typing to search across all content
                </p>
              )}
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm text-muted-foreground text-center py-8">
                Search results for "{query}" - coming soon
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>⌘K Toggle</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchOverlay;
