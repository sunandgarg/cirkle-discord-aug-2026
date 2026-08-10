import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Heart, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Story {
  id: string;
  image_url: string | null;
  content: string | null;
  created_at: string;
  profile?: { name: string | null; avatar_url: string | null } | null;
}

interface StoryGroup {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  stories: Story[];
}

interface StoryViewerProps {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

const StoryViewer = ({ groups, initialGroupIndex, onClose }: StoryViewerProps) => {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const DURATION = 5000;

  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      if (isPaused) return;
      setProgress((p) => {
        if (p >= 100) {
          goNext();
          return 0;
        }
        return p + 100 / (DURATION / 50);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [groupIdx, storyIdx, isPaused]);

  const goNext = useCallback(() => {
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [storyIdx, groupIdx, group, groups, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(0);
    }
  }, [storyIdx, groupIdx]);

  if (!group || !story) return null;

  // Instagram-style gradient backgrounds for text stories
  const textGradients = [
    "from-[hsl(280,80%,40%)] to-[hsl(320,70%,50%)]",
    "from-[hsl(200,80%,40%)] to-[hsl(170,70%,40%)]",
    "from-[hsl(340,70%,45%)] to-[hsl(30,80%,50%)]",
    "from-[hsl(220,70%,48%)] to-[hsl(260,65%,55%)]",
  ];
  const gradientClass = textGradients[groupIdx % textGradients.length];

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      {/* Story container with Instagram aspect ratio */}
      <div className="relative w-full h-full max-w-[420px] max-h-[750px] mx-auto overflow-hidden rounded-none sm:rounded-3xl">
        {/* Progress bars — Instagram style */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                  transition: i === storyIdx ? "none" : "width 0.3s ease",
                }}
              />
            </div>
          ))}
        </div>

        {/* User info — Instagram style */}
        <div className="absolute top-5 left-0 right-0 z-20 flex items-center gap-3 px-4 pt-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden ring-2 ring-white/40">
            {group.avatarUrl ? (
              <img src={group.avatarUrl} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-xs font-bold text-white">{group.userName[0]}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white drop-shadow-sm">{group.userName}</p>
            <p className="text-[11px] text-white/70">
              {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Story content */}
        <div className="w-full h-full flex items-center justify-center"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}>
          {story.image_url ? (
            <img src={story.image_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex items-center justify-center p-8`}>
              <p className="text-2xl text-white text-center font-bold leading-relaxed drop-shadow-lg">{story.content}</p>
            </div>
          )}
        </div>

        {/* Tap zones */}
        <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={goPrev} aria-label="Previous" />
        <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={goNext} aria-label="Next" />

        {/* Bottom input — Instagram style */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-2 px-4 pb-6 pt-10 bg-gradient-to-t from-black/60 to-transparent">
          <input
            placeholder="Send message"
            className="flex-1 bg-white/15 backdrop-blur-sm text-white text-sm rounded-full px-4 py-2.5 border border-white/20 placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/40"
          />
          <button className="p-2 text-white/80 hover:text-red-400 transition-colors">
            <Heart className="w-6 h-6" />
          </button>
          <button className="p-2 text-white/80 hover:text-white transition-colors">
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Side navigation — desktop */}
      {groupIdx > 0 && (
        <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors hidden md:block">
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {groupIdx < groups.length - 1 && (
        <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors hidden md:block">
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default StoryViewer;
