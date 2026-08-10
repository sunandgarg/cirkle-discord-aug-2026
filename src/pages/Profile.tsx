import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Pencil, Settings, MapPin, BadgeCheck, UserPlus, Check, MessageSquare,
  LogOut, Camera, GraduationCap, Calendar, Briefcase, Share2, LinkIcon, Mail, Globe,
  ExternalLink, Plus, X, Trash2, Star, MessageCircle, Phone, Video, ShieldCheck, Link2
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import SearchableSelect from "@/components/SearchableSelect";
import ExpertiseSelect from "@/components/ExpertiseSelect";
import { institutions } from "@/data/institutionsList";
import { passingYears } from "@/data/dropdownOptions";
import { ALL_COURSES, getSpecialisations } from "@/data/courseSpecialisations";
import { companies } from "@/data/companiesList";
import { locations } from "@/data/locationsList";

const PROFILE_TABS = ["About Me", "Education", "Professional Details", "Expertise", "Pricing Information", "Social Handles", "Activity"];

const getCompanyLogo = (name: string) => {
  const key = name.toLowerCase().trim();
  return `https://logo.clearbit.com/${key.replace(/\s+/g, "")}.com`;
};

const Profile = () => {
  const { userId, slug } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, profile: myProfile, isAdmin, refetchProfile: refetchAuthProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Determine if we're looking up by slug or userId
  const isSlugRoute = location.pathname.startsWith("/u/");
  const isOwnProfile = !userId && !slug || userId === user?.id;
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(isOwnProfile ? user?.id || null : userId || null);

  const [activeTab, setActiveTab] = useState(0);
  const [editingSection, setEditingSection] = useState<string | null>(searchParams.get("edit") === "true" ? "about" : null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Slug edit state
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");

  // Section-specific edit forms
  const [aboutForm, setAboutForm] = useState({ name: "", headline: "", bio: "", location: "", date_of_birth: "" });
  const [expertiseList, setExpertiseList] = useState<string[]>([]);
  const [pricingForm, setPricingForm] = useState({ is_mentor: false, mentor_category: "", mentor_price_chat: "", mentor_price_audio: "", mentor_price_video: "" });
  const [socialForm, setSocialForm] = useState<Record<string, string>>({});
  const [eduForm, setEduForm] = useState({ institution: "", degree: "", branch_area: "", passing_year: "", location: "" });
  const [expForm, setExpForm] = useState({ company_name: "", job_title: "", start_date: "", end_date: "", location: "", is_current: false });

  // Resolve slug to user_id
  const { data: slugProfile } = useQuery({
    queryKey: ["profile-by-slug", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await supabase.from("profiles").select("user_id").eq("slug", slug).maybeSingle();
      return data;
    },
    enabled: isSlugRoute && !!slug,
  });

  useEffect(() => {
    if (isSlugRoute && slugProfile) {
      setResolvedUserId(slugProfile.user_id);
    } else if (!isSlugRoute) {
      setResolvedUserId(isOwnProfile ? user?.id || null : userId || null);
    }
  }, [slugProfile, isSlugRoute, isOwnProfile, user?.id, userId]);

  const targetId = resolvedUserId;
  const isOwn = targetId === user?.id;

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", targetId],
    queryFn: async () => {
      if (!targetId) return null;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", targetId).maybeSingle();
      return data;
    },
    enabled: !!targetId,
    staleTime: 0, gcTime: 0, refetchOnMount: "always",
  });

  const { data: education, refetch: refetchEducation } = useQuery({
    queryKey: ["education", targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data } = await supabase.from("education").select("*").eq("user_id", targetId).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!targetId, staleTime: 5000, refetchOnMount: "always",
  });

  const { data: experience, refetch: refetchExperience } = useQuery({
    queryKey: ["professional_experience", targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data } = await supabase.from("professional_experience").select("*").eq("user_id", targetId).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!targetId, staleTime: 5000, refetchOnMount: "always",
  });

  const { data: connectionStatus } = useQuery({
    queryKey: ["connection-status", targetId],
    queryFn: async () => {
      if (!user || isOwn || !targetId) return "none";
      const { data } = await supabase.from("connections").select("*")
        .or(`and(requester_id.eq.${user.id},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${user.id})`);
      if (!data || data.length === 0) return "none";
      return data[0].status;
    },
    enabled: !!user && !isOwn && !!targetId,
  });

  const { data: userActivity } = useQuery({
    queryKey: ["user-activity", targetId],
    queryFn: async () => {
      if (!targetId) return [];
      // Only show home feed posts (channel is null), exclude forum messages
      const { data: posts } = await supabase.from("posts").select("*").eq("author_id", targetId).eq("is_anonymous", false)
        .is("channel", null)
        .order("created_at", { ascending: false }).limit(20);
      return (posts || []).map(p => ({ type: p.reshared_post_id ? "reshare" : "post", data: p, date: p.created_at }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!targetId,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", targetId],
    queryFn: async () => {
      if (!targetId) return { posts: 0, connections: 0, sessions: 0 };
      const [postsRes, connectionsRes, sessionsRes] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", targetId),
        supabase.from("connections").select("id", { count: "exact", head: true })
          .or(`requester_id.eq.${targetId},receiver_id.eq.${targetId}`).eq("status", "accepted"),
        supabase.from("consultations").select("id", { count: "exact", head: true })
          .or(`consultant_id.eq.${targetId},client_id.eq.${targetId}`),
      ]);
      return { posts: postsRes.count || 0, connections: connectionsRes.count || 0, sessions: sessionsRes.count || 0 };
    },
    enabled: !!targetId,
  });

  useEffect(() => {
    if (profile) {
      setAboutForm({ name: (profile as any).name || "", headline: (profile as any).headline || "", bio: (profile as any).bio || "", location: (profile as any).location || "", date_of_birth: (profile as any).date_of_birth || "" });
      setExpertiseList((profile as any).skills || []);
      setPricingForm({ is_mentor: !!(profile as any).is_mentor, mentor_category: (profile as any).mentor_category || "", mentor_price_chat: (profile as any).mentor_price_chat?.toString() || "", mentor_price_audio: (profile as any).mentor_price_audio?.toString() || "", mentor_price_video: (profile as any).mentor_price_video?.toString() || "" });
      setSocialForm((profile as any).social_links as any || {});
    }
  }, [profile]);

  const saveSection = useMutation({
    mutationFn: async (section: string) => {
      if (!user) return;
      let update: any = {};
      if (section === "about") {
        if (!aboutForm.name?.trim()) throw new Error("Name is required");
        update = {
          name: aboutForm.name.trim(),
          headline: aboutForm.headline.trim() || null,
          bio: aboutForm.bio.trim() || null,
          location: aboutForm.location.trim() || null,
          date_of_birth: aboutForm.date_of_birth || null,
        };
      } else if (section === "expertise") {
        update = { skills: expertiseList };
      } else if (section === "pricing") {
        update = {
          is_mentor: pricingForm.is_mentor,
          mentor_category: pricingForm.mentor_category || null,
          mentor_price_chat: pricingForm.mentor_price_chat ? (parseInt(pricingForm.mentor_price_chat) || null) : null,
          mentor_price_audio: pricingForm.mentor_price_audio ? (parseInt(pricingForm.mentor_price_audio) || null) : null,
          mentor_price_video: pricingForm.mentor_price_video ? (parseInt(pricingForm.mentor_price_video) || null) : null,
        };
      } else if (section === "social") {
        update = { social_links: socialForm };
      }
      const { error } = await supabase.from("profiles").update(update as any).eq("user_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refetchProfile();
      await refetchAuthProfile();
      setEditingSection(null);
      toast.success("Saved successfully!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addEducation = useMutation({
    mutationFn: async () => {
      if (!user || !eduForm.institution) throw new Error("Institution required");
      const isOtherInstitution = !institutions.includes(eduForm.institution);
      const knownSpecs = eduForm.degree ? getSpecialisations(eduForm.degree) : [];
      const isOtherBranch = eduForm.branch_area ? !knownSpecs.includes(eduForm.branch_area) : false;
      const { error } = await supabase.from("education").insert({
        user_id: user.id,
        institution: eduForm.institution,
        degree: eduForm.degree || null,
        branch_area: eduForm.branch_area || null,
        passing_year: eduForm.passing_year || null,
        location: eduForm.location || null,
        is_other_institution: isOtherInstitution,
        is_other_branch: isOtherBranch,
      });
      if (error) throw new Error(error.message);
      // Save custom options
      if (isOtherInstitution) {
        try { await supabase.from("custom_options").insert({ category: "institution", value: eduForm.institution, created_by: user.id }); } catch {}
      }
      if (isOtherBranch) {
        try { await supabase.from("custom_options").insert({ category: "branch", value: eduForm.branch_area, created_by: user.id }); } catch {}
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["education", targetId] });
      await refetchEducation();
      setEditingSection(null);
      setEduForm({ institution: "", degree: "", branch_area: "", passing_year: "", location: "" });
      toast.success("Education added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteEducation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("education").delete().eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["education", targetId] }); refetchEducation(); toast.success("Deleted"); },
  });

  const addExperience = useMutation({
    mutationFn: async () => {
      if (!user || !expForm.company_name) throw new Error("Company required");
      const isOtherCompany = !companies.includes(expForm.company_name);
      const { error } = await supabase.from("professional_experience").insert({
        user_id: user.id,
        company_name: expForm.company_name,
        job_title: expForm.job_title || null,
        start_date: expForm.start_date || null,
        end_date: expForm.is_current ? null : (expForm.end_date || null),
        is_current: expForm.is_current,
        location: expForm.location || null,
        is_other_company: isOtherCompany,
      });
      if (error) throw new Error(error.message);
      if (isOtherCompany) {
        try { await supabase.from("custom_options").insert({ category: "company", value: expForm.company_name, created_by: user.id }); } catch {}
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["professional_experience", targetId] });
      await refetchExperience();
      setEditingSection(null);
      setExpForm({ company_name: "", job_title: "", start_date: "", end_date: "", location: "", is_current: false });
      toast.success("Experience added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteExperience = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("professional_experience").delete().eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["professional_experience", targetId] }); refetchExperience(); toast.success("Deleted"); },
  });

  const saveSlug = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const clean = slugInput.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
      if (clean.length < 3 || clean.length > 50) throw new Error("Slug must be 3-50 characters");
      // Check uniqueness
      const { data: existing } = await supabase.from("profiles").select("user_id").eq("slug", clean).maybeSingle();
      if (existing && existing.user_id !== user.id) throw new Error("This URL is already taken");
      const { error } = await supabase.from("profiles").update({ slug: clean, slug_updated_at: new Date().toISOString() } as any).eq("user_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await refetchProfile();
      await refetchAuthProfile();
      setEditingSlug(false);
      toast.success("Profile URL updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendConnect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("connections").insert({ requester_id: user!.id, receiver_id: targetId!, community_id: "default", status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["connection-status"] }); toast.success("Request sent!"); },
  });

  const uploadImage = async (file: File, bucket: string, field: string) => {
    if (!user) return;
    try {
      const { convertToWebP } = await import("@/lib/imageUtils");
      const optimized = await convertToWebP(file, 0.8, field === "cover_photo_url" ? 1200 : 400);
      const path = `${user.id}/${field}-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, optimized, { upsert: true });
      if (uploadError) { toast.error("Upload failed"); return; }
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      await supabase.from("profiles").update({ [field]: urlData.publicUrl } as any).eq("user_id", user.id);
      await refetchProfile();
      await refetchAuthProfile();
      toast.success("Photo updated!");
    } catch (err: any) { toast.error("Upload error: " + err.message); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };

  if (!user && isOwn) { navigate("/auth"); return null; }

  const displayProfile = isOwn ? (profile || myProfile) : profile;
  const skills = (displayProfile as any)?.skills || [];
  const socialLinks = (displayProfile as any)?.social_links as any || {};
  const profileSlug = (displayProfile as any)?.slug;
  const slugUpdatedAt = (displayProfile as any)?.slug_updated_at;
  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);

  const shareUrl = profileSlug ? `${window.location.origin}/u/${profileSlug}` : window.location.href;

  const EditButton = ({ section, tab }: { section: string; tab?: number }) => (
    isOwn ? (
      <button onClick={() => { if (tab !== undefined) setActiveTab(tab); setEditingSection(section); }}
        className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
        <Pencil className="w-3 h-3" /> Edit
      </button>
    ) : null
  );

  return (
    <div className="bg-background min-h-screen pb-8">
      {/* Cover */}
      <div className="h-44 sm:h-52 relative overflow-hidden profile-cover">
        {(displayProfile as any)?.cover_photo_url ? <img src={(displayProfile as any).cover_photo_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/60" />}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card/60 backdrop-blur flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-foreground" /></button>
          <div className="flex items-center gap-2">
            {isOwn && (
              <>
                <button onClick={() => coverInputRef.current?.click()} className="w-9 h-9 rounded-full bg-card/60 backdrop-blur flex items-center justify-center" title="Change cover"><Camera className="w-4 h-4 text-foreground" /></button>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "avatars", "cover_photo_url"); e.target.value = ""; }} />
                <button onClick={() => navigate("/settings")} className="w-9 h-9 rounded-full bg-card/60 backdrop-blur flex items-center justify-center"><Settings className="w-4 h-4 text-foreground" /></button>
              </>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 -mt-16 relative z-10">
        {/* Avatar + Name */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-end gap-4 -mt-14 mb-3">
            <div className="flex-shrink-0 relative">
              {(displayProfile as any)?.avatar_url ? (
                <div className="w-24 h-24 rounded-full border-4 border-card overflow-hidden shadow-lg"><img src={(displayProfile as any).avatar_url} alt="Profile" className="w-full h-full object-cover" /></div>
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-card bg-secondary flex items-center justify-center shadow-lg"><span className="text-3xl font-bold text-primary">{((displayProfile as any)?.name || "?")[0]}</span></div>
              )}
              {isOwn && (
                <>
                  <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md border-2 border-card"><Camera className="w-3 h-3" /></button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "avatars", "avatar_url"); e.target.value = ""; }} />
                </>
              )}
            </div>
            <div className="pb-1 flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-lg font-bold text-foreground break-words">{(displayProfile as any)?.name || "Anonymous"}</h1>
                {(displayProfile as any)?.is_verified && <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0" />}
              </div>
              {(displayProfile as any)?.headline && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{(displayProfile as any).headline}</p>}
              {/* Slug URL display */}
              {profileSlug && (
                <div className="flex items-center gap-1 mt-1">
                  <Link2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground truncate">cirkle.app/u/{profileSlug}</span>
                  {isOwn && !slugUpdatedAt && (
                    <button onClick={() => { setSlugInput(profileSlug); setEditingSlug(true); }} className="text-[10px] text-primary hover:underline ml-1 flex-shrink-0">Edit</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Slug edit modal */}
          {editingSlug && (
            <div className="bg-secondary/50 rounded-xl p-3 mb-3 space-y-2">
              <Label className="text-xs">Custom Profile URL</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">/u/</span>
                <Input value={slugInput} onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="bg-background border-border h-8 text-sm flex-1" placeholder="your-custom-url" />
              </div>
              <p className="text-[10px] text-muted-foreground">Lowercase letters, numbers, hyphens only. You can only change this once.</p>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs h-7" onClick={() => saveSlug.mutate()} disabled={saveSlug.isPending}>{saveSlug.isPending ? "Saving..." : "Save"}</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setEditingSlug(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mt-2 mb-3 bg-secondary/50 rounded-xl p-2.5">
            <div className="text-center"><p className="text-base font-bold text-foreground">{formatCount(stats?.connections || 0)}</p><p className="text-[10px] text-muted-foreground">Connections</p></div>
            <div className="text-center border-x border-border"><p className="text-base font-bold text-foreground">{formatCount(stats?.posts || 0)}</p><p className="text-[10px] text-muted-foreground">Posts</p></div>
            <div className="text-center"><p className="text-base font-bold text-foreground">{formatCount(stats?.sessions || 0)}</p><p className="text-[10px] text-muted-foreground">Sessions</p></div>
          </div>
          <div className="flex gap-2">
            {isOwn ? (
              <>
                <Button className="flex-1 rounded-xl h-9 text-xs font-semibold gap-1" onClick={() => { setActiveTab(0); setEditingSection("about"); }}><Pencil className="w-3.5 h-3.5" /> Edit Profile</Button>
                <Button variant="outline" className="rounded-xl h-9 px-3" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); }}><Share2 className="w-3.5 h-3.5" /></Button>
                {isAdmin && <Button variant="outline" className="rounded-xl h-9 gap-1 text-xs" onClick={() => navigate("/admin")}><ShieldCheck className="w-3.5 h-3.5" /> Admin</Button>}
                <Button variant="outline" className="rounded-xl h-9 gap-1 text-xs" onClick={handleLogout}><LogOut className="w-3.5 h-3.5" /></Button>
              </>
            ) : (
              <>
                {connectionStatus === "none" && <Button className="flex-1 rounded-xl h-9 gap-1 text-xs" onClick={() => sendConnect.mutate()}><UserPlus className="w-3.5 h-3.5" /> Connect</Button>}
                {connectionStatus === "pending" && <Button variant="outline" className="flex-1 rounded-xl h-9 text-xs" disabled><Check className="w-3.5 h-3.5 mr-1" /> Pending</Button>}
                {connectionStatus === "accepted" && <Button variant="outline" className="flex-1 rounded-xl h-9 gap-1 text-xs" onClick={() => navigate("/chats")}><MessageSquare className="w-3.5 h-3.5" /> Message</Button>}
                <Button variant="outline" className="rounded-xl h-9 px-3" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); }}><Share2 className="w-3.5 h-3.5" /></Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mt-4 -mx-1 px-1 overflow-x-auto scrollbar-hide">
          {PROFILE_TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap px-3 ${activeTab === i ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{tab}</button>
          ))}
        </div>

        {/* Section Edit Modals */}
        {editingSection && (
          <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
            <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">Edit {editingSection === "about" ? "About Me" : editingSection === "expertise" ? "Expertise" : editingSection === "pricing" ? "Pricing" : editingSection === "social" ? "Social Handles" : editingSection === "education" ? "Add Education" : "Add Experience"}</h3>
                <button onClick={() => setEditingSection(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>

              {editingSection === "about" && (
                <div className="space-y-3">
                  <div><Label className="text-xs">Name</Label><Input value={aboutForm.name} onChange={e => setAboutForm({ ...aboutForm, name: e.target.value })} className="bg-secondary border-border mt-1" /></div>
                  <div><Label className="text-xs">Headline</Label><Input value={aboutForm.headline} onChange={e => setAboutForm({ ...aboutForm, headline: e.target.value })} className="bg-secondary border-border mt-1" /></div>
                  <div><Label className="text-xs">Bio</Label><Textarea value={aboutForm.bio} onChange={e => setAboutForm({ ...aboutForm, bio: e.target.value })} className="bg-secondary border-border mt-1" rows={3} /></div>
                  <div><Label className="text-xs">Location</Label><Input value={aboutForm.location} onChange={e => setAboutForm({ ...aboutForm, location: e.target.value })} className="bg-secondary border-border mt-1" /></div>
                  <div><Label className="text-xs">Date of Birth</Label><Input type="date" value={aboutForm.date_of_birth} onChange={e => setAboutForm({ ...aboutForm, date_of_birth: e.target.value })} className="bg-secondary border-border mt-1" /></div>
                  <Button className="w-full rounded-xl" onClick={() => saveSection.mutate("about")} disabled={saveSection.isPending}>{saveSection.isPending ? "Saving..." : "Save"}</Button>
                </div>
              )}

              {editingSection === "expertise" && (
                <div className="space-y-3">
                  <ExpertiseSelect value={expertiseList} onChange={setExpertiseList} />
                  <Button className="w-full rounded-xl" onClick={() => saveSection.mutate("expertise")} disabled={saveSection.isPending}>{saveSection.isPending ? "Saving..." : "Save"}</Button>
                </div>
              )}

              {editingSection === "pricing" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs">Mentor</Label>
                    <button onClick={() => setPricingForm({ ...pricingForm, is_mentor: !pricingForm.is_mentor })}
                      className={`text-xs px-3 py-1.5 rounded-full border ${pricingForm.is_mentor ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"}`}>
                      {pricingForm.is_mentor ? "Yes" : "No"}
                    </button>
                  </div>
                  {pricingForm.is_mentor && (
                    <>
                      <div><Label className="text-xs">Category</Label><Input value={pricingForm.mentor_category} onChange={e => setPricingForm({ ...pricingForm, mentor_category: e.target.value })} className="bg-secondary border-border mt-1" /></div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-[10px]">Chat ₹</Label><Input type="number" value={pricingForm.mentor_price_chat} onChange={e => setPricingForm({ ...pricingForm, mentor_price_chat: e.target.value })} className="bg-secondary border-border h-9 text-xs" /></div>
                        <div><Label className="text-[10px]">Audio ₹</Label><Input type="number" value={pricingForm.mentor_price_audio} onChange={e => setPricingForm({ ...pricingForm, mentor_price_audio: e.target.value })} className="bg-secondary border-border h-9 text-xs" /></div>
                        <div><Label className="text-[10px]">Video ₹</Label><Input type="number" value={pricingForm.mentor_price_video} onChange={e => setPricingForm({ ...pricingForm, mentor_price_video: e.target.value })} className="bg-secondary border-border h-9 text-xs" /></div>
                      </div>
                    </>
                  )}
                  <Button className="w-full rounded-xl" onClick={() => saveSection.mutate("pricing")} disabled={saveSection.isPending}>{saveSection.isPending ? "Saving..." : "Save"}</Button>
                </div>
              )}

              {editingSection === "social" && (
                <div className="space-y-3">
                  {["linkedin", "twitter", "github", "website", "instagram"].map(key => (
                    <div key={key}><Label className="text-xs capitalize">{key}</Label><Input placeholder={`https://${key}.com/...`} value={socialForm[key] || ""} onChange={e => setSocialForm({ ...socialForm, [key]: e.target.value })} className="bg-secondary border-border mt-1" /></div>
                  ))}
                  <Button className="w-full rounded-xl" onClick={() => saveSection.mutate("social")} disabled={saveSection.isPending}>{saveSection.isPending ? "Saving..." : "Save"}</Button>
                </div>
              )}

              {editingSection === "education" && (
                <div className="space-y-3">
                  <div><Label className="text-xs">Institution *</Label><div className="mt-1"><SearchableSelect options={institutions} value={eduForm.institution} onChange={v => setEduForm({ ...eduForm, institution: v })} placeholder="Select institution..." /></div></div>
                  <div><Label className="text-xs">Course</Label><div className="mt-1"><SearchableSelect options={ALL_COURSES} value={eduForm.degree} onChange={v => setEduForm({ ...eduForm, degree: v, branch_area: "" })} placeholder="Select course..." /></div></div>
                  <div><Label className="text-xs">Specialisation</Label><div className="mt-1"><SearchableSelect options={eduForm.degree ? getSpecialisations(eduForm.degree) : []} value={eduForm.branch_area} onChange={v => setEduForm({ ...eduForm, branch_area: v })} placeholder={eduForm.degree ? "Select specialisation..." : "Select course first"} /></div></div>
                  <div><Label className="text-xs">Passing Year</Label><div className="mt-1"><SearchableSelect options={passingYears} value={eduForm.passing_year} onChange={v => setEduForm({ ...eduForm, passing_year: v })} placeholder="Select year..." /></div></div>
                  <div><Label className="text-xs">Location</Label><div className="mt-1"><SearchableSelect options={locations} value={eduForm.location} onChange={v => setEduForm({ ...eduForm, location: v })} placeholder="Select location..." /></div></div>
                  <Button className="w-full rounded-xl" onClick={() => addEducation.mutate()} disabled={addEducation.isPending}>{addEducation.isPending ? "Adding..." : "Add Education"}</Button>
                </div>
              )}

              {editingSection === "experience" && (
                <div className="space-y-3">
                  <div><Label className="text-xs">Company *</Label><div className="mt-1"><SearchableSelect options={companies} value={expForm.company_name} onChange={v => setExpForm({ ...expForm, company_name: v })} placeholder="Select company..." /></div></div>
                  <div><Label className="text-xs">Job Title</Label><Input value={expForm.job_title} onChange={e => setExpForm({ ...expForm, job_title: e.target.value })} className="bg-secondary border-border mt-1" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Start Date</Label><Input type="month" value={expForm.start_date} onChange={e => setExpForm({ ...expForm, start_date: e.target.value })} className="bg-secondary border-border mt-1" /></div>
                    <div><Label className="text-xs">End Date</Label><Input type="month" value={expForm.end_date} onChange={e => setExpForm({ ...expForm, end_date: e.target.value })} disabled={expForm.is_current} className="bg-secondary border-border mt-1" /></div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input type="checkbox" checked={expForm.is_current} onChange={e => setExpForm({ ...expForm, is_current: e.target.checked })} /> Currently working here
                  </label>
                  <div><Label className="text-xs">Location</Label><div className="mt-1"><SearchableSelect options={locations} value={expForm.location} onChange={v => setExpForm({ ...expForm, location: v })} placeholder="Select location..." /></div></div>
                  <Button className="w-full rounded-xl" onClick={() => addExperience.mutate()} disabled={addExperience.isPending}>{addExperience.isPending ? "Adding..." : "Add Experience"}</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="mt-4 animate-fade-in space-y-4">
          {/* ─── Profile Capsule Pricing Buttons (₹499 / ₹999 / ₹1999) ─── */}
          {(displayProfile as any)?.is_mentor && !isOwn && activeTab === 0 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="font-bold text-foreground text-sm mb-3">Book a Session</h3>
              <div className="flex gap-2">
                {[
                  { label: "₹499", type: "chat" as const, price: (displayProfile as any)?.mentor_price_chat || 499 },
                  { label: "₹999", type: "audio" as const, price: (displayProfile as any)?.mentor_price_audio || 999 },
                  { label: "₹1999", type: "video" as const, price: (displayProfile as any)?.mentor_price_video || 1999 },
                ].map((tier) => (
                  <button
                    key={tier.type}
                    onClick={() => navigate(`/consult`)}
                    className="flex-1 py-3 px-4 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm hover:bg-primary hover:text-primary-foreground transition-all hover:shadow-md"
                  >
                    {tier.label}
                    <span className="block text-[9px] font-medium opacity-70 capitalize">{tier.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 0 && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm">About Me</h3>
                <EditButton section="about" />
              </div>
              {(displayProfile as any)?.bio ? <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{(displayProfile as any).bio}</p>
                : <p className="text-sm text-muted-foreground/50 italic">No bio added yet</p>}
              <div className="space-y-3 pt-2 border-t border-border">
                {(displayProfile as any)?.location && <div className="flex items-center gap-2.5 text-sm text-muted-foreground"><MapPin className="w-4 h-4 text-primary flex-shrink-0" /> {(displayProfile as any).location}</div>}
                {(displayProfile as any)?.date_of_birth && <div className="flex items-center gap-2.5 text-sm text-muted-foreground"><Calendar className="w-4 h-4 text-primary flex-shrink-0" /> {format(new Date((displayProfile as any).date_of_birth + "T00:00:00"), "do MMM, yyyy")}</div>}
                {(displayProfile as any)?.iit_name && <div className="flex items-center gap-2.5 text-sm text-muted-foreground"><GraduationCap className="w-4 h-4 text-primary flex-shrink-0" /> {(displayProfile as any).iit_name}{(displayProfile as any)?.student_status && <span className="text-xs">· {(displayProfile as any).student_status}</span>}</div>}
                {(displayProfile as any)?.is_mentor && <div className="flex items-center gap-2.5 text-sm text-primary"><BadgeCheck className="w-4 h-4 flex-shrink-0" /> Mentor{(displayProfile as any).mentor_category && <span className="text-xs bg-primary/10 px-2 py-0.5 rounded-full">{(displayProfile as any).mentor_category}</span>}</div>}
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground text-sm">Education</h3>
                {isOwn && <button onClick={() => setEditingSection("education")} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> Add</button>}
              </div>
              {education && education.length > 0 ? (
                <div className="space-y-4">
                  {education.map((edu: any) => (
                    <div key={edu.id} className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><GraduationCap className="w-5 h-5 text-primary" /></div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">{edu.institution}</p>
                        <p className="text-xs text-muted-foreground">{[edu.degree, edu.branch_area].filter(Boolean).join(" - ")}</p>
                        {edu.passing_year && <p className="text-[10px] text-muted-foreground/70 mt-0.5">Class of {edu.passing_year}</p>}
                      </div>
                      {isOwn && <button onClick={() => deleteEducation.mutate(edu.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground/50 italic text-center py-8">No education added yet</p>}
            </div>
          )}

          {activeTab === 2 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground text-sm">Professional Details</h3>
                {isOwn && <button onClick={() => setEditingSection("experience")} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> Add</button>}
              </div>
              {experience && experience.length > 0 ? (
                <div className="space-y-4">
                  {experience.map((exp: any) => {
                    const logoUrl = exp.logo_url || getCompanyLogo(exp.company_name);
                    return (
                      <div key={exp.id} className="flex gap-3">
                        <img src={logoUrl} alt={exp.company_name} className="w-10 h-10 rounded-lg object-contain bg-secondary p-1 flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">{exp.job_title || "Role"} at {exp.company_name}</p>
                          <p className="text-xs text-muted-foreground">{exp.start_date || ""}{exp.start_date && " - "}{exp.is_current ? "Present" : exp.end_date || ""}</p>
                          {exp.location && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{exp.location}</p>}
                        </div>
                        {isOwn && <button onClick={() => deleteExperience.mutate(exp.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-muted-foreground/50 italic text-center py-8">No experience added yet</p>}
            </div>
          )}

          {activeTab === 3 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground text-sm">Expertise & Skills</h3>
                <EditButton section="expertise" />
              </div>
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: string) => <span key={skill} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{skill}</span>)}
                </div>
              ) : <p className="text-sm text-muted-foreground/50 italic text-center py-8">No skills added yet</p>}
            </div>
          )}

          {activeTab === 4 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground text-sm">Pricing Information</h3>
                <EditButton section="pricing" />
              </div>
              {(displayProfile as any)?.is_mentor ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border"><div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-foreground">Chat</span></div><span className="text-sm font-semibold text-foreground">₹{(displayProfile as any).mentor_price_chat || "-"}</span></div>
                  <div className="flex items-center justify-between py-2 border-b border-border"><div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-foreground">Audio Call</span></div><span className="text-sm font-semibold text-foreground">₹{(displayProfile as any).mentor_price_audio || "-"}</span></div>
                  <div className="flex items-center justify-between py-2"><div className="flex items-center gap-2"><Video className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-foreground">Video Call</span></div><span className="text-sm font-semibold text-foreground">₹{(displayProfile as any).mentor_price_video || "-"}</span></div>
                </div>
              ) : <p className="text-sm text-muted-foreground/50 italic text-center py-8">Not a mentor</p>}
            </div>
          )}

          {activeTab === 5 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground text-sm">Social Handles</h3>
                <EditButton section="social" />
              </div>
              {Object.keys(socialLinks).length > 0 && Object.values(socialLinks).some(v => !!v) ? (
                <div className="space-y-3">
                  {Object.entries(socialLinks).map(([key, val]) => val ? (
                    <a key={key} href={val as string} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 py-2 border-b border-border last:border-0 text-sm text-primary hover:underline">
                      <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" /><span className="capitalize">{key}:</span> {val as string}
                    </a>
                  ) : null)}
                </div>
              ) : <p className="text-sm text-muted-foreground/50 italic text-center py-8">No social links added</p>}
            </div>
          )}

          {activeTab === 6 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="font-bold text-foreground text-sm mb-3">Activity</h3>
              <div className="space-y-3">
                {userActivity && userActivity.length > 0 ? userActivity.map((activity: any, i: number) => (
                  <div key={i} className="bg-secondary/50 rounded-xl p-3">
                    {activity.type === "post" && (
                      <>
                        <p className="text-sm text-foreground line-clamp-3">{activity.data.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">{formatDistanceToNow(new Date(activity.date), { addSuffix: true })}</p>
                      </>
                    )}
                    {activity.type === "reshare" && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Share2 className="w-3 h-3" /> Reshared a post · {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}</div>
                    )}
                  </div>
                )) : <p className="text-sm text-muted-foreground/50 italic text-center py-8">No activity yet</p>}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
