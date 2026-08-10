import { ArrowLeft, Search, Plus, Send, Check, CheckCheck, Smile, Reply, Users as UsersIcon, X, Phone, Video, MoreVertical, Mic, Paperclip, Image as ImageIcon, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
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
import CallModal from "@/components/CallModal";

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
  const { user } = useAuth();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [callMode, setCallMode] = useState<"audio" | "video" | null>(null);

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
    queryKey: ["chat-rooms"],
    queryFn: async () => {
      if (!user) return [];
      const { data: memberships } = await supabase.from("chat_members").select("room_id").eq("user_id", user.id);
      if (!memberships?.length) return [];
      const roomIds = memberships.map((m) => m.room_id);
      const { data: roomsData } = await supabase.from("chat_rooms").select("*").in("id", roomIds);

      const enriched = await Promise.all((roomsData || []).map(async (room) => {
        const { data: lastMsg } = await supabase.from("messages").select("content, created_at, sender_id")
          .eq("room_id", room.id).order("created_at", { ascending: false }).limit(1);
        let otherProfile = null;
        if (!room.is_group) {
          const { data: members } = await supabase.from("chat_members").select("user_id")
            .eq("room_id", room.id).neq("user_id", user.id);
          if (members?.[0]) {
            const { data: prof } = await supabase.from("profiles").select("name, avatar_url")
              .eq("user_id", members[0].user_id).maybeSingle();
            otherProfile = prof;
          }
        }
        const { data: unreadMsgs } = await supabase.from("messages").select("id")
          .eq("room_id", room.id).not("read_by", "cs", `{${user.id}}`);
        return {
          ...room, lastMessage: lastMsg?.[0] || null, otherProfile,
          unreadCount: unreadMsgs?.length || 0,
          displayName: room.is_group ? room.name : (otherProfile?.name || "User"),
          displayAvatar: room.is_group ? room.avatar_url : otherProfile?.avatar_url,
        };
      }));

      return enriched.sort((a, b) => {
        const aTime = a.lastMessage?.created_at || a.created_at;
        const bTime = b.lastMessage?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!activeRoom) return;
    const fetchMessages = async () => {
      const { data } = await supabase.from("messages").select("*")
        .eq("room_id", activeRoom.id).order("created_at", { ascending: true });
      setMessages(data || []);
      const unread = data?.filter((m) => !m.read_by?.includes(user?.id)) || [];
      for (const msg of unread) {
        await supabase.from("messages").update({ read_by: [...(msg.read_by || []), user?.id] }).eq("id", msg.id);
      }
    };
    fetchMessages();

    const msgChannel = supabase
      .channel(`room-msgs-${activeRoom.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${activeRoom.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (payload.new.sender_id !== user?.id) {
            supabase.from("messages").update({ read_by: [...(payload.new.read_by || []), user?.id] }).eq("id", payload.new.id);
          }
        })
      .subscribe();

    const typingChannel = supabase
      .channel(`room-typing-${activeRoom.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_members", filter: `room_id=eq.${activeRoom.id}` },
        async (payload) => {
          const updated = payload.new as any;
          if (updated.user_id === user?.id) return;
          if (updated.typing_at) {
            const { data: prof } = await supabase.from("profiles").select("name").eq("user_id", updated.user_id).maybeSingle();
            const name = prof?.name || "Someone";
            setTypingUsers((prev) => prev.includes(name) ? prev : [...prev, name]);
            setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== name)), 3000);
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(msgChannel); supabase.removeChannel(typingChannel); };
  }, [activeRoom?.id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTyping = () => {
    if (!activeRoom || !user) return;
    supabase.from("chat_members").update({ typing_at: new Date().toISOString() } as any).eq("room_id", activeRoom.id).eq("user_id", user.id).then();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      supabase.from("chat_members").update({ typing_at: null } as any).eq("room_id", activeRoom.id).eq("user_id", user.id).then();
    }, 2000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !activeRoom) return;
    const content = replyTo ? `↩️ ${replyTo.content.substring(0, 40)}${replyTo.content.length > 40 ? "..." : ""}\n\n${newMessage}` : newMessage;
    const { error } = await supabase.from("messages").insert({
      content, room_id: activeRoom.id, sender_id: user.id, read_by: [user.id],
    });
    if (error) toast.error(error.message);
    setNewMessage(""); setReplyTo(null);
    queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
  };

  const sendImage = async (file: File) => {
    if (!user || !activeRoom) return;
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("post-images").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
      await supabase.from("messages").insert({
        content: `📷 ${urlData.publicUrl}`, room_id: activeRoom.id, sender_id: user.id, read_by: [user.id],
      });
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    } catch (err: any) {
      toast.error(err.message);
    }
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
    const { data: room, error: roomError } = await supabase.from("chat_rooms").insert({
      name: groupName, is_group: true, created_by: user.id,
    }).select().single();
    if (roomError) { toast.error(roomError.message); return; }
    const members = [...selectedMembers, user.id].map((uid) => ({ room_id: room.id, user_id: uid }));
    await supabase.from("chat_members").insert(members);
    setShowCreateGroup(false); setGroupName(""); setSelectedMembers([]);
    queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    toast.success("Group created!");
  };

  const startDM = async (otherUserId: string) => {
    if (!user) return;
    // Check if other user is a friend
    if (!friendIds?.includes(otherUserId)) {
      toast.error("You can only message your connections");
      return;
    }
    const { data: myRooms } = await supabase.from("chat_members").select("room_id").eq("user_id", user.id);
    const { data: theirRooms } = await supabase.from("chat_members").select("room_id").eq("user_id", otherUserId);
    const myRoomIds = myRooms?.map(r => r.room_id) || [];
    const theirRoomIds = theirRooms?.map(r => r.room_id) || [];
    const shared = myRoomIds.filter(id => theirRoomIds.includes(id));
    if (shared.length > 0) {
      const { data: existingDM } = await supabase.from("chat_rooms").select("*").in("id", shared).eq("is_group", false).limit(1);
      if (existingDM?.[0]) {
        const enriched = { ...existingDM[0], displayName: friendProfiles?.find(p => p.user_id === otherUserId)?.name || "User", displayAvatar: friendProfiles?.find(p => p.user_id === otherUserId)?.avatar_url };
        setActiveRoom(enriched); return;
      }
    }
    const { data: room } = await supabase.from("chat_rooms").insert({ is_group: false, created_by: user.id }).select().single();
    if (room) {
      await supabase.from("chat_members").insert([{ room_id: room.id, user_id: user.id }, { room_id: room.id, user_id: otherUserId }]);
      const enriched = { ...room, displayName: friendProfiles?.find(p => p.user_id === otherUserId)?.name || "User", displayAvatar: friendProfiles?.find(p => p.user_id === otherUserId)?.avatar_url };
      setActiveRoom(enriched);
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    }
  };

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
          {groupedMessages.map((group, gi) => (
            <div key={gi}>
              <div className="flex items-center justify-center my-3">
                <span className="text-[11px] bg-card/90 text-muted-foreground px-3 py-1 rounded-lg shadow-sm font-medium">{group.date}</span>
              </div>
              {group.msgs.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                const isRead = msg.read_by?.length > 1;
                const hasReply = msg.content.startsWith("↩️");
                const isImage = msg.content.startsWith("📷 http");
                const imageUrl = isImage ? msg.content.replace("📷 ", "") : null;

                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm relative group ${
                        isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card text-foreground rounded-bl-md"
                      }`}
                    >
                      {hasReply && !isImage && (
                        <div className={`text-[11px] mb-1 px-2 py-1 rounded-lg border-l-2 ${isMine ? "bg-white/10 border-white/30" : "bg-muted border-primary/30"}`}>
                          {msg.content.split("\n\n")[0].replace("↩️ ", "")}
                        </div>
                      )}
                      {isImage ? (
                        <img src={imageUrl!} alt="Shared" className="rounded-xl max-h-48 object-cover" loading="lazy" />
                      ) : (
                        <p className="text-sm leading-relaxed">{hasReply ? msg.content.split("\n\n").slice(1).join("\n\n") : msg.content}</p>
                      )}
                      <div className={`flex items-center justify-end gap-1 mt-0.5 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        <span className="text-[10px]">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {isMine && (isRead ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" /> : <Check className="w-3.5 h-3.5" />)}
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
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-muted-foreground hover:text-foreground"><Paperclip className="w-5 h-5" /></button>
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
        <CallModal roomId={activeRoom.id} mode={callMode} onClose={() => setCallMode(null)} />
      )}
    </div>
  );
};

export default Chats;
