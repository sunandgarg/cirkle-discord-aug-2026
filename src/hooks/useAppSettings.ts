import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAppSettings = () => {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*");
      const map: Record<string, string> = {};
      (data as any[])?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 60000,
  });
};

export const useShowHomeNetwork = () => {
  const { data, isLoading } = useAppSettings();
  return { showHomeNetwork: data?.show_home_network === "true", isLoading };
};
