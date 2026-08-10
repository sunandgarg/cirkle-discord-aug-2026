import { useLocation, useNavigate } from "react-router-dom";
import { Users, Waypoints, Briefcase, MessageSquareText, Settings, ShieldCheck, Calendar, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import cirkLogo from "@/assets/cirkle-logo.png";

// Custom Cirkle logo icon for forum tab
const CirkleLogo = ({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth={strokeWidth} stroke="currentColor">
    <rect x="3" y="3" width="18" height="18" rx="4" strokeLinecap="round" />
    <path d="M15 9.5C14.2 8.5 13.2 8 12 8C9.8 8 8 9.8 8 12C8 14.2 9.8 16 12 16C13.2 16 14.2 15.5 15 14.5" strokeLinecap="round" />
  </svg>
);

// Main navigation — Forum first, Network removed
const MAIN_TABS = [
  { path: "/cirkle-forum", key: "forum", fallbackLabel: "Cirkle Forum", icon: CirkleLogo, isCustom: true },
  { path: "/consult", key: "consult", fallbackLabel: "Consult", icon: Waypoints, isCustom: false },
  { path: "/jobs", key: "jobs", fallbackLabel: "Jobs", icon: Briefcase, isCustom: false },
];

const extraLinks = [
  { path: "/chats", label: "Messages", icon: MessageSquareText, requiresVerification: true },
  { path: "/calendar", label: "Events", icon: Calendar, requiresVerification: false },
  { path: "/profile", label: "Profile", icon: User, requiresVerification: false },
  { path: "/settings", label: "Settings", icon: Settings, requiresVerification: false },
];

const getInitials = (name?: string | null): string => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const DesktopSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, isVerified } = useAuth();

  const { data: navConfig } = useQuery({
    queryKey: ["nav-config"],
    queryFn: async () => {
      const { data } = await supabase.from("nav_config" as any).select("*");
      const map: Record<string, any> = {};
      (data as any[])?.forEach((c: any) => { map[c.tab_key] = c; });
      return map;
    },
    staleTime: 60000,
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <aside className="hidden lg:flex flex-col w-56 bg-card border-r border-border h-screen sticky top-0">
      {/* Brand */}
      <div className="px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <img src={cirkLogo} alt="Cirkle" className="w-8 h-8 rounded-lg" />
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight">Cirkle</h1>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Community</p>
          </div>
        </div>
      </div>

      {/* Profile card */}
      <div className="px-3 py-2.5 border-b border-border">
        <button onClick={() => navigate("/profile")} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-xs font-semibold text-foreground">{getInitials(profile?.name)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-foreground truncate">{profile?.name || "User"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{profile?.headline || "Set up profile"}</p>
          </div>
        </button>
      </div>

      {/* Nav — Forum is first, Home removed */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        <p className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-2 mb-1">Navigate</p>
        {MAIN_TABS.map(({ path, key, fallbackLabel, icon: Icon }) => {
          const config = navConfig?.[key];
          const label = config?.label || fallbackLabel;
          const iconUrl = config?.icon_url;
          const active = isActive(path);

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {iconUrl ? (
                <img src={iconUrl} alt={label} className="w-4 h-4 object-contain" />
              ) : (
                <Icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} strokeWidth={active ? 2 : 1.5} />
              )}
              <span>{label}</span>
            </button>
          );
        })}

        <div className="pt-2.5">
          <p className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-2 mb-1">More</p>
          {extraLinks.filter(link => !link.requiresVerification || isVerified).map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} strokeWidth={active ? 2 : 1.5} />
                <span>{label}</span>
              </button>
            );
          })}

          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                isActive("/admin") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${isActive("/admin") ? "text-primary" : ""}`} strokeWidth={isActive("/admin") ? 2 : 1.5} />
              <span>Admin</span>
            </button>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border">
        <p className="text-[9px] text-muted-foreground/40 text-center">© 2026 Cirkle</p>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
