import { Heart, MessageCircle, Share2, Flag, Trash2, UserCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface PostCardProps {
  id: string;
  authorId?: string;
  authorSlug?: string;
  authorName: string;
  authorHeadline?: string;
  avatarUrl?: string;
  isAnonymous: boolean;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  canDelete?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onReport?: () => void;
  onDelete?: () => void;
}

const PostCard = ({
  authorId,
  authorSlug,
  authorName,
  authorHeadline,
  avatarUrl,
  isAnonymous,
  content,
  createdAt,
  likesCount,
  commentsCount,
  isLiked,
  canDelete,
  onLike,
  onComment,
  onShare,
  onReport,
  onDelete,
}: PostCardProps) => {
  const navigate = useNavigate();
  const displayName = isAnonymous ? "Anonymous" : authorName;
  const displayHeadline = isAnonymous ? "Community Member" : authorHeadline;
  const profileUrl = authorSlug ? `/u/${authorSlug}` : authorId ? `/profile/${authorId}` : null;
  const handleProfileClick = () => {
    if (!isAnonymous && profileUrl) navigate(profileUrl);
  };

  return (
    <article className="bg-card border-b border-border px-4 py-4 animate-fade-in">
      <div className="flex gap-3 max-w-lg mx-auto">
        {/* Avatar */}
        <div className={`flex-shrink-0 ${!isAnonymous && profileUrl ? 'cursor-pointer' : ''}`} onClick={handleProfileClick}>
          {isAnonymous ? (
            <div className="w-10 h-10 rounded-full bg-anonymous/20 flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-anonymous" />
            </div>
          ) : avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">{displayName[0]}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-sm text-foreground">{displayName}</p>
              {displayHeadline && (
                <p className="text-xs text-muted-foreground">{displayHeadline}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex gap-1">
              {canDelete && onDelete && (
                <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {onReport && (
                <button onClick={onReport} className="p-1.5 text-muted-foreground hover:text-warning transition-colors">
                  <Flag className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{content}</p>

          {/* Actions */}
          <div className="flex items-center gap-6 mt-3">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                isLiked ? "text-primary font-medium" : "text-muted-foreground"
              }`}
            >
              <Heart className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} />
              {likesCount > 0 && likesCount}
            </button>
            <button onClick={onComment} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageCircle className="w-4 h-4" />
              {commentsCount > 0 && commentsCount}
            </button>
            <button onClick={onShare} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default PostCard;
