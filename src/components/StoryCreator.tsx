import { useState, useRef } from "react";
import { X, Camera, Type, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface StoryCreatorProps {
  onClose: () => void;
}

const StoryCreator = ({ onClose }: StoryCreatorProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"choose" | "text" | "image">("choose");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMode("image");
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("stories")
          .upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("stories").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        content: text || null,
        image_url: imageUrl,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story posted!");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="text-white p-1"><X className="w-6 h-6" /></button>
        <h2 className="text-white font-semibold text-sm">Create Story</h2>
        <div className="w-8" />
      </div>

      {mode === "choose" && (
        <div className="flex-1 flex items-center justify-center gap-6">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Camera className="w-10 h-10 text-white" />
            <span className="text-white font-medium text-sm">Photo</span>
          </button>
          <button
            onClick={() => setMode("text")}
            className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Type className="w-10 h-10 text-white" />
            <span className="text-white font-medium text-sm">Text</span>
          </button>
        </div>
      )}

      {mode === "text" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <Textarea
            placeholder="What's on your mind?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="bg-transparent border-0 text-white text-xl text-center placeholder:text-white/40 resize-none focus-visible:ring-0 min-h-[200px]"
            autoFocus
          />
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || loading}
            className="mt-6 gap-2 rounded-full px-8"
          >
            <Send className="w-4 h-4" /> Share Story
          </Button>
        </div>
      )}

      {mode === "image" && imagePreview && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <img src={imagePreview} className="max-h-[60vh] rounded-xl object-contain" alt="" />
          <Textarea
            placeholder="Add a caption..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-4 bg-white/10 border-0 text-white placeholder:text-white/40 resize-none focus-visible:ring-0 rounded-xl"
            rows={2}
          />
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-4 gap-2 rounded-full px-8"
          >
            <Send className="w-4 h-4" /> {loading ? "Posting..." : "Share Story"}
          </Button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
    </div>
  );
};

export default StoryCreator;
