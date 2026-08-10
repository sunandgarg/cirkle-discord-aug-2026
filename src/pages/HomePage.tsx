import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MoreHorizontal,
  MessageCircle,
  Share2,
  Plus,
  BadgeCheck,
  ChevronRight,
  Users,
  X,
  Send,
  Repeat2,
  ShieldCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import StoryViewer from "@/components/StoryViewer";
import StoryCreator from "@/components/StoryCreator";
import PostComposer from "@/components/PostComposer";
import { toast } from "sonner";

const getInitials = (name?: string | null): string => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const IIT_NAMES = [
  "IIT Bombay",
  "IIT Delhi",
  "IIT Madras",
  "IIT Kanpur",
  "IIT Kharagpur",
  "IIT Roorkee",
  "IIT Guwahati",
  "IIT Hyderabad",
  "IIT BHU",
  "IIT Indore",
  "IIT Ropar",
  "IIT Patna",
  "IIT Bhubaneswar",
  "IIT Gandhinagar",
  "IIT Jodhpur",
  "IIT Mandi",
  "IIT Tirupati",
  "IIT Palakkad",
  "IIT Dharwad",
  "IIT Bhilai",
  "IIT Goa",
  "IIT Jammu",
  "IIT Dhanbad (ISM)",
];

const COURSES = ["BTech", "MTech", "MBA", "MSc", "MA", "MPhil", "PhD", "BDes", "MDes", "BS", "MS", "Dual Degree"];

const BRANCHES: Record<string, string[]> = {
  BTech: [
    "Computer Science",
    "Electrical",
    "Mechanical",
    "Civil",
    "Chemical",
    "Aerospace",
    "Biotechnology",
    "Mathematics & Computing",
    "Engineering Physics",
    "Metallurgical",
    "Mining",
    "Textile",
    "Ocean Engineering",
  ],
  MTech: [
    "Computer Science",
    "Data Science",
    "AI/ML",
    "VLSI",
    "Power Systems",
    "Structural",
    "Geotechnical",
    "Environmental",
    "Signal Processing",
    "Control Systems",
    "Manufacturing",
  ],
  MBA: [
    "General Management",
    "Finance",
    "Marketing",
    "Operations",
    "HR",
    "Strategy",
    "Consulting",
    "Entrepreneurship",
    "Public Policy",
  ],
  MSc: [
    "Physics",
    "Chemistry",
    "Mathematics",
    "Biology",
    "Economics",
    "Statistics",
    "Earth Sciences",
    "Cognitive Science",
  ],
  PhD: ["Computer Science", "Physics", "Chemistry", "Mathematics", "Engineering", "Management", "Humanities", "Design"],
  default: ["General"],
};

const YEARS = Array.from({ length: 43 }, (_, i) => String(2032 - i));

const SUGGESTED_SKILLS = [
  "React",
  "Python",
  "Machine Learning",
  "Data Science",
  "JavaScript",
  "Java",
  "C++",
  "Product Management",
  "UI/UX Design",
  "Cloud Computing",
  "DevOps",
  "Blockchain",
  "Deep Learning",
  "NLP",
  "Computer Vision",
  "Competitive Programming",
  "SQL",
  "Leadership",
  "Public Speaking",
  "Consulting",
  "Finance",
  "Marketing",
];

const MENTOR_CATEGORIES = ["Tech", "Finance", "Career", "Startups", "Research", "Design", "Legal", "Other"];

type WizardStep =
  | "name"
  | "headline"
  | "institute"
  | "course"
  | "branch"
  | "passing_year"
  | "location"
  | "skills"
  | "bio"
  | "mentor"
  | "avatar"
  | "cover";

const WIZARD_STEPS: { key: WizardStep; label: string; mandatory: boolean }[] = [
  { key: "name", label: "Full Name", mandatory: true },
  { key: "headline", label: "Headline", mandatory: false },
  { key: "institute", label: "Institute", mandatory: true },
  { key: "course", label: "Course / Degree", mandatory: true },
  { key: "branch", label: "Branch / Area", mandatory: true },
  { key: "passing_year", label: "Passing Year", mandatory: true },
  { key: "location", label: "Location", mandatory: true },
  { key: "skills", label: "Skills", mandatory: true },
  { key: "bio", label: "About You", mandatory: true },
  { key: "mentor", label: "Want to be a Mentor?", mandatory: true },
  { key: "avatar", label: "Profile Picture", mandatory: true },
  { key: "cover", label: "Cover Photo (Optional)", mandatory: false },
];

