import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useState, useCallback } from "react";
import BottomNav from "./BottomNav";
import AppHeader from "./AppHeader";
import DesktopSidebar from "./DesktopSidebar";
import { useAuth } from "@/hooks/useAuth";
import { usePrefetch } from "@/hooks/usePrefetch";
import LockedModeOverlay from "./LockedModeOverlay";
import PostVerifyOnboarding from "./PostVerifyOnboarding";
import { ErrorBoundary } from "./ErrorBoundary";
import GlobalSearchOverlay from "./GlobalSearchOverlay";
import { useEffect } from "react";

const AppLayout = () => {
  const { user, profile, isVerified, refetchProfile } = useAuth();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  // Prefetch all critical data on login
  usePrefetch(user?.id, profile);

  // Cmd+K global search shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Always refetch profile on mount to ensure fresh verification state
  useEffect(() => {
    let cancelled = false;
    if (user) {
      refetchProfile().then(() => {
        if (!cancelled) setProfileReady(true);
      });
    } else {
      setProfileReady(true);
    }
    return () => { cancelled = true; };
  }, [user?.id]);

  // If verified but onboarding not completed, show onboarding wizard
  const needsOnboarding = profileReady && user && isVerified && profile && !profile.onboarding_completed;

  // Block unverified users on all pages except settings/profile/iit-verify
  const allowedUnverified = ["/settings", "/profile", "/iit-verify"];
  const isProtectedPage = !allowedUnverified.some(p => location.pathname.startsWith(p));
  const showLockedOverlay = profileReady && user && !isVerified && isProtectedPage;

  // Show onboarding wizard if verified but not onboarded
  if (needsOnboarding) {
    return (
      <PostVerifyOnboarding
        derivedIit={profile?.iit_name}
        onComplete={async () => {
          await refetchProfile();
        }}
      />
    );
  }

  // Show loading while profile is being fetched to prevent flash
  if (!profileReady && user) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isForum = location.pathname.startsWith("/cirkle-forum");

  return (
    <div className="fixed inset-0 bg-background flex w-full overflow-hidden">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden">
        {!isForum && <AppHeader />}
        <main id="main-content" className={`flex-1 ${isForum ? '' : 'pb-[72px]'} lg:pb-0 overflow-y-auto overflow-x-hidden overscroll-y-contain`} style={{ WebkitOverflowScrolling: 'touch' }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        {!isForum && <BottomNav />}
        {showLockedOverlay && <LockedModeOverlay />}
      </div>
      <GlobalSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default AppLayout;
