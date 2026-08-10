import { useState, useRef } from "react";
import { ImageIcon, Send, X, Film, Music, Smile } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const getInitials = (name?: string | null): string => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const PostComposer = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) return;
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("post-images").upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from("posts").insert({
        content: content || (imageUrl ? "📷" : ""),
        is_anonymous: false,
        author_id: user.id,
        community_id: "default",
        image_url: imageUrl,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      setImageFile(null);
      setImagePreview(null);
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["home-posts"] });
      toast.success("Posted!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setExpanded(true);
  };

  if (!user) return null;

  return (
    <div className="bg-card border-b border-border px-4 py-3">
      <div className="max-w-lg lg:max-w-3xl mx-auto">
        <div className="flex items-start gap-3">
          <button className="flex-shrink-0 mt-1">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{getInitials(profile?.name)}</span>
              </div>
            )}
          </button>
          <div className="flex-1">
            {expanded ? (
              <Textarea
                autoFocus
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[80px] bg-secondary border-border resize-none text-sm"
                rows={3}
              />
            ) : (
              <button
                onClick={() => setExpanded(true)}
                className="w-full text-left px-4 py-2.5 rounded-full bg-secondary text-sm text-muted-foreground hover:bg-accent transition-colors"
              >
                What's on your mind?
              </button>
            )}

            {imagePreview && (
              <div className="relative inline-block mt-2">
                <img src={imagePreview} alt="Preview" className="h-24 rounded-xl object-cover" />
                <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {expanded && (
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-accent transition-colors">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-accent transition-colors">
                    <Film className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-accent transition-colors">
                    <Music className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-accent transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setExpanded(false); setContent(""); setImageFile(null); setImagePreview(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full">
                    Cancel
                  </button>
                  {(content.trim() || imageFile) && (
                    <button onClick={() => createPost.mutate()} disabled={createPost.isPending}
                      className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full hover:opacity-90 transition-opacity flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Post
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleImageSelect} />
      </div>
    </div>
  );
};

export default PostComposer;
