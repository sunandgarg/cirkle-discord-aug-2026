import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, Smile, Search, ImageIcon, X, BarChart3, Plus, Trash2, Reply,
  ChevronDown, Menu, Hash, Bookmark, BookmarkPlus, Pin,
  MoreHorizontal, Check, Users, Megaphone, Copy, Forward,
  CheckCheck, Clock, Pencil, AtSign, ArrowDown, Film,
  Mic, Paperclip, MessageSquare, Bold, Italic, Code, Timer, Settings2, Eye,
  Filter, Calendar, User, Link2, Image as ImageLucide, ChevronRight,
  Volume2, EyeOff, Flag
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format, isToday, isYesterday, subDays, subHours, subMinutes } from "date-fns";
import MaskedContent from "@/components/MaskedContent";
import GifPicker from "@/components/GifPicker";
import { renderFormattedMessage } from "@/components/forum/MessageFormatting";
import VoiceRecorder, { VoicePlayback } from "@/components/forum/VoiceRecorder";
import ImageLightbox from "@/components/forum/ImageLightbox";
import FileAttachment from "@/components/forum/FileAttachment";
import ThreadPanel from "@/components/forum/ThreadPanel";
import { getCachedPosts, setCachedPosts, getUnreadChannels, setChannelRead, setChannelUnread } from "@/hooks/useForumCache";
import { useScrollBehavior } from "@/hooks/useScrollBehavior";

/* ─── Types ─── */
interface ScopeDef {
  id: string; type: string; key: string; label: string;
  subtitle?: string; emoji: string; section: "recommended" | "all" | "saved";
  hasToggle?: boolean;
  toggleOptions?: { id: string; type: string; key: string; label: string; scopeLabel?: string; subtitle?: string }[];
}
interface SavedView {
  id: string; user_id: string; name: string; scope_type: string;
  scope_key: string; filters_json: any; sort: string; pinned: boolean; created_at: string;
}

const EMOJIS = ["❤️", "🔥", "👍", "😂", "💯", "😮", "😢", "🎉"];
const isDemoId = (id: string) => typeof id === "string" && id.startsWith("demo-");
const QUICK_REACTIONS = ["❤️", "🔥", "👍", "😂", "💯"];

/* ─── Color helpers ─── */
const DISCORD_COLORS = [
  "text-[hsl(359,82%,65%)]", "text-[hsl(38,96%,65%)]", "text-[hsl(139,47%,55%)]",
  "text-[hsl(197,100%,64%)]", "text-[hsl(234,89%,74%)]", "text-[hsl(313,64%,68%)]",
  "text-[hsl(27,90%,65%)]", "text-[hsl(168,76%,52%)]",
];
const AVATAR_COLORS = [
  "bg-[hsl(359,82%,55%)]", "bg-[hsl(38,96%,55%)]", "bg-[hsl(139,47%,45%)]",
  "bg-[hsl(197,100%,54%)]", "bg-[hsl(234,89%,64%)]", "bg-[hsl(313,64%,58%)]",
  "bg-[hsl(27,90%,55%)]", "bg-[hsl(168,76%,42%)]",
];
const getUserColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % DISCORD_COLORS.length;
  return { bg: AVATAR_COLORS[idx], text: DISCORD_COLORS[idx] };
};
const getInitials = (name?: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
};

/* ─── Build scopes from profile ─── */
const buildScopes = (profile: any, education: any): ScopeDef[] => {
  const iit = profile?.iit_name || education?.institution || "";
  const degree = education?.degree || "";
  const branch = education?.branch_area || "";
  const batch = education?.passing_year || "";
  const iitCode = iit.replace(/\s+/g, "_").toUpperCase();
  const scopes: ScopeDef[] = [];

  scopes.push({ id: "global", type: "GLOBAL", key: "IIT_ALL", label: "Multiverse", subtitle: "All 23 IITs · Everyone", emoji: "🌐", section: "all" });

  if (iit) {
    scopes.push({ id: "campus", type: "CAMPUS", key: iitCode, label: "My Campus", subtitle: `${iit} · All batches`, emoji: "🏛️", section: "recommended" });
  }

  if (degree && branch) {
    const courseCode = `${degree.replace(/\s+/g, "_")}_${branch.replace(/\s+/g, "_")}`.toUpperCase();
    scopes.push({
      id: "course", type: iit ? "COURSE_CAMPUS" : "COURSE_GLOBAL", key: iit ? `${iitCode}|${courseCode}` : courseCode,
      label: "My Course", subtitle: `${degree} · ${branch}`, emoji: "📖", section: "recommended",
      hasToggle: !!iit,
      toggleOptions: iit ? [
        { id: "course-campus", type: "COURSE_CAMPUS", key: `${iitCode}|${courseCode}`, label: "Campus" },
        { id: "course-global", type: "COURSE_GLOBAL", key: courseCode, label: "Global" },
      ] : undefined,
    });
  }

  if (batch) {
    scopes.push({
      id: "batch", type: iit ? "BATCH_CAMPUS" : "BATCH_GLOBAL", key: iit ? `${iitCode}|${batch}` : batch,
      label: "My Batch", subtitle: `Batch ${batch}`, emoji: "🎓", section: "recommended",
      hasToggle: !!iit,
      toggleOptions: iit ? [
        { id: "batch-campus", type: "BATCH_CAMPUS", key: `${iitCode}|${batch}`, label: "Campus" },
        { id: "batch-global", type: "BATCH_GLOBAL", key: batch, label: "Global" },
      ] : undefined,
    });
  }

  if (degree && branch && batch) {
    const cohortGlobalKey = `${degree.replace(/\s+/g, "_")}|${branch.replace(/\s+/g, "_")}|${batch}`.toUpperCase();
    if (iit) {
      const cohortKey = `${iitCode}|${cohortGlobalKey}`;
      scopes.push({
        id: "cohort", type: "COHORT", key: cohortKey,
        label: "My Cohort", subtitle: `${iit} · ${degree} · ${branch} · ${batch}`, emoji: "👥", section: "recommended",
        hasToggle: true,
        toggleOptions: [
          { id: "cohort-campus", type: "COHORT", key: cohortKey, label: "Campus", scopeLabel: "My Cohort", subtitle: `${iit} · ${degree} · ${branch} · ${batch}` },
          { id: "cohort-global", type: "COHORT_GLOBAL", key: cohortGlobalKey, label: "All IITs", scopeLabel: `All IITs · ${degree} · ${branch} · ${batch}`, subtitle: `Every IIT · ${degree} · ${branch} · ${batch}` },
        ],
      });
    } else {
      scopes.push({ id: "cohort", type: "COHORT_GLOBAL", key: cohortGlobalKey, label: "My Cohort · All IITs", subtitle: `${degree} · ${branch} · ${batch} · All IITs`, emoji: "👥", section: "recommended" });
    }
  }


  return scopes;
};

