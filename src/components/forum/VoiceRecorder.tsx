import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2, Send, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRecorderProps {
  userId: string;
  onSend: (voiceUrl: string, duration: number) => void;
  onCancel: () => void;
}

const VoiceRecorder = ({ userId, onSend, onCancel }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        audioContext.close();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);
      setWaveformData([]);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Waveform animation
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setWaveformData((prev) => [...prev.slice(-40), avg / 255]);
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();
    } catch {
      onCancel();
    }
  }, [onCancel]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsPaused(!isPaused);
  }, [isPaused]);

  const handleSend = useCallback(async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const ext = audioBlob.type.includes("webm") ? "webm" : "mp4";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("voice-notes").upload(path, audioBlob);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("voice-notes").getPublicUrl(path);
      onSend(urlData.publicUrl, duration);
    } catch {
      // error handled by caller
    } finally {
      setIsUploading(false);
    }
  }, [audioBlob, duration, userId, onSend]);

  const handleDiscard = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setWaveformData([]);
    onCancel();
  }, [stopRecording, onCancel]);

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 w-full animate-fade-in">
      {/* Discard */}
      <button onClick={handleDiscard} className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors">
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Waveform + timer */}
      <div className="flex-1 flex items-center gap-2 bg-secondary rounded-full px-4 py-2">
        <div className="flex items-center gap-1 flex-1 h-6">
          {isRecording && !audioUrl ? (
            <>
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <div className="flex items-end gap-[2px] h-6 flex-1">
                {waveformData.map((v, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-primary transition-all"
                    style={{ height: `${Math.max(4, v * 24)}px` }}
                  />
                ))}
              </div>
            </>
          ) : audioUrl ? (
            <VoicePlayback url={audioUrl} duration={duration} />
          ) : null}
        </div>
        <span className="text-xs font-mono text-muted-foreground min-w-[40px] text-right">
          {formatTime(duration)}
        </span>
      </div>

      {/* Actions */}
      {isRecording && !audioUrl ? (
        <div className="flex items-center gap-1">
          <button onClick={togglePause} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors">
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
          <button onClick={stopRecording} className="p-2.5 bg-destructive text-destructive-foreground rounded-full hover:opacity-90 transition-opacity">
            <Square className="w-4 h-4" />
          </button>
        </div>
      ) : audioUrl ? (
        <button
          onClick={handleSend}
          disabled={isUploading}
          className="p-2.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      ) : null}
    </div>
  );
};

/* ── Voice Playback with waveform ── */
export const VoicePlayback = ({ url, duration }: { url: string; duration: number }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime / (audioRef.current.duration || 1));
        }
      };
    }
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 w-full">
      <button onClick={togglePlay} className="p-1 text-primary hover:text-primary/80 transition-colors flex-shrink-0">
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground min-w-[32px]">
        {formatTime(Math.round(duration * (1 - progress)))}
      </span>
      <button onClick={cycleSpeed} className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full hover:bg-primary/20 transition-colors">
        {playbackRate}x
      </button>
    </div>
  );
};

export default VoiceRecorder;
