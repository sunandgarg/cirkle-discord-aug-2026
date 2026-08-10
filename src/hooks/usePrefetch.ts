import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Prefetches critical data on login so all tabs load instantly from cache.
 * Only runs once when user is authenticated. Data stays cached until explicit refresh.
 */
export const usePrefetch = (userId: string | undefined, profile: any) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const prefetch = async () => {
      const userIit = profile?.iit_name || "";
      const studentStatus = profile?.student_status || "";
      const parts = studentStatus.split(" ");
      const year = parts[0] || "";
      const course = parts[1] || "";
      const branch = parts.slice(2).join(" ") || "";
      const cohortKey = [userIit, course, branch, year].filter(Boolean).join("|");

      // 1. Forum: 50 messages per channel
      queryClient.prefetchQuery({
        queryKey: ["forum-posts", "global", userIit, cohortKey],
        queryFn: async () => {
          const { data } = await supabase.from("posts").select("*").eq("channel", "global").order("created_at", { ascending: true }).limit(50);
          if (!data?.length) return [];
          const ids = [...new Set(data.map((p) => p.author_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url, iit_name, student_status").in("user_id", ids);
          const map = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
          return data.map((post) => ({ ...post, profile: map.get(post.author_id) ?? null }));
        },
        staleTime: Infinity,
      });

      if (userIit) {
        queryClient.prefetchQuery({
          queryKey: ["forum-posts", "campus", userIit, cohortKey],
          queryFn: async () => {
            const { data } = await supabase.from("posts").select("*").eq("channel", "campus").eq("campus_filter", userIit).order("created_at", { ascending: true }).limit(50);
            if (!data?.length) return [];
            const ids = [...new Set(data.map((p) => p.author_id))];
            const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url, iit_name, student_status").in("user_id", ids);
            const map = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
            return data.map((post) => ({ ...post, profile: map.get(post.author_id) ?? null }));
          },
          staleTime: Infinity,
        });
      }

      if (cohortKey.split("|").filter(Boolean).length >= 2) {
        queryClient.prefetchQuery({
          queryKey: ["forum-posts", "cohort", userIit, cohortKey],
          queryFn: async () => {
            const { data } = await supabase.from("posts").select("*").eq("channel", "cohort").eq("cohort_filter", cohortKey).order("created_at", { ascending: true }).limit(50);
            if (!data?.length) return [];
            const ids = [...new Set(data.map((p) => p.author_id))];
            const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url, iit_name, student_status").in("user_id", ids);
            const map = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
            return data.map((post) => ({ ...post, profile: map.get(post.author_id) ?? null }));
          },
          staleTime: Infinity,
        });
      }

      // 2. Home: friend IDs + recent posts
      const { data: conns } = await supabase.from("connections").select("requester_id, receiver_id")
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).eq("status", "accepted");
      const friendIds = conns?.map((c) => c.requester_id === userId ? c.receiver_id : c.requester_id) || [];
      queryClient.setQueryData(["friend-ids", userId], friendIds);

      const allowedIds = [...friendIds, userId];
      queryClient.prefetchQuery({
        queryKey: ["home-posts", friendIds],
        queryFn: async () => {
          const { data } = await supabase.from("posts").select("*").in("author_id", allowedIds).eq("is_anonymous", false)
            .order("created_at", { ascending: false }).limit(25);
          if (!data?.length) return [];
          const authorIds = [...new Set(data.map((p) => p.author_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, name, headline, avatar_url, is_verified").in("user_id", authorIds);
          const map = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
          return data.map((post) => ({ ...post, profile: map.get(post.author_id) }));
        },
        staleTime: Infinity,
      });

      // 3. Network: members
      queryClient.prefetchQuery({
        queryKey: ["members"],
        queryFn: async () => {
          const { data } = await supabase.from("profiles").select("*").neq("user_id", userId).limit(200);
          return data ?? [];
        },
        staleTime: Infinity,
      });

      // 4. Consult: top mentors
      queryClient.prefetchQuery({
        queryKey: ["mentors", "", "All"],
        queryFn: async () => {
          const { data } = await supabase.from("profiles").select("*").eq("is_mentor", true).order("is_verified", { ascending: false }).limit(20);
          return (data ?? []) as any[];
        },
        staleTime: Infinity,
      });

      // 5. Jobs: latest 20
      queryClient.prefetchQuery({
        queryKey: ["jobs"],
        queryFn: async () => {
          const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(50);
          return data ?? [];
        },
        staleTime: Infinity,
      });
    };

    prefetch();
  }, [userId, profile?.iit_name, profile?.student_status, queryClient]);
};
