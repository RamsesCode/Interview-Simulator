import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Conversation as ElevenConversation } from "@elevenlabs/client";
import { Mic } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interview")({
  head: () => ({
    meta: [{ title: "Voice Interview — Interviewly" }],
  }),
  component: InterviewSetupPage,
});

type InterviewStatus = "idle" | "connecting" | "live" | "ended" | "error";
type AgentMode = "speaking" | "listening";

function InterviewSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [mode, setMode] = useState<AgentMode>("listening");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const conversationRef = useRef<ElevenConversation | null>(null);
  const volumeLockTimerRef = useRef<number | null>(null);
  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
    }
  }, [navigate, user]);

  useEffect(() => {
    return () => {
      stopVolumeLock(volumeLockTimerRef);
      if (conversationRef.current) {
        void conversationRef.current.endSession();
        conversationRef.current = null;
      }
    };
  }, []);

  const beginInterview = async () => {
    if (!user) return;

    if (!agentId) {
      setStatus("error");
      setErrorMessage("Missing VITE_ELEVENLABS_AGENT_ID in .env");
      toast.error("ElevenLabs agent is not configured");
      return;
    }

    setStatus("connecting");
    setMode("listening");
    setErrorMessage(null);

    try {
      await requestMicrophonePermission();

      const { Conversation } = await import("@elevenlabs/client");

      const conversation = await withStableMicCapture(() =>
        Conversation.startSession({
          agentId,
          connectionType: "websocket",
          dynamicVariables: {
            candidate_name: user.user_metadata?.full_name ?? user.email,
          },
          onConnect: ({ conversationId }) => {
            setConversationId(conversationId ?? null);
            setStatus("live");
            enforceConversationVolume(conversationRef.current);
            startVolumeLock(volumeLockTimerRef, conversationRef);
            toast.success("Interview started. You are live with the AI agent.");
          },
          onModeChange: ({ mode }) => {
            setMode(mode);
            enforceConversationVolume(conversationRef.current);
          },
          onDisconnect: () => {
            stopVolumeLock(volumeLockTimerRef);
            conversationRef.current = null;
            setStatus((prev) => (prev === "error" ? "error" : "ended"));
            setMode("listening");
          },
          onError: (message) => {
            stopVolumeLock(volumeLockTimerRef);
            setStatus("error");
            setErrorMessage(message);
            setMode("listening");
            toast.error("Could not connect to ElevenLabs");
          },
        }),
      );

      conversationRef.current = conversation;
    } catch (error) {
      setStatus("error");
      const message = error instanceof Error ? error.message : "Unknown connection error";
      setErrorMessage(message);
      setMode("listening");
      toast.error("Failed to start interview session");
    }
  };

  const endInterview = async () => {
    if (!conversationRef.current) return;
    await conversationRef.current.endSession();
    stopVolumeLock(volumeLockTimerRef);
    conversationRef.current = null;
    setStatus("ended");
    setMode("listening");
  };

  const statusLabel =
    status === "idle"
      ? "Ready"
      : status === "connecting"
        ? "Connecting"
        : status === "live"
          ? "Live"
          : status === "ended"
            ? "Ended"
            : "Error";
  const isSpeaking = status === "live" && mode === "speaking";
  const isListening = status === "live" && mode === "listening";

  return (
    <main className="container mx-auto flex min-h-[80vh] max-w-3xl items-center px-4 py-12">
      <div
        className="w-full rounded-2xl border border-border/60 bg-card p-8 text-center"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <h1 className="text-2xl font-bold tracking-tight">Voice Interview Agent</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tap begin and talk naturally. Your ElevenLabs interviewer will ask questions in real time.
        </p>

        <div className="relative mx-auto mt-10 h-64 w-64">
          <div
            className={`orb-shell ${status === "live" ? "orb-live" : ""} ${isSpeaking ? "orb-speaking" : ""} ${isListening ? "orb-listening" : ""}`}
          >
            <div className="orb-surface" />
            <div className="orb-caustic orb-caustic-a" />
            <div className="orb-caustic orb-caustic-b" />
            <div className="orb-gloss" />
            <div className="orb-core-dot" />
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {status === "live" ? (isSpeaking ? "AI is speaking" : "AI is listening") : "Waiting to start"}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${status === "live" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-primary"}`}
          />
          {statusLabel}
        </div>

        {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}
        {conversationId && (
          <p className="mt-2 text-xs text-muted-foreground">Conversation {conversationId.slice(0, 8)}</p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            size="lg"
            className="w-full max-w-xs"
            style={{ backgroundImage: "var(--gradient-brand)" }}
            onClick={beginInterview}
            disabled={status === "connecting" || status === "live"}
          >
            {status === "connecting" ? "Connecting..." : status === "live" ? "Interview Live" : "Begin Interview"}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full max-w-xs"
            onClick={endInterview}
            disabled={status !== "live"}
          >
            End Interview
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You will be prompted for microphone access when the connection starts.
        </p>

        <div
          className="mx-auto mt-8 inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        >
          <Mic className="h-5 w-5" />
        </div>
      </div>
    </main>
  );
}

async function requestMicrophonePermission() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported in this browser.");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: false,
        noiseSuppression: false,
        echoCancellation: false,
      },
    });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      throw new Error("Microphone access was blocked. Please allow microphone access in browser site settings and try again.");
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      throw new Error("No microphone was found. Connect a microphone and try again.");
    }

    throw new Error("Unable to access microphone. Please check browser/device settings and try again.");
  }
}

async function withStableMicCapture<T>(action: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return action();
  }

  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getUserMedia = (constraints: MediaStreamConstraints = { audio: true }) => {
    const next = { ...constraints };

    if (next.audio) {
      const audioConstraints =
        typeof next.audio === "object" ? { ...next.audio } : ({} as MediaTrackConstraints);

      next.audio = {
        ...audioConstraints,
        autoGainControl: false,
        noiseSuppression: false,
        echoCancellation: false,
      };
    }

    return originalGetUserMedia(next);
  };

  try {
    return await action();
  } finally {
    navigator.mediaDevices.getUserMedia = originalGetUserMedia;
  }
}

function enforceConversationVolume(conversation: ElevenConversation | null) {
  if (!conversation) return;

  try {
    conversation.setVolume({ volume: 1 });
  } catch {
    // Ignore SDK volume setter issues and continue.
  }
}

function startVolumeLock(
  timerRef: { current: number | null },
  conversationRef: { current: ElevenConversation | null },
) {
  stopVolumeLock(timerRef);

  timerRef.current = window.setInterval(() => {
    enforceConversationVolume(conversationRef.current);
  }, 1500);
}

function stopVolumeLock(timerRef: { current: number | null }) {
  if (!timerRef.current) return;
  window.clearInterval(timerRef.current);
  timerRef.current = null;
}
