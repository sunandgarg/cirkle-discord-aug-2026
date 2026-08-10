import { useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { X, Loader2, Mic, Video as VideoIcon, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CallModalProps {
  roomId: string;
  mode: "audio" | "video";
  onClose: () => void;
}

type Stage =
  | { kind: "permission" }
  | { kind: "checking" }
  | { kind: "permission_denied"; reason: string }
  | { kind: "no_devices" }
  | { kind: "fetching_token" }
  | { kind: "joining" }
  | { kind: "in_call" }
  | { kind: "reconnecting" }
  | { kind: "error"; message: string };

const CallModal = ({ roomId, mode, onClose }: CallModalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const participantRowRef = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "permission" });
  const { user } = useAuth();

  // ── Cleanup helpers ────────────────────────────────────────────────────
  const recordParticipantLeave = async () => {
    if (participantRowRef.current) {
      await supabase.from("call_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("id", participantRowRef.current);
      participantRowRef.current = null;
    }
  };

  const finalizeSession = async (failureReason?: string) => {
    if (!sessionIdRef.current) return;
    // If I'm the last participant, mark session ended.
    const { count } = await supabase.from("call_participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionIdRef.current)
      .is("left_at", null);
    if ((count ?? 0) === 0) {
      const { data: sess } = await supabase.from("call_sessions")
        .select("started_at, participant_count")
        .eq("id", sessionIdRef.current).single();
      const startedAt = sess?.started_at ? new Date(sess.started_at).getTime() : Date.now();
      const dur = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      await supabase.from("call_sessions").update({
        ended_at: new Date().toISOString(),
        duration_seconds: dur,
        failure_reason: failureReason ?? null,
      }).eq("id", sessionIdRef.current);
    }
  };

  const teardown = async (failureReason?: string) => {
    try {
      await callRef.current?.leave();
    } catch {}
    try {
      callRef.current?.destroy();
    } catch {}
    callRef.current = null;
    await recordParticipantLeave();
    await finalizeSession(failureReason);
  };

  // ── Pre-flight permission check ────────────────────────────────────────
  const requestPermissions = async () => {
    setStage({ kind: "checking" });
    if (!navigator.mediaDevices?.getUserMedia) {
      setStage({ kind: "no_devices" });
      return;
    }
    try {
      const constraints = mode === "video"
        ? { audio: true, video: true }
        : { audio: true, video: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(t => t.stop()); // release immediately, Daily will re-acquire
      await joinCall();
    } catch (e: any) {
      const name = e?.name ?? "";
      let reason = "Could not access your microphone/camera.";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        reason = "You denied microphone/camera access. Please enable it in your browser settings and try again.";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setStage({ kind: "no_devices" }); return;
      } else if (name === "NotReadableError") {
        reason = "Your microphone or camera is being used by another app.";
      } else if (name === "OverconstrainedError") {
        reason = "No device matches the requested settings.";
      }
      setStage({ kind: "permission_denied", reason });
    }
  };

  // ── Main join flow ─────────────────────────────────────────────────────
  const joinCall = async () => {
    try {
      setStage({ kind: "fetching_token" });
      const { data, error } = await supabase.functions.invoke("daily-create-room", {
        body: { roomId, mode },
      });
      if (error) throw new Error(error.message ?? "Failed to fetch call token");
      if (!data?.url || !data?.token) throw new Error("Invalid call token response");
      sessionIdRef.current = data.sessionId ?? null;

      if (!containerRef.current) throw new Error("Call container not ready");

      const call = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "12px" },
        showLeaveButton: true,
        showFullscreenButton: true,
      });
      callRef.current = call;

      call.on("joined-meeting", async () => {
        setStage({ kind: "in_call" });
        if (user && sessionIdRef.current) {
          const { data: row } = await supabase.from("call_participants")
            .insert({ session_id: sessionIdRef.current, user_id: user.id })
            .select("id").single();
          participantRowRef.current = row?.id ?? null;
          // bump participant_count
          const { count } = await supabase.from("call_participants")
            .select("id", { count: "exact", head: true })
            .eq("session_id", sessionIdRef.current);
          await supabase.from("call_sessions")
            .update({ participant_count: count ?? 1 })
            .eq("id", sessionIdRef.current);
        }
      });
      call.on("left-meeting", async () => { await teardown(); onClose(); });
      call.on("error", async (ev: any) => {
        console.error("Daily error", ev);
        await teardown(`daily_error: ${ev?.errorMsg ?? "unknown"}`);
        setStage({ kind: "error", message: ev?.errorMsg ?? "Call error" });
      });
      call.on("network-connection", (ev: any) => {
        if (ev?.event === "interrupted") setStage({ kind: "reconnecting" });
        if (ev?.event === "connected") setStage({ kind: "in_call" });
      });

      setStage({ kind: "joining" });
      await call.join({ url: data.url, token: data.token, startVideoOff: mode === "audio" });
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Failed to start call";
      toast.error(msg);
      await teardown(msg);
      setStage({ kind: "error", message: msg });
    }
  };

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => { teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-2 sm:p-4"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="relative w-full h-full max-w-5xl max-h-[100dvh] sm:max-h-[90vh] bg-card rounded-xl overflow-hidden shadow-2xl">
        <button
          onClick={async () => { await teardown(); onClose(); }}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
          aria-label="Close call"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Permission gate */}
        {stage.kind === "permission" && (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {mode === "video" ? <VideoIcon className="w-8 h-8 text-primary" /> : <Mic className="w-8 h-8 text-primary" />}
            </div>
            <h2 className="text-lg font-bold text-foreground">Allow {mode === "video" ? "camera & microphone" : "microphone"} access</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              We need access to your {mode === "video" ? "camera and microphone" : "microphone"} to start this call. Your browser will ask for permission next.
            </p>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={requestPermissions}>Continue</Button>
            </div>
          </div>
        )}

        {(stage.kind === "checking" || stage.kind === "fetching_token" || stage.kind === "joining") && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-white bg-black/40">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-3 text-sm">
              {stage.kind === "checking" ? "Checking devices…" : stage.kind === "fetching_token" ? "Preparing call…" : "Joining call…"}
            </span>
          </div>
        )}

        {stage.kind === "reconnecting" && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 bg-yellow-500/90 text-black text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Reconnecting…
          </div>
        )}

        {stage.kind === "permission_denied" && (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 gap-4">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">Permission required</h2>
            <p className="text-sm text-muted-foreground max-w-sm">{stage.reason}</p>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={requestPermissions}>Try again</Button>
            </div>
          </div>
        )}

        {stage.kind === "no_devices" && (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 gap-4">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">No microphone or camera found</h2>
            <p className="text-sm text-muted-foreground max-w-sm">Connect a device and try again.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        )}

        {stage.kind === "error" && (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 gap-4">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">Call failed</h2>
            <p className="text-sm text-muted-foreground max-w-sm">{stage.message}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={requestPermissions}>Retry</Button>
            </div>
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default CallModal;
