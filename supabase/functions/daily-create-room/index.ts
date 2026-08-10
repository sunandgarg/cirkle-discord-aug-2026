// Daily.co room + token + call session tracking
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { roomId, mode } = body as { roomId?: string; mode?: "audio" | "video" };
    if (!roomId || !/^[0-9a-f-]{36}$/i.test(roomId)) {
      return new Response(JSON.stringify({ error: "Invalid roomId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (mode !== "audio" && mode !== "video") {
      return new Response(JSON.stringify({ error: "mode must be audio|video" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Server-side membership check
    const { data: member, error: memberErr } = await supabase
      .from("chat_members").select("id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    if (memberErr) throw memberErr;
    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden: not a room member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dailyRoomName = `cirkle-${roomId.replace(/-/g, "").slice(0, 24)}`;

    // Look for an active session in last 5 minutes (rejoin) else create a new tracking row
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: activeSession } = await supabase
      .from("call_sessions")
      .select("id")
      .eq("room_id", roomId)
      .is("ended_at", null)
      .gt("started_at", fiveMinAgo)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let sessionId: string;
    if (activeSession) {
      sessionId = activeSession.id;
    } else {
      const { data: newSession, error: sErr } = await supabase
        .from("call_sessions")
        .insert({ room_id: roomId, daily_room_name: dailyRoomName, started_by: user.id, mode })
        .select("id").single();
      if (sErr) throw sErr;
      sessionId = newSession.id;
    }

    // Get or create Daily room
    let roomRes = await fetch(`https://api.daily.co/v1/rooms/${dailyRoomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (roomRes.status === 404) {
      roomRes = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dailyRoomName,
          properties: {
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
            enable_screenshare: true,
            enable_chat: false,
            start_video_off: mode === "audio",
            start_audio_off: false,
            max_participants: 50,
          },
        }),
      });
    }
    if (!roomRes.ok) {
      const t = await roomRes.text();
      await supabase.from("call_sessions").update({
        ended_at: new Date().toISOString(), failure_reason: `daily_room: ${roomRes.status}`,
      }).eq("id", sessionId);
      throw new Error(`Daily room failed: ${roomRes.status} ${t}`);
    }
    const room = await roomRes.json();

    // Mint meeting token
    const { data: profile } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          room_name: dailyRoomName,
          user_name: profile?.name ?? "User",
          user_id: user.id,
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          start_video_off: mode === "audio",
        },
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      throw new Error(`Daily token failed: ${tokenRes.status} ${t}`);
    }
    const { token } = await tokenRes.json();

    return new Response(JSON.stringify({ url: room.url, token, roomName: dailyRoomName, sessionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("daily-create-room error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
