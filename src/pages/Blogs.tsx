import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, X, Pencil, Trash2, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const SUPER_ADMIN_PHONE = "8700602524";

const Blogs = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingBlog, setEditingBlog] = useState<any>(null);
  const [form, setForm] = useState({ title: "", content: "", category: "General", cover_image_url: "" });

  // Check admin via user_roles table
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin-blogs", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      return (data && data.length > 0) || false;
    },
    enabled: !!user,
  });

  const { data: blogs, isLoading } = useQuery({
    queryKey: ["blogs"],
    queryFn: async () => {
      const { data } = await supabase.from("blogs").select("*").eq("published", true).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: blogAuthors } = useQuery({
    queryKey: ["blog-authors", blogs],
    queryFn: async () => {
      if (!blogs?.length) return {};
      const ids = [...new Set(blogs.map((b: any) => b.author_id))];
      const { data } = await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", ids);
      const map: Record<string, any> = {};
      data?.forEach((p) => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!blogs?.length,
  });

  const saveBlog = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (editingBlog) {
        const { error } = await supabase.from("blogs").update({
          title: form.title, content: form.content, category: form.category, cover_image_url: form.cover_image_url || null, updated_at: new Date().toISOString(),
        } as any).eq("id", editingBlog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blogs").insert({
          title: form.title, content: form.content, category: form.category, cover_image_url: form.cover_image_url || null, author_id: user.id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogs"] });
      setShowEditor(false);
      setEditingBlog(null);
      setForm({ title: "", content: "", category: "General", cover_image_url: "" });
      toast.success(editingBlog ? "Blog updated!" : "Blog published!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteBlog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blogs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["blogs"] }); toast.success("Blog deleted"); },
  });

  const openEdit = (blog: any) => {
    setForm({ title: blog.title, content: blog.content, category: blog.category || "General", cover_image_url: blog.cover_image_url || "" });
    setEditingBlog(blog);
    setShowEditor(true);
  };

  return (
    <div className="bg-background min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold text-foreground">Blogs</h1>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-1.5 rounded-full" onClick={() => { setShowEditor(true); setEditingBlog(null); setForm({ title: "", content: "", category: "General", cover_image_url: "" }); }}>
              <Plus className="w-4 h-4" /> New Blog
            </Button>
          )}
        </div>
      </header>

      {/* Editor Modal */}
      {showEditor && isAdmin && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{editingBlog ? "Edit Blog" : "New Blog"}</h3>
              <button onClick={() => setShowEditor(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Blog title..." className="bg-secondary border-border" /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="General, Tech, Career..." className="bg-secondary border-border" /></div>
              <div><Label>Cover Image URL (optional)</Label><Input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} placeholder="https://..." className="bg-secondary border-border" /></div>
              <div><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write your blog content..." rows={10} className="bg-secondary border-border" /></div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditor(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => saveBlog.mutate()} disabled={!form.title.trim() || !form.content.trim() || saveBlog.isPending}>
                  {editingBlog ? "Update" : "Publish"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 animate-pulse">
              <div className="h-5 bg-secondary rounded w-2/3 mb-3" />
              <div className="h-3 bg-secondary rounded w-full mb-2" />
              <div className="h-3 bg-secondary rounded w-4/5" />
            </div>
          ))
        ) : blogs?.length ? (
          blogs.map((blog: any) => {
            const author = blogAuthors?.[blog.author_id];
            return (
              <article key={blog.id} className="bg-card border border-border rounded-2xl overflow-hidden hover-lift transition-all">
                {blog.cover_image_url && (
                  <img src={blog.cover_image_url} alt="" className="w-full h-48 object-cover" loading="lazy" />
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">{blog.category}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(blog.created_at), { addSuffix: true })}</span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground mb-2">{blog.title}</h2>
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{blog.content}</p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      {author?.avatar_url ? (
                        <img src={author.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-primary">{(author?.name || "A")[0]}</span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">{author?.name || "Admin"}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(blog)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteBlog.mutate(blog.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No blogs published yet.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Blogs;
