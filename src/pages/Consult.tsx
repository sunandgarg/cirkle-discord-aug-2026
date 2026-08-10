import { useState } from "react";
import { BadgeCheck, MessageCircle, Phone, Video, Search, Star, Lock, X, Calendar, Clock, CheckCircle2, ArrowRight, Users, Sparkles, ExternalLink, Globe, Award } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const CATEGORIES = ["All", "Tech", "Finance", "Career", "Startups", "Research", "Design", "Legal"];
const TIME_SLOTS = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"];
const DURATION_OPTIONS = [15, 30, 45, 60];

const getInitials = (name?: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

// Topmate-style service card
const ServiceButton = ({ icon: Icon, label, price, color, active, onClick }: any) => (
  <button onClick={onClick}
    className={`flex-1 py-3 rounded-2xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all border-2 hover-scale ${
      active ? `${color} shadow-sm` : "bg-card border-border text-muted-foreground hover:border-primary/30"
    }`}>
    <Icon className="w-4 h-4" />
    <span>{label}</span>
    {price !== undefined && price !== null && <span className="text-[10px] opacity-75">₹{price}</span>}
  </button>
);

const Consult = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [bookingExpert, setBookingExpert] = useState<any>(null);
  const [bookingType, setBookingType] = useState<"chat" | "audio" | "video">("chat");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [bookingNotes, setBookingNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"mentors" | "bookings">("mentors");

  const isVerified = !!user && !!profile?.is_verified;

  // Only fetch mentors who opted in
  const { data: experts } = useQuery({
    queryKey: ["mentors", search, activeCategory],
    queryFn: async () => {
      let query: any = supabase.from("profiles").select("*").eq("is_mentor", true);
      if (search) query = query.or(`name.ilike.%${search}%,headline.ilike.%${search}%,skills.cs.{${search}}`);
      if (activeCategory !== "All") query = query.eq("mentor_category", activeCategory);
      query = query.order("is_verified", { ascending: false });
      const { data } = await query.limit(50);
      return (data ?? []) as any[];
    },
    staleTime: Infinity,
  });

  // My bookings — topmate-style
  const { data: myBookings } = useQuery({
    queryKey: ["my-consultations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("consultations").select("*").or(`client_id.eq.${user.id},consultant_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (!data?.length) return [];
      const userIds = [...new Set(data.map(b => b.consultant_id === user.id ? b.client_id : b.consultant_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", userIds);
      const pMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);
      return data.map(b => ({
        ...b,
        otherProfile: pMap.get(b.consultant_id === user.id ? b.client_id : b.consultant_id),
        isConsultant: b.consultant_id === user.id,
      }));
    },
    enabled: !!user,
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !bookingExpert) return;
      const amount = bookingType === "chat"
        ? (bookingExpert.mentor_price_chat || 200)
        : bookingType === "audio"
        ? (bookingExpert.mentor_price_audio || 300)
        : (bookingExpert.mentor_price_video || 400);

      const scheduledAt = selectedDate && selectedTime
        ? new Date(`${selectedDate}T${selectedTime.replace(" AM", ":00").replace(" PM", ":00").replace(/(\d+):/, (_, h) => {
            const hour = parseInt(h);
            if (selectedTime.includes("PM") && hour !== 12) return `${hour + 12}:`;
            if (selectedTime.includes("AM") && hour === 12) return "00:";
            return `${hour}:`;
          })}`).toISOString()
        : null;

      const { data: consultation, error } = await supabase.from("consultations").insert({
        consultant_id: bookingExpert.user_id, client_id: user.id, consultation_type: bookingType,
        scheduled_at: scheduledAt, amount, duration_minutes: selectedDuration,
        notes: bookingNotes || null, status: "pending",
      }).select("id").single();
      if (error) {
        if (error.message.includes("row-level security")) throw new Error("Please verify your account to book sessions");
        throw new Error("Booking failed. Please try again.");
      }

      // Send notification
      await supabase.from("notifications").insert({
        user_id: bookingExpert.user_id, type: "consultation_booking", title: "New Booking Request",
        message: `${profile?.name || "Someone"} booked a ${bookingType} session (${selectedDuration}min)`, entity_id: bookingExpert.user_id,
      });

      // Auto-create chat room via edge function
      if (consultation?.id) {
        try {
          await supabase.functions.invoke("create-consult-chat", {
            body: { consultation_id: consultation.id },
          });
        } catch {
          // Non-critical: chat room creation can be retried
          console.warn("Chat room creation deferred");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-consultations"] });
      setBookingExpert(null); setBookingNotes(""); setSelectedDate(""); setSelectedTime(""); setSelectedDuration(30);
      toast.success("Session booked! A chat has been created with your mentor. 🎉");
    },
    onError: (err: any) => toast.error(err.message || "Something went wrong"),
  });

  const updateBookingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from("consultations").update({ status }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-consultations"] });
      toast.success("Status updated!");
    },
  });

  const displayExperts = !user ? experts?.slice(0, 3) : isVerified ? experts : experts?.slice(0, 3);
  const hasBooked = (expertId: string) => myBookings?.some((b) => b.consultant_id === expertId && b.status !== "cancelled");

  const nextDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  return (
    <div className="bg-background flex flex-col min-h-0">
      {/* Booking Modal — topmate.io style */}
      {bookingExpert && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border p-6 animate-fade-in max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Expert mini card */}
            <div className="flex items-center gap-3 mb-5">
              {bookingExpert.avatar_url ? (
                <img src={bookingExpert.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/20" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{getInitials(bookingExpert.name)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-1">
                  {bookingExpert.name}
                  {bookingExpert.is_verified && <BadgeCheck className="w-4 h-4 text-primary" />}
                </h3>
                <p className="text-xs text-muted-foreground truncate">{bookingExpert.headline || "Mentor"}</p>
              </div>
              <button onClick={() => setBookingExpert(null)} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {/* Service type — topmate style */}
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Choose Service</Label>
            <div className="flex gap-2 mb-5">
              <ServiceButton icon={MessageCircle} label="Chat" price={bookingExpert.mentor_price_chat} color="bg-primary/10 border-primary text-primary" active={bookingType === "chat"} onClick={() => setBookingType("chat")} />
              <ServiceButton icon={Phone} label="Audio" price={bookingExpert.mentor_price_audio} color="bg-[hsl(var(--success))]/10 border-[hsl(var(--success))] text-[hsl(var(--success))]" active={bookingType === "audio"} onClick={() => setBookingType("audio")} />
              <ServiceButton icon={Video} label="Video" price={bookingExpert.mentor_price_video} color="bg-destructive/10 border-destructive text-destructive" active={bookingType === "video"} onClick={() => setBookingType("video")} />
            </div>

            {/* Duration */}
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block"><Clock className="w-3.5 h-3.5 inline mr-1" />Duration</Label>
            <div className="flex gap-2 mb-5">
              {DURATION_OPTIONS.map((d) => (
                <button key={d} onClick={() => setSelectedDuration(d)}
                  className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold transition-all border-2 ${
                    selectedDuration === d ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  }`}>{d} min</button>
              ))}
            </div>

            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block"><Calendar className="w-3.5 h-3.5 inline mr-1" />Pick a Date</Label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-1">
              {nextDates.map((d) => {
                const date = new Date(d);
                return (
                  <button key={d} onClick={() => setSelectedDate(d)}
                    className={`flex-shrink-0 w-16 py-2.5 rounded-2xl text-center transition-all border-2 ${
                      selectedDate === d ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-foreground border-border hover:border-primary/30"
                    }`}>
                    <p className="text-[10px] font-medium">{date.toLocaleDateString("en", { weekday: "short" })}</p>
                    <p className="text-lg font-bold">{date.getDate()}</p>
                  </button>
                );
              })}
            </div>

            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block"><Clock className="w-3.5 h-3.5 inline mr-1" />Pick a Time</Label>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {TIME_SLOTS.map((t) => (
                <button key={t} onClick={() => setSelectedTime(t)}
                  className={`py-2 rounded-xl text-[11px] font-semibold transition-all border ${
                    selectedTime === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  }`}>{t}</button>
              ))}
            </div>

            <div className="mb-5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What would you like to discuss?</Label>
              <Textarea placeholder="Share your goals, questions, or topics..." value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} className="bg-secondary border-border mt-2 rounded-2xl" rows={3} />
            </div>

            <Button className="w-full h-12 rounded-2xl text-sm font-bold gap-2" onClick={() => bookMutation.mutate()} disabled={bookMutation.isPending || !selectedDate || !selectedTime}>
              {bookMutation.isPending ? "Booking..." : <><Sparkles className="w-4 h-4" /> Confirm Booking — ₹{
                bookingType === "chat" ? (bookingExpert.mentor_price_chat || 200)
                : bookingType === "audio" ? (bookingExpert.mentor_price_audio || 300)
                : (bookingExpert.mentor_price_video || 400)
              }</>}
            </Button>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="flex-shrink-0 bg-background sticky top-0 z-10">
        <div className="px-4 pt-4 pb-2">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Consult</h1>
              <p className="text-xs text-muted-foreground">Book 1:1 sessions with verified experts</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">{experts?.length || 0} mentors</span>
            </div>
          </div>
        </div>

        {/* Tabs — topmate style */}
        <div className="px-4 py-1">
          <div className="max-w-lg mx-auto flex gap-2">
            <button onClick={() => setActiveTab("mentors")}
              className={`flex-1 text-xs font-semibold py-2.5 rounded-full transition-all ${activeTab === "mentors" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              <Users className="w-3.5 h-3.5 inline mr-1" />Mentors
            </button>
            <button onClick={() => setActiveTab("bookings")}
              className={`flex-1 text-xs font-semibold py-2.5 rounded-full transition-all ${activeTab === "bookings" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              <Calendar className="w-3.5 h-3.5 inline mr-1" />My Bookings
              {(myBookings?.filter(b => b.status === "pending").length || 0) > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground rounded-full px-1.5 text-[10px]">{myBookings?.filter(b => b.status === "pending").length}</span>
              )}
            </button>
          </div>
        </div>

        {activeTab === "mentors" && (
          <>
            <div className="px-4 py-2">
              <div className="max-w-lg mx-auto relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name, skill, or topic..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-12 rounded-2xl bg-card border-border w-full" />
              </div>
            </div>
            <div className="px-4 py-2 overflow-x-auto scrollbar-hide">
              <div className="max-w-lg mx-auto flex gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <main className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-4">
          {activeTab === "bookings" && (
            <>
              {!myBookings?.length ? (
                <div className="text-center py-16">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="font-bold text-foreground text-sm">No bookings yet</h3>
                  <p className="text-xs text-muted-foreground mt-1">Book a session with a mentor to get started</p>
                </div>
              ) : myBookings.map((booking: any) => (
                <div key={booking.id} className="bg-card border border-border rounded-2xl p-4 animate-fade-in">
                  <div className="flex items-center gap-3 mb-3">
                    {booking.otherProfile?.avatar_url ? (
                      <img src={booking.otherProfile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{getInitials(booking.otherProfile?.name)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{booking.otherProfile?.name || "User"}</p>
                      <p className="text-[10px] text-muted-foreground">{booking.isConsultant ? "Client" : "Mentor"} · {booking.consultation_type}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                      booking.status === "pending" ? "bg-warning/10 text-warning" :
                      booking.status === "confirmed" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" :
                      booking.status === "completed" ? "bg-primary/10 text-primary" :
                      "bg-destructive/10 text-destructive"
                    }`}>{booking.status}</span>
                  </div>
                  {booking.scheduled_at && (
                    <p className="text-xs text-muted-foreground mb-2">
                      📅 {new Date(booking.scheduled_at).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })} at {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {booking.duration_minutes && ` · ${booking.duration_minutes}min`}
                    </p>
                  )}
                  {booking.notes && <p className="text-xs text-muted-foreground mb-2">💬 {booking.notes}</p>}
                  <p className="text-xs font-semibold text-foreground">₹{booking.amount || 0}</p>
                  {/* Action buttons for consultant */}
                  {booking.isConsultant && booking.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 rounded-xl h-8 text-xs" onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "confirmed" })}>Accept</Button>
                      <Button size="sm" variant="outline" className="flex-1 rounded-xl h-8 text-xs" onClick={() => updateBookingStatus.mutate({ id: booking.id, status: "cancelled" })}>Decline</Button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {activeTab === "mentors" && (
            <>
              {(!experts || experts.length === 0) && !search && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-base">No mentors yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">Be the first! Enable mentoring in your profile settings.</p>
                </div>
              )}

              {displayExperts?.map((expert: any, i: number) => {
                const chatPrice = expert.mentor_price_chat;
                const audioPrice = expert.mentor_price_audio;
                const videoPrice = expert.mentor_price_video;
                const booked = hasBooked(expert.user_id);
                const skills = expert.skills || [];

                return (
                  <article key={expert.user_id}
                    className="bg-card border border-border rounded-3xl p-5 hover-lift cursor-pointer animate-fade-in overflow-hidden"
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => navigate(expert.slug ? `/u/${expert.slug}` : `/profile/${expert.user_id}`)}>
                    {/* Topmate-style header */}
                    <div className="flex items-start gap-3.5 mb-4">
                      {expert.avatar_url ? (
                        <img src={expert.avatar_url} alt={expert.name || ""} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 ring-2 ring-border" loading="lazy" />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl font-bold text-primary">{getInitials(expert.name)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="font-bold text-base text-foreground truncate">{expert.name || "Mentor"}</h2>
                          {expert.is_verified && <BadgeCheck className="w-4.5 h-4.5 text-primary flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{expert.headline || "Professional Mentor"}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {expert.iit_name && <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">{expert.iit_name}</span>}
                          {expert.mentor_category && <span className="text-[10px] bg-secondary text-muted-foreground px-2.5 py-0.5 rounded-full font-medium">{expert.mentor_category}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Bio snippet */}
                    {expert.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{expert.bio}</p>
                    )}

                    {/* Skills chips */}
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {skills.slice(0, 5).map((skill: string) => (
                          <span key={skill} className="text-[10px] bg-secondary text-muted-foreground px-2.5 py-1 rounded-full font-medium">{skill}</span>
                        ))}
                        {skills.length > 5 && <span className="text-[10px] text-muted-foreground px-1">+{skills.length - 5}</span>}
                      </div>
                    )}

                    {/* Topmate-style pricing buttons */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {!user || !isVerified ? (
                        <div className="flex-1 flex gap-2 opacity-50 pointer-events-none">
                          <div className="flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 pricing-chat"><MessageCircle className="w-3.5 h-3.5" /><span className="text-xs font-bold">₹{chatPrice || "—"}</span></div>
                          <div className="flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 pricing-audio"><Phone className="w-3.5 h-3.5" /><span className="text-xs font-bold">₹{audioPrice || "—"}</span></div>
                          <div className="flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 pricing-video"><Video className="w-3.5 h-3.5" /><span className="text-xs font-bold">₹{videoPrice || "—"}</span></div>
                        </div>
                      ) : booked ? (
                        <div className="flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border border-[hsl(var(--success))]/20">
                          <CheckCircle2 className="w-4 h-4" /><span className="text-xs font-bold">Booked</span>
                        </div>
                      ) : (
                        <>
                          {chatPrice && (
                            <button onClick={() => { setBookingExpert(expert); setBookingType("chat"); }}
                              className="flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 pricing-chat cursor-pointer hover:shadow-md transition-all hover-scale">
                              <MessageCircle className="w-3.5 h-3.5" /><span className="text-xs font-bold">₹{chatPrice}</span>
                            </button>
                          )}
                          {audioPrice && (
                            <button onClick={() => { setBookingExpert(expert); setBookingType("audio"); }}
                              className="flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 pricing-audio cursor-pointer hover:shadow-md transition-all hover-scale">
                              <Phone className="w-3.5 h-3.5" /><span className="text-xs font-bold">₹{audioPrice}</span>
                            </button>
                          )}
                          {videoPrice && (
                            <button onClick={() => { setBookingExpert(expert); setBookingType("video"); }}
                              className="flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 pricing-video cursor-pointer hover:shadow-md transition-all hover-scale">
                              <Video className="w-3.5 h-3.5" /><span className="text-xs font-bold">₹{videoPrice}</span>
                            </button>
                          )}
                          {!chatPrice && !audioPrice && !videoPrice && (
                            <button onClick={() => { setBookingExpert(expert); setBookingType("chat"); }}
                              className="flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 bg-primary/10 border border-primary text-primary cursor-pointer hover:shadow-md transition-all hover-scale">
                              <Sparkles className="w-3.5 h-3.5" /><span className="text-xs font-bold">Book Session</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}

              {(!user || !isVerified) && (experts?.length || 0) > 0 && (
                <div className="relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-8 text-center">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-bold text-foreground text-sm">{!user ? "Sign In to Book" : "Unlock All Mentors"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{!user ? "Sign in to see all mentors and book consultations." : "Verify your account to access all mentors."}</p>
                  <button onClick={() => navigate(!user ? "/auth" : "/iit-verify")} className="mt-4 px-6 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-full hover:opacity-90 transition-opacity">
                    {!user ? "Sign In" : "Verify Now"}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Consult;
