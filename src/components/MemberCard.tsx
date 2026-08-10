import { MapPin, UserPlus, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MemberCardProps {
  id: string;
  slug?: string;
  name: string;
  headline?: string;
  location?: string;
  skills?: string[];
  avatarUrl?: string;
  connectionStatus?: "none" | "pending_sent" | "pending_received" | "connected";
  onConnect?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onClick?: () => void;
}

const MemberCard = ({
  name,
  headline,
  location,
  skills,
  avatarUrl,
  connectionStatus = "none",
  onConnect,
  onAccept,
  onDecline,
  onClick,
}: MemberCardProps) => (
  <div className="bg-card border border-border rounded-lg p-4 animate-fade-in">
    <button onClick={onClick} className="w-full text-left">
      <div className="flex gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-base font-semibold text-primary">{name[0]}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground">{name}</h3>
          {headline && <p className="text-xs text-muted-foreground truncate">{headline}</p>}
          {location && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 inline mr-1" />{location}
            </p>
          )}
          {skills && skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skills.slice(0, 3).map((skill) => (
                <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-badge text-badge-foreground">
                  {skill}
                </span>
              ))}
              {skills.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{skills.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
    <div className="flex gap-2 mt-3 justify-end">
      {connectionStatus === "none" && onConnect && (
        <Button size="sm" className="text-xs h-8 gap-1" onClick={onConnect}>
          <UserPlus className="w-3.5 h-3.5" /> Connect
        </Button>
      )}
      {connectionStatus === "pending_sent" && (
        <Button size="sm" variant="outline" className="text-xs h-8 gap-1" disabled>
          <Clock className="w-3.5 h-3.5" /> Pending
        </Button>
      )}
      {connectionStatus === "pending_received" && (
        <>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={onDecline}>
            Decline
          </Button>
          <Button size="sm" className="text-xs h-8 gap-1" onClick={onAccept}>
            <Check className="w-3.5 h-3.5" /> Accept
          </Button>
        </>
      )}
      {connectionStatus === "connected" && (
        <Button size="sm" variant="secondary" className="text-xs h-8" disabled>
          Connected
        </Button>
      )}
    </div>
  </div>
);

export default MemberCard;