const getProfileCompleteness = (profile: any): number => {
  if (!profile) return 0;
  const fields = ["name", "headline", "bio", "avatar_url", "location", "skills", "iit_name", "student_status"];
  const filled = fields.filter((f) => {
    const val = profile[f];
    if (Array.isArray(val)) return val.length > 0;
    return !!val;
  }).length;
  return Math.round((filled / fields.length) * 100);
};

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const HomePage = () => {
  const { user, profile, isVerified, refetchProfile: refetchAuthProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState<{ groups: any[]; index: number } | null>(null);
  const [showProfileWizard, setShowProfileWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardForm, setWizardForm] = useState<Record<string, string>>({});
  const [customInput, setCustomInput] = useState("");
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (searchParams.get("wizard") === "true" && user && profile) {
      openWizardWithData();
    }
  }, [searchParams, user, profile]);

  const { data: customOptions } = useQuery({
    queryKey: ["custom-options"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_options").select("*");
      return data ?? [];
    },
    staleTime: 60000,
  });

  const { data: friendIds } = useQuery({
    queryKey: ["friend-ids", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("connections")
        .select("requester_id, receiver_id")
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq("status", "accepted");
      if (!data) return [];
      return data.map((c) => (c.requester_id === user.id ? c.receiver_id : c.requester_id));
    },
    enabled: !!user && isVerified,
    staleTime: Infinity,
  });

  const { data: stories } = useQuery({
    queryKey: ["stories", friendIds],
    queryFn: async () => {
      if (!user) return [];
      const allowedUserIds = [...(friendIds || []), user.id];
      const { data: storiesData } = await supabase
        .from("stories")
        .select("*")
        .in("user_id", allowedUserIds)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (!storiesData?.length) return [];
      const userIds = [...new Set(storiesData.map((s) => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      return storiesData.map((s) => ({ ...s, profile: profileMap.get(s.user_id) }));
    },
    enabled: !!user && isVerified,
    staleTime: Infinity,
  });

  const storyGroups = useMemo(() => {
    if (!stories) return [];
    return Object.values(
      stories.reduce<Record<string, any>>((acc, s: any) => {
        if (!acc[s.user_id])
          acc[s.user_id] = {
            userId: s.user_id,
            userName: s.profile?.name || "User",
            avatarUrl: s.profile?.avatar_url,
            stories: [],
          };
        acc[s.user_id].stories.push(s);
        return acc;
      }, {}),
    );
  }, [stories]);

  const [postsPage, setPostsPage] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 15;

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["home-posts", friendIds, postsPage],
    queryFn: async () => {
      if (!user) return [];
      // First fetch connection posts, then global posts
      const offset = postsPage * PAGE_SIZE;
      
      // Fetch from connections first
      const connectionIds = [...(friendIds || []), user.id];
      const { data: connPosts } = await supabase
        .from("posts")
        .select("*")
        .in("author_id", connectionIds)
        .eq("is_anonymous", false)
        .is("channel", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      
      let combinedPosts = connPosts || [];
      
      // If not enough from connections, fill with global posts
      if (combinedPosts.length < PAGE_SIZE) {
        const remaining = PAGE_SIZE - combinedPosts.length;
        const existingIds = combinedPosts.map(p => p.id);
        const { data: globalPosts } = await supabase
          .from("posts")
          .select("*")
          .eq("is_anonymous", false)
          .is("channel", null)
          .not("id", "in", `(${existingIds.length > 0 ? existingIds.join(",") : "00000000-0000-0000-0000-000000000000"})`)
          .order("created_at", { ascending: false })
          .range(0, remaining - 1);
        combinedPosts = [...combinedPosts, ...(globalPosts || [])];
      }
      
      if (combinedPosts.length < PAGE_SIZE) setHasMorePosts(false);
      if (!combinedPosts.length) return [];
      
      const authorIds = [...new Set(combinedPosts.map((p) => p.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, headline, avatar_url, is_verified, slug")
        .in("user_id", authorIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      const enriched = combinedPosts.map((post) => ({ 
        ...post, 
        profile: profileMap.get(post.author_id),
        isConnection: connectionIds.includes(post.author_id),
      }));
      
      // Sort: connections first, then by date
      enriched.sort((a, b) => {
        if (a.isConnection && !b.isConnection) return -1;
        if (!a.isConnection && b.isConnection) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      return enriched;
    },
    enabled: !!user && isVerified,
    staleTime: Infinity,
  });

  // Accumulate posts for infinite scroll
  useEffect(() => {
    if (posts && posts.length > 0) {
      if (postsPage === 0) {
        setAllPosts(posts);
      } else {
        setAllPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = posts.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
      setLoadingMore(false);
    }
  }, [posts, postsPage]);

  const loadMorePosts = useCallback(() => {
    if (loadingMore || !hasMorePosts) return;
    setLoadingMore(true);
    setPostsPage(prev => prev + 1);
  }, [loadingMore, hasMorePosts]);

  // Infinite scroll observer
  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMorePosts();
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMorePosts]);

  const { data: reactionData } = useQuery({
    queryKey: ["post-reactions"],
    queryFn: async () => {
      const { data } = await supabase.from("reactions").select("*").eq("entity_type", "post");
      const counts: Record<string, Record<string, number>> = {};
      const myReacts: Record<string, string[]> = {};
      data?.forEach((r: any) => {
        if (!counts[r.entity_id]) counts[r.entity_id] = {};
        const emoji = r.emoji || "👍";
        counts[r.entity_id][emoji] = (counts[r.entity_id][emoji] || 0) + 1;
        if (r.user_id === user?.id) {
          if (!myReacts[r.entity_id]) myReacts[r.entity_id] = [];
          myReacts[r.entity_id].push(emoji);
        }
      });
      return { counts, myReacts };
    },
    enabled: !!user && isVerified,
    staleTime: Infinity,
  });

  const { data: commentsData } = useQuery({
    queryKey: ["post-comments", expandedComments],
    queryFn: async () => {
      if (!expandedComments) return [];
      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", expandedComments)
        .order("created_at", { ascending: true });
      if (!data?.length) return [];
      const authorIds = [...new Set(data.map((c) => c.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, slug")
        .in("user_id", authorIds);
      const pMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      return data.map((c) => ({ ...c, profile: pMap.get(c.author_id) }));
    },
    enabled: !!expandedComments,
  });

  const { data: commentCounts } = useQuery({
    queryKey: ["comment-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("comments").select("post_id");
      const counts: Record<string, number> = {};
      data?.forEach((c) => {
        counts[c.post_id] = (counts[c.post_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user && isVerified,
    staleTime: Infinity,
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string }) => {
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data: existing } = await supabase
        .from("reactions")
        .select("id")
        .eq("entity_id", postId)
        .eq("user_id", user.id)
        .eq("entity_type", "post")
        .eq("emoji", emoji)
        .maybeSingle();
      if (existing) {
        await supabase.from("reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("reactions").insert({ entity_type: "post", entity_id: postId, user_id: user.id, emoji });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["post-reactions"] }),
  });

  const addComment = useMutation({
    mutationFn: async ({ postId, parentId }: { postId: string; parentId?: string }) => {
      if (!user || !commentText.trim()) return;
      await supabase.from("comments").insert({
        post_id: postId,
        author_id: user.id,
        content: commentText.trim(),
        ...(parentId ? { parent_comment_id: parentId } : {}),
      });
    },
    onSuccess: () => {
      setCommentText("");
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ["post-comments"] });
      queryClient.invalidateQueries({ queryKey: ["comment-counts"] });
    },
  });

  const resharePost = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) {
        navigate("/auth");
        return;
      }
      await supabase.from("posts").insert({
        author_id: user.id,
        content: "",
        community_id: "default",
        is_anonymous: false,
        reshared_post_id: postId,
      });
    },
    onSuccess: () => {
      toast.success("Reshared!");
      queryClient.invalidateQueries({ queryKey: ["home-posts"] });
    },
  });

  const saveWizardStep = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const step = WIZARD_STEPS[wizardStep];
      const value = (wizardForm[step.key] || "").trim();

      // Validation
      if (step.mandatory) {
        if (step.key === "skills") {
          const skills = (wizardForm.skills || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (skills.length === 0) throw new Error("Add at least one skill");
        } else if (step.key === "mentor") {
          if (!wizardForm.is_mentor) throw new Error("Please choose Yes or No");
        } else if (step.key === "avatar") {
          if (!wizardForm.avatar_url) throw new Error("Profile picture is required");
        } else if (step.key !== "cover") {
          if (!value) throw new Error(`${step.label} is required`);
        }
      }

      const update: any = {};

      if (step.key === "name") {
        update.name = value;
      } else if (step.key === "headline") {
        update.headline = value;
      } else if (step.key === "institute") {
        update.iit_name = value;
        if (value && !IIT_NAMES.includes(value)) {
          await supabase
            .from("custom_options")
            .insert({ category: "institute", value, created_by: user.id } as any)
            .then(() => {});
        }
      } else if (step.key === "course") {
        // Build full student_status with current course + existing branch + year
        const branch = wizardForm.branch || "";
        const year = wizardForm.passing_year || "";
        update.student_status = [year, value, branch].filter(Boolean).join(" ").trim();
        if (value && !COURSES.includes(value)) {
          await supabase
            .from("custom_options")
            .insert({ category: "degree", value, created_by: user.id } as any)
            .then(() => {});
        }
      } else if (step.key === "branch") {
        const course = wizardForm.course || "";
        const year = wizardForm.passing_year || "";
        update.student_status = [year, course, value].filter(Boolean).join(" ").trim();
        const courseKey = wizardForm.course || "default";
        const branches = BRANCHES[courseKey] || BRANCHES.default;
        if (value && !branches.includes(value)) {
          await supabase
            .from("custom_options")
            .insert({ category: "branch", value, created_by: user.id } as any)
            .then(() => {});
        }
      } else if (step.key === "passing_year") {
        const course = wizardForm.course || "";
        const branch = wizardForm.branch || "";
        update.student_status = [value, course, branch].filter(Boolean).join(" ").trim();
      } else if (step.key === "location") {
        update.location = value;
        if (value) {
          await supabase
            .from("custom_options")
            .insert({ category: "city", value, created_by: user.id } as any)
            .then(() => {});
        }
      } else if (step.key === "skills") {
        const skills = (wizardForm.skills || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        update.skills = skills;
        for (const skill of skills) {
          if (!SUGGESTED_SKILLS.includes(skill)) {
            await supabase
              .from("custom_skills")
              .insert({ name: skill, created_by: user.id } as any)
              .then(() => {});
          }
        }
      } else if (step.key === "bio") {
        update.bio = value;
      } else if (step.key === "mentor") {
        const isMentor = wizardForm.is_mentor === "true";
        update.is_mentor = isMentor;
        if (isMentor) {
          update.mentor_category = wizardForm.mentor_category || null;
          update.mentor_price_chat = wizardForm.mentor_price_chat
            ? parseInt(wizardForm.mentor_price_chat) || null
            : null;
          update.mentor_price_audio = wizardForm.mentor_price_audio
            ? parseInt(wizardForm.mentor_price_audio) || null
            : null;
          update.mentor_price_video = wizardForm.mentor_price_video
            ? parseInt(wizardForm.mentor_price_video) || null
            : null;
        }
      } else if (step.key === "avatar") {
        if (wizardForm.avatar_url) update.avatar_url = wizardForm.avatar_url;
      } else if (step.key === "cover") {
        if (wizardForm.cover_photo_url) update.cover_photo_url = wizardForm.cover_photo_url;
      }

      // Always save onboarding progress
      if (Object.keys(update).length > 0) {
        const { error } = await supabase
          .from("profiles")
          .update(update as any)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      // Refetch profile immediately so data is fresh
      await refetchAuthProfile();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });

      if (wizardStep < WIZARD_STEPS.length - 1) {
        setWizardStep(wizardStep + 1);
      } else {
        // Also insert education record from wizard data
        const institute = wizardForm.institute?.trim();
        const course = wizardForm.course?.trim();
        const branch = wizardForm.branch?.trim();
        const year = wizardForm.passing_year?.trim();
        if (institute && user) {
          const { data: eduEntry } = await supabase
            .from("education")
            .insert({
              user_id: user.id,
              institution: institute,
              degree: course || null,
              branch_area: branch || null,
              passing_year: year || null,
              location: wizardForm.location?.trim() || null,
            })
            .select("id")
            .single();
          // Set as primary education
          if (eduEntry) {
            await supabase
              .from("profiles")
              .update({ primary_education_id: eduEntry.id } as any)
              .eq("user_id", user.id);
          }
        }
        // Mark onboarding complete
        await supabase
          .from("profiles")
          .update({ onboarding_completed: true } as any)
          .eq("user_id", user!.id);
        await refetchAuthProfile();
        queryClient.invalidateQueries({ queryKey: ["education"] });
        setShowProfileWizard(false);
        setWizardStep(0);
        toast.success("Profile completed! 🎉");
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <img src="/cirkle-logo.png" alt="Cirkle" className="w-16 h-16 rounded-2xl mb-4" />
        <h2 className="text-xl font-bold text-foreground">Welcome to Cirkle</h2>
        <p className="text-muted-foreground mt-2">Sign in to see your personalized feed.</p>
        <Button className="mt-4" onClick={() => navigate("/auth")}>
          Sign In
        </Button>
      </div>
    );
  }

  // Gate content behind verification
  if (!isVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <ShieldCheck className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Verify Your Account</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Complete verification to access your home feed, network, and all features.
        </p>
        <Button className="mt-6 rounded-xl" onClick={() => navigate("/iit-verify")}>
          <ShieldCheck className="w-4 h-4 mr-2" /> Verify Now
        </Button>
      </div>
    );
  }

  const profileComplete = getProfileCompleteness(profile);
  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));

  const handleCancelWizard = () => setShowCancelConfirm(true);
  const confirmCancel = () => {
    setShowCancelConfirm(false);
    setShowProfileWizard(false);
    setWizardStep(0);
  };

  const extraDegrees = customOptions?.filter((o: any) => o.category === "degree").map((o: any) => o.value) || [];
  const extraBranches = customOptions?.filter((o: any) => o.category === "branch").map((o: any) => o.value) || [];
  const extraCities = customOptions?.filter((o: any) => o.category === "city").map((o: any) => o.value) || [];
  const extraInstitutes = customOptions?.filter((o: any) => o.category === "institute").map((o: any) => o.value) || [];

  const openWizardWithData = () => {
    const status = profile?.student_status || "";
    const statusParts = status.split(" ");
    setWizardForm({
      name: profile?.name || "",
      headline: profile?.headline || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      skills: (profile?.skills || []).join(", "),
      institute: profile?.iit_name || "",
      course: statusParts[1] || "",
      branch: statusParts.slice(2).join(" ") || "",
      passing_year: statusParts[0] || "",
      is_mentor: profile?.is_mentor ? "true" : profile?.is_mentor === false ? "false" : "",
      mentor_category: profile?.mentor_category || "",
      mentor_price_chat: profile?.mentor_price_chat?.toString() || "",
      mentor_price_audio: profile?.mentor_price_audio?.toString() || "",
      mentor_price_video: profile?.mentor_price_video?.toString() || "",
      avatar_url: profile?.avatar_url || "",
      cover_photo_url: profile?.cover_photo_url || "",
    });
    setWizardStep(0);
    setShowProfileWizard(true);
  };

  const renderWizardField = () => {
    const step = WIZARD_STEPS[wizardStep];

    if (step.key === "name" || step.key === "headline") {
      return (
        <Input
          placeholder={step.key === "name" ? "John Doe" : "BTech CSE @ IIT Delhi"}
          value={wizardForm[step.key] || ""}
          onChange={(e) => setWizardForm({ ...wizardForm, [step.key]: e.target.value })}
          className="bg-secondary border-border h-12"
        />
      );
    }

    if (step.key === "institute") {
      const allInstitutes = [...IIT_NAMES, ...extraInstitutes.filter((i: string) => !IIT_NAMES.includes(i))];
      return (
        <div className="space-y-2">
          <div className="max-h-[35vh] overflow-y-auto space-y-1">
            <button
              onClick={() => {
                setCustomInput("");
                setWizardForm({ ...wizardForm, institute: "" });
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm bg-accent/50 border border-dashed border-primary/30 text-primary font-medium"
            >
              ✏️ Other (type your own)
            </button>
            {allInstitutes.map((opt) => (
              <button
                key={opt}
                onClick={() => setWizardForm({ ...wizardForm, institute: opt })}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${wizardForm.institute === opt ? "bg-primary/10 border border-primary text-primary font-medium" : "bg-secondary border border-border text-foreground hover:border-primary/50"}`}
              >
                {opt}
              </button>
            ))}
          </div>
          {!IIT_NAMES.includes(wizardForm.institute || "") && (
            <Input
              placeholder="Type your institute name..."
              value={wizardForm.institute || ""}
              onChange={(e) => setWizardForm({ ...wizardForm, institute: e.target.value })}
              className="bg-secondary border-border h-10 mt-2"
            />
          )}
        </div>
      );
    }

    if (step.key === "course") {
      const allCourses = [...COURSES, ...extraDegrees.filter((d: string) => !COURSES.includes(d))];
      return (
        <div className="space-y-2">
          <div className="max-h-[35vh] overflow-y-auto space-y-1">
            <button
              onClick={() => setWizardForm({ ...wizardForm, course: "" })}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm bg-accent/50 border border-dashed border-primary/30 text-primary font-medium"
            >
              ✏️ Other (type your own)
            </button>
            {allCourses.map((opt) => (
              <button
                key={opt}
                onClick={() => setWizardForm({ ...wizardForm, course: opt })}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${wizardForm.course === opt ? "bg-primary/10 border border-primary text-primary font-medium" : "bg-secondary border border-border text-foreground hover:border-primary/50"}`}
              >
                {opt}
              </button>
            ))}
          </div>
          {!COURSES.includes(wizardForm.course || "") && (
            <Input
              placeholder="Type your degree..."
              value={wizardForm.course || ""}
              onChange={(e) => setWizardForm({ ...wizardForm, course: e.target.value })}
              className="bg-secondary border-border h-10 mt-2"
            />
          )}
        </div>
      );
    }

    if (step.key === "branch") {
      const courseKey = wizardForm.course || "default";
      const baseBranches = BRANCHES[courseKey] || BRANCHES.default;
      const allBranches = [...baseBranches, ...extraBranches.filter((b: string) => !baseBranches.includes(b))];
      return (
        <div className="space-y-2">
          <div className="max-h-[35vh] overflow-y-auto space-y-1">
            <button
              onClick={() => setWizardForm({ ...wizardForm, branch: "" })}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm bg-accent/50 border border-dashed border-primary/30 text-primary font-medium"
            >
              ✏️ Other (type your own)
            </button>
            {allBranches.map((opt) => (
              <button
                key={opt}
                onClick={() => setWizardForm({ ...wizardForm, branch: opt })}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${wizardForm.branch === opt ? "bg-primary/10 border border-primary text-primary font-medium" : "bg-secondary border border-border text-foreground hover:border-primary/50"}`}
              >
                {opt}
              </button>
            ))}
          </div>
          {!baseBranches.includes(wizardForm.branch || "") && (
            <Input
              placeholder="Type your branch..."
              value={wizardForm.branch || ""}
              onChange={(e) => setWizardForm({ ...wizardForm, branch: e.target.value })}
              className="bg-secondary border-border h-10 mt-2"
            />
          )}
        </div>
      );
    }

    if (step.key === "passing_year") {
      return (
        <div className="max-h-[40vh] overflow-y-auto space-y-1">
          {YEARS.map((opt) => (
            <button
              key={opt}
              onClick={() => setWizardForm({ ...wizardForm, passing_year: opt })}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${wizardForm.passing_year === opt ? "bg-primary/10 border border-primary text-primary font-medium" : "bg-secondary border border-border text-foreground hover:border-primary/50"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (step.key === "location") {
      const popularCities = [
        "New Delhi",
        "Mumbai",
        "Bangalore",
        "Chennai",
        "Hyderabad",
        "Kolkata",
        "Pune",
        "Ahmedabad",
        "Jaipur",
        "Lucknow",
        "Chandigarh",
        "Guwahati",
        "Bhopal",
        "Indore",
        "Patna",
        "Kochi",
        "Coimbatore",
        "Nagpur",
        "Visakhapatnam",
        "Thiruvananthapuram",
      ];
      const allCities = [...popularCities, ...extraCities.filter((c: string) => !popularCities.includes(c))];
      return (
        <div className="space-y-2">
          <Input
            placeholder="Search or type your city..."
            value={wizardForm.location || ""}
            onChange={(e) => setWizardForm({ ...wizardForm, location: e.target.value })}
            className="bg-secondary border-border h-10"
          />
          <div className="max-h-[30vh] overflow-y-auto space-y-1">
            {allCities
              .filter(
                (c) => !wizardForm.location || c.toLowerCase().includes((wizardForm.location || "").toLowerCase()),
              )
              .map((city) => (
                <button
                  key={city}
                  onClick={() => setWizardForm({ ...wizardForm, location: city })}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${wizardForm.location === city ? "bg-primary/10 border border-primary text-primary font-medium" : "bg-secondary border border-border text-foreground hover:border-primary/50"}`}
                >
                  {city}
                </button>
              ))}
          </div>
        </div>
      );
    }

    if (step.key === "skills") {
      const selectedSkills = (wizardForm.skills || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return (
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedSkills.map((skill) => (
              <span
                key={skill}
                onClick={() => {
                  const updated = selectedSkills.filter((s) => s !== skill).join(", ");
                  setWizardForm({ ...wizardForm, skills: updated });
                }}
                className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                {skill} ×
              </span>
            ))}
          </div>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Add custom skill..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customInput.trim()) {
                  const updated = [...selectedSkills, customInput.trim()].join(", ");
                  setWizardForm({ ...wizardForm, skills: updated });
                  setCustomInput("");
                }
              }}
              className="bg-secondary border-border h-9 text-xs"
            />
            <Button
              size="sm"
              className="h-9 px-3"
              onClick={() => {
                if (customInput.trim()) {
                  const updated = [...selectedSkills, customInput.trim()].join(", ");
                  setWizardForm({ ...wizardForm, skills: updated });
                  setCustomInput("");
                }
              }}
            >
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Or tap to add:</p>
          <div className="flex flex-wrap gap-1.5 max-h-[25vh] overflow-y-auto">
            {SUGGESTED_SKILLS.filter((s) => !selectedSkills.includes(s)).map((skill) => (
              <button
                key={skill}
                onClick={() => {
                  const updated = [...selectedSkills, skill].join(", ");
                  setWizardForm({ ...wizardForm, skills: updated });
                }}
                className="px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-foreground hover:border-primary hover:bg-primary/5 transition-all"
              >
                + {skill}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (step.key === "bio") {
      return (
        <Textarea
          placeholder="Tell others about yourself..."
          value={wizardForm.bio || ""}
          onChange={(e) => setWizardForm({ ...wizardForm, bio: e.target.value })}
          className="bg-secondary border-border min-h-[100px]"
        />
      );
    }

    if (step.key === "mentor") {
      const isMentor = wizardForm.is_mentor === "true";
      const isNo = wizardForm.is_mentor === "false";
      return (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Want to offer consultations and mentoring?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setWizardForm({ ...wizardForm, is_mentor: "true" })}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${isMentor ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground"}`}
            >
              <Users className="w-5 h-5 mx-auto mb-1" />
              Yes, I'm in!
            </button>
            <button
              onClick={() => setWizardForm({ ...wizardForm, is_mentor: "false" })}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${isNo ? "bg-secondary border-foreground/20 text-foreground" : "bg-secondary border-border text-muted-foreground"}`}
            >
              Not now
            </button>
          </div>
          {isMentor && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <Label className="text-xs">Category</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {MENTOR_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setWizardForm({ ...wizardForm, mentor_category: cat })}
                      className={`text-xs px-3 py-1.5 rounded-full transition-all border ${wizardForm.mentor_category === cat ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px]">Chat ₹</Label>
                  <Input
                    type="number"
                    placeholder="200"
                    value={wizardForm.mentor_price_chat || ""}
                    onChange={(e) => setWizardForm({ ...wizardForm, mentor_price_chat: e.target.value })}
                    className="bg-secondary border-border h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Audio ₹</Label>
                  <Input
                    type="number"
                    placeholder="300"
                    value={wizardForm.mentor_price_audio || ""}
                    onChange={(e) => setWizardForm({ ...wizardForm, mentor_price_audio: e.target.value })}
                    className="bg-secondary border-border h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Video ₹</Label>
                  <Input
                    type="number"
                    placeholder="400"
                    value={wizardForm.mentor_price_video || ""}
                    onChange={(e) => setWizardForm({ ...wizardForm, mentor_price_video: e.target.value })}
                    className="bg-secondary border-border h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (step.key === "avatar" || step.key === "cover") {
      const field = step.key === "avatar" ? "avatar_url" : "cover_photo_url";
      const preview = wizardForm[field];
      const isAvatar = step.key === "avatar";
      return (
        <div className="flex flex-col items-center gap-4">
          <div
            className={`${isAvatar ? "w-24 h-24 rounded-full" : "w-full h-32 rounded-xl"} bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden`}
          >
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className={`w-full h-full object-cover ${isAvatar ? "rounded-full" : "rounded-xl"}`}
              />
            ) : (
              <span className="text-2xl text-muted-foreground">📷</span>
            )}
          </div>
          <label className="cursor-pointer px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            {preview ? "Change Photo" : "Upload Photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user) return;
                const { convertToWebP } = await import("@/lib/imageUtils");
                const optimized = await convertToWebP(file, 0.8, isAvatar ? 400 : 1200);
                const path = `${user.id}/${step.key}-${Date.now()}.webp`;
                const { error } = await supabase.storage.from("avatars").upload(path, optimized, { upsert: true });
                if (error) {
                  toast.error("Upload failed");
                  return;
                }
                const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                setWizardForm({ ...wizardForm, [field]: urlData.publicUrl });
                await supabase
                  .from("profiles")
                  .update({ [field]: urlData.publicUrl } as any)
                  .eq("user_id", user.id);
                toast.success("Photo uploaded!");
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {step.mandatory ? "Required" : "Optional - you can add this later"}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-background min-h-0">
      {showStoryCreator && <StoryCreator onClose={() => setShowStoryCreator(false)} />}
      {storyViewerData && (
        <StoryViewer
          groups={storyViewerData.groups}
          initialGroupIndex={storyViewerData.index}
          onClose={() => setStoryViewerData(null)}
        />
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full animate-fade-in text-center">
            <p className="text-lg font-bold text-foreground mb-2">Wait, really? 🥺</p>
            <p className="text-sm text-muted-foreground mb-4">
              Your profile is like a first impression — complete it to stand out!
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={confirmCancel}>
                Skip for now
              </Button>
              <Button className="flex-1" onClick={() => setShowCancelConfirm(false)}>
                Let's finish!
              </Button>
            </div>
          </div>
        </div>
      )}

      {showProfileWizard && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-start justify-center pt-16">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in max-h-[80vh] overflow-y-auto relative">
            <button
              onClick={handleCancelWizard}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-4">
              <h3 className="font-bold text-foreground text-lg">Complete Your Profile</h3>
              <p className="text-xs text-muted-foreground">
                Step {wizardStep + 1} of {WIZARD_STEPS.length}{" "}
                {WIZARD_STEPS[wizardStep].mandatory && <span className="text-destructive">*</span>}
              </p>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full mb-6">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((wizardStep + 1) / WIZARD_STEPS.length) * 100}%` }}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                {WIZARD_STEPS[wizardStep].label}
                {WIZARD_STEPS[wizardStep].mandatory && <span className="text-destructive ml-1">*</span>}
              </Label>
              {renderWizardField()}
            </div>
            <div className="flex gap-2 mt-6">
              {wizardStep > 0 && (
                <Button variant="outline" className="flex-1" onClick={() => setWizardStep(wizardStep - 1)}>
                  Back
                </Button>
              )}
              <Button
                className="flex-1 gap-1"
                onClick={() => saveWizardStep.mutate()}
                disabled={saveWizardStep.isPending}
              >
                {saveWizardStep.isPending ? (
                  "Saving..."
                ) : wizardStep < WIZARD_STEPS.length - 1 ? (
                  <>
                    Next <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  "Finish"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-lg lg:max-w-3xl mx-auto">
        {profileComplete < 100 && (
          <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-4 flex items-center gap-4">
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" stroke="white" strokeOpacity="0.3" strokeWidth="4" fill="none" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="white"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${(profileComplete / 100) * 150.8} 150.8`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {profileComplete}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Enhance Profile</p>
              <p className="text-xs text-primary-foreground/80">Complete your profile to stand out</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-7 rounded-full px-3 flex-shrink-0"
              onClick={openWizardWithData}
            >
              Complete Now
            </Button>
          </div>
        )}

        <section
          className="flex gap-3 px-4 py-4 overflow-x-auto scrollbar-hide border-b border-border"
          aria-label="Stories"
        >
          <div
            className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 press-scale cursor-pointer"
            onClick={() => setShowStoryCreator(true)}
          >
            <div className="w-[60px] h-[60px] rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary transition-colors">
              <Plus className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="text-[10px] text-muted-foreground text-center truncate w-full">Your Story</span>
          </div>
          {storyGroups.map((group: any, i: number) => (
            <div
              key={group.userId}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 press-scale cursor-pointer"
              onClick={() => setStoryViewerData({ groups: storyGroups, index: i })}
            >
              <div className="story-ring">
                <div className="story-ring-inner">
                  {group.avatarUrl ? (
                    <img
                      src={group.avatarUrl}
                      alt={group.userName}
                      className="w-[54px] h-[54px] rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-[54px] h-[54px] rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{getInitials(group.userName)}</span>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground text-center truncate w-full">
                {group.userName.split(" ")[0]}
              </span>
            </div>
          ))}
        </section>

        <PostComposer />

        <section className="divide-y divide-border" aria-label="Feed">
          {allPosts?.map((post: any, idx: number) => {
            const authorProfile = post.profile;
            const displayName = authorProfile?.name || "User";
            const headline = authorProfile?.headline || "";
            const avatar = authorProfile?.avatar_url;
            const postIsVerified = authorProfile?.is_verified;
            const postReactions = reactionData?.counts?.[post.id] || {};
            const myPostReactions = reactionData?.myReacts?.[post.id] || [];
            const totalReactions = Object.values(postReactions).reduce((a: number, b: any) => a + b, 0);
            const commCount = commentCounts?.[post.id] || 0;
            const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: false }).replace("about ", "");
            const isCommentsOpen = expandedComments === post.id;
            const postComments = isCommentsOpen ? commentsData || [] : [];
            const topComments = postComments.filter((c: any) => !c.parent_comment_id);
            const childComments = postComments.filter((c: any) => c.parent_comment_id);

            return (
              <article
                key={post.id}
                className="bg-card px-4 py-4 animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() =>
                      navigate(post.profile?.slug ? `/u/${post.profile.slug}` : `/profile/${post.author_id}`)
                    }
                    className="flex-shrink-0"
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{getInitials(displayName)}</span>
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="font-semibold text-sm text-foreground leading-tight">{displayName}</p>
                          {postIsVerified && <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {headline}
                          {headline ? " · " : ""}
                          {timeAgo} ago
                        </p>
                      </div>
                      <button className="p-1 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {post.reshared_post_id && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Repeat2 className="w-3.5 h-3.5" /> Reshared a post
                  </div>
                )}

                <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {post.content.length > 200 ? (
                    <>
                      {post.content.substring(0, 200)}...{" "}
                      <span className="text-primary cursor-pointer font-medium">more</span>
                    </>
                  ) : (
                    post.content
                  )}
                </p>

                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt=""
                    className="mt-3 rounded-xl w-full max-h-80 object-cover"
                    loading="lazy"
                  />
                )}

                {totalReactions > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(postReactions).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction.mutate({ postId: post.id, emoji })}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-all ${myPostReactions.includes(emoji) ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-foreground hover:border-primary/40"}`}
                      >
                        {emoji} {count as number}
                      </button>
                    ))}
                  </div>
                )}

                {/* Facebook-style engagement bar */}
                <div className="mt-3 pt-2 border-t border-border">
                  {totalReactions > 0 || commCount > 0 ? (
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                      {totalReactions > 0 && (
                        <span className="flex items-center gap-1">
                          {Object.keys(postReactions).slice(0, 3).map(e => <span key={e}>{e}</span>)}
                          {totalReactions}
                        </span>
                      )}
                      {commCount > 0 && <span className="ml-auto">{formatCount(commCount)} comment{commCount !== 1 ? 's' : ''}</span>}
                    </div>
                  ) : null}
                  <div className="flex items-center border-t border-border pt-1">
                    <div className="flex-1 group/like relative">
                      <button onClick={() => toggleReaction.mutate({ postId: post.id, emoji: "👍" })}
                        className={`engagement-btn w-full justify-center py-2 ${myPostReactions.length > 0 ? 'active' : ''}`}>
                        {myPostReactions.length > 0 ? myPostReactions[0] : '👍'} <span>{myPostReactions.length > 0 ? 'Liked' : 'Like'}</span>
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/like:flex bg-card border border-border rounded-full shadow-xl px-1.5 py-1 gap-0.5 z-20">
                        {EMOJIS.map(emoji => (
                          <button key={emoji} onClick={() => toggleReaction.mutate({ postId: post.id, emoji })}
                            className={`text-lg px-1 hover:scale-125 transition-transform rounded-full ${myPostReactions.includes(emoji) ? 'bg-primary/10' : ''}`}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setExpandedComments(isCommentsOpen ? null : post.id)}
                      className="engagement-btn flex-1 justify-center py-2">
                      <MessageCircle className="w-4 h-4" /> <span>Comment</span>
                    </button>
                    <button onClick={() => resharePost.mutate(post.id)} className="engagement-btn flex-1 justify-center py-2">
                      <Repeat2 className="w-4 h-4" /> <span>Reshare</span>
                    </button>
                    <button onClick={() => { navigator.share?.({ text: post.content, url: window.location.href }).catch(() => {}); }}
                      className="engagement-btn flex-1 justify-center py-2">
                      <Share2 className="w-4 h-4" /> <span>Send</span>
                    </button>
                  </div>
                </div>

                {isCommentsOpen && (
                  <div className="mt-3 space-y-3 animate-fade-in">
                    {topComments.map((comment: any) => {
                      const cReplies = childComments.filter((c: any) => c.parent_comment_id === comment.id);
                      return (
                        <div key={comment.id}>
                          <CommentBubble
                            comment={comment}
                            onReply={() =>
                              setReplyingTo({ commentId: comment.id, authorName: comment.profile?.name || "User" })
                            }
                          />
                          {cReplies.map((reply: any) => (
                            <div key={reply.id} className="ml-8 mt-1">
                              <CommentBubble
                                comment={reply}
                                onReply={() =>
                                  setReplyingTo({ commentId: comment.id, authorName: reply.profile?.name || "User" })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <div className="flex gap-2 items-center pt-2 border-t border-border">
                      <div className="flex-1 relative">
                        {replyingTo && (
                          <div className="text-[10px] text-primary mb-1 flex items-center gap-1">
                            Replying to {replyingTo.authorName}
                            <button onClick={() => setReplyingTo(null)}>
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <Input
                          placeholder="Write a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              addComment.mutate({ postId: post.id, parentId: replyingTo?.commentId });
                          }}
                          className="bg-secondary border-border h-9 text-xs pr-10"
                        />
                      </div>
                      <button
                        onClick={() => addComment.mutate({ postId: post.id, parentId: replyingTo?.commentId })}
                        className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {(!allPosts || allPosts.length === 0) && !postsLoading && (
            <div className="text-center py-16 px-6">
              <p className="text-lg font-semibold text-foreground mb-1">No posts yet</p>
              <p className="text-sm text-muted-foreground">Connect with people or create a post to get started!</p>
            </div>
          )}
          {/* Infinite scroll trigger */}
          {hasMorePosts && allPosts.length > 0 && (
            <div ref={observerRef} className="py-6 text-center">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading more...
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Scroll for more</span>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

/* Comment Bubble */
const CommentBubble = ({ comment, onReply }: { comment: any; onReply: () => void }) => {
  const navigate = useNavigate();
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => navigate(comment.profile?.slug ? `/u/${comment.profile.slug}` : `/profile/${comment.author_id}`)}
        className="flex-shrink-0"
      >
        {comment.profile?.avatar_url ? (
          <img src={comment.profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">{getInitials(comment.profile?.name)}</span>
          </div>
        )}
      </button>
      <div className="flex-1">
        <div className="bg-secondary rounded-xl px-3 py-2">
          <p className="text-xs font-semibold text-foreground">{comment.profile?.name || "User"}</p>
          <p className="text-xs text-foreground/80 mt-0.5">{comment.content}</p>
        </div>
        <div className="flex gap-3 mt-0.5 px-1">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: false })} ago
          </span>
          <button onClick={onReply} className="text-[10px] font-semibold text-primary hover:underline">
            Reply
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
