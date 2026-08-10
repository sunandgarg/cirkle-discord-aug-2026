import { useState, useEffect, createContext, useContext, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

// ⚠️ HARDCODED SUPER ADMIN — DO NOT MODIFY ⚠️
const SUPER_ADMIN_PHONE = "8700602524";

interface AuthContextType {
  user: User | null;
  profile: any;
  loading: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, loading: true, isAdmin: false, isVerified: false, refetchProfile: async () => {},
});

const ensureSuperAdmin = async (userId: string) => {
  await supabase.rpc("ensure_super_admin", { p_user_id: userId });
};

const isSuperAdminUser = (u: User): boolean => {
  return !!u.phone && u.phone.includes(SUPER_ADMIN_PHONE);
};

const fetchProfileAndAdmin = async (userId: string) => {
  const [profileRes, adminRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  return { profile: profileRes.data, isAdmin: !!adminRes.data };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const initializedRef = useRef(false);
  const refreshRetryRef = useRef(0);

  const isVerified = !!profile?.is_verified;

  const loadUserData = useCallback(async (u: User) => {
    try {
      if (isSuperAdminUser(u)) {
        await ensureSuperAdmin(u.id);
      }
      const { profile: p, isAdmin: admin } = await fetchProfileAndAdmin(u.id);
      setUser(u);
      setProfile(p);
      setIsAdmin(admin);
      refreshRetryRef.current = 0; // reset on success
    } catch (err) {
      // Network error — keep existing user state, don't sign out
      console.warn("Failed to load user data, keeping session:", err);
      setUser(u);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (session?.user) {
        // Use setTimeout to avoid Supabase deadlock
        setTimeout(async () => {
          await loadUserData(session.user);
          if (!initializedRef.current) {
            setLoading(false);
            initializedRef.current = true;
          }
        }, 0);
      } else if (event === "INITIAL_SESSION" && !session) {
        setLoading(false);
        initializedRef.current = true;
      }
    });

    // Then initialize
    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!session && !error) {
          // Try refreshing — keeps user logged in across restarts
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (!refreshData?.session) {
            setLoading(false);
            initializedRef.current = true;
          }
        }
      } catch {
        // Network failure on init — don't force logout, just stop loading
        setLoading(false);
        initializedRef.current = true;
      }
    };
    init();

    // Periodic silent refresh every 10 minutes to keep session alive indefinitely
    const refreshInterval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          await supabase.auth.refreshSession();
          refreshRetryRef.current = 0;
        }
      } catch {
        refreshRetryRef.current += 1;
        // Only log, never sign out — let autoRefreshToken handle recovery
        if (refreshRetryRef.current <= 3) {
          console.warn(`Silent refresh attempt ${refreshRetryRef.current} failed, will retry.`);
        }
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [loadUserData]);

  const refetchProfile = useCallback(async () => {
    const currentUser = user;
    if (!currentUser) return;
    const { profile: p, isAdmin: admin } = await fetchProfileAndAdmin(currentUser.id);
    setProfile(p);
    setIsAdmin(admin);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isVerified, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
