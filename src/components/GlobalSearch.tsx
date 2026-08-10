import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Users, Briefcase, FileText, Calendar, TrendingUp, Monitor, Palette, BarChart3, Megaphone, DollarSign, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const TRENDING = [
  { tag: "#AIRevolution", count: "12.5k" },
  { tag: "#StartupIndia", count: "8.2k" },
  { tag: "#RemoteWork", count: "6.7k" },
  { tag: "#DesignThinking", count: "4.3k" },
  { tag: "#Web3", count: "3.9k" },
];

const CATEGORIES = [
  { name: "Technology", count: "2.3k posts", icon: Monitor },
  { name: "Design", count: "1.8k posts", icon: Palette },
  { name: "Business", count: "3.1k posts", icon: BarChart3 },
  { name: "Marketing", count: "1.2k posts", icon: Megaphone },
  { name: "Finance", count: "980 posts", icon: DollarSign },
  { name: "Health", count: "756 posts", icon: Heart },
];

const GlobalSearch = ({ open, onClose }: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ type: string; items: any[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Prefetch suggested people
  const { data: suggestedPeople } = useQuery({
    queryKey: ["suggested-people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name, headline, avatar_url").limit(5);
      return data ?? [];
    },
    staleTime: 120000,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const q = `%${query}%`;
      const [profiles, jobs, posts, events] = await Promise.all([
        supabase.from("profiles").select("user_id, name, headline, avatar_url").or(`name.ilike.${q},headline.ilike.${q}`).limit(5),
        supabase.from("jobs").select("id, title, company, location").or(`title.ilike.${q},company.ilike.${q}`).limit(5),
        supabase.from("posts").select("id, content, author_id").ilike("content", q).limit(5),
        supabase.from("events").select("id, title, location, start_time").ilike("title", q).limit(5),
      ]);
      const r: { type: string; items: any[] }[] = [];
      if (profiles.data?.length) r.push({ type: "People", items: profiles.data });
      if (jobs.data?.length) r.push({ type: "Jobs", items: jobs.data });
      if (posts.data?.length) r.push({ type: "Posts", items: posts.data });
      if (events.data?.length) r.push({ type: "Events", items: events.data });
      setResults(r);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleClick = (type: string, item: any) => {
    onClose();
    if (type === "People") navigate(`/profile/${item.user_id}`);
    else if (type === "Jobs") navigate("/jobs");
    else if (type === "Posts") navigate("/forum");
    else if (type === "Events") navigate("/calendar");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "People": return Users;
      case "Jobs": return Briefcase;
      case "Posts": return FileText;
      case "Events": return Calendar;
      default: return Search;
    }
  };

  if (!open) return null;

  const showExplore = query.length < 2 && results.length === 0;

  return (
    <div className="fixed inset-0 z-[90] bg-background/98 backdrop-blur-sm">
      <div className="max-w-lg mx-auto px-4 pt-4 h-full overflow-y-auto pb-20">
        {/* Header */}
        <h2 className="text-xl font-bold text-foreground mb-3">Explore</h2>

        {/* Search bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search people, topics, jobs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-card border border-border"
            />
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && <p className="text-xs text-muted-foreground text-center py-8">Searching...</p>}

        {!loading && results.length === 0 && query.length >= 2 && (
          <p className="text-sm text-muted-foreground text-center py-12">No results found</p>
        )}

        {/* Search results */}
        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((group) => {
              const Icon = getIcon(group.type);
              return (
                <div key={group.type}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">{group.type}</h3>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleClick(group.type, item)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-3"
                      >
                        {group.type === "People" && item.avatar_url ? (
                          <img src={item.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.name || item.title || item.content?.substring(0, 60)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.headline || item.company || item.location || ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Explore view when no search */}
        {showExplore && (
          <div className="space-y-6 animate-fade-in">
            {/* Trending */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Trending</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map((t) => (
                  <button key={t.tag} className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-card border border-border hover:border-primary/30 transition-colors">
                    <span className="font-semibold text-primary">{t.tag}</span>
                    <span className="text-muted-foreground">{t.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Browse Categories</h3>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat.name} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors text-left">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <cat.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                      <p className="text-[10px] text-muted-foreground">{cat.count}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* People you may know */}
            {suggestedPeople && suggestedPeople.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3">People You May Know</h3>
                <div className="space-y-2">
                  {suggestedPeople.map((person: any) => (
                    <button
                      key={person.user_id}
                      onClick={() => { onClose(); navigate(`/profile/${person.user_id}`); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
                    >
                      {person.avatar_url ? (
                        <img src={person.avatar_url} className="w-11 h-11 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{(person.name || "?")[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-foreground truncate">{person.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{person.headline || ""}</p>
                      </div>
                      <span className="text-xs font-semibold px-4 py-1.5 rounded-full bg-primary text-primary-foreground">Follow</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearch;
