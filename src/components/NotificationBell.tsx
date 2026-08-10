import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

const NotificationBell = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 15000,
  });

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  // Realtime notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); if (!open && unreadCount > 0) markAllRead(); }}
        className="p-2.5 text-muted-foreground hover:text-foreground hover-scale rounded-full relative" aria-label="Notifications">
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 max-h-96 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-bold text-sm text-foreground">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="overflow-y-auto max-h-80">
            {notifications?.length ? notifications.map((n: any) => (
              <div key={n.id} className={`px-4 py-3 border-b border-border last:border-0 ${!n.is_read ? "bg-primary/5" : ""}`}>
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
              </div>
            )) : (
              <div className="py-8 text-center"><p className="text-sm text-muted-foreground">No notifications yet</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
