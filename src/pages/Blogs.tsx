import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, X, Pencil, Trash2, BookOpen, Calendar, Clock, Search, ArrowRight, Mail } from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

const readTime = (content: string) => Math.max(1, Math.round(content.split(/\s+/).length / 200));
const fmtDate = (d: string) => format(new Date(d), "MMM d, yyyy");

const Blogs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingBlog, setEditingBlog] = useState<any>(null);
  const [form, setForm] = useState({ title: "", content: "", category: "General", cover_image_url: "" });
  const [activeCat, setActiveCat] = useState("All");
  const [query, setQuery] = useState("");

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
    queryKey: ["blog-authors", blogs?.length],
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
      toast.success(editingBlog ? "Article updated" : "Article published");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteBlog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blogs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["blogs"] }); toast.success("Article deleted"); },
  });

  const openEdit = (blog: any) => {
    setForm({ title: blog.title, content: blog.content, category: blog.category || "General", cover_image_url: blog.cover_image_url || "" });
    setEditingBlog(blog);
    setShowEditor(true);
  };

  const categories = useMemo(() => ["All", ...Array.from(new Set((blogs ?? []).map((b: any) => b.category || "General")))], [blogs]);

  const filtered = useMemo(() => {
    let list = blogs ?? [];
    if (activeCat !== "All") list = list.filter((b: any) => (b.category || "General") === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((b: any) => b.title.toLowerCase().includes(q) || b.content.toLowerCase().includes(q));
    }
    return list;
  }, [blogs, activeCat, query]);

  /* ---------- Single article view ---------- */
  const article = slug ? (blogs ?? []).find((b: any) => b.id === slug) : null;
  if (slug) {
    if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    if (!article) return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-muted-foreground">Article not found.</p>
        <Button variant="outline" onClick={() => navigate("/blogs")}>Back to News</Button>
      </div>
    );
    const author = blogAuthors?.[article.author_id];
    const related = (blogs ?? []).filter((b: any) => b.id !== article.id && b.category === article.category).slice(0, 3);
    return (
      <div className="bg-background min-h-screen pb-24">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 max-w-3xl mx-auto">
            <button onClick={() => navigate("/blogs")} className="p-1 text-foreground" aria-label="Back to news"><ArrowLeft className="w-5 h-5" /></button>
            <span className="text-sm font-semibold text-foreground">News</span>
          </div>
        </header>
        <article className="max-w-3xl mx-auto px-4 py-6">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary">{article.category || "General"}</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-3 mb-3 leading-snug">{article.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-5">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{fmtDate(article.created_at)}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{readTime(article.content)} min read</span>
            <span>By {author?.name || "DekhoCampus Desk"}</span>
          </div>
          {article.cover_image_url && (
            <img src={article.cover_image_url} alt={article.title} className="w-full rounded-2xl object-cover max-h-[380px] mb-6" loading="lazy" />
          )}
          <div className="prose-none space-y-4">
            {article.content.split("\n").filter(Boolean).map((p: string, i: number) => (
              <p key={i} className="text-[15px] leading-7 text-foreground/90">{p}</p>
            ))}
          </div>
          {related.length > 0 && (
            <section className="mt-10 pt-6 border-t border-border">
              <h2 className="text-base font-bold text-foreground mb-4">Related news</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map((r: any) => (
                  <Link key={r.id} to={`/blogs/${r.id}`} className="block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
                    {r.cover_image_url && <img src={r.cover_image_url} alt="" className="w-full h-24 object-cover" loading="lazy" />}
                    <div className="p-3">
                      <p className="text-xs font-semibold text-foreground line-clamp-2">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{fmtDate(r.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    );
  }

  const featured: any = filtered[0];
  const rest: any[] = filtered.slice(1);

  return (
    <div className="bg-background min-h-screen pb-24">
      {/* Hero banner, DekhoCampus News style */}
      <section className="bg-primary/5 border-b border-border px-4 py-10">
        <div className="max-w-5xl mx-auto text-center relative">
          <button onClick={() => navigate(-1)} className="absolute left-0 top-1 p-1 text-muted-foreground hover:text-foreground" aria-label="Go back"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Cirkle News</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
            Updates on the latest career opportunities, campus life, exams, online education and more.
          </p>
          <div className="mt-6 max-w-md mx-auto relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search news..." className="pl-9 bg-card border-border rounded-full" />
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-1.5 rounded-full mt-5" onClick={() => { setShowEditor(true); setEditingBlog(null); setForm({ title: "", content: "", category: "General", cover_image_url: "" }); }}>
              <Plus className="w-4 h-4" /> New Article
            </Button>
          )}
        </div>
      </section>

      {/* Category tabs */}
      <div className="border-b border-border bg-card/60 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 flex gap-2 overflow-x-auto py-3 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`whitespace-nowrap text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
                activeCat === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && isAdmin && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{editingBlog ? "Edit Article" : "New Article"}</h3>
              <button onClick={() => setShowEditor(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Article title..." className="bg-secondary border-border" /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Exams, Admissions, Careers..." className="bg-secondary border-border" /></div>
              <div><Label>Cover Image URL (optional)</Label><Input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} placeholder="https://..." className="bg-secondary border-border" /></div>
              <div><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write the article..." rows={10} className="bg-secondary border-border" /></div>
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

      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
                <div className="h-36 bg-secondary" />
                <div className="p-4"><div className="h-4 bg-secondary rounded w-3/4 mb-2" /><div className="h-3 bg-secondary rounded w-full" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <>
            {/* Featured story */}
            <article className="grid md:grid-cols-2 gap-6 bg-card border border-border rounded-2xl overflow-hidden mb-10">
              <Link to={`/blogs/${featured.id}`} className="block">
                {featured.cover_image_url ? (
                  <img src={featured.cover_image_url} alt={featured.title} className="w-full h-full min-h-[220px] object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full min-h-[220px] bg-primary/10 flex items-center justify-center"><BookOpen className="w-10 h-10 text-primary/40" /></div>
                )}
              </Link>
              <div className="p-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary text-primary-foreground">Featured</span>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">{featured.category || "General"}</span>
                </div>
                <Link to={`/blogs/${featured.id}`}>
                  <h2 className="text-xl font-bold text-foreground leading-snug hover:text-primary transition-colors">{featured.title}</h2>
                </Link>
                <p className="text-sm text-muted-foreground line-clamp-3 mt-2 leading-relaxed">{featured.content}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-4">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{fmtDate(featured.created_at)}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{readTime(featured.content)} min read</span>
                </div>
                <Link to={`/blogs/${featured.id}`} className="text-xs font-semibold text-primary inline-flex items-center gap-1 mt-4">
                  Read more <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                {isAdmin && (
                  <div className="flex gap-1 mt-4">
                    <button onClick={() => openEdit(featured)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteBlog.mutate(featured.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </article>

            <h2 className="text-lg font-bold text-foreground mb-4">Latest Posts</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rest.map((blog: any) => {
                const author = blogAuthors?.[blog.author_id];
                return (
                  <article key={blog.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/40 transition-colors">
                    <Link to={`/blogs/${blog.id}`}>
                      {blog.cover_image_url ? (
                        <img src={blog.cover_image_url} alt={blog.title} className="w-full h-40 object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-40 bg-primary/10 flex items-center justify-center"><BookOpen className="w-8 h-8 text-primary/40" /></div>
                      )}
                    </Link>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">{blog.category || "General"}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(blog.created_at)}</span>
                      </div>
                      <Link to={`/blogs/${blog.id}`}>
                        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors">{blog.title}</h3>
                      </Link>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed flex-1">{blog.content}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <span className="text-[10px] text-muted-foreground">{author?.name || "DekhoCampus Desk"} · {readTime(blog.content)} min</span>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(blog)} className="p-1 text-muted-foreground hover:text-primary rounded-lg"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => deleteBlog.mutate(blog.id)} className="p-1 text-muted-foreground hover:text-destructive rounded-lg"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No posts found</p>
          </div>
        )}

        {/* Newsletter band */}
        <section className="mt-12 bg-card border border-border rounded-2xl p-6 text-center">
          <Mail className="w-6 h-6 text-primary mx-auto mb-2" />
          <h2 className="text-base font-bold text-foreground">Join our Newsletter</h2>
          <p className="text-xs text-muted-foreground mt-1">Weekly campus and career updates. We don't spam!</p>
          <form className="flex gap-2 max-w-sm mx-auto mt-4" onSubmit={(e) => { e.preventDefault(); toast.success("Subscribed to Cirkle News"); }}>
            <Input type="email" required placeholder="you@example.com" className="bg-secondary border-border" />
            <Button type="submit" size="sm">Subscribe</Button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Blogs;
