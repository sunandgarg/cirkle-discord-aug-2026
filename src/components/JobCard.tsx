import { MapPin, Clock, Briefcase } from "lucide-react";

interface JobCardProps {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: string;
  experience?: string;
  createdAt: string;
  onClick?: () => void;
}

const JobCard = ({ title, company, location, jobType, experience, onClick }: JobCardProps) => (
  <button
    onClick={onClick}
    className="w-full text-left bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow animate-fade-in"
  >
    <div className="flex gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Briefcase className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-foreground truncate">{title}</h3>
        <p className="text-xs text-muted-foreground">{company}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />{location}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />{jobType}
          </span>
          {experience && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-badge text-badge-foreground">
              {experience}
            </span>
          )}
        </div>
      </div>
    </div>
  </button>
);

export default JobCard;
