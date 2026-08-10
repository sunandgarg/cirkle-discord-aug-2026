import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import { Calendar as CalendarIcon, Plus, MapPin, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameDay } from "date-fns";

const CalendarPage = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [form, setForm] = useState({ title: "", description: "", start_time: "", end_time: "", location: "" });
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin-calendar", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      return (data && data.length > 0) || false;
    },
    enabled: !!user,
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: myRsvps } = useQuery({
    queryKey: ["my-rsvps"],
    queryFn: async () => {
      if (!user) return {};
      const { data } = await supabase.from("rsvps").select("event_id, status").eq("user_id", user.id);
      const map: Record<string, string> = {};
      data?.forEach((r) => { map[r.event_id] = r.status; });
      return map;
    },
    enabled: !!user,
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").insert({ ...form, created_by: user!.id, community_id: "default" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      setForm({ title: "", description: "", start_time: "", end_time: "", location: "" });
      toast.success("Event created!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rsvp = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: string }) => {
      if (!user) return;
      const existing = myRsvps?.[eventId];
      if (existing === status) {
        await supabase.from("rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
      } else {
        await supabase.from("rsvps").upsert({ event_id: eventId, user_id: user.id, status }, { onConflict: "event_id,user_id" });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-rsvps"] }),
  });

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const eventsOnDate = (d: Date) => events?.filter((e: any) => isSameDay(new Date(e.start_time), d)) ?? [];
  const filteredEvents = selectedDate
    ? events?.filter((e: any) => isSameDay(new Date(e.start_time), selectedDate))
    : events?.filter((e: any) => isSameMonth(new Date(e.start_time), currentMonth));

  return (
    <div className="bg-background min-h-screen">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-lg font-bold text-foreground">Calendar</h1>
            <p className="text-xs text-muted-foreground">Community events</p>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="w-4 h-4" />New</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div><Label>Start</Label><Input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div><Label>End</Label><Input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                  <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                  <Button className="w-full" onClick={() => createEvent.mutate()} disabled={!form.title || !form.start_time}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 text-muted-foreground">←</button>
          <h2 className="text-sm font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 text-muted-foreground">→</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 mb-6">
          {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((day) => {
            const hasEvent = eventsOnDate(day).length > 0;
            const selected = selectedDate && isSameDay(day, selectedDate);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(selected ? null : day)}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors relative ${
                  selected ? "bg-primary text-primary-foreground" :
                  isToday(day) ? "bg-primary/10 text-primary font-bold" :
                  "text-foreground hover:bg-muted"
                }`}
              >
                {day.getDate()}
                {hasEvent && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {/* Events list */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "This Month"}
          </h3>
          {isLoading ? (
            [1, 2].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))
          ) : filteredEvents && filteredEvents.length > 0 ? (
            filteredEvents.map((event: any) => (
              <div key={event.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{format(new Date(event.start_time), "MMM")}</span>
                    <span className="text-lg font-bold text-primary leading-none">{format(new Date(event.start_time), "d")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-foreground">{event.title}</h4>
                    {event.description && <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(event.start_time), "h:mm a")}</span>
                      {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                    </div>
                  </div>
                </div>
                {user && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant={myRsvps?.[event.id] === "going" ? "default" : "outline"} className="text-xs h-8 flex-1"
                      onClick={() => rsvp.mutate({ eventId: event.id, status: "going" })}>
                      Going
                    </Button>
                    <Button size="sm" variant={myRsvps?.[event.id] === "not_going" ? "destructive" : "outline"} className="text-xs h-8 flex-1"
                      onClick={() => rsvp.mutate({ eventId: event.id, status: "not_going" })}>
                      Not Going
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <EmptyState icon={CalendarIcon} title="No events" description={selectedDate ? "No events on this date." : "No events this month."} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
