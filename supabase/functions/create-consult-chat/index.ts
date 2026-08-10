// Edge function: auto-create a chat room when a consultation is booked
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { consultation_id } = await req.json();
    if (!consultation_id) {
      return new Response(JSON.stringify({ error: "consultation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch consultation
    const { data: consult, error: cErr } = await supabase
      .from("consultations")
      .select("*")
      .eq("id", consultation_id)
      .single();

    if (cErr || !consult) {
      return new Response(JSON.stringify({ error: "Consultation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get both profiles for room name
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", [consult.client_id, consult.consultant_id]);

    const clientName = profiles?.find((p: any) => p.user_id === consult.client_id)?.name || "Client";
    const consultantName = profiles?.find((p: any) => p.user_id === consult.consultant_id)?.name || "Consultant";

    // Check if a room already exists between these two
    const { data: existingRooms } = await supabase
      .from("chat_members")
      .select("room_id")
      .eq("user_id", consult.client_id);

    let existingRoomId: string | null = null;
    if (existingRooms?.length) {
      const roomIds = existingRooms.map((r: any) => r.room_id);
      const { data: sharedRooms } = await supabase
        .from("chat_members")
        .select("room_id")
        .eq("user_id", consult.consultant_id)
        .in("room_id", roomIds);

      if (sharedRooms?.length) {
        // Check if any of these is a 1:1 (not group)
        const { data: rooms } = await supabase
          .from("chat_rooms")
          .select("id")
          .in("id", sharedRooms.map((r: any) => r.room_id))
          .eq("is_group", false);

        if (rooms?.length) {
          existingRoomId = rooms[0].id;
        }
      }
    }

    let roomId = existingRoomId;

    if (!roomId) {
      // Create new chat room
      const { data: room, error: rErr } = await supabase
        .from("chat_rooms")
        .insert({
          name: `${clientName} ↔ ${consultantName}`,
          is_group: false,
          created_by: consult.client_id,
        })
        .select("id")
        .single();

      if (rErr) throw rErr;
      roomId = room.id;

      // Add both as members
      await supabase.from("chat_members").insert([
        { room_id: roomId, user_id: consult.client_id },
        { room_id: roomId, user_id: consult.consultant_id },
      ]);
    }

    // Send initial system-like message
    await supabase.from("messages").insert({
      room_id: roomId,
      sender_id: consult.client_id,
      content: `📋 Consultation booked: ${consult.consultation_type} session (${consult.duration_minutes}min). Looking forward to connecting!`,
    });

    // Update consultation status to confirmed
    await supabase
      .from("consultations")
      .update({ status: "confirmed" })
      .eq("id", consultation_id);

    return new Response(JSON.stringify({ room_id: roomId, status: "confirmed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
