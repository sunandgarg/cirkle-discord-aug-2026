import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface EventCardProps {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  location?: string;
  rsvpStatus?: "going" | "not_going" | null;
  attendeeCount?: number;
  onRsvp?: (status: "going" | "not_going") => void;
  onClick?: () => void;
}

const EventCard = ({
  title,
  startTime,
  location,
  rsvpStatus,
  attendeeCount,
  onRsvp,
  onClick,
}: EventCardProps) => (
  <div className="bg-card border border-border rounded-lg p-4 animate-fade-in">
    <button onClick={onClick} className="w-full text-left">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-primary">{format(new Date(startTime), "MMM")}</span>
          <span className="text-lg font-bold text-primary leading-none">{format(new Date(startTime), "d")}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            <Calendar className="w-3 h-3 inline mr-1" />
            {format(new Date(startTime), "EEE, MMM d · h:mm a")}
          </p>
          {location && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 inline mr-1" />{location}
            </p>
          )}
          {attendeeCount !== undefined && attendeeCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <Users className="w-3 h-3 inline mr-1" />{attendeeCount} going
            </p>
          )}
        </div>
      </div>
    </button>
    {onRsvp && (
      <div className="flex gap-2 mt-3 ml-15">
        <Button
          size="sm"
          variant={rsvpStatus === "going" ? "default" : "outline"}
          className="text-xs h-8"
          onClick={() => onRsvp("going")}
        >
          Going
        </Button>
        <Button
          size="sm"
          variant={rsvpStatus === "not_going" ? "destructive" : "outline"}
          className="text-xs h-8"
          onClick={() => onRsvp("not_going")}
        >
          Not Going
        </Button>
      </div>
    )}
  </div>
);

export default EventCard;
