import { useState, useMemo } from "react";
import EmptyState from "@/components/EmptyState";
import { Briefcase, Search, MapPin, Clock, Bookmark, Filter, ExternalLink, Lock, X, Upload, FileText, CheckCircle2, Plus, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { convertToWebP } from "@/lib/imageUtils";

const PRIMARY_FILTERS = ["All", "Easy Apply", "Internship", "Full-time", "Part-time", "Remote"];

const SUB_FILTERS: Record<string, string[]> = {
  "Full-time": ["0-1 yr", "1-3 yr", "3-5 yr", "5-7 yr", "7+ yr"],
  "Part-time": ["0-1 yr", "1-3 yr", "3-5 yr", "5-7 yr", "7+ yr"],
  "Remote": ["0-1 yr", "1-3 yr", "3-5 yr", "5-7 yr", "7+ yr"],
  "Internship": ["0-1 mo", "1-3 mo", "3-6 mo", "6-12 mo"],
};

const getSkillsForJob = (title: string): string[] => {
  const t = title.toLowerCase();
  if (t.includes("react") || t.includes("frontend")) return ["React", "TypeScript", "CSS"];
  if (t.includes("backend") || t.includes("node")) return ["Node.js", "PostgreSQL", "Docker"];
  if (t.includes("ai") || t.includes("ml")) return ["Python", "TensorFlow", "LLMs"];
  if (t.includes("design")) return ["Figma", "UI/UX", "Design Systems"];
  if (t.includes("product")) return ["Strategy", "Analytics", "Agile"];
  return ["Problem Solving", "Communication", "Teamwork"];
};

const Jobs = () => {
  const [activeFilter, setActiveFilter] = useState(0);
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [applyingJob, setApplyingJob] = useState<any>(null);
  const [note, setNote] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [jobForm, setJobForm] = useState({ title: "", company: "", location: "", description: "", job_type: "Full-time", experience_level: "", category: "", easy_apply: true, apply_url: "" });
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isVerified = !!user && !!profile?.is_verified;
  const canPostJobs = isVerified;
  const currentPrimaryFilter = PRIMARY_FILTERS[activeFilter];
  const availableSubFilters = SUB_FILTERS[currentPrimaryFilter] || [];

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
    staleTime: Infinity,
  });

  const { data: myApplications } = useQuery({
    queryKey: ["my-applications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("applications").select("job_id").eq("applicant_id", user.id);
      return data?.map((a) => a.job_id) ?? [];
    },
    enabled: !!user,
  });

  const easyApplyMutation = useMutation({
    mutationFn: async (job: any) => {
      if (!user) return;
      const { error } = await supabase.from("applications").insert({
        job_id: job.id, applicant_id: user.id, note: "Easy Apply", resume_url: null,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: job.created_by, type: "job_application", title: "New Job Application",
        message: `${profile?.name || "Someone"} applied for ${job.title} (Easy Apply)`, entity_id: job.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      toast.success("Applied successfully! 🎉");
    },
    onError: (err: any) => toast.error(err.message?.includes("duplicate") ? "Already applied!" : err.message),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!user || !applyingJob) return;
      let resumeUrl: string | null = null;
      if (resumeFile) {
        const ext = resumeFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-images").upload(path, resumeFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        resumeUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from("applications").insert({
        job_id: applyingJob.id, applicant_id: user.id, note: note || null, resume_url: resumeUrl,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: applyingJob.created_by, type: "job_application", title: "New Job Application",
        message: `${profile?.name || "Someone"} applied for ${applyingJob.title}`, entity_id: applyingJob.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      setApplyingJob(null); setNote(""); setResumeFile(null);
      toast.success("Application submitted! 🎉");
    },
    onError: (err: any) => toast.error(err.message?.includes("duplicate") ? "Already applied!" : err.message),
  });

  const postJobMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("jobs").insert({
        title: jobForm.title, company: jobForm.company, location: jobForm.location,
        description: jobForm.description || null, job_type: jobForm.job_type,
        experience_level: jobForm.experience_level || null, category: jobForm.category || null,
        easy_apply: jobForm.easy_apply,
        apply_url: jobForm.easy_apply ? null : (jobForm.apply_url || null),
        created_by: user.id, community_id: "default",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setShowPostForm(false);
      setJobForm({ title: "", company: "", location: "", description: "", job_type: "Full-time", experience_level: "", category: "", easy_apply: true, apply_url: "" });
      toast.success("Job posted! 🎉");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!jobs) return [];
    let result = jobs;
    if (activeFilter === 1) result = result.filter((j: any) => j.easy_apply === true);
    else if (activeFilter === 2) result = result.filter((j: any) => j.job_type?.toLowerCase().includes("intern"));
    else if (activeFilter === 3) result = result.filter((j: any) => j.job_type?.toLowerCase().includes("full"));
    else if (activeFilter === 4) result = result.filter((j: any) => j.job_type?.toLowerCase().includes("part"));
    else if (activeFilter === 5) result = result.filter((j: any) => j.location?.toLowerCase().includes("remote"));
    if (activeSubFilter) {
      result = result.filter((j: any) => j.experience_level === activeSubFilter || j.experience === activeSubFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((j: any) => j.title?.toLowerCase().includes(q) || j.company?.toLowerCase().includes(q));
    }
    return result;
  }, [jobs, activeFilter, activeSubFilter, search]);

  const displayJobs = !user ? filtered.slice(0, 3) : isVerified ? filtered : filtered.slice(0, 3);

  const handleApplyClick = (job: any) => {
    if (job.easy_apply) {
      easyApplyMutation.mutate(job);
    } else if (job.apply_url) {
      window.open(job.apply_url, "_blank", "noopener,noreferrer");
    } else {
      setApplyingJob(job);
    }
  };

  return (
    <div className="bg-background flex flex-col min-h-0">
      {/* Apply Modal */}
      {applyingJob && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">Apply for {applyingJob.title}</h3>
                <p className="text-xs text-muted-foreground">{applyingJob.company}</p>
              </div>
              <button onClick={() => setApplyingJob(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Cover Note</Label>
                <Textarea placeholder="Why are you a good fit?" value={note} onChange={(e) => setNote(e.target.value)} className="bg-secondary border-border mt-1" rows={4} />
              </div>
              <div>
                <Label className="text-sm">Resume (optional)</Label>
                <div className="mt-1 border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById("resume-input")?.click()}>
                  {resumeFile ? (
                    <div className="flex items-center gap-2 justify-center"><FileText className="w-4 h-4 text-primary" /><span className="text-sm text-foreground">{resumeFile.name}</span></div>
                  ) : (
                    <div><Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" /><p className="text-xs text-muted-foreground">Upload PDF or DOC</p></div>
                  )}
                </div>
                <input id="resume-input" type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
              </div>
              <Button className="w-full h-11 rounded-xl" onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
                {applyMutation.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Post Job Modal */}
      {showPostForm && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Post a Job</h3>
              <button onClick={() => setShowPostForm(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><Label className="text-sm">Title *</Label><Input placeholder="Frontend Developer" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} className="bg-secondary border-border mt-1" /></div>
              <div><Label className="text-sm">Company *</Label><Input placeholder="Acme Inc" value={jobForm.company} onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })} className="bg-secondary border-border mt-1" /></div>
              <div><Label className="text-sm">Location *</Label><Input placeholder="Remote / Bangalore" value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} className="bg-secondary border-border mt-1" /></div>
              <div>
                <Label className="text-sm">Job Type</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {["Full-time", "Part-time", "Internship", "Remote"].map((t) => (
                    <button key={t} onClick={() => setJobForm({ ...jobForm, job_type: t, experience_level: "" })}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${jobForm.job_type === t ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Experience Level</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(SUB_FILTERS[jobForm.job_type] || SUB_FILTERS["Full-time"]).map((lvl) => (
                    <button key={lvl} onClick={() => setJobForm({ ...jobForm, experience_level: jobForm.experience_level === lvl ? "" : lvl })}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${jobForm.experience_level === lvl ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"}`}>{lvl}</button>
                  ))}
                </div>
              </div>
              <div><Label className="text-sm">Description</Label><Textarea placeholder="Job responsibilities, requirements..." value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} className="bg-secondary border-border mt-1" rows={3} /></div>
              <div>
                <Label className="text-sm">Application Method</Label>
                <div className="flex gap-1.5 mt-1">
                  <button type="button" onClick={() => setJobForm({ ...jobForm, easy_apply: true })}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl border transition-colors flex items-center justify-center gap-1 ${jobForm.easy_apply ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"}`}>
                    <Zap className="w-3.5 h-3.5" /> Easy Apply
                  </button>
                  <button type="button" onClick={() => setJobForm({ ...jobForm, easy_apply: false })}
                    className={`flex-1 text-xs px-3 py-2 rounded-xl border transition-colors flex items-center justify-center gap-1 ${!jobForm.easy_apply ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"}`}>
                    <ExternalLink className="w-3.5 h-3.5" /> External Link
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {jobForm.easy_apply ? "Applicants apply directly within Cirkle." : "Applicants are sent to an external website."}
                </p>
              </div>
              {!jobForm.easy_apply && (
                <div>
                  <Label className="text-sm">Apply URL *</Label>
                  <Input placeholder="https://company.com/careers/123" value={jobForm.apply_url} onChange={(e) => setJobForm({ ...jobForm, apply_url: e.target.value })} className="bg-secondary border-border mt-1" />
                </div>
              )}
              <Button className="w-full h-11 rounded-xl" onClick={() => postJobMutation.mutate()} disabled={postJobMutation.isPending || !jobForm.title || !jobForm.company || !jobForm.location || (!jobForm.easy_apply && !jobForm.apply_url)}>
                {postJobMutation.isPending ? "Posting..." : "Post Job"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky header section */}
      <div className="flex-shrink-0 bg-background sticky top-0 z-10">
        <div className="px-4 pt-4 pb-2">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Jobs</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{filtered.length} found</span>
              {canPostJobs && (
                <button onClick={() => setShowPostForm(true)} className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="max-w-lg mx-auto relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search jobs, companies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl bg-card border-border w-full" />
          </div>
        </div>

        {/* Primary filters */}
        <div className="px-4 py-2 overflow-x-auto scrollbar-hide">
          <div className="max-w-lg mx-auto flex gap-2">
            {PRIMARY_FILTERS.map((filter, i) => (
              <button key={filter} onClick={() => { setActiveFilter(i); setActiveSubFilter(null); }}
                className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-1 ${activeFilter === i ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
                {filter === "Easy Apply" && <Zap className="w-3 h-3" />}
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-filters */}
        {availableSubFilters.length > 0 && (
          <div className="px-4 py-1.5 overflow-x-auto scrollbar-hide">
            <div className="max-w-lg mx-auto flex gap-1.5">
              <button onClick={() => setActiveSubFilter(null)}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${!activeSubFilter ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                All Exp
              </button>
              {availableSubFilters.map((sub) => (
                <button key={sub} onClick={() => setActiveSubFilter(activeSubFilter === sub ? null : sub)}
                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border ${activeSubFilter === sub ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-y-contain">
        <main className="max-w-lg mx-auto px-4 py-3 space-y-3 pb-4">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                <div className="flex gap-3"><div className="w-12 h-12 rounded-full bg-secondary" /><div className="flex-1 space-y-2"><div className="h-4 bg-secondary rounded w-2/3" /><div className="h-3 bg-secondary rounded w-1/2" /></div></div>
              </div>
            ))
          ) : displayJobs.length ? (
            displayJobs.map((job: any, idx: number) => {
              const skills = getSkillsForJob(job.title);
              const isRemote = job.location?.toLowerCase().includes("remote");
              const hasApplied = myApplications?.includes(job.id);

              return (
                <article key={job.id} className="bg-card border border-border rounded-2xl p-4 animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                  <div className="flex gap-3 items-start">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary">{job.company?.[0] || "C"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div><h2 className="font-bold text-sm text-foreground leading-tight">{job.title}</h2><p className="text-xs text-muted-foreground mt-0.5">{job.company}</p></div>
                        <button className="p-1 text-muted-foreground hover:text-primary transition-colors"><Bookmark className="w-5 h-5" /></button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                    {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                    {isRemote && <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-[hsl(var(--success))]/20">Remote</span>}
                    {job.experience_level && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-foreground">{job.experience_level}</span>}
                    {job.easy_apply && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"><Zap className="w-2.5 h-2.5" />Easy Apply</span>}
                  </div>
                  {job.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{job.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {skills.map((skill) => (
                      <span key={skill} className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-primary/30 text-primary bg-primary/5">{skill}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-3">
                      {job.experience && <span className="text-sm font-bold text-foreground">{job.experience}</span>}
                      {job.job_type && <span className="text-xs text-muted-foreground">{job.job_type}</span>}
                    </div>
                    {!user || !isVerified ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2 rounded-lg bg-muted text-muted-foreground opacity-60 pointer-events-none">
                        Apply <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    ) : hasApplied ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2 rounded-lg bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                      </span>
                    ) : job.easy_apply ? (
                      <button onClick={() => handleApplyClick(job)}
                        disabled={easyApplyMutation.isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity min-h-[40px]">
                        <Zap className="w-3.5 h-3.5" /> Easy Apply
                      </button>
                    ) : (
                      <button onClick={() => handleApplyClick(job)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity min-h-[40px]">
                        Apply <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState icon={Briefcase} title="No jobs found" description="Try adjusting your filters." />
          )}

          {(!user || !isVerified) && (
            <div className="relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-8 text-center">
              <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-bold text-foreground text-sm">{!user ? "Sign In to Apply" : "Unlock All Jobs"}</h3>
              <p className="text-xs text-muted-foreground mt-1">{!user ? "Sign in and verify your account to see all jobs and apply." : "Verify your account to see all job listings and apply."}</p>
              <button onClick={() => navigate(!user ? "/auth" : "/iit-verify")} className="mt-4 px-6 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-full hover:opacity-90 transition-opacity">
                {!user ? "Sign In" : "Verify Now"}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Jobs;
