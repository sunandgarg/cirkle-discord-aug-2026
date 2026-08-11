import { ArrowLeft, Search, Plus, Send, Check, CheckCheck, Smile, Reply, Users as UsersIcon, X, Phone, Video, MoreVertical, Mic, Paperclip, Image as ImageIcon, Lock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { convertToWebP } from "@/lib/imageUtils";
import { getCached, getSmallCached, mergeById, setCached, setSmallCached } from "@/lib/browserCache";

const MESSAGE_PAGE_SIZE = 50;
const CallModal = lazy(() => import("@/components/CallModal"));

const getInitials = (name?: string | null): string => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const formatMessageDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yyyy");
};

const Chats = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [tab, setTab] = useState<"messages" | "groups">("messages");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [callMode, setCallMode] = useState<"audio" | "video" | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const autoOpenedUserRef = useRef<string | null>(null);
  const activeRoomId = activeRoom?.id as string | undefined;

  // Only fetch connected friends for DM
  const { data: friendIds } = useQuery({
    queryKey: ["friend-ids-chat", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("connections").select("requester_id, receiver_id")
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).eq("status", "accepted");
      return data?.map(c => c.requester_id === user.id ? c.receiver_id : c.requester_id) || [];
    },
    enabled: !!user,
  });

  const { data: friendProfiles } = useQuery({
    queryKey: ["friend-profiles-chat", friendIds],
    queryFn: async () => {
      if (!friendIds?.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", friendIds);
      return data ?? [];
    },
    enabled: !!friendIds && friendIds.length > 0,
  });

  const { data: rooms } = useQuery({
    queryKey: ["chat-rooms", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("get_my_chat_rooms" as any);
      if (error) throw error;
      const result = ((data || []) as any[]).map((row) => row.room ?? row);
      setSmallCached(`chat-rooms:${user.id}`, result);
      return result;
    },
    enabled: !!user,
    initialData: () => user ? getSmallCached<any[]>(`chat-rooms:${user.id}`, 7 * 24 * 60 * 60 * 1000) ?? undefined : undefined,
    staleTime: 15_000,
  });

  const hydrateMediaUrls = useCallback(async (rows: any[]) => {
    const paths = [...new Set(rows.map((message) => message.media_path).filter(Boolean))] as string[];
    if (!paths.length) return rows;
    const { data } = await supabase.storage.from("chat-media").createSignedUrls(paths, 60 * 60);
    const urls = new Map((data || []).map((item) => [item.path, item.signedUrl]));
    return rows.map((message) => ({ ...message, media_url: message.media_path ? urls.get(message.media_path) : undefined }));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`chat-room-state-${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "chat_room_state", filter: `user_id=eq.${userId}`,
      }, ({ new: state }: any) => {
        queryClient.setQueryData<any[]>(["chat-rooms", userId], (current = []) => {
          const updated = current.map((room) => room.id === state.room_id ? {
            ...room,
            unreadCount: state.unread_count,
            lastMessage: state.last_message_id ? {
              id: state.last_message_id,
              content: state.last_content,
              created_at: state.last_message_at,
              sender_id: state.last_sender_id,
            } : room.lastMessage,
          } : room);
          const sorted = [...updated].sort((a, b) =>
            new Date(b.lastMessage?.created_at || b.created_at).getTime() - new Date(a.lastMessage?.created_at || a.created_at).getTime());
          setSmallCached(`chat-rooms:${userId}`, sorted);
          return sorted;
        });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, userId]);

  useEffect(() => {
    if (!activeRoomId) return;
    let cancelled = false;
    const cacheKey = `chat:${userId}:${activeRoomId}`;
    const fetchMessages = async () => {
      const cached = await getCached<any[]>(cacheKey);
      if (!cancelled && cached?.length) setMessages(cached.slice(-200));
      const { data, error } = await supabase.from("messages").select("*")
        .eq("room_id", activeRoomId).is("deleted_at" as any, null)
        .order("created_at", { ascending: false }).limit(MESSAGE_PAGE_SIZE);
      if (error) { toast.error("Could not refresh messages"); return; }
      let hydrated = await hydrateMediaUrls([...(data || [])].reverse());
      const sentMessageIds = hydrated.filter((message) => message.sender_id === userId).map((message) => message.id);
      if (sentMessageIds.length) {
        const { data: receipts } = await supabase.from("message_receipts" as any)
          .select("message_id,user_id,read_at")
          .in("message_id", sentMessageIds)
          .not("read_at", "is", null);
        const readIds = new Set((receipts || []).filter((receipt: any) => receipt.user_id !== userId).map((receipt: any) => receipt.message_id));
        hydrated = hydrated.map((message) => ({ ...message, is_read: readIds.has(message.id) }));
      }
      if (cancelled) return;
      setHasOlderMessages((data?.length || 0) === MESSAGE_PAGE_SIZE);
      setMessages((current) => {
        const merged = mergeById(current.filter((message) => !String(message.id).startsWith("optimistic:")), hydrated);
        void setCached(cacheKey, merged.slice(-200));
        return merged;
      });
      if (userId) {
        await supabase.rpc("mark_room_read" as any, { p_room_id: activeRoomId });
      }
    };
    void fetchMessages();

    const msgChannel = supabase
      .channel(`room-msgs-${activeRoomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${activeRoomId}` },
        async (payload) => {
          const [incoming] = await hydrateMediaUrls([payload.new]);
          setMessages((prev) => {
            const withoutOptimisticCopy = prev.filter((message) =>
              !incoming.client_message_id || message.client_message_id !== incoming.client_message_id);
            const merged = mergeById(withoutOptimisticCopy, [incoming]);
            void setCached(cacheKey, merged.slice(-200));
            return merged;
          });
          if (payload.new.sender_id !== userId) {
            void supabase.from("message_receipts" as any).upsert({
              message_id: payload.new.id, room_id: activeRoomId, user_id: userId, delivered_at: new Date().toISOString(), read_at: new Date().toISOString(),
            }, { onConflict: "message_id,user_id" });
          }
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_receipts", filter: `room_id=eq.${activeRoomId}` },
        ({ new: receipt }: any) => {
          if (!receipt.read_at || receipt.user_id === userId) return;
          setMessages((current) => current.map((message) =>
            message.id === receipt.message_id ? { ...message, is_read: true } : message));
        })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === userId) return;
        const name = payload.name || "Someone";
        setTypingUsers((prev) => prev.includes(name) ? prev : [...prev, name]);
        setTimeout(() => setTypingUsers((prev) => prev.filter((value) => value !== name)), 2500);
      })
      .subscribe();
    roomChannelRef.current = msgChannel;

    return () => {
      cancelled = true;
      if (roomChannelRef.current === msgChannel) roomChannelRef.current = null;
      void supabase.removeChannel(msgChannel);
    };
  }, [activeRoomId, hydrateMediaUrls, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTyping = () => {
    if (!activeRoom || !user) return;
    void roomChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: user.id, name: user.user_metadata?.name } });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => undefined, 1200);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !activeRoom) return;
    const content = newMessage.trim();
    const clientMessageId = crypto.randomUUID();
    const optimistic = {
      id: `optimistic:${clientMessageId}`,
      client_message_id: clientMessageId,
      content,
      room_id: activeRoom.id,
      sender_id: user.id,
      reply_to_message_id: replyTo?.id || null,
      created_at: new Date().toISOString(),
      status: "sending",
      read_by: [user.id],
    };
    setMessages((current) => [...current, optimistic]);
    setNewMessage(""); setReplyTo(null);
    const { data, error } = await supabase.from("messages").insert({
      content,
      room_id: activeRoom.id,
      sender_id: user.id,
      read_by: [user.id],
      reply_to_message_id: optimistic.reply_to_message_id,
      client_message_id: clientMessageId,
      status: "sent",
    } as any).select("*").single();
    if (error) {
      const { data: existing } = await (supabase as any).from("messages").select("*")
        .eq("sender_id", user.id).eq("client_message_id", clientMessageId).maybeSingle();
      if (existing) {
        setMessages((current) => mergeById(current.filter((message) => message.id !== optimistic.id), [existing]));
        return;
      }
      setMessages((current) => current.map((message) => message.id === optimistic.id ? { ...message, status: "failed" } : message));
      toast.error("Message was not sent. Check your connection and retry.");
      return;
    }
    if (data) setMessages((current) => mergeById(current.filter((message) => message.id !== optimistic.id), [data]));
    queryClient.invalidateQueries({ queryKey: ["chat-rooms", user.id] });
  };

  const retryMessage = async (message: any) => {
    if (!user || !activeRoom || !message.client_message_id) return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, status: "sending" } : item));
    const { data, error } = await supabase.from("messages").insert({
      content: message.content,
      room_id: activeRoom.id,
      sender_id: user.id,
      read_by: [user.id],
      reply_to_message_id: message.reply_to_message_id || null,
      client_message_id: message.client_message_id,
      status: "sent",
    } as any).select("*").single();
    let delivered = data;
    if (error) {
      const { data: existing } = await (supabase as any).from("messages").select("*")
        .eq("sender_id", user.id).eq("client_message_id", message.client_message_id).maybeSingle();
      delivered = existing;
    }
    if (!delivered) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, status: "failed" } : item));
      toast.error("Still offline. Try again when your connection returns.");
      return;
    }
    setMessages((current) => mergeById(current.filter((item) => item.id !== message.id), [delivered]));
  };

  const sendImage = async (file: File) => {
    if (!user || !activeRoom) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("Image must be smaller than 15 MB"); return; }
    setUploadingImage(true);
    try {
      const webp = await convertToWebP(file, 0.78, 1600);
      const path = `${activeRoom.id}/${user.id}/${crypto.randomUUID()}.webp`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, webp, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) throw upErr;
      await supabase.from("messages").insert({
        content: "", room_id: activeRoom.id, sender_id: user.id, read_by: [user.id],
        client_message_id: crypto.randomUUID(), media_path: path, media_type: "image/webp", status: "sent",
      } as any);
      queryClient.invalidateQueries({ queryKey: ["chat-rooms", user.id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!activeRoom || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    const oldest = messages.find((message) => !String(message.id).startsWith("optimistic:"));
    const { data, error } = await supabase.from("messages").select("*")
      .eq("room_id", activeRoom.id)
      .lt("created_at", oldest?.created_at || new Date().toISOString())
      .is("deleted_at" as any, null)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);
    if (!error) {
      const hydrated = await hydrateMediaUrls([...(data || [])].reverse());
      setMessages((current) => mergeById(hydrated, current));
      setHasOlderMessages((data?.length || 0) === MESSAGE_PAGE_SIZE);
    }
    setLoadingOlder(false);
  };

  // Group creation: user can only add people who share a common connection with all members
  // Simplified rule: all selected members must be friends of the creator
  // AND at least one common friend must exist between the creator and each member
  const canCreateGroupWithMembers = useMemo(() => {
    if (!friendIds || selectedMembers.length === 0) return false;
    // All selected members must be friends of creator
    return selectedMembers.every(id => friendIds.includes(id));
  }, [friendIds, selectedMembers]);

  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !user) return;
    if (!canCreateGroupWithMembers) {
      toast.error("You can only create groups with your connections");
      return;
    }
    const { error: roomError } = await supabase.rpc("create_group_room" as any, {
      p_name: groupName.trim(), p_member_ids: selectedMembers,
    });
    if (roomError) { toast.error(roomError.message); return; }
    setShowCreateGroup(false); setGroupName(""); setSelectedMembers([]);
    queryClient.invalidateQueries({ queryKey: ["chat-rooms", user.id] });
    toast.success("Group created!");
  };

  const startDM = useCallback(async (otherUserId: string) => {
    if (!user) return;
    // Check if other user is a friend
    if (!friendIds?.includes(otherUserId)) {
      toast.error("You can only message your connections");
      return;
    }
    const { data: roomId, error } = await supabase.rpc("get_or_create_direct_room" as any, { p_other_user_id: otherUserId });
    if (error || !roomId) { toast.error(error?.message || "Could not open chat"); return; }
    const profile = friendProfiles?.find((item) => item.user_id === otherUserId);
    setActiveRoom({ id: roomId, is_group: false, displayName: profile?.name || "User", displayAvatar: profile?.avatar_url });
    queryClient.invalidateQueries({ queryKey: ["chat-rooms", user.id] });
  }, [friendIds, friendProfiles, queryClient, user]);

  useEffect(() => {
    const targetUserId = searchParams.get("user");
    if (!targetUserId || !friendIds || autoOpenedUserRef.current === targetUserId) return;
    autoOpenedUserRef.current = targetUserId;
    void startDM(targetUserId).finally(() => {
      setSearchParams({}, { replace: true });
    });
  }, [friendIds, searchParams, setSearchParams, startDM]);

  const groupedMessages = messages.reduce<{ date: string; msgs: any[] }[]>((acc, msg) => {
    const dateStr = formatMessageDate(msg.created_at);
    const last = acc[acc.length - 1];
    if (last && last.date === dateStr) {
      last.msgs.push(msg);
    } else {
      acc.push({ date: dateStr, msgs: [msg] });
    }
    return acc;
  }, []);

  // WhatsApp-style conversation view
  if (activeRoom) {
    return (
      <div className="bg-background min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 px-3 py-2.5 flex items-center gap-3 bg-primary shadow-md">
          <button onClick={() => { setActiveRoom(null); setReplyTo(null); }} className="text-primary-foreground p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
            {activeRoom.displayAvatar ? (
              <img src={activeRoom.displayAvatar} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-sm font-bold text-primary-foreground">{getInitials(activeRoom.displayName)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary-foreground truncate">{activeRoom.displayName}</p>
            <p className="text-[11px] text-primary-foreground/70">
              {typingUsers.length > 0 ? `${typingUsers.join(", ")} typing...` : activeRoom.is_group ? `${messages.length} messages` : "tap here for contact info"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCallMode("video")} className="p-2 text-primary-foreground/80 hover:text-primary-foreground"><Video className="w-5 h-5" /></button>
            <button onClick={() => setCallMode("audio")} className="p-2 text-primary-foreground/80 hover:text-primary-foreground"><Phone className="w-5 h-5" /></button>
            <button className="p-2 text-primary-foreground/80 hover:text-primary-foreground"><MoreVertical className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 chat-wallpaper">
          {hasOlderMessages && (
            <div className="flex justify-center pb-2">
              <Button variant="secondary" size="sm" onClick={loadOlderMessages} disabled={loadingOlder}>
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </Button>
            </div>
          )}
          {groupedMessages.map((group, gi) => (
            <div key={gi}>
              <div className="flex items-center justify-center my-3">
                <span className="text-[11px] bg-card/90 text-muted-foreground px-3 py-1 rounded-lg shadow-sm font-medium">{group.date}</span>
              </div>
              {group.msgs.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                const isRead = msg.is_read || msg.read_by?.length > 1;
                const hasLegacyReply = msg.content?.startsWith("↩️");
                const repliedMessage = msg.reply_to_message_id ? messages.find((item) => item.id === msg.reply_to_message_id) : null;
                const hasReply = Boolean(repliedMessage) || hasLegacyReply;
                const isLegacyImage = msg.content?.startsWith("📷 http");
                const imageUrl = msg.media_url || (isLegacyImage ? msg.content.replace("📷 ", "") : null);

                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm relative group ${
                        isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card text-foreground rounded-bl-md"
                      }`}
                    >
                      {hasReply && !imageUrl && (
                        <div className={`text-[11px] mb-1 px-2 py-1 rounded-lg border-l-2 ${isMine ? "bg-white/10 border-white/30" : "bg-muted border-primary/30"}`}>
                          {repliedMessage?.content || msg.content.split("\n\n")[0].replace("↩️ ", "")}
                        </div>
                      )}
                      {imageUrl ? (
                        <img src={imageUrl!} alt="Shared" className="rounded-xl max-h-48 object-cover" loading="lazy" />
                      ) : (
                        <p className="text-sm leading-relaxed">{hasLegacyReply ? msg.content.split("\n\n").slice(1).join("\n\n") : msg.content}</p>
                      )}
                      <div className={`flex items-center justify-end gap-1 mt-0.5 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        <span className="text-[10px]">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {isMine && msg.status === "sending" && <span className="text-[9px]">Sending…</span>}
                        {isMine && msg.status === "failed" && (
                          <button className="text-[9px] underline" onClick={() => void retryMessage(msg)}>Retry</button>
                        )}
                        {isMine && msg.status !== "sending" && msg.status !== "failed" && (isRead ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" /> : <Check className="w-3.5 h-3.5" />)}
                      </div>
                      <button onClick={() => setReplyTo(msg)}
                        className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border rounded-full p-1 shadow-sm">
                        <Reply className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {replyTo && (
          <div className="bg-muted/50 px-4 py-2 flex items-center gap-2 border-t border-border">
            <Reply className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-xs text-muted-foreground flex-1 truncate">{replyTo.content}</p>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="sticky bottom-0 bg-card border-t border-border px-2 py-2 flex items-center gap-2">
          <button className="p-2 text-muted-foreground hover:text-foreground"><Smile className="w-5 h-5" /></button>
          <button disabled={uploadingImage} onClick={() => fileInputRef.current?.click()} className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"><Paperclip className="w-5 h-5" /></button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) sendImage(file);
            e.target.value = "";
          }} />
          <Input
            placeholder="Type a message"
            value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 h-10 rounded-full bg-secondary border-0"
          />
          {newMessage.trim() ? (
            <button onClick={sendMessage} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors">
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>
        {callMode && (
          <Suspense fallback={null}>
            <CallModal roomId={activeRoom.id} mode={callMode} onClose={() => setCallMode(null)} />
          </Suspense>
        )}
      </div>
    );
  }

  const filteredRooms = (rooms?.filter((r: any) => tab === "messages" ? !r.is_group : r.is_group) || [])
    .filter((r: any) => !searchQuery || r.displayName?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="bg-background min-h-screen">
      <header className="sticky top-0 z-40 bg-primary">
        <div className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between max-w-lg mx-auto mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-1 text-primary-foreground hover-scale"><ArrowLeft className="w-5 h-5" /></button>
              <h1 className="text-xl font-bold text-primary-foreground">Chats</h1>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 text-primary-foreground hover-scale"><Search className="w-5 h-5" /></button>
              <Dialog>
                <DialogTrigger asChild>
                  <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover-scale"><Plus className="w-5 h-5 text-primary-foreground" /></button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>New Conversation</DialogTitle></DialogHeader>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setShowCreateGroup(true)}>
                      <UsersIcon className="w-4 h-4" /> Create Group
                    </Button>
                    <p className="text-xs text-muted-foreground pt-2 px-1 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Only your connections
                    </p>
                    {friendProfiles?.length ? friendProfiles.map((p: any) => (
                      <button key={p.user_id} onClick={() => startDM(p.user_id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                          : <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-xs font-bold text-primary">{getInitials(p.name)}</span></div>}
                        <span className="text-sm font-medium text-foreground">{p.name || "User"}</span>
                      </button>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No connections yet. Connect with people first!</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="max-w-lg mx-auto pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
              <input placeholder="Search or start new chat" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-10 pr-4 rounded-lg bg-white/15 text-primary-foreground text-sm placeholder:text-primary-foreground/50 border-0 outline-none focus:bg-white/25 transition-colors" />
            </div>
          </div>
        </div>
        <div className="max-w-lg mx-auto flex">
          <button onClick={() => setTab("messages")} className={`flex-1 text-sm font-semibold py-3 border-b-2 transition-colors ${tab === "messages" ? "border-white text-primary-foreground" : "border-transparent text-primary-foreground/50"}`}>Chats</button>
          <button onClick={() => setTab("groups")} className={`flex-1 text-sm font-semibold py-3 border-b-2 transition-colors ${tab === "groups" ? "border-white text-primary-foreground" : "border-transparent text-primary-foreground/50"}`}>Groups</button>
        </div>
      </header>

      {showCreateGroup && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
            <button onClick={() => setShowCreateGroup(false)} className="text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-foreground flex-1">New Group</h2>
            <Button size="sm" disabled={!groupName.trim() || selectedMembers.length === 0 || !canCreateGroupWithMembers} onClick={createGroup} className="rounded-full">Create</Button>
          </div>
          <div className="px-4 py-3">
            <Input placeholder="Group subject" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="h-11 rounded-xl bg-secondary border-0 mb-3" />
            <p className="text-xs text-muted-foreground mb-1">Add from your connections ({selectedMembers.length} selected)</p>
            <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><Lock className="w-3 h-3" /> Only your connections can be added to groups</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-1">
            {friendProfiles?.map((p: any) => {
              const isSelected = selectedMembers.includes(p.user_id);
              return (
                <button key={p.user_id} onClick={() => setSelectedMembers(prev => isSelected ? prev.filter(id => id !== p.user_id) : [...prev, p.user_id])}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-muted/50"}`}>
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  {p.avatar_url ? <img src={p.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                    : <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-xs font-bold text-primary">{getInitials(p.name)}</span></div>}
                  <span className="text-sm font-medium text-foreground">{p.name || "User"}</span>
                </button>
              );
            })}
            {(!friendProfiles || friendProfiles.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-8">No connections to add. Connect with people first!</p>
            )}
          </div>
        </div>
      )}

      <main className="max-w-lg mx-auto">
        {filteredRooms.length > 0 ? filteredRooms.map((room: any, i: number) => (
          <div key={room.id} onClick={() => setActiveRoom(room)}
            className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors press-scale animate-fade-in"
            style={{ animationDelay: `${i * 50}ms` }}>
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {room.displayAvatar ? <img src={room.displayAvatar} className="w-full h-full object-cover" alt="" loading="lazy" />
                  : <span className="text-lg font-bold text-primary">{getInitials(room.displayName)}</span>}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-foreground truncate">{room.displayName}</p>
                <span className={`text-[11px] flex-shrink-0 ${room.unreadCount > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                  {room.lastMessage ? formatDistanceToNow(new Date(room.lastMessage.created_at), { addSuffix: false }) : ""}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-muted-foreground truncate pr-2 flex items-center gap-1">
                  {room.lastMessage?.sender_id === user?.id && <CheckCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                  {room.lastMessage?.content?.startsWith("📷") ? "📷 Photo" : (room.lastMessage?.content || "No messages yet")}
                </p>
                {room.unreadCount > 0 && (
                  <span className="flex-shrink-0 min-w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
                    {room.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground text-sm">No conversations yet</p>
            <p className="text-xs text-muted-foreground mt-1">Tap + to start chatting with your connections</p>
          </div>
        )}
      </main>
      {callMode && activeRoom && (
        <Suspense fallback={null}>
          <CallModal roomId={activeRoom.id} mode={callMode} onClose={() => setCallMode(null)} />
        </Suspense>
      )}
    </div>
  );
};

export default Chats;