/* ─── Build query for a scope ─── */
const buildScopeQuery = (scopeType: string, scopeKey: string, limit = 50, beforeDate?: string) => {
  let q = supabase.from("posts").select("*")
    .is("reply_to_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(limit) as any;
  
  if (beforeDate) {
    q = q.lt("created_at", beforeDate);
  }

  switch (scopeType) {
    case "GLOBAL": q = q.or("channel.in.(global,all-iit-global),and(scope_type.eq.GLOBAL,scope_key.eq.IIT_ALL)"); break;
    case "CAMPUS": q = q.or(`campus_filter.eq.${scopeKey.replace(/_/g, " ")},and(scope_type.eq.CAMPUS,scope_key.eq.${scopeKey}),channel.eq.my-campus`); break;
    case "COURSE_GLOBAL": q = q.or(`and(scope_type.eq.COURSE_GLOBAL,scope_key.eq.${scopeKey}),channel.eq.course-global`); break;
    case "COURSE_CAMPUS": q = q.or(`and(scope_type.eq.COURSE_CAMPUS,scope_key.eq.${scopeKey}),channel.eq.course-campus`); break;
    case "BATCH_GLOBAL": q = q.or(`and(scope_type.eq.BATCH_GLOBAL,scope_key.eq.${scopeKey}),channel.eq.batch-global`); break;
    case "BATCH_CAMPUS": q = q.or(`and(scope_type.eq.BATCH_CAMPUS,scope_key.eq.${scopeKey}),channel.eq.batch-campus`); break;
    case "COHORT": q = q.or(`and(scope_type.eq.COHORT,scope_key.eq.${scopeKey}),channel.eq.my-cohort`); break;
    case "COHORT_GLOBAL": q = q.or(`and(scope_type.eq.COHORT_GLOBAL,scope_key.eq.${scopeKey}),channel.eq.cohort-global`); break;

    default: q = q.or("channel.in.(global,all-iit-global),and(scope_type.eq.GLOBAL,scope_key.eq.IIT_ALL)");
  }
  return q;
};

/* ─── Expanded test data (60+ messages) ─── */
const DEMO_NAMES = [
  "Arjun Mehta", "Priya Sharma", "Karthik Nair", "Sneha Reddy", "Rahul Verma",
  "Ananya Gupta", "Vikram Singh", "Deepika Joshi", "Rohan Das", "Megha Patel",
  "Aditya Kumar", "Ishita Banerjee", "Siddharth Rao", "Kavya Iyer", "Nikhil Chopra",
];
const DEMO_IDS = DEMO_NAMES.map((_, i) => `demo-user-${i + 1}`);

const generateTestMessages = (): any[] => {
  const now = new Date();
  const msgs: any[] = [];
  let id = 1;
  const m = (content: string, authorIdx: number, hoursAgo: number, opts: Partial<any> = {}) => {
    const created = subMinutes(subHours(now, Math.floor(hoursAgo)), Math.round((hoursAgo % 1) * 60));
    msgs.push({
      id: `demo-${id++}`, content, author_id: opts.is_anonymous ? `anon-${id}` : DEMO_IDS[authorIdx % DEMO_IDS.length],
      created_at: created.toISOString(), is_anonymous: opts.is_anonymous || false,
      scope_type: "GLOBAL", scope_key: "IIT_ALL", channel: "global",
      image_url: opts.image_url || null, voice_url: null, file_url: null,
      pinned_at: opts.pinned_at || null, reply_to_id: opts.reply_to_id || null,
      deleted_at: null, is_deleted_for_everyone: false, seen_by: [],
      edited_at: opts.edited_at || null, tags: opts.tags || null,
      profile: { name: DEMO_NAMES[authorIdx % DEMO_NAMES.length], avatar_url: null, slug: null },
      poll: opts.poll || null,
      replyCount: opts.replyCount || 0,
      reactions: opts.reactions || {},
      myReactions: [],
    });
  };

  // ── Tech discussions (spread over 5 days) ──
  m("🚀 React 19 just dropped! Server Components are now stable. Anyone tried migrating a production app yet?", 0, 96);
  m("We migrated our dashboard last week. The streaming SSR is incredible - TTFB dropped by 60%", 2, 95, { replyCount: 3 });
  m("Honest question: is it worth the migration pain? We have a massive codebase on React 17 still 😅", 4, 94);
  m("@Karthik Worth it if you're doing SSR. If it's a pure SPA, the benefits are more subtle", 1, 93, { reactions: { "👍": 4, "💯": 2 } });
  m("Has anyone here run Bun in production? Our Node.js cold starts on Lambda are killing us", 3, 88);
  m("We switched 3 months ago. Cold starts went from ~800ms to ~120ms. No regrets.", 5, 87.5, { reactions: { "🔥": 6 } });
  m("Careful with Bun - some npm packages with native bindings still break. Test thoroughly.", 7, 87);
  m("Rust vs Go for backend services - what's the IIT consensus? Starting a new microservice and genuinely torn", 6, 80);
  m("Go for 90% of use cases. Rust only if you need zero-cost abstractions or systems-level perf.", 8, 79, { reactions: { "👍": 8, "❤️": 2 } });
  m("Go has a gentler learning curve too. Your team will thank you when onboarding new devs", 9, 78.5);
  m("Supabase AMA happening next Friday! Drop your questions here and I'll compile them 📋", 0, 72, { pinned_at: new Date().toISOString(), replyCount: 7 });
  m("Question: Will Supabase ever support MongoDB-style document queries? Sometimes I miss flexible schemas", 10, 71);
  m("AI made me 40% more productive but 40% more lazy. Is this a net positive? 🤖", 11, 65, { is_anonymous: true, reactions: { "😂": 12, "💯": 5, "🔥": 3 } });
  m("The real question is: does your manager know the productivity gain is from AI? 😏", 4, 64.5, { reactions: { "😂": 8 } });
  m("TypeScript 5.4 discriminated unions are so clean. Here's a pattern I've been using for API responses…", 12, 56);
  m("```\ntype Result<T> = \n  | { ok: true; data: T }\n  | { ok: false; error: string }\n```\nSimple but powerful", 12, 55.8, { reactions: { "💯": 4 } });
  m("Just discovered htmx. Is anyone using it seriously or is it just Twitter hype?", 13, 48);
  m("We use it for internal tools. It's genuinely good for CRUD apps. Not a React replacement though.", 1, 47.5);
  m("Tailwind v4 alpha is looking interesting. CSS-first config, no more tailwind.config.js 🎨", 3, 40, { reactions: { "👍": 3 } });

  // ── Jobs channel ──
  m("🔥 Razorpay is hiring SDE-2s. DM me for referral. TC: 35-42L. Bangalore/Remote", 5, 92, { reactions: { "🔥": 5, "👍": 3 } });
  m("FAANG vs unicorn comp thread - let's be real about numbers. I'll start: L5 at Google Bangalore, 65L TC", 8, 84, { replyCount: 12, reactions: { "😮": 6 } });
  m("Meesho SDE-3: 52L. Joined at 26, now 28. Best decision of my career honestly", 10, 83);
  m("Staff Eng journey at 28 - AMA. Went from SDE-1 at Infosys to Staff at Razorpay in 5 years", 6, 76, { replyCount: 15, reactions: { "🔥": 9, "💯": 4 } });
  m("is job hopping every 18 months the new normal? I've done 4 companies in 6 years and my salary 5x'd", 14, 68, { is_anonymous: true, reactions: { "😂": 3, "👍": 7 } });
  m("Counterpoint: I stayed 4 years at Amazon, got promoted twice. Loyalty still works if the company is right", 2, 67);
  m("Bangalore SDE-3 salary benchmarks 2025 - let's crowdsource this. Drop your TC anonymously 📊", 9, 52, { replyCount: 8 });
  m("45L Flipkart SDE-3, 3 YOE at this level", 0, 51.5, { is_anonymous: true });
  m("58L Atlassian SDE-3, Bangalore. RSUs are the real game changer", 1, 51, { is_anonymous: true, reactions: { "🔥": 2 } });
  m("Anyone know about Cred's hiring freeze? Was supposed to interview next week and got ghosted", 11, 44);
  m("PhonePe is doing a campus drive at IIT KGP next month. Internship → PPO pipeline", 3, 36, { reactions: { "👍": 2 } });

  // ── Random channel ──
  m("Best chai spots in Koramangala? Just moved here from Delhi and the chai scene is… different 🍵", 7, 90, { reactions: { "😂": 3 } });
  m("Third Wave Coffee on 80 feet road isn't chai but their filter coffee is elite", 9, 89.5);
  m("There's a street vendor near Sony Signal. ₹15 cutting chai, better than anything in Delhi fight me", 13, 89, { reactions: { "🔥": 4, "❤️": 2 } });
  m("WFH vs office hot take: I'm more productive at home but more creative in office. Hybrid 3 days is the sweet spot", 1, 82, { replyCount: 6, reactions: { "👍": 5 } });
  m("Deployed on Friday. Production went down. Classic. 🫠", 4, 74, { reactions: { "😂": 15, "🔥": 3 } });
  m("```\ngit push origin main --force\n# What could go wrong?\n```", 4, 73.8, { reactions: { "😂": 8 } });
  m("does anyone else pretend to be busy during standups? 'Yeah I was... refactoring... the auth module... 👀'", 12, 60, { is_anonymous: true, reactions: { "😂": 18, "💯": 7 } });
  m("Weekend hiking near Bangalore - Skandagiri sunrise trek this Saturday. Who's in? 🏔️", 6, 50, { reactions: { "❤️": 4 }, replyCount: 5 });
  m("Count me in! Last time we went to Nandi Hills it was magical at 5am", 10, 49.5);
  m("Just finished reading 'Staff Engineer' by Will Larson. Highly recommend for anyone eyeing that path 📚", 0, 42, { reactions: { "👍": 6 } });
  m("Monday motivation: Remember when you couldn't even center a div? Look at you now building distributed systems 💪", 1, 28, { reactions: { "❤️": 9, "🔥": 4 } });
  m("The irony is I still can't center a div without Flexbox 😂", 3, 27.5, { reactions: { "😂": 11 } });

  // ── Announcements ──
  m("🎉 We just hit 1000 members! Thank you all for making this community incredible. Here's to the next 1000!", 0, 70, { pinned_at: new Date().toISOString(), reactions: { "🎉": 20, "❤️": 12, "🔥": 8 } });
  m("📢 Anonymous posting is now live! Toggle the 👁️ icon in the composer to post anonymously. Your identity stays hidden.", 0, 62, { reactions: { "👍": 15, "🔥": 6 } });
  m("Monthly IIT Alumni Meetup - This Saturday 7PM IST at Cubbon Park, Bangalore. DM for exact location 📍", 0, 34, { replyCount: 9, reactions: { "👍": 8, "❤️": 3 } });
  m("🚀 Job board feature coming next week! Post and discover opportunities within the IIT network. Stay tuned!", 0, 20, { reactions: { "🔥": 10, "💯": 5 } });

  // ── Recent messages (today) ──
  m("Good morning everyone! ☀️ What's everyone working on today?", 5, 8);
  m("Building a real-time dashboard with Supabase + React Query. The combo is 🤌", 2, 7.5, { reactions: { "🔥": 2 } });
  m("Debugging a memory leak in our Node service. Send help 🆘", 8, 6, { reactions: { "😂": 3 } });
  m("Have you tried the --inspect flag with Chrome DevTools? Saved my life last week", 0, 5.5);
  m("Hot take: Prettier > ESLint for code formatting. Fight me.", 14, 4, { reactions: { "👍": 3, "😂": 2 } });
  m("That's not even a hot take, that's just facts 😤", 3, 3.5);
  m("Anyone else excited about Deno 2.0? The npm compat story is finally solid", 11, 2, { reactions: { "👍": 2 } });
  m("Just shipped my first Rust + WASM module in a React app. Performance is insane for image processing", 6, 1, { reactions: { "🔥": 5, "💯": 2 } });
  m("The future is polyglot. JS for UI, Rust for compute, Go for services, Python for ML. Master your stack.", 0, 0.5, { reactions: { "💯": 8, "❤️": 3 } });

  return msgs;
};

const DEMO_MESSAGES = generateTestMessages();

/* ─── Scope-specific demo messages (so each channel feels unique) ─── */
const generateScopeDemos = (scopeType: string, scopeKey: string, scopeDef?: any): any[] => {
  if (scopeType === "GLOBAL") return DEMO_MESSAGES;

  const now = new Date();
  const label = scopeDef?.label || "this channel";
  const subtitle = scopeDef?.subtitle || "";
  const parts = scopeKey.split("|");
  const iit = (parts[0] || "").replace(/_/g, " ");
  const seed = scopeType + "_" + scopeKey;
  let h = 0; for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  const pick = (arr: string[], offset = 0) => arr[Math.abs(h + offset) % arr.length];

  let templates: string[] = [];
  switch (scopeType) {
    case "CAMPUS":
      templates = [
        `Welcome to the ${iit} channel 👋 Drop a hi so we know who's around!`,
        `Anyone heading to the ${iit} hostel mess tonight? The Tuesday menu is actually decent`,
        `${iit} placement cell just opened registrations for the spring drive - link in pinned`,
        `Looking for a ${iit} senior who did MS in Germany - quick chai/coffee chat?`,
        `Auditorium AC is broken again 🥲 Anyone raised a complaint?`,
        `${iit} tech fest dates are out. Volunteers needed for logistics`,
        `Selling cycle in good condition, graduating next month - ${iit} hostel pickup`,
        `Library extended hours till 2am during endsems - finally`,
      ];
      break;
    case "COURSE_CAMPUS":
    case "COURSE_GLOBAL": {
      const course = (parts[parts.length - 1] || "").replace(/_/g, " ");
      templates = [
        `${course} folks - what electives did you regret NOT taking?`,
        `Best prof for the core ${course} sequence? Asking for a junior`,
        `Any ${course} grads working in product roles? Curious about the transition`,
        `${course} project ideas - sharing a Notion doc with 30+ ideas, DM for link`,
        `Internship season tips for ${course} students - what worked for you?`,
        `${course} alumni meetup happening this weekend, IRL + Zoom`,
      ];
      break;
    }
    case "BATCH_CAMPUS":
    case "BATCH_GLOBAL": {
      const batch = parts[parts.length - 1] || "our batch";
      templates = [
        `Batch ${batch} - convocation photos, drop them here 📸`,
        `Whatsapp groups are dead, glad we have this. How's everyone doing post-grad?`,
        `Batch ${batch} reunion - Goa or Bangalore? Vote with reactions 🏖️🌆`,
        `Who else from ${batch} is doing MBA this year? Forming a study group`,
        `Throwback to ${batch} freshers night… we were so confused 😂`,
        `${batch} - anyone got married recently?? Share the news!`,
      ];
      break;
    }
    case "COHORT": {
      const degree = (parts[1] || "").replace(/_/g, " ");
      const branch = (parts[2] || "").replace(/_/g, " ");
      const batch = parts[3] || "";
      templates = [
        `${degree} ${branch} ${batch} - our private corner. No outsiders 🤫`,
        `Project allocation list dropped - who got which guide?`,
        `${branch} comprehensive viva tips please 🙏`,
        `Lab partners for next sem - drop a 🙋 if you need one`,
        `Anyone else struggling with the ${branch} core sequence this sem?`,
        `${batch} ${branch} placement stats - shall we make a shared sheet?`,
      ];
      break;
    }
    case "COHORT_GLOBAL": {
      const degree = (parts[0] || "").replace(/_/g, " ");
      const branch = (parts[1] || "").replace(/_/g, " ");
      const batch = parts[2] || "";
      templates = [
        `${degree} ${branch} ${batch} across all 23 IITs - say hi from your campus 👋`,
        `Curriculum comparison: how does ${branch} differ at your IIT?`,
        `Inter-IIT ${branch} project collab - anyone interested?`,
        `${batch} ${branch} placement trends across IITs - let's pool data`,
        `Best ${branch} electives at your campus? Recommendations welcome`,
        `Anyone from ${branch} ${batch} going for higher studies abroad?`,
      ];
      break;
    }

    default:
      templates = [`Welcome to ${label} ${subtitle ? "· " + subtitle : ""}`, "Be the first to start a conversation here ✨"];
  }

  return templates.map((content, i) => ({
    id: `demo-${seed}-${i}`,
    content,
    author_id: DEMO_IDS[(Math.abs(h) + i) % DEMO_IDS.length],
    created_at: subHours(now, (templates.length - i) * 2 + (i % 3)).toISOString(),
    is_anonymous: false,
    scope_type: scopeType, scope_key: scopeKey,
    channel: scopeType.toLowerCase(),
    image_url: null, voice_url: null, file_url: null,
    pinned_at: i === 0 ? new Date().toISOString() : null,
    reply_to_id: null, deleted_at: null, is_deleted_for_everyone: false, seen_by: [],
    edited_at: null, tags: null,
    profile: { name: pick(DEMO_NAMES, i), avatar_url: null, slug: null },
    poll: null, replyCount: i % 4, reactions: i % 2 === 0 ? { "👍": (i % 5) + 1 } : {},
    myReactions: [],
  }));
};

const PAGE_SIZE = 50;
const MAX_RENDERED = 200;

/* ══════════════════════════════════════════════════ */
/*                  FORUM PAGE                       */
/* ══════════════════════════════════════════════════ */
const Forum = () => {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Core state
  const [activeScope, setActiveScope] = useState<{ type: string; key: string }>({ type: "GLOBAL", key: "IIT_ALL" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchTab, setSearchTab] = useState<"messages" | "media" | "pins" | "links">("messages");
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [searchFilter, setSearchFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"feed" | "pinned">("feed");
  const [savingView, setSavingView] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [scopeToggles, setScopeToggles] = useState<Record<string, number>>({});
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [threadPost, setThreadPost] = useState<any>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [unreadDots, setUnreadDots] = useState<Record<string, boolean>>(() => getUnreadChannels());

  // Pagination state
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [olderPages, setOlderPages] = useState<any[]>([]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasScrolledRef = useRef(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevPostCountRef = useRef(0);

  // Slow mode state
  const [slowModeEnabled, setSlowModeEnabled] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(30);
  const [lastPostTime, setLastPostTime] = useState<number>(0);
  const [slowModeCooldown, setSlowModeCooldown] = useState(0);

  const { data: slowModeSettings } = useQuery({
    queryKey: ["slow-mode-settings", activeScope.type, activeScope.key],
    queryFn: async () => {
      const scopeSettingKey = `slow_mode_${activeScope.type}_${activeScope.key}`;
      const { data } = await supabase.from("app_settings").select("*").or(`key.eq.slow_mode_global,key.eq.${scopeSettingKey}`);
      const map: Record<string, string> = {};
      (data as any[])?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (!slowModeSettings) return;
    const scopeKey = `slow_mode_${activeScope.type}_${activeScope.key}`;
    const setting = slowModeSettings[scopeKey] || slowModeSettings["slow_mode_global"];
    if (setting) {
      try {
        const parsed = JSON.parse(setting);
        setSlowModeEnabled(parsed.enabled || false);
        setSlowModeSeconds(parsed.seconds || 30);
      } catch { setSlowModeEnabled(false); }
    } else {
      setSlowModeEnabled(false);
    }
  }, [slowModeSettings, activeScope]);

  useEffect(() => {
    if (!slowModeEnabled || slowModeCooldown <= 0) return;
    const timer = setInterval(() => {
      setSlowModeCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [slowModeEnabled, slowModeCooldown]);

  const isVerified = profile?.is_verified;

  /* ─── Education data ─── */
  const { data: primaryEducation } = useQuery({
    queryKey: ["primary-education", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      if ((profile as any)?.primary_education_id) {
        const { data } = await supabase.from("education").select("*").eq("id", (profile as any).primary_education_id).maybeSingle();
        return data;
      }
      const { data } = await supabase.from("education").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const scopes = useMemo(() => buildScopes(profile, primaryEducation), [profile, primaryEducation]);

  const { data: savedViews = [] } = useQuery({
    queryKey: ["saved-views", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("saved_views").select("*").eq("user_id", user.id).order("pinned", { ascending: false }).order("created_at", { ascending: false });
      return (data || []) as SavedView[];
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const { data: userPinnedIds = [] } = useQuery({
    queryKey: ["user-pins", user?.id, activeScope.type, activeScope.key],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("user_pinned_messages").select("message_id")
        .eq("user_id", user.id)
        .eq("forum_scope_type", activeScope.type)
        .eq("forum_scope_key", activeScope.key);
      return (data || []).map((d: any) => d.message_id);
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const { data: adMessages } = useQuery({
    queryKey: ["ad-messages", activeScope.type, activeScope.key],
    queryFn: async () => {
      const { data } = await supabase.from("ad_messages").select("*")
        .eq("is_active", true)
        .or(`and(scope_type.eq.${activeScope.type},scope_key.eq.${activeScope.key}),and(scope_type.eq.GLOBAL,scope_key.eq.IIT_ALL)`)
        .order("created_at", { ascending: false }).limit(3);
      return data || [];
    },
    staleTime: 60000,
  });

  const { data: scopeMembers } = useQuery({
    queryKey: ["scope-members", activeScope.type, activeScope.key],
    queryFn: async () => {
      const q = buildScopeQuery(activeScope.type, activeScope.key);
      const { data: posts } = await q;
      if (!posts?.length) return [];
      const authorIds = [...new Set((posts as any[]).map((p: any) => p.author_id))].slice(0, 30) as string[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url, headline, iit_name, is_verified, slug").in("user_id", authorIds);
      return profiles || [];
    },
    staleTime: 60000,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    scopeMembers?.forEach((p: any) => map.set(p.user_id, p));
    return map;
  }, [scopeMembers]);

  const activeScopeDef = useMemo(() => {
    const saved = savedViews.find(v => v.scope_type === activeScope.type && v.scope_key === activeScope.key);
    if (saved) return { label: saved.name, subtitle: `${saved.scope_type} · ${saved.scope_key}`, emoji: "📌" };
    for (const s of scopes) {
      if (s.hasToggle && s.toggleOptions) {
        const toggleIdx = scopeToggles[s.id] ?? 0;
        const opt = s.toggleOptions[toggleIdx];
        if (opt.type === activeScope.type && opt.key === activeScope.key) {
          return { ...s, label: opt.scopeLabel || s.label, subtitle: opt.subtitle || s.subtitle };
        }
      }
      if (s.type === activeScope.type && s.key === activeScope.key) return s;
    }
    return scopes[0] || { label: "Multiverse", subtitle: "Global", emoji: "🌐" };
  }, [scopes, activeScope, savedViews, scopeToggles]);

  useEffect(() => {
    if (scopes.length > 0) {
      const campus = scopes.find(s => s.type === "CAMPUS");
      if (campus) setActiveScope({ type: campus.type, key: campus.key });
    }
  }, [scopes.length]);

  // Smart scroll hide/show
  const { showInput, showNavBar, showHeader, restoreAll } = useScrollBehavior(scrollContainerRef);

  // Mark channel as read when opened - also reset pagination
  useEffect(() => {
    setChannelRead(activeScope.type, activeScope.key);
    setUnreadDots(getUnreadChannels());
    setNewMsgCount(0);
    setHasMoreOlder(true);
    setOlderPages([]);
  }, [activeScope.type, activeScope.key]);

  /* ─── Helper: enrich raw posts with profiles, polls, replies, reactions ─── */
  const enrichPosts = useCallback(async (postsData: any[]) => {
    if (!postsData?.length) return [];
    const postIds = postsData.map((p: any) => p.id);
    const authorIds = [...new Set(postsData.map((p: any) => p.author_id))] as string[];

    const [{ data: profiles }, { data: polls }, { data: replies }, { data: reactions }] = await Promise.all([
      supabase.from("profiles").select("user_id, name, avatar_url, iit_name, student_status, slug").in("user_id", authorIds),
      supabase.from("polls").select("*").in("post_id", postIds),
      supabase.from("posts").select("id, reply_to_id").in("reply_to_id", postIds).is("deleted_at", null),
      supabase.from("reactions").select("*").in("entity_id", postIds).eq("entity_type", "forum_msg"),
    ]);

    const pMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
    const pollMap = new Map(polls?.map((p: any) => [p.post_id, p]) ?? []);
    const replyCountMap = new Map<string, number>();
    (replies as any[])?.forEach((r: any) => replyCountMap.set(r.reply_to_id, (replyCountMap.get(r.reply_to_id) || 0) + 1));
    const reactionMap = new Map<string, Record<string, string[]>>();
    (reactions as any[])?.forEach((r: any) => {
      const map = reactionMap.get(r.entity_id) || {};
      const emoji = r.emoji || "👍";
      if (!map[emoji]) map[emoji] = [];
      map[emoji].push(r.user_id);
      reactionMap.set(r.entity_id, map);
    });

    let userDeletedIds: string[] = [];
    if (user?.id) {
      const { data: deletedRows } = await supabase.from("message_deleted_for_user" as any)
        .select("message_id").eq("user_id", user.id).in("message_id", postIds);
      userDeletedIds = (deletedRows || []).map((r: any) => r.message_id);
    }

    return postsData
      .filter((post: any) => {
        if (userDeletedIds.includes(post.id)) return false;
        if (post.deleted_for_users && user?.id && (post.deleted_for_users as string[]).includes(user.id)) return false;
        return true;
      })
      .map((post: any) => {
        const rxMap = reactionMap.get(post.id) || {};
        const rxCounts: Record<string, number> = {};
        const myRx: string[] = [];
        Object.entries(rxMap).forEach(([emoji, userIds]) => {
          rxCounts[emoji] = (userIds as string[]).length;
          if ((userIds as string[]).includes(user?.id || "")) myRx.push(emoji);
        });
        return {
          ...post,
          profile: pMap.get(post.author_id) ?? null,
          poll: pollMap.get(post.id) ?? null,
          replyCount: replyCountMap.get(post.id) || 0,
          reactions: rxCounts,
          myReactions: myRx,
        };
      });
  }, [user?.id]);

  /* ─── Posts query with localStorage cache ─── */
  const { data: postsData, isLoading } = useQuery({
    queryKey: ["forum-posts", activeScope.type, activeScope.key],
    queryFn: async () => {
      const q = buildScopeQuery(activeScope.type, activeScope.key, PAGE_SIZE);
      const { data: rawPosts, error } = await q;
      if (error) throw error;
      if (!rawPosts || rawPosts.length === 0) {
        // Real empty: return marker so empty-state UI can show
        return { posts: [], isDemo: activeScope.type === "GLOBAL", demos: activeScope.type === "GLOBAL" ? DEMO_MESSAGES : [] };
      }
      const enriched = (await enrichPosts(rawPosts as any[])).reverse();
      setCachedPosts(activeScope.type, activeScope.key, enriched);
      if ((rawPosts as any[]).length < PAGE_SIZE) setHasMoreOlder(false);
      return { posts: enriched, isDemo: false, demos: [] };
    },
    placeholderData: () => {
      const cached = getCachedPosts(activeScope.type, activeScope.key);
      return cached ? { posts: cached, isDemo: false, demos: [] } : undefined;
    },
    staleTime: 15000,
  });

  // Merge older pages on top
  const posts = useMemo(() => {
    if (!postsData) return undefined;
    if (postsData.isDemo) return postsData.demos;
    return [...olderPages, ...(postsData.posts || [])];
  }, [postsData, olderPages]);
  const isEmptyChannel = !!postsData && !postsData.isDemo && (postsData.posts?.length || 0) === 0 && olderPages.length === 0;


  // Track new message arrivals for pill
  useEffect(() => {
    if (!posts) return;
    const currentCount = posts.length;
    if (prevPostCountRef.current > 0 && currentCount > prevPostCountRef.current) {
      const el = scrollContainerRef.current;
      if (el) {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom > 100) {
          setNewMsgCount(prev => Math.min(prev + (currentCount - prevPostCountRef.current), 99));
        }
      }
    }
    prevPostCountRef.current = currentCount;
  }, [posts]);

  // Mark messages as seen (skip demo posts)
  useEffect(() => {
    if (!user?.id || !posts?.length) return;
    const unseenPosts = posts.filter((p: any) =>
      !isDemoId(p.id) && p.author_id !== user.id && !(p.seen_by || []).includes(user.id)
    );
    if (unseenPosts.length === 0) return;
    unseenPosts.slice(0, 20).forEach(async (post: any) => {
      const currentSeenBy = (post?.seen_by || []) as string[];
      if (!currentSeenBy.includes(user.id)) {
        await supabase.from("posts").update({
          seen_by: [...currentSeenBy, user.id]
        } as any).eq("id", post.id);
      }
    });
  }, [posts, user?.id]);

  /* ─── Mutations ─── */
  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) { navigate("/auth"); return; }
      if (slowModeEnabled && !isAdmin) {
        const now = Date.now();
        const elapsed = (now - lastPostTime) / 1000;
        if (elapsed < slowModeSeconds) {
          const remaining = Math.ceil(slowModeSeconds - elapsed);
          setSlowModeCooldown(remaining);
          throw new Error(`Slow mode: wait ${remaining}s`);
        }
      }
      if (!content.trim() && !imageFile && !showPollCreator && !attachedFile) throw new Error("Please type a message");

      let imageUrl: string | null = null;
      if (imageFile) {
        const { convertToWebP } = await import("@/lib/imageUtils");
        const optimized = await convertToWebP(imageFile, 0.75, 800);
        const path = `${user.id}/${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage.from("post-images").upload(path, optimized);
        if (uploadError) throw new Error("Failed to upload image.");
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let fileType: string | null = null;
      if (attachedFile) {
        const path = `${user.id}/${Date.now()}-${attachedFile.name}`;
        const { error: uploadError } = await supabase.storage.from("forum-files").upload(path, attachedFile);
        if (uploadError) throw new Error("Failed to upload file.");
        const { data: urlData } = supabase.storage.from("forum-files").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = attachedFile.name;
        fileSize = attachedFile.size;
        fileType = attachedFile.type;
      }

      const postData: any = {
        community_id: "default", scope_type: activeScope.type, scope_key: activeScope.key,
        channel: activeScope.type.toLowerCase().replace(/_/g, "-"),
        content: content || (imageUrl ? "📷" : fileUrl ? `📎 ${fileName}` : showPollCreator ? `📊 ${pollQuestion}` : ""),
        is_anonymous: isAnonymous, author_id: user.id, image_url: imageUrl,
        reply_to_id: replyTo?.id || null,
        file_url: fileUrl, file_name: fileName, file_size: fileSize, file_type: fileType,
      };

      const { data: newPost, error } = await supabase.from("posts").insert(postData).select("id").single();
      if (error) {
        if (error.message.includes("row-level security")) throw new Error("You don't have permission to post.");
        throw new Error("Failed to send message.");
      }

      if (showPollCreator && pollQuestion.trim() && newPost) {
        const validOptions = pollOptions.filter(o => o.trim());
        if (validOptions.length >= 2) {
          await supabase.from("polls").insert({ post_id: newPost.id, question: pollQuestion.trim(), options: validOptions });
        }
      }
    },
    onSuccess: () => {
      setContent(""); setIsAnonymous(false); setImageFile(null); setImagePreview(null);
      setShowPollCreator(false); setPollQuestion(""); setPollOptions(["", ""]); setReplyTo(null);
      setAttachedFile(null); setShowAttachMenu(false); setShowFormatBar(false);
      setLastPostTime(Date.now());
      if (slowModeEnabled && !isAdmin) setSlowModeCooldown(slowModeSeconds);
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      setTimeout(() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" }), 300);
    },
    onError: (err: any) => toast.error(err.message || "Something went wrong"),
  });

  const editPost = useMutation({
    mutationFn: async () => {
      if (!user || !editingPost || !editContent.trim()) return;
      if (isDemoId(editingPost.id)) { toast("This is a demo message"); return; }
      const { error } = await supabase.from("posts")
        .update({ content: editContent.trim(), edited_at: new Date().toISOString() } as any)
        .eq("id", editingPost.id).eq("author_id", user.id);
      if (error) throw new Error("Could not edit message");
    },
    onSuccess: () => {
      setEditingPost(null); setEditContent("");
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      toast.success("Message edited");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePost = useMutation({
    mutationFn: async ({ postId, forEveryone }: { postId: string; forEveryone: boolean }) => {
      if (!user) return;
      if (isDemoId(postId)) { toast("This is a demo message"); return; }
      if (forEveryone) {
        const { error } = await supabase.from("posts")
          .update({ is_deleted_for_everyone: true } as any)
          .eq("id", postId).eq("author_id", user.id);
        if (error) {
          if (error.message.includes("3 minutes")) throw new Error("Cannot delete for everyone after 3 minutes");
          if (error.message.includes("sender")) throw new Error("Only the sender can delete for everyone");
          throw new Error("Could not delete message");
        }
      } else {
        const { error } = await supabase.from("message_deleted_for_user" as any)
          .insert({ message_id: postId, user_id: user.id });
        if (error) {
          if (error.message?.includes("duplicate")) return;
          throw new Error("Could not hide message");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      queryClient.invalidateQueries({ queryKey: ["user-deleted-messages"] });
      toast.success("Message removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveView = useMutation({
    mutationFn: async (name: string) => {
      if (!user) return;
      const { error } = await supabase.from("saved_views").insert({ user_id: user.id, name, scope_type: activeScope.type, scope_key: activeScope.key, filters_json: {}, sort: "newest", pinned: false });
      if (error) throw new Error("Could not save view.");
    },
    onSuccess: () => { setSavingView(false); setSaveViewName(""); toast.success("View saved!"); queryClient.invalidateQueries({ queryKey: ["saved-views"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteView = useMutation({
    mutationFn: async (viewId: string) => { await supabase.from("saved_views").delete().eq("id", viewId); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["saved-views"] }); toast.success("View removed"); },
  });

  const togglePinView = useMutation({
    mutationFn: async ({ viewId, pinned }: { viewId: string; pinned: boolean }) => {
      await supabase.from("saved_views").update({ pinned: !pinned }).eq("id", viewId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-views"] }),
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string }) => {
      if (!user) throw new Error("Please sign in to react");
      if (isDemoId(postId)) { toast("This is a demo message"); return; }
      const { data: existing } = await supabase.from("reactions")
        .select("id").eq("entity_id", postId).eq("user_id", user.id).eq("entity_type", "forum_msg").eq("emoji", emoji).maybeSingle();
      if (existing) {
        await supabase.from("reactions").delete().eq("id", existing.id);
      } else {
        const { error } = await supabase.from("reactions").insert({ entity_id: postId, entity_type: "forum_msg", user_id: user.id, emoji });
        if (error) throw new Error("Could not add reaction");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forum-posts"] }),
    onError: (err: any) => toast.error(err.message),
  });

  const toggleUserPin = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) return;
      if (isDemoId(postId)) { toast("This is a demo message"); return; }
      const isPinned = userPinnedIds.includes(postId);
      if (isPinned) {
        await supabase.from("user_pinned_messages").delete().eq("user_id", user.id).eq("message_id", postId);
      } else {
        await supabase.from("user_pinned_messages").insert({
          user_id: user.id, message_id: postId,
          forum_scope_type: activeScope.type, forum_scope_key: activeScope.key,
        });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-pins"] }); toast.success("Pin updated"); },
    onError: () => toast.error("Could not update pin"),
  });

  const toggleAdminPin = useMutation({
    mutationFn: async (postId: string) => {
      if (!isAdmin) return;
      if (isDemoId(postId)) { toast("This is a demo message"); return; }
      const post = posts?.find((p: any) => p.id === postId);
      const newPinned = post?.pinned_at ? null : new Date().toISOString();
      await supabase.from("posts").update({ pinned_at: newPinned } as any).eq("id", postId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["forum-posts"] }); toast.success("Pin updated"); },
  });

  /* ─── Realtime: scope-aware INSERTs only invalidate active scope ─── */
  useEffect(() => {
    const channel = supabase.channel(`forum-rt-${activeScope.type}-${activeScope.key}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload: any) => {
        const row = payload.new || {};
        // Only refresh if the new post belongs to the active scope
        if (row.scope_type === activeScope.type && row.scope_key === activeScope.key) {
          queryClient.invalidateQueries({ queryKey: ["forum-posts", activeScope.type, activeScope.key] });
        } else {
          // Mark other channel as unread (handled elsewhere); skip refetch
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload: any) => {
        const row = payload.new || {};
        if (row.scope_type === activeScope.type && row.scope_key === activeScope.key) {
          queryClient.invalidateQueries({ queryKey: ["forum-posts", activeScope.type, activeScope.key] });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => {
        queryClient.invalidateQueries({ queryKey: ["forum-posts", activeScope.type, activeScope.key] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ["forum-posts", activeScope.type, activeScope.key] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, activeScope.type, activeScope.key]);


  /* ─── Typing indicator ─── */
  useEffect(() => {
    if (!user?.id) return;
    const presenceChannel = supabase.channel(`typing-${activeScope.type}-${activeScope.key}`, {
      config: { presence: { key: user.id } },
    });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const typing: string[] = [];
        Object.entries(state).forEach(([userId, presences]) => {
          if (userId !== user?.id && (presences as any[])?.[0]?.typing) {
            const name = (presences as any[])?.[0]?.name;
            if (name) typing.push(name);
          }
        });
        setTypingUsers(typing);
      })
      .subscribe();
    return () => { supabase.removeChannel(presenceChannel); };
  }, [user?.id, activeScope.type, activeScope.key]);

  const broadcastTyping = useCallback(() => {
    if (!user?.id || !profile?.name) return;
    const channelName = `typing-${activeScope.type}-${activeScope.key}`;
    const ch = supabase.channel(channelName);
    ch.track({ typing: true, name: profile.name });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      ch.track({ typing: false, name: profile.name });
    }, 3000);
  }, [user?.id, profile?.name, activeScope]);

  // Auto-scroll on initial load
  useEffect(() => {
    if (posts && posts.length > 0 && !hasScrolledRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      hasScrolledRef.current = true;
    }
  }, [posts]);
  useEffect(() => { hasScrolledRef.current = false; }, [activeScope.type, activeScope.key]);

  const handleScroll = useCallback(async () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distFromBottom > 100);
    if (distFromBottom < 50) setNewMsgCount(0);

    // Real DB pagination - fetch older messages when scrolled to top
    if (el.scrollTop < 120 && !loadingOlder && hasMoreOlder && posts && posts.length > 0) {
      const oldestReal = posts.find((p: any) => !isDemoId(p.id));
      if (!oldestReal) { setHasMoreOlder(false); return; }
      setLoadingOlder(true);
      const prevHeight = el.scrollHeight;
      try {
        const q = buildScopeQuery(activeScope.type, activeScope.key, PAGE_SIZE, oldestReal.created_at);
        const { data: older, error } = await q;
        if (error) throw error;
        const olderArr = (older as any[]) || [];
        if (olderArr.length === 0) {
          setHasMoreOlder(false);
        } else {
          const enriched = (await enrichPosts(olderArr)).reverse();
          setOlderPages(prev => [...enriched, ...prev]);
          if (olderArr.length < PAGE_SIZE) setHasMoreOlder(false);
          // Preserve scroll position
          requestAnimationFrame(() => {
            const newHeight = el.scrollHeight;
            el.scrollTop = newHeight - prevHeight + el.scrollTop;
          });
        }
      } catch {
        setHasMoreOlder(false);
      } finally {
        setLoadingOlder(false);
      }
    }
  }, [loadingOlder, hasMoreOlder, posts, activeScope.type, activeScope.key, enrichPosts]);


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && (content.trim() || imageFile || attachedFile)) {
      e.preventDefault();
      createPost.mutate();
    }
  };

  // Auto-grow textarea
  const handleContentChange = (value: string) => {
    setContent(value);
    broadcastTyping();

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + 'px';
    }

    const lastAt = value.lastIndexOf("@");
    if (lastAt !== -1) {
      const afterAt = value.slice(lastAt + 1);
      const spaceIdx = afterAt.indexOf(" ");
      if (spaceIdx === -1 && afterAt.length > 0) {
        setMentionQuery(afterAt.toLowerCase());
        setShowMentionSuggestions(true);
        return;
      }
    }
    setShowMentionSuggestions(false);
  };

  const insertMention = (name: string) => {
    const lastAt = content.lastIndexOf("@");
    if (lastAt !== -1) setContent(content.slice(0, lastAt) + `@${name} `);
    setShowMentionSuggestions(false);
    textareaRef.current?.focus();
  };

  const insertFormatting = (wrapper: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + wrapper + (selected || "text") + wrapper + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + wrapper.length, start + wrapper.length + (selected || "text").length);
    }, 0);
  };

  const mentionSuggestions = useMemo(() => {
    if (!showMentionSuggestions || !mentionQuery) return [];
    return (scopeMembers || []).filter((m: any) => m.name?.toLowerCase().includes(mentionQuery)).slice(0, 5);
  }, [showMentionSuggestions, mentionQuery, scopeMembers]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setShowAttachMenu(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("File must be under 25MB"); return; }
    setAttachedFile(file);
    setShowAttachMenu(false);
  };

  const handleReply = (post: any) => { setReplyTo(post); setShowGifPicker(false); textareaRef.current?.focus(); };

  const handleGifSelect = async (gifUrl: string) => {
    if (!user) return;
    setShowGifPicker(false);
    try {
      const { error } = await supabase.from("posts").insert({
        community_id: "default", scope_type: activeScope.type, scope_key: activeScope.key,
        channel: activeScope.type.toLowerCase().replace(/_/g, "-"),
        content: "GIF", is_anonymous: false, author_id: user.id,
        image_url: gifUrl, reply_to_id: replyTo?.id || null,
      });
      if (error) throw error;
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      setTimeout(() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" }), 300);
    } catch {
      toast.error("Failed to send GIF");
    }
  };

  const handleVoiceSend = async (voiceUrl: string, duration: number) => {
    if (!user) return;
    setIsRecordingVoice(false);
    try {
      const { error } = await supabase.from("posts").insert({
        community_id: "default", scope_type: activeScope.type, scope_key: activeScope.key,
        channel: activeScope.type.toLowerCase().replace(/_/g, "-"),
        content: "🎤 Voice message", is_anonymous: false, author_id: user.id,
        voice_url: voiceUrl, voice_duration: duration,
        reply_to_id: replyTo?.id || null,
      } as any);
      if (error) throw error;
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      setTimeout(() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" }), 300);
    } catch {
      toast.error("Failed to send voice note");
    }
  };

  const handleEdit = (post: any) => { setEditingPost(post); setEditContent(post.content); };
  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };
  const handleForward = (post: any) => {
    if (isDemoId(post.id)) { toast("This is a demo message"); return; }
    setContent(`↩️ Forwarded: ${post.content}`); textareaRef.current?.focus(); toast("Message ready to forward");
  };
  const handleThread = (post: any) => { setThreadPost(post); };

  const scrollToMessage = (postId: string) => {
    const el = messageRefs.current[postId];
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setHighlightedPostId(postId); setTimeout(() => setHighlightedPostId(null), 2000); }
  };
  const scrollToBottom = () => {
    scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" });
    setNewMsgCount(0);
  };
  const selectScope = (type: string, key: string) => { setActiveScope({ type, key }); setSidebarOpen(false); setActiveTab("feed"); setThreadPost(null); };

  const filteredPosts = useMemo(() => {
    let filtered = posts || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      switch (searchTab) {
        case "messages": filtered = filtered.filter((p: any) => p.content?.toLowerCase().includes(q) || p.profile?.name?.toLowerCase().includes(q)); break;
        case "media": filtered = filtered.filter((p: any) => p.image_url); break;
        case "pins": filtered = filtered.filter((p: any) => userPinnedIds.includes(p.id) || p.pinned_at); break;
        case "links": filtered = filtered.filter((p: any) => p.content?.match(/https?:\/\//)); break;
      }
    } else if (searchTab !== "messages" && showSearch) {
      switch (searchTab) {
        case "media": filtered = filtered.filter((p: any) => p.image_url); break;
        case "pins": filtered = filtered.filter((p: any) => userPinnedIds.includes(p.id) || p.pinned_at); break;
        case "links": filtered = filtered.filter((p: any) => p.content?.match(/https?:\/\//)); break;
      }
    }
    if (activeTab === "pinned") filtered = filtered.filter((p: any) => userPinnedIds.includes(p.id) || p.pinned_at);
    // Cap at MAX_RENDERED
    if (filtered.length > MAX_RENDERED) filtered = filtered.slice(filtered.length - MAX_RENDERED);
    return filtered;
  }, [posts, searchQuery, searchTab, showSearch, activeTab, userPinnedIds]);

  const searchCounts = useMemo(() => {
    if (!posts) return { messages: 0, media: 0, pins: 0, links: 0 };
    const q = searchQuery.toLowerCase();
    const matchingPosts = q ? posts.filter((p: any) => p.content?.toLowerCase().includes(q) || p.profile?.name?.toLowerCase().includes(q)) : posts;
    return {
      messages: matchingPosts.length,
      media: posts.filter((p: any) => p.image_url && (!q || p.content?.toLowerCase().includes(q))).length,
      pins: posts.filter((p: any) => (userPinnedIds.includes(p.id) || p.pinned_at) && (!q || p.content?.toLowerCase().includes(q))).length,
      links: posts.filter((p: any) => p.content?.match(/https?:\/\//) && (!q || p.content?.toLowerCase().includes(q))).length,
    };
  }, [posts, searchQuery, userPinnedIds]);

  const groupedByDate = useMemo(() => {
    return filteredPosts.reduce<Record<string, any[]>>((acc, post: any) => {
      const dateKey = getDateLabel(post.created_at);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(post);
      return acc;
    }, {});
  }, [filteredPosts]);

  const canPost = !!user && !!isVerified;
  const findParentPost = useCallback((replyToId: string | null) => {
    if (!replyToId || !posts) return null;
    return posts.find((p: any) => p.id === replyToId) || null;
  }, [posts]);

  const hasContent = content.trim() || imageFile || attachedFile || showPollCreator;

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <div className="flex flex-col bg-background overflow-hidden w-full" style={{ height: '100dvh' } as any}>
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ═══ CHANNEL SIDEBAR (Desktop: 280px) ═══ */}
      <aside className="hidden lg:flex w-[280px] flex-col border-r border-border bg-card flex-shrink-0 overflow-hidden">
        <div className="h-12 flex items-center px-4 border-b border-border flex-shrink-0">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Channels</h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <ScopeList
            scopes={scopes} savedViews={savedViews} activeScope={activeScope} scopeToggles={scopeToggles}
            unreadDots={unreadDots}
            onSelect={selectScope}
            onToggle={(scopeId, idx) => { setScopeToggles(prev => ({ ...prev, [scopeId]: idx })); const scope = scopes.find(s => s.id === scopeId); if (scope?.toggleOptions?.[idx]) selectScope(scope.toggleOptions[idx].type, scope.toggleOptions[idx].key); }}
            onDeleteView={(id) => deleteView.mutate(id)}
            onTogglePin={(id, pinned) => togglePinView.mutate({ viewId: id, pinned })}
          />
        </div>
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[300px] p-0 bg-card flex flex-col">
          <SheetTitle className="h-12 flex items-center justify-between px-4 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Channels
            <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </SheetTitle>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <ScopeList
              scopes={scopes} savedViews={savedViews} activeScope={activeScope} scopeToggles={scopeToggles}
              unreadDots={unreadDots}
              onSelect={selectScope}
              onToggle={(scopeId, idx) => { setScopeToggles(prev => ({ ...prev, [scopeId]: idx })); const scope = scopes.find(s => s.id === scopeId); if (scope?.toggleOptions?.[idx]) selectScope(scope.toggleOptions[idx].type, scope.toggleOptions[idx].key); }}
              onDeleteView={(id) => deleteView.mutate(id)}
              onTogglePin={(id, pinned) => togglePinView.mutate({ viewId: id, pinned })}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ MAIN CHAT AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-x-hidden">
        {/* ── Header (48px) with scroll hide ── */}
        <div className={`h-12 flex items-center gap-2 px-3 border-b border-border bg-card flex-shrink-0 z-10 transition-transform duration-[250ms] ease-in-out ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent active:scale-95 transition-all" aria-label="Open menu">
            <img src="/cirkle-logo.png" alt="Cirkle" className="w-7 h-7 rounded-md" />
          </button>

          <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] sm:text-[15px] font-bold text-foreground truncate leading-tight">{(activeScopeDef as any)?.label}</p>
            {(activeScopeDef as any)?.subtitle && (
              <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate leading-tight">{(activeScopeDef as any)?.subtitle}</p>
            )}
          </div>

          {typingUsers.length > 0 && (
            <span className="text-[11px] text-primary animate-pulse hidden sm:inline truncate max-w-32">
              {typingUsers.length === 1 ? `${typingUsers[0]} typing...` : `${typingUsers.length} typing...`}
            </span>
          )}

          <div className="flex items-center gap-0 flex-shrink-0">
            {isAdmin && (
              <button
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${slowModeEnabled ? "text-warning bg-warning/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                onClick={async () => {
                  const scopeKey = `slow_mode_${activeScope.type}_${activeScope.key}`;
                  const newEnabled = !slowModeEnabled;
                  const value = JSON.stringify({ enabled: newEnabled, seconds: slowModeSeconds });
                  const { data: existing } = await supabase.from("app_settings").select("id").eq("key", scopeKey).maybeSingle();
                  if (existing) {
                    await supabase.from("app_settings").update({ value, updated_by: user?.id } as any).eq("id", existing.id);
                  } else {
                    await supabase.from("app_settings").insert({ key: scopeKey, value, updated_by: user?.id });
                  }
                  queryClient.invalidateQueries({ queryKey: ["slow-mode-settings"] });
                  toast.success(newEnabled ? `Slow mode: ${slowModeSeconds}s` : "Slow mode off");
                }}
              >
                <Timer className="w-4 h-4" />
              </button>
            )}

            {savingView ? (
              <div className="flex items-center gap-1 animate-fade-in">
                <Input value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)} placeholder="Name..." className="h-7 w-20 text-xs" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && saveViewName.trim()) saveView.mutate(saveViewName.trim()); if (e.key === "Escape") setSavingView(false); }} />
                <button onClick={() => saveViewName.trim() && saveView.mutate(saveViewName.trim())} className="w-7 h-7 flex items-center justify-center text-primary"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setSavingView(false)} className="w-7 h-7 flex items-center justify-center text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <>
                <button onClick={() => setSavingView(true)} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent" title="Save view">
                  <BookmarkPlus className="w-4 h-4" />
                </button>
                <button onClick={() => { setShowSearch(!showSearch); setSearchQuery(""); setSearchTab("messages"); setSearchFilter(null); setShowSearchFilters(false); }} className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${showSearch ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                  <Search className="w-4 h-4" />
                </button>
                <button onClick={() => setMemberPanelOpen(!memberPanelOpen)} className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${memberPanelOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                  <Users className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Slow mode banner */}
        {slowModeEnabled && (
          <div className="px-4 py-1 bg-warning/5 border-b border-warning/10 flex-shrink-0">
            <div className="flex items-center gap-2 text-[11px] text-warning">
              <Timer className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">Slow mode · {slowModeSeconds}s</span>
              {slowModeCooldown > 0 && <span className="ml-auto font-bold tabular-nums">{slowModeCooldown}s</span>}
            </div>
          </div>
        )}

        {/* ── Search overlay ── */}
        {showSearch && (
          <div className="flex flex-col border-b border-border bg-card flex-shrink-0 animate-fade-in">
            <div className="flex items-center gap-2 px-3 py-2">
              <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0">
                <ArrowDown className="w-4 h-4 rotate-90" />
              </button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-8 bg-accent border-0 rounded-lg text-sm" autoFocus />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center hover:bg-muted-foreground/30">
                    <X className="w-3 h-3 text-foreground" />
                  </button>
                )}
              </div>
              <button onClick={() => setShowSearchFilters(!showSearchFilters)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors ${showSearchFilters ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                <Filter className="w-4 h-4" />
              </button>
            </div>

            <div className="flex px-3 gap-0 overflow-x-auto scrollbar-hide">
              {([
                { key: "messages", label: "Messages", count: searchCounts.messages },
                { key: "media", label: "Media", count: searchCounts.media },
                { key: "pins", label: "Pins", count: searchCounts.pins },
                { key: "links", label: "Links", count: searchCounts.links },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setSearchTab(tab.key)}
                  className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    searchTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  {tab.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${searchTab === tab.key ? "bg-primary/15 text-primary" : "bg-accent text-muted-foreground"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {showSearchFilters && (
              <div className="px-3 py-2 border-t border-border bg-accent/50 animate-fade-in">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Filter results...</p>
                <div className="space-y-0.5">
                  {[
                    { key: "from", label: "From a specific person", icon: User },
                    { key: "mentions", label: "Mentions someone", icon: AtSign },
                    { key: "date", label: "Sent on a date", icon: Calendar },
                  ].map(f => (
                    <button key={f.key}
                      onClick={() => { setSearchFilter(searchFilter === f.key ? null : f.key); setShowSearchFilters(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] rounded-lg transition-colors ${
                        searchFilter === f.key ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-accent"
                      }`}>
                      <f.icon className="w-4 h-4 text-muted-foreground" />
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Messages area ── */}
        <div ref={scrollContainerRef} onScroll={handleScroll} onClick={restoreAll} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-y-contain">
          <div className="px-0 w-full">
            {/* Pagination: Beginning marker or spinner */}
            {!hasMoreOlder && posts && posts.length > 0 && (
              <div className="flex items-center justify-center py-6">
                <span className="text-[12px] text-muted-foreground font-medium">✦ Beginning of #{(activeScopeDef as any)?.label || "channel"}</span>
              </div>
            )}
            {loadingOlder && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isVerified && user ? (
              <MaskedContent>
                <MessagesView isLoading={isLoading} groupedByDate={groupedByDate} messagesEndRef={messagesEndRef}
                  onReply={handleReply} onReact={(postId, emoji) => toggleReaction.mutate({ postId, emoji })}
                  userId={user?.id} isAdmin={!!isAdmin}
                  onAdminPin={(id) => toggleAdminPin.mutate(id)}
                  onUserPin={(id) => toggleUserPin.mutate(id)} userPinnedIds={userPinnedIds}
                  navigate={navigate} messageRefs={messageRefs} highlightedPostId={highlightedPostId}
                  onScrollToMessage={scrollToMessage} findParentPost={findParentPost}
                  adMessages={adMessages} activeScopeDef={activeScopeDef}
                  isEmptyChannel={isEmptyChannel} onStartFirst={() => textareaRef.current?.focus()}
                  onEdit={handleEdit} onDelete={(id, forAll) => deletePost.mutate({ postId: id, forEveryone: forAll })}
                  onCopy={handleCopy} onForward={handleForward} profileMap={profileMap}
                  onImageClick={setLightboxImage} onThread={handleThread} />
              </MaskedContent>
            ) : (
              <MessagesView isLoading={isLoading} groupedByDate={groupedByDate} messagesEndRef={messagesEndRef}
                onReply={handleReply} onReact={(postId, emoji) => toggleReaction.mutate({ postId, emoji })}
                userId={user?.id} isAdmin={!!isAdmin}
                onAdminPin={(id) => toggleAdminPin.mutate(id)}
                onUserPin={(id) => toggleUserPin.mutate(id)} userPinnedIds={userPinnedIds}
                navigate={navigate} messageRefs={messageRefs} highlightedPostId={highlightedPostId}
                onScrollToMessage={scrollToMessage} findParentPost={findParentPost}
                adMessages={adMessages} activeScopeDef={activeScopeDef}
                isEmptyChannel={isEmptyChannel} onStartFirst={() => textareaRef.current?.focus()}
                onEdit={handleEdit} onDelete={(id, forAll) => deletePost.mutate({ postId: id, forEveryone: forAll })}
                onCopy={handleCopy} onForward={handleForward} profileMap={profileMap}
                onImageClick={setLightboxImage} onThread={handleThread} />
            )}
          </div>
        </div>

        {/* New messages pill (FIX 9) */}
        {newMsgCount > 0 && (
          <button onClick={scrollToBottom}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold shadow-lg animate-bounce flex items-center gap-1.5 transition-all active:scale-95">
            <ArrowDown className="w-3.5 h-3.5" />
            {newMsgCount > 9 ? "9+" : newMsgCount} new message{newMsgCount !== 1 ? "s" : ""}
          </button>
        )}

        {/* Scroll to bottom FAB */}
        {showScrollDown && newMsgCount === 0 && (
          <button onClick={scrollToBottom}
            className="absolute bottom-24 right-4 z-10 w-9 h-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-95">
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Typing indicator bar */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1 text-[12px] text-muted-foreground flex items-center gap-2 bg-card/50 flex-shrink-0 border-t border-border/50">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="font-medium">
              {typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : `${typingUsers.join(", ")} are typing...`}
            </span>
          </div>
        )}

        {/* Edit bar */}
        {editingPost && (
          <div className="px-4 py-2 bg-card border-t border-border flex-shrink-0 animate-fade-in">
            <div className="flex items-center gap-2 mb-1.5">
              <Pencil className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Editing message</span>
              <button onClick={() => setEditingPost(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-end gap-2">
              <Textarea ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 min-h-[40px] max-h-24 bg-accent border-0 rounded-lg text-sm resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); editPost.mutate(); } }} autoFocus />
              <Button size="icon" className="rounded-lg w-9 h-9 flex-shrink-0" onClick={() => editPost.mutate()} disabled={editPost.isPending || !editContent.trim()}>
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Ultra-smooth Composer (FIX 2) ── */}
        {canPost && !editingPost && (
          <div className={`backdrop-blur-xl bg-card/95 border-t border-border/60 px-3 py-2 flex-shrink-0 safe-bottom transition-transform duration-[250ms] ease-in-out ${showInput ? 'translate-y-0' : 'translate-y-full absolute bottom-0 left-0 right-0'}`}>
            {/* Reply preview */}
            {replyTo && (
              <div className="flex items-center bg-accent/80 rounded-t-lg mb-1 overflow-hidden animate-fade-in">
                <div className="w-1 self-stretch bg-primary flex-shrink-0" />
                <div className="flex-1 px-3 py-1.5 min-w-0">
                  <p className="text-[11px] font-semibold text-primary truncate">{replyTo.is_anonymous ? "Anonymous" : replyTo.profile?.name || "User"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Poll creator */}
            {showPollCreator && (
              <div className="bg-accent/60 rounded-lg p-3 mb-2 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5 text-primary" /> Create Poll</p>
                  <button onClick={() => setShowPollCreator(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <Input placeholder="Ask a question..." value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} className="h-8 text-xs mb-2 bg-background/50 border-border" />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1 mb-1">
                    <Input placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} className="h-7 text-xs bg-background/50 border-border" />
                    {i >= 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-muted-foreground"><X className="w-3 h-3" /></button>}
                  </div>
                ))}
                {pollOptions.length < 6 && <button onClick={() => setPollOptions([...pollOptions, ""])} className="text-[11px] text-primary font-medium hover:underline">+ Add option</button>}
              </div>
            )}

            {/* Image/File preview */}
            {imagePreview && (
              <div className="relative mb-2 inline-block animate-fade-in">
                <img src={imagePreview} className="h-20 rounded-lg border border-border object-cover" alt="" />
                <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs shadow"><X className="w-3 h-3" /></button>
              </div>
            )}
            {attachedFile && (
              <div className="mb-2 flex items-center gap-2 bg-accent/60 rounded-lg px-3 py-2 animate-fade-in">
                <Paperclip className="w-4 h-4 text-primary" />
                <span className="text-xs text-foreground truncate flex-1">{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Voice recorder */}
            {isRecordingVoice && <VoiceRecorder userId={user?.id || ""} onSend={handleVoiceSend} onCancel={() => setIsRecordingVoice(false)} />}

            {/* GIF picker */}
            {showGifPicker && (
              <div className="mb-2 animate-fade-in"><GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} /></div>
            )}

            {/* Mention suggestions */}
            {showMentionSuggestions && mentionSuggestions.length > 0 && (
              <div className="mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-fade-in">
                {mentionSuggestions.map((m: any) => (
                  <button key={m.user_id} onClick={() => insertMention(m.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left">
                    {m.avatar_url ? <img src={m.avatar_url} className="w-6 h-6 rounded-full" alt="" /> : (
                      <div className={`w-6 h-6 rounded-full ${getUserColor(m.user_id).bg} flex items-center justify-center`}><span className="text-[8px] font-bold text-white">{getInitials(m.name)}</span></div>
                    )}
                    <span className="text-sm font-medium text-foreground">{m.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Formatting bar */}
            {showFormatBar && (
              <div className="flex items-center gap-1 mb-2 animate-fade-in">
                <button onClick={() => insertFormatting("**")} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Bold"><Bold className="w-4 h-4" /></button>
                <button onClick={() => insertFormatting("*")} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Italic"><Italic className="w-4 h-4" /></button>
                <button onClick={() => insertFormatting("`")} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Code"><Code className="w-4 h-4" /></button>
                <button onClick={() => insertFormatting("~~")} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Strikethrough"><span className="text-sm font-bold line-through">S</span></button>
                <button onClick={() => insertFormatting("||")} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Spoiler"><Eye className="w-4 h-4" /></button>
              </div>
            )}

            {/* Attach menu popover */}
            {showAttachMenu && (
              <div className="mb-2 bg-card border border-border rounded-xl shadow-xl p-2 grid grid-cols-2 gap-1 animate-fade-in max-w-[240px]">
                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center"><ImageLucide className="w-4 h-4 text-primary" /></div>
                  <span className="text-[13px] font-medium text-foreground">Photo</span>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                </label>
                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[hsl(234,89%,64%)]/15 flex items-center justify-center"><Paperclip className="w-4 h-4 text-[hsl(234,89%,64%)]" /></div>
                  <span className="text-[13px] font-medium text-foreground">File</span>
                  <input ref={docInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                </label>
                <button onClick={() => { setShowPollCreator(true); setShowAttachMenu(false); }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[hsl(38,96%,55%)]/15 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-[hsl(38,96%,55%)]" /></div>
                  <span className="text-[13px] font-medium text-foreground">Poll</span>
                </button>
              </div>
            )}

            {/* Input row - buttery smooth */}
            {!isRecordingVoice && (
              <div className="flex items-end gap-1.5">
                <button onClick={() => { setShowAttachMenu(!showAttachMenu); setShowFormatBar(false); }}
                  className={`w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-all ${showAttachMenu ? "text-primary bg-primary/10 rotate-45" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                  <Plus className="w-5 h-5" />
                </button>

                <div className="flex-1 min-w-0 relative">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { setShowAttachMenu(false); restoreAll(); }}
                    placeholder={`Message #${(activeScopeDef as any)?.label || "channel"}`}
                    rows={1}
                    style={{ transition: 'height 100ms ease' }}
                    className="w-full min-h-[40px] max-h-[96px] bg-accent border-0 rounded-lg text-[16px] resize-none py-2.5 px-3 pr-24 focus:outline-none focus:ring-0 placeholder:text-muted-foreground/60"
                  />
                  <div className="absolute right-1 bottom-1 flex items-center gap-0">
                    <button onClick={() => setShowGifPicker(!showGifPicker)}
                      className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${showGifPicker ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                      <Film className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowFormatBar(!showFormatBar)}
                      className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${showFormatBar ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsAnonymous((v) => {
                          toast(v ? "Posting as yourself" : "Posting anonymously 👁️");
                          return !v;
                        });
                      }}
                      className={`w-8 h-8 flex items-center justify-center rounded relative transition-all duration-200 ${
                        isAnonymous
                          ? "text-primary bg-primary/10 shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={isAnonymous ? "Sending anonymously" : "Send as yourself"}
                    >
                      <EyeOff className="w-4 h-4" />
                      {isAnonymous && (
                        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-[7px] font-bold text-primary leading-none">ANON</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Send / Voice button with smooth state transition */}
                {hasContent ? (
                  <button
                    onClick={() => createPost.mutate()}
                    disabled={createPost.isPending || (slowModeEnabled && slowModeCooldown > 0 && !isAdmin)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0 active:scale-95 transition-all duration-150 disabled:opacity-50"
                  >
                    {slowModeCooldown > 0 && slowModeEnabled && !isAdmin
                      ? <span className="text-[10px] font-bold tabular-nums">{slowModeCooldown}</span>
                      : <Send className="w-4 h-4" />
                    }
                  </button>
                ) : (
                  <button onClick={() => setIsRecordingVoice(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0 active:scale-95 transition-all duration-150">
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {user && !isVerified && (
          <div className="bg-card border-t border-border px-4 py-3 flex-shrink-0 safe-bottom">
            <p className="text-xs text-muted-foreground text-center">
              <button onClick={() => navigate("/iit-verify")} className="text-primary font-semibold hover:underline">Verify your IIT email</button> to post messages
            </p>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL: Thread / Members ═══ */}
      {threadPost ? (
        <aside className="hidden lg:flex w-80 flex-shrink-0">
          <ThreadPanel parentPost={threadPost} onClose={() => setThreadPost(null)} activeScope={activeScope} profileMap={profileMap} navigate={navigate} />
        </aside>
      ) : memberPanelOpen ? (
        <aside className="hidden lg:flex w-60 flex-col border-l border-border bg-secondary/20 flex-shrink-0 overflow-hidden">
          <div className="h-12 flex items-center px-4 border-b border-border justify-between flex-shrink-0">
            <h3 className="text-sm font-bold text-foreground">Members</h3>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{scopeMembers?.length || 0}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2">
              Online - {scopeMembers?.length || 0}
            </p>
            {scopeMembers?.map((member: any) => (
              <button key={member.user_id} onClick={() => navigate(member.slug ? `/u/${member.slug}` : `/profile/${member.user_id}`)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left group">
                <div className="relative flex-shrink-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full ${getUserColor(member.user_id).bg} flex items-center justify-center`}>
                      <span className="text-[10px] font-bold text-white">{getInitials(member.name)}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card bg-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium truncate flex items-center gap-1 ${getUserColor(member.user_id).text} group-hover:text-foreground`}>
                    {member.name}
                    {member.is_verified && <Check className="w-3 h-3 text-primary" />}
                  </p>
                  {member.headline && <p className="text-[10px] text-muted-foreground truncate">{member.headline}</p>}
                </div>
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      {/* Mobile member panel sheet */}
      <Sheet open={memberPanelOpen && typeof window !== 'undefined' && window.innerWidth < 1024} onOpenChange={setMemberPanelOpen}>
        <SheetContent side="right" className="w-[280px] p-0 bg-secondary/20">
          <SheetTitle className="h-12 flex items-center px-4 border-b border-border text-sm font-bold text-foreground gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Members
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold ml-auto">{scopeMembers?.length || 0}</span>
          </SheetTitle>
          <div className="overflow-y-auto scrollbar-hide p-2" style={{ height: 'calc(100% - 48px)' }}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2">
              Online - {scopeMembers?.length || 0}
            </p>
            {scopeMembers?.map((member: any) => (
              <button key={member.user_id} onClick={() => { navigate(member.slug ? `/u/${member.slug}` : `/profile/${member.user_id}`); setMemberPanelOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left">
                <div className="relative flex-shrink-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full ${getUserColor(member.user_id).bg} flex items-center justify-center`}>
                      <span className="text-[10px] font-bold text-white">{getInitials(member.name)}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card bg-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium truncate ${getUserColor(member.user_id).text}`}>{member.name}</p>
                  {member.headline && <p className="text-[10px] text-muted-foreground truncate">{member.headline}</p>}
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Image lightbox */}
      {lightboxImage && <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}

      {/* Mobile thread sheet */}
      {threadPost && (
        <Sheet open={!!threadPost} onOpenChange={(open) => { if (!open) setThreadPost(null); }}>
          <SheetContent side="right" className="w-full sm:w-96 p-0">
            <SheetTitle className="sr-only">Thread</SheetTitle>
            <ThreadPanel parentPost={threadPost} onClose={() => setThreadPost(null)} activeScope={activeScope} profileMap={profileMap} navigate={navigate} />
          </SheetContent>
        </Sheet>
      )}

      {/* Dismiss attach menu backdrop */}
      {showAttachMenu && <div className="fixed inset-0 z-10" onClick={() => setShowAttachMenu(false)} />}
      </div>
      {/* Forum's own bottom nav with scroll hide */}
      <div className={`lg:hidden flex-shrink-0 transition-transform duration-[250ms] ease-in-out ${showNavBar ? 'translate-y-0' : 'translate-y-full'}`}>
        <BottomNav />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════ */
/*              SCOPE LIST SIDEBAR                   */
/* ══════════════════════════════════════════════════ */
const ScopeList = ({ scopes, savedViews, activeScope, scopeToggles, unreadDots, onSelect, onToggle, onDeleteView, onTogglePin }: {
  scopes: ScopeDef[]; savedViews: SavedView[]; activeScope: { type: string; key: string };
  scopeToggles: Record<string, number>; unreadDots: Record<string, boolean>;
  onSelect: (type: string, key: string) => void;
  onToggle: (scopeId: string, idx: number) => void;
  onDeleteView: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}) => {
  const recommended = scopes.filter(s => s.section === "recommended");
  const all = scopes.filter(s => s.section === "all");
  return (
    <div className="py-2">
      {recommended.length > 0 && (
        <>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 pt-2 pb-2">For You</p>
          {recommended.map(s => <ScopeItem key={s.id} scope={s} activeScope={activeScope} scopeToggles={scopeToggles} unreadDots={unreadDots} onSelect={onSelect} onToggle={onToggle} />)}
        </>
      )}
      {all.length > 0 && (
        <>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 pt-5 pb-2">All Channels</p>
          {all.map(s => <ScopeItem key={s.id} scope={s} activeScope={activeScope} scopeToggles={scopeToggles} unreadDots={unreadDots} onSelect={onSelect} onToggle={onToggle} />)}
        </>
      )}
      {savedViews.length > 0 && (
        <>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 pt-5 pb-2">Saved Views</p>
          {savedViews.map((view) => (
            <div key={view.id} className={`flex items-center gap-1 mx-2 px-3 py-2 text-[13px] rounded-md ${activeScope.type === view.scope_type && activeScope.key === view.scope_key ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}>
              <button onClick={() => onSelect(view.scope_type, view.scope_key)} className="flex-1 text-left truncate flex items-center gap-2">
                <Bookmark className={`w-3.5 h-3.5 flex-shrink-0 ${view.pinned ? "fill-primary text-primary" : ""}`} />{view.name}
              </button>
              <button onClick={() => onTogglePin(view.id, view.pinned)} className="p-1 hover:text-primary"><Pin className="w-3 h-3" /></button>
              <button onClick={() => onDeleteView(view.id)} className="p-1 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

const ScopeItem = ({ scope, activeScope, scopeToggles, unreadDots, onSelect, onToggle }: {
  scope: ScopeDef; activeScope: { type: string; key: string }; scopeToggles: Record<string, number>;
  unreadDots: Record<string, boolean>;
  onSelect: (type: string, key: string) => void; onToggle: (scopeId: string, idx: number) => void;
}) => {
  const toggleIdx = scopeToggles[scope.id] ?? 0;
  const activeOpt = scope.hasToggle && scope.toggleOptions ? scope.toggleOptions[toggleIdx] : undefined;
  const effectiveType = activeOpt ? activeOpt.type : scope.type;
  const effectiveKey = activeOpt ? activeOpt.key : scope.key;
  const isActive = activeScope.type === effectiveType && activeScope.key === effectiveKey;
  const hasUnread = unreadDots[`${effectiveType}_${effectiveKey}`];

  return (
    <div className={`mx-2 rounded-md transition-all ${isActive ? "bg-primary/8 border-l-[3px] border-primary" : ""}`}>
      <button onClick={() => onSelect(effectiveType, effectiveKey)}
        className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-[14px] transition-all rounded-md ${isActive ? "text-primary font-semibold" : "text-foreground hover:bg-accent/60"}`}>
        <Hash className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0 text-left">
          <span className="block truncate flex items-center gap-1.5">
            {(isActive && activeOpt?.scopeLabel) || scope.label}
            {/* Unread dot (FIX 10) */}
            {hasUnread && !isActive && (
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 inline-block" />
            )}
          </span>
          {((isActive && activeOpt?.subtitle) || scope.subtitle) && <span className="block text-[11px] text-muted-foreground font-normal truncate mt-0.5">{(isActive && activeOpt?.subtitle) || scope.subtitle}</span>}
        </div>
      </button>
      {scope.hasToggle && scope.toggleOptions && isActive && (
        <div className="flex items-center gap-1.5 px-4 pl-9 pb-2 pt-0">
          {scope.toggleOptions.map((opt, i) => (
            <button key={opt.id} onClick={(e) => { e.stopPropagation(); onToggle(scope.id, i); }}
              className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-colors ${toggleIdx === i ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════ */
/*              MESSAGES VIEW                        */
/* ══════════════════════════════════════════════════ */
const MessagesView = ({ isLoading, groupedByDate, messagesEndRef, onReply, onReact, userId, isAdmin, onAdminPin, onUserPin, userPinnedIds, navigate, messageRefs, highlightedPostId, onScrollToMessage, findParentPost, adMessages, activeScopeDef, isEmptyChannel, onStartFirst, onEdit, onDelete, onCopy, onForward, profileMap, onImageClick, onThread }: {
  isLoading: boolean; groupedByDate: Record<string, any[]>; messagesEndRef: React.RefObject<HTMLDivElement>;
  onReply: (post: any) => void; onReact: (postId: string, emoji: string) => void; userId?: string;
  isAdmin: boolean; onAdminPin: (id: string) => void; onUserPin: (id: string) => void;
  userPinnedIds: string[]; navigate: (path: string) => void;
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  highlightedPostId: string | null; onScrollToMessage: (postId: string) => void;
  findParentPost: (replyToId: string | null) => any; adMessages?: any[];
  activeScopeDef?: any;
  isEmptyChannel?: boolean; onStartFirst?: () => void;
  onEdit: (post: any) => void; onDelete: (id: string, forAll: boolean) => void;
  onCopy: (text: string) => void; onForward: (post: any) => void;
  profileMap: Map<string, any>;
  onImageClick: (src: string) => void; onThread: (post: any) => void;
}) => (
  <>
    {isLoading ? (
      /* ── Shimmer Skeleton (FIX 8) - 8 skeleton messages ── */
      <div className="space-y-4 p-4 animate-fade-in">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex gap-3 px-4">
            {/* Avatar shimmer */}
            <div className="w-10 h-10 rounded-full flex-shrink-0 bg-gradient-to-r from-accent via-accent/40 to-accent bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-24 rounded bg-gradient-to-r from-accent via-accent/40 to-accent bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
                <div className="h-2.5 w-14 rounded bg-gradient-to-r from-accent via-accent/40 to-accent bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
              </div>
              <div className="h-4 rounded bg-gradient-to-r from-accent via-accent/40 to-accent bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" style={{ width: `${[60, 90, 75, 85, 55, 70, 80, 65][i - 1]}%` }} />
              {i % 3 === 0 && (
                <div className="h-4 rounded bg-gradient-to-r from-accent via-accent/40 to-accent bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" style={{ width: `${[40, 50, 35, 45, 55, 30, 60, 40][i - 1]}%` }} />
              )}
            </div>
          </div>
        ))}
      </div>
    ) : Object.keys(groupedByDate).length > 0 ? (
      <>
        {adMessages && adMessages.length > 0 && (
          <div className="px-4 pt-3">
            {adMessages.slice(0, 1).map((ad: any) => (
              <div key={ad.id} className="bg-primary/5 border border-primary/15 rounded-lg p-3 flex items-start gap-3">
                <Megaphone className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{ad.content}</p>
                  {ad.link_url && <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline mt-1 block">Learn more →</a>}
                </div>
                <span className="text-[8px] text-muted-foreground uppercase font-bold">Ad</span>
              </div>
            ))}
          </div>
        )}
        {Object.entries(groupedByDate).map(([dateKey, datePosts]) => (
          <div key={dateKey}>
            <div className="flex items-center px-4 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] font-semibold text-muted-foreground bg-background px-3 py-0.5 rounded-full border border-border">{dateKey}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            {datePosts.map((post: any, idx: number) => {
              const prevPost = idx > 0 ? datePosts[idx - 1] : null;
              const isSameAuthor = prevPost && prevPost.author_id === post.author_id && !prevPost.deleted_at;
              const timeDiff = prevPost ? (new Date(post.created_at).getTime() - new Date(prevPost.created_at).getTime()) / 60000 : 999;
              const isGrouped = isSameAuthor && timeDiff < 7;
              return (
                <MemoizedDiscordMessage key={post.id} post={post} onReply={onReply} onReact={onReact}
                  userId={userId} isAdmin={isAdmin} onAdminPin={onAdminPin}
                  onUserPin={onUserPin} isUserPinned={userPinnedIds.includes(post.id)}
                  navigate={navigate} messageRefs={messageRefs} highlightedPostId={highlightedPostId}
                  onScrollToMessage={onScrollToMessage} findParentPost={findParentPost}
                  onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} onForward={onForward}
                  profileMap={profileMap} onImageClick={onImageClick} onThread={onThread}
                  isGrouped={isGrouped} />
              );
            })}
          </div>
        ))}
      </>
    ) : (
      <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4">
          <Hash className="w-8 h-8 text-primary" />
        </div>
        <p className="text-foreground text-base sm:text-lg font-bold">
          {isEmptyChannel ? `No messages yet in #${activeScopeDef?.label || "channel"}` : `Welcome to #${activeScopeDef?.label || "channel"}!`}
        </p>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 max-w-xs">
          {isEmptyChannel
            ? `Be the first to start a conversation here. Your message will be visible to everyone in ${activeScopeDef?.subtitle || "this scope"}.`
            : "This is the very beginning of this channel. Start the conversation!"}
        </p>
        {isEmptyChannel && onStartFirst && (
          <button onClick={onStartFirst}
            className="mt-5 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm">
            Start the first chat
          </button>
        )}
      </div>
    )}
    <div ref={messagesEndRef} className="h-4" />
  </>
);

/* ══════════════════════════════════════════════════ */
/*       Discord-style MESSAGE ROW (React.memo FIX 6)*/
/* ══════════════════════════════════════════════════ */
interface DiscordMessageProps {
  post: any; onReply: (p: any) => void; onReact: (id: string, emoji: string) => void;
  userId?: string; isAdmin: boolean; onAdminPin: (id: string) => void;
  onUserPin: (id: string) => void; isUserPinned: boolean;
  navigate: (path: string) => void;
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  highlightedPostId: string | null; onScrollToMessage: (postId: string) => void;
  findParentPost: (replyToId: string | null) => any;
  onEdit: (post: any) => void; onDelete: (id: string, forAll: boolean) => void;
  onCopy: (text: string) => void; onForward: (post: any) => void;
  profileMap: Map<string, any>;
  onImageClick: (src: string) => void; onThread: (post: any) => void;
  isGrouped?: boolean;
}

const DiscordMessage = ({ post, onReply, onReact, userId, isAdmin, onAdminPin, onUserPin, isUserPinned, navigate, messageRefs, highlightedPostId, onScrollToMessage, findParentPost, onEdit, onDelete, onCopy, onForward, profileMap, onImageClick, onThread, isGrouped }: DiscordMessageProps) => {
  const [showActions, setShowActions] = useState(false);
  const [showSeenBy, setShowSeenBy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeThreshold = 60;

  const displayName = post.is_anonymous ? "Anonymous" : (post.profile?.name || "User");
  const avatar = post.is_anonymous ? null : post.profile?.avatar_url;
  const colors = getUserColor(post.is_anonymous ? "anon" : post.author_id);
  const time = format(new Date(post.created_at), "h:mm a");
  const fullTime = format(new Date(post.created_at), "MMM d, yyyy h:mm a");
  const poll = post.poll;
  const reactions: Record<string, number> = post.reactions || {};
  const myReactions: string[] = post.myReactions || [];
  const isMine = post.author_id === userId;
  const profileSlug = post.profile?.slug;
  const isHighlighted = highlightedPostId === post.id;
  const isDeleted = !!post.deleted_at || !!post.is_deleted_for_everyone;
  const isEdited = !!post.edited_at;
  const replyCount = post.replyCount || 0;
  const parentPost = findParentPost(post.reply_to_id);
  const canDeleteForEveryone = isMine && !isDeleted && ((Date.now() - new Date(post.created_at).getTime()) < 3 * 60 * 1000);
  const seenBy = (post.seen_by || []) as string[];
  const seenByNames = seenBy.map((id: string) => profileMap.get(id)?.name || "Unknown").filter(Boolean);

  const goToProfile = () => {
    if (post.is_anonymous) return;
    if (profileSlug) navigate(`/u/${profileSlug}`);
    else if (post.author_id) navigate(`/profile/${post.author_id}`);
  };

  // Long-press: 500ms (FIX 7)
  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => setShowActions(true), 500);
  };
  const handleLongPressEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartXRef.current = e.touches[0].clientX;
    handleLongPressStart();
  };

  // Close all popups on any tap outside
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showActions && !showSeenBy) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (messageRef.current && !messageRef.current.contains(e.target as Node)) {
        setShowActions(false);
        setShowSeenBy(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [showActions, showSeenBy]);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartXRef.current === null) return;
    const diff = e.touches[0].clientX - swipeStartXRef.current;
    if (Math.abs(diff) > 15) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }
    if (diff > 0) {
      setSwipeOffset(Math.min(diff * 0.6, 80));
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    handleLongPressEnd();
    if (swipeStartXRef.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - swipeStartXRef.current;
    swipeStartXRef.current = null;
    setSwipeOffset(0);
    if (diff > swipeThreshold && !isDeleted) {
      onReply(post);
    }
  };

  // Right-click = same sheet (desktop, FIX 1 + 7)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isDeleted) setShowActions(true);
  };

  return (
    <div
      ref={(el) => { messageRefs.current[post.id] = el; messageRef.current = el; }}
      className={`relative transition-colors duration-300 ${isHighlighted ? 'bg-primary/5' : ''} ${isGrouped ? '' : 'mt-[2px]'}`}
      style={{ transform: `translateX(${swipeOffset}px)`, transition: swipeOffset === 0 ? 'transform 0.2s ease-out' : 'none' }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Pinned indicator */}
      {post.pinned_at && (
        <div className="flex items-center gap-1.5 text-[10px] text-warning font-medium px-3 sm:px-4 pl-[60px] sm:pl-[72px] pt-1">
          <Pin className="w-3 h-3" /> Pinned message
        </div>
      )}
      {isUserPinned && !post.pinned_at && (
        <div className="flex items-center gap-1.5 text-[10px] text-primary font-medium px-3 sm:px-4 pl-[60px] sm:pl-[72px] pt-1">
          <Bookmark className="w-3 h-3" /> Saved
        </div>
      )}

      {/* Reply reference */}
      {parentPost && (
        <button onClick={() => onScrollToMessage(parentPost.id)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-3 sm:px-4 pl-[60px] sm:pl-[72px] pt-1 hover:text-foreground transition-colors">
          <Reply className="w-3 h-3 flex-shrink-0" />
          <span className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0">
            {parentPost.profile?.avatar_url ? (
              <img src={parentPost.profile.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className={`w-full h-full ${getUserColor(parentPost.author_id).bg} flex items-center justify-center`}>
                <span className="text-[6px] font-bold text-white">{getInitials(parentPost.profile?.name)}</span>
              </div>
            )}
          </span>
          <span className={`font-semibold ${getUserColor(parentPost.author_id).text}`}>
            {parentPost.is_anonymous ? "Anonymous" : parentPost.profile?.name || "User"}
          </span>
          <span className="truncate">{parentPost.content}</span>
        </button>
      )}

      <div className={`flex gap-3 sm:gap-4 px-3 sm:px-4 ${isGrouped ? 'py-[1px]' : 'pt-1.5 pb-0.5'} ${isDeleted ? "opacity-50" : ""}`}>
        {/* Avatar column */}
        <div className="w-9 sm:w-10 flex-shrink-0 pt-0.5">
          {!isGrouped ? (
            <button onClick={goToProfile} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden hover:opacity-80 transition-opacity">
              {avatar ? (
                <img src={avatar} alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover" loading="lazy" />
              ) : (
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${post.is_anonymous ? "bg-muted" : colors.bg} flex items-center justify-center`}>
                  <span className="text-xs font-bold text-white">{post.is_anonymous ? "?" : getInitials(post.profile?.name)}</span>
                </div>
              )}
            </button>
          ) : (
            <span className="text-[10px] text-transparent hover:text-muted-foreground transition-colors w-9 sm:w-10 text-center block pt-1.5 select-none cursor-default" title={fullTime}>
              {format(new Date(post.created_at), "h:mm")}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {!isGrouped && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <button onClick={goToProfile} className={`text-[15px] font-semibold hover:underline ${post.is_anonymous ? "text-muted-foreground italic" : colors.text}`}>
                {displayName}
              </button>
              {post.is_anonymous && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">ANON</span>}
              <span className="text-[11px] text-muted-foreground" title={fullTime}>{time}</span>
              {isEdited && <span className="text-[10px] text-muted-foreground italic">(edited)</span>}
              {isMine && seenBy.length > 0 && (
                <button onClick={() => { setShowActions(false); setShowSeenBy(!showSeenBy); }} className="inline-flex items-center gap-0.5 text-[10px] text-primary" title={`Seen by ${seenBy.length}`}>
                  <Eye className="w-3 h-3" /> {seenBy.length}
                </button>
              )}
            </div>
          )}

          {/* Message content */}
          {isDeleted ? (
            <p className="text-[14px] text-muted-foreground italic">
              {isMine ? "🚫 You deleted this message" : "🚫 This message was deleted"}
            </p>
          ) : (
            <div className="text-[14px] text-foreground leading-[1.375rem] whitespace-pre-wrap break-words">
              {renderFormattedMessage(post.content, profileMap, navigate)}
            </div>
          )}

          {/* Image */}
          {!isDeleted && post.image_url && (
            <img src={post.image_url} alt="" className="mt-1.5 rounded-lg max-h-72 max-w-[400px] w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy" onClick={() => onImageClick(post.image_url)} />
          )}

          {/* File */}
          {!isDeleted && post.file_url && post.file_name && (
            <div className="mt-1.5 max-w-[300px]">
              <FileAttachment fileName={post.file_name} fileUrl={post.file_url} fileSize={post.file_size} fileType={post.file_type} />
            </div>
          )}

          {/* Voice */}
          {!isDeleted && post.voice_url && (
            <div className="mt-1.5 max-w-[280px]">
              <VoicePlayback url={post.voice_url} duration={post.voice_duration || 0} />
            </div>
          )}

          {!isDeleted && poll && <PollDisplay poll={poll} />}

          {!isDeleted && Object.keys(reactions).length > 0 && (
            <ReactionDisplay reactions={reactions} myReactions={myReactions} postId={post.id} onReact={onReact} />
          )}

          {/* Thread indicator */}
          {!isDeleted && replyCount > 0 && (
            <button onClick={() => onThread(post)} className="flex items-center gap-1.5 mt-1.5 text-[12px] text-primary hover:text-primary/80 font-semibold transition-colors group/thread">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover/thread:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </div>

      {/* Swipe reply indicator */}
      {swipeOffset > 20 && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60">
          <Reply className="w-5 h-5 text-primary" />
        </div>
      )}

      {/* NO hover actions (FIX 1 - removed entirely) */}

      {/* Long-press / right-click action sheet (FIX 7) */}
      {showActions && (
        <>
          <div className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px]" onClick={() => { setShowActions(false); setConfirmDelete(false); }} />
          <div className="fixed left-0 right-0 bottom-0 z-40 animate-slide-up safe-bottom sm:absolute sm:left-auto sm:right-4 sm:top-0 sm:bottom-auto sm:w-auto">
            <div className="bg-card border-t sm:border border-border sm:rounded-lg rounded-t-2xl shadow-2xl overflow-hidden sm:min-w-[220px]">
              {/* Row 1: Quick reactions */}
              <div className="flex items-center justify-around px-4 py-3 border-b border-border">
                {QUICK_REACTIONS.map(emoji => (
                  <button key={emoji} onClick={() => { onReact(post.id, emoji); setShowActions(false); }}
                    className={`text-xl w-11 h-11 flex items-center justify-center rounded-xl hover:bg-accent transition-all active:scale-90 ${myReactions.includes(emoji) ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}>
                    {emoji}
                  </button>
                ))}
                <button onClick={() => { /* could open full emoji picker */ setShowActions(false); }}
                  className="text-xl w-11 h-11 flex items-center justify-center rounded-xl hover:bg-accent transition-all active:scale-90 text-muted-foreground">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {/* Row 2: Reply, Copy, Report */}
              <div className="py-1">
                <ActionButton icon={Reply} label="Reply" onClick={() => { onReply(post); setShowActions(false); }} />
                <ActionButton icon={Copy} label="Copy" onClick={() => { onCopy(post.content); setShowActions(false); }} />
                <ActionButton icon={Flag} label="Report" onClick={async () => {
                  if (!userId) { toast.error("Please sign in to report"); setShowActions(false); return; }
                  if (isDemoId(post.id)) { toast("This is a demo message"); setShowActions(false); return; }
                  try {
                    const { error } = await supabase.from("reports").insert({ entity_id: post.id, entity_type: "forum_msg", reporter_id: userId, reason: "Reported via forum" });
                    if (error) throw error;
                    toast.success("Report submitted");
                  } catch { toast.error("Could not submit report"); }
                  setShowActions(false);
                }} />
                <ActionButton icon={Bookmark} label={isUserPinned ? "Unsave" : "Save"} onClick={() => { onUserPin(post.id); setShowActions(false); }} active={isUserPinned} />
                <ActionButton icon={MessageSquare} label="Thread" onClick={() => { onThread(post); setShowActions(false); }} />
                <ActionButton icon={Forward} label="Forward" onClick={() => { onForward(post); setShowActions(false); }} />
                
                {/* Row 3: Delete - only own messages with confirm */}
                {isMine && !isDeleted && (
                  <>
                    <div className="h-px bg-border mx-3 my-1" />
                    <ActionButton icon={Pencil} label="Edit" onClick={() => { onEdit(post); setShowActions(false); }} />
                    {!confirmDelete ? (
                      <ActionButton icon={Trash2} label="Delete" onClick={() => setConfirmDelete(true)} destructive />
                    ) : (
                      <div className="px-4 py-2 space-y-1 animate-fade-in">
                        <p className="text-[12px] text-destructive font-semibold">Delete this message?</p>
                        {canDeleteForEveryone && (
                          <button onClick={() => { onDelete(post.id, true); setShowActions(false); setConfirmDelete(false); }}
                            className="w-full text-left text-[13px] text-destructive px-3 py-2 rounded-lg hover:bg-destructive/10 transition-colors">
                            Delete for everyone
                          </button>
                        )}
                        <button onClick={() => { onDelete(post.id, false); setShowActions(false); setConfirmDelete(false); }}
                          className="w-full text-left text-[13px] text-muted-foreground px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                          Delete for me
                        </button>
                        <button onClick={() => setConfirmDelete(false)}
                          className="w-full text-left text-[13px] text-foreground px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
                {!isMine && !isDeleted && (
                  <>
                    <div className="h-px bg-border mx-3 my-1" />
                    <ActionButton icon={Trash2} label="Delete for me" onClick={() => { onDelete(post.id, false); setShowActions(false); }} muted />
                  </>
                )}
                {isAdmin && (
                  <ActionButton icon={Pin} label={post.pinned_at ? "Unpin" : "Pin"} onClick={() => { onAdminPin(post.id); setShowActions(false); }} />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Seen-by tooltip */}
      {showSeenBy && isMine && seenByNames.length > 0 && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setShowSeenBy(false)} />
          <div className="absolute right-4 top-0 z-30 animate-fade-in">
            <div className="bg-card border border-border rounded-lg shadow-xl p-3 min-w-[140px] max-w-[200px]">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Eye className="w-3 h-3" /> Seen by {seenBy.length}</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {seenByNames.map((name: string, i: number) => (
                  <p key={i} className="text-xs text-foreground truncate">{name}</p>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* FIX 6: React.memo with custom comparator */
const MemoizedDiscordMessage = React.memo(DiscordMessage, (prev, next) => {
  return (
    prev.post.id === next.post.id &&
    prev.post.reactions === next.post.reactions &&
    prev.post.replyCount === next.post.replyCount &&
    prev.isUserPinned === next.isUserPinned &&
    prev.highlightedPostId === next.highlightedPostId &&
    prev.isGrouped === next.isGrouped &&
    prev.post.edited_at === next.post.edited_at &&
    prev.post.is_deleted_for_everyone === next.post.is_deleted_for_everyone
  );
});

/* ── Reaction Display ── */
const ReactionDisplay = ({ reactions, myReactions, postId, onReact }: {
  reactions: Record<string, number>; myReactions: string[]; postId: string;
  onReact: (id: string, emoji: string) => void;
}) => {
  const allEmojis = Object.keys(reactions);
  const totalCount = Object.values(reactions).reduce((a, b) => a + b, 0);
  const hasMyReaction = myReactions.length > 0;

  return (
    <div className="relative mt-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        {allEmojis.map(emoji => (
          <button key={emoji} onClick={() => onReact(postId, emoji)}
            className={`text-[12px] h-[26px] px-2 rounded-full border transition-all flex items-center gap-1 ${
              myReactions.includes(emoji) ? "bg-primary/10 border-primary/30" : "bg-accent/60 border-border hover:border-primary/20"
            }`}>
            <span>{emoji}</span>
            <span className={`text-[11px] font-medium ${myReactions.includes(emoji) ? "text-primary" : "text-foreground"}`}>
              {reactions[emoji]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* Action button for context menu */
const ActionButton = ({ icon: Icon, label, onClick, destructive, muted, active }: {
  icon: any; label: string; onClick: () => void; destructive?: boolean; muted?: boolean; active?: boolean;
}) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors active:bg-accent/80 ${
      destructive ? "text-destructive hover:bg-destructive/10" :
      muted ? "text-muted-foreground hover:bg-accent" :
      "text-foreground hover:bg-accent"
    }`}>
    <Icon className={`w-[18px] h-[18px] ${active ? "text-primary fill-primary" : destructive ? "" : "text-muted-foreground"}`} />
    {label}
  </button>
);

/* ── Poll Display ── */
const PollDisplay = ({ poll }: { poll: any }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const rawOptions = poll.options;
  const options: string[] = Array.isArray(rawOptions) ? rawOptions : [];
  const { data: votes } = useQuery({
    queryKey: ["poll-votes", poll.id],
    queryFn: async () => { const { data } = await supabase.from("poll_votes").select("*").eq("poll_id", poll.id); return data ?? []; },
    staleTime: 30000,
  });
  const myVote = votes?.find((v: any) => v.user_id === user?.id);
  const totalVotes = votes?.length || 0;
  const voteCounts = options.map((_, i) => votes?.filter((v: any) => v.option_index === i).length || 0);
  const vote = async (idx: number) => {
    if (!user) return;
    if (myVote) {
      if (myVote.option_index === idx) await supabase.from("poll_votes").delete().eq("id", myVote.id);
      else await supabase.from("poll_votes").update({ option_index: idx }).eq("id", myVote.id);
    } else {
      await supabase.from("poll_votes").insert({ poll_id: poll.id, user_id: user.id, option_index: idx });
    }
    queryClient.invalidateQueries({ queryKey: ["poll-votes", poll.id] });
  };
  return (
    <div className="mt-2 space-y-1.5 max-w-[300px]">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-primary" /> {poll.question}</p>
      {options.map((opt: string, i: number) => {
        const pct = totalVotes > 0 ? Math.round((voteCounts[i] / totalVotes) * 100) : 0;
        const isMyVote = myVote?.option_index === i;
        return (
          <button key={i} onClick={() => vote(i)} className="w-full text-left relative overflow-hidden rounded-md border border-border bg-accent/40 p-2 text-xs transition-all hover:border-primary/30">
            <div className="absolute inset-0 bg-primary/10 transition-all" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between">
              <span className={`font-medium ${isMyVote ? "text-primary" : "text-foreground"}`}>{opt}</span>
              <span className="text-muted-foreground text-[10px] tabular-nums">{pct}%</span>
            </div>
          </button>
        );
      })}
      <p className="text-[10px] text-muted-foreground text-right">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>
    </div>
  );
};

export default Forum;
