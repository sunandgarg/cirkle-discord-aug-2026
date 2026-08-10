import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, CloudMoon, Sun, Sunset, Coffee } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";

/* ─── Extract last name, fallback to first name ─── */
const getDisplayName = (fullName?: string | null): string => {
  if (!fullName) return "there";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  // If 2+ parts, show last name; otherwise show first name
  if (parts.length >= 2) return parts[parts.length - 1];
  return parts[0] || "there";
};

const getInitials = (fullName?: string | null): string => {
  if (!fullName) return "U";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

/* ─── Dynamic greeting based on user's local time ─── */
const getGreeting = (): { text: string; Icon: typeof Sun } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: "Good Morning", Icon: Coffee };
  if (hour >= 12 && hour < 17) return { text: "Good Afternoon", Icon: Sun };
  if (hour >= 17 && hour < 21) return { text: "Good Evening", Icon: Sunset };
  return { text: "Good Night", Icon: CloudMoon };
};

const AppHeader = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const greeting = getGreeting();

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border px-4 py-2.5" role="banner">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {/* Left: Avatar + Greeting — friendly, human feel */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/profile")} className="flex-shrink-0" aria-label="View profile">
            <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center overflow-hidden bg-secondary">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="Profile" loading="lazy" />
              ) : (
                <span className="text-xs font-semibold text-foreground">{getInitials(profile?.name)}</span>
              )}
            </div>
          </button>
          <div>
            {/* Show "Hi, LastName" — personal touch */}
            <p className="text-base font-bold text-foreground leading-tight">
              Hi, {getDisplayName(profile?.name)}
            </p>
            {/* Dynamic time-based greeting */}
            <p className="text-xs text-primary flex items-center gap-1 font-medium">
              <greeting.Icon className="w-3.5 h-3.5" />
              {greeting.text}
            </p>
          </div>
        </div>

        {/* Right: Admin + Notifications only — search removed per requirement */}
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button onClick={() => navigate("/admin")} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors" aria-label="Admin">
              <ShieldCheck className="w-4.5 h-4.5" />
            </button>
          )}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
