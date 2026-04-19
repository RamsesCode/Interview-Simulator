import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation as ElevenConversation, Mode } from "@elevenlabs/client";
import { ArrowLeft, Bug, Terminal, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDebuggingSessionById, saveDebuggingSessionCode } from "@/lib/localData";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/debugging/$sessionId")({
  head: () => ({
    meta: [{ title: "Debugging Challenge — Interviewly" }],
  }),
  component: DebuggingSessionPage,
});

function DebuggingSessionPage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(getDebuggingSessionById(sessionId));
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended" | "error">("idle");
  const [mode, setMode] = useState<Mode>("listening");
  const [code, setCode] = useState(session?.final_code ?? session?.initial_code ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const conversationRef = useRef<ElevenConversation | null>(null);
  const statusRef = useRef(status);
  const modeRef = useRef(mode);
  const codeSyncTimerRef = useRef<number | null>(null);
  const volumeLockTimerRef = useRef<number | null>(null);
  const keepAliveTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectingRef = useRef(false);
  const shouldMaintainSessionRef = useRef(false);
  const connectFnRef = useRef<(reason: "initial" | "reconnect") => Promise<void>>(async () => {});
  const lastActivityAtRef = useRef(0);
  const lastInactivityNudgeAtRef = useRef(0);
  const lastAgentMessageRef = useRef("");
  const pendingIntroRef = useRef<{ context: string; user: string } | null>(null);
  const userHasEditedCodeRef = useRef(false);
  const lastSentCodeRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightedPreRef = useRef<HTMLPreElement | null>(null);

  const TECH_AGENT_ID =
    import.meta.env.VITE_ELEVENLABS_TECH_AGENT_ID || "agent_7101kpj1m23mfjsvm90s5de288e9";
  const KEEPALIVE_MS = 12000;
  const INACTIVITY_CHECK_MS = 8000;
  const INACTIVITY_NUDGE_MS = 30000;

  if (!session) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <p className="text-sm text-destructive">Session not found.</p>
          <Link to="/debugging" className="mt-4 inline-block text-sm text-primary hover:underline">
            ← Back to Debugging
          </Link>
        </div>
      </main>
    );
  }

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    return () => {
      shouldMaintainSessionRef.current = false;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (codeSyncTimerRef.current) window.clearTimeout(codeSyncTimerRef.current);
      if (volumeLockTimerRef.current) window.clearInterval(volumeLockTimerRef.current);
      if (keepAliveTimerRef.current) window.clearInterval(keepAliveTimerRef.current);
      if (inactivityTimerRef.current) window.clearInterval(inactivityTimerRef.current);
      if (conversationRef.current) {
        void conversationRef.current.endSession();
        conversationRef.current = null;
      }
    };
  }, []);

  const scheduleReconnect = () => {
    if (!shouldMaintainSessionRef.current) return;
    if (reconnectTimerRef.current) return;

    const attempt = reconnectAttemptsRef.current + 1;
    reconnectAttemptsRef.current = attempt;
    reconnectingRef.current = true;
    const delay = Math.min(700 * 2 ** (attempt - 1), 5000);

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectFnRef.current("reconnect");
    }, delay);
  };

  const connectDebuggingSession = useCallback(async (reason: "initial" | "reconnect") => {
    if (statusRef.current === "connecting" || statusRef.current === "live") return;

    setStatus("connecting");
    setErrorMessage(null);

    try {
      await requestMicrophonePermission();

      if (conversationRef.current) {
        await conversationRef.current.endSession();
        conversationRef.current = null;
      }

      const { Conversation } = await import("@elevenlabs/client");
      const resumeContext =
        reason === "reconnect"
          ? `The prior realtime socket disconnected unexpectedly. Resume the same debugging challenge without restarting. Last known interviewer prompt: ${lastAgentMessageRef.current || "<none>"}. Current code snapshot:\n${code.slice(0, 900) || "<empty>"}`
          : "";
      const introContext = `You are a senior software engineer reviewing code for bugs. The candidate is debugging code in ${session.language}. Your role:
1. Observe their debugging process and code changes
2. Ask probing questions like: "What happens if input is null?", "Have you considered edge cases?", "Why did you choose this fix?"
3. Help them think through the debugging process, not give answers
4. Provide subtle hints only when they're stuck
5. Encourage them to test their fixes
6. Focus on their reasoning and approach, not just fixing the code

${resumeContext ? `Resume context: ${resumeContext}` : ""}`;
      const introUser = `I'm ready to debug the code in ${session.language}. Please help me find and fix the bugs.`;
      pendingIntroRef.current = { context: introContext, user: introUser };

      const conversation = await withStableMicCapture(() =>
        Conversation.startSession({
          agentId: TECH_AGENT_ID,
          connectionType: "websocket",
          dynamicVariables: {
            interview_mode: "debugging",
            language: session.language,
          },
          onConnect: () => {
            setStatus("live");
            setErrorMessage(null);
            reconnectAttemptsRef.current = 0;
            reconnectingRef.current = false;
            if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
            startVolumeLock(volumeLockTimerRef, conversationRef);
            startSessionMaintenance({
              keepAliveTimerRef,
              inactivityTimerRef,
              conversationRef,
              lastActivityAtRef,
              lastInactivityNudgeAtRef,
              modeRef,
              KEEPALIVE_MS,
              INACTIVITY_CHECK_MS,
              INACTIVITY_NUDGE_MS,
            });
            const intro = pendingIntroRef.current;
            if (intro && conversationRef.current) {
              safeSendContextualUpdate(conversationRef.current, intro.context);
              safeSendUserMessage(conversationRef.current, intro.user);
              pendingIntroRef.current = null;
            }
            toast.success("Debugging challenge connected.");
          },
          onModeChange: ({ mode }) => {
            setMode(mode);
            enforceConversationVolume(conversationRef.current);
          },
          onMessage: ({ role, message }) => {
            lastActivityAtRef.current = Date.now();
            if (role === "agent" && message?.trim()) {
              lastAgentMessageRef.current = message.trim();
            }
          },
          onDisconnect: () => {
            stopVolumeLock(volumeLockTimerRef);
            if (codeSyncTimerRef.current) window.clearTimeout(codeSyncTimerRef.current);
            stopSessionMaintenance(keepAliveTimerRef, inactivityTimerRef);
            pendingIntroRef.current = null;
            conversationRef.current = null;

            if (shouldMaintainSessionRef.current) {
              scheduleReconnect();
              return;
            }

            setStatus((prev) => (prev === "error" ? "error" : "ended"));
          },
          onError: (message) => {
            stopVolumeLock(volumeLockTimerRef);
            if (codeSyncTimerRef.current) window.clearTimeout(codeSyncTimerRef.current);
            stopSessionMaintenance(keepAliveTimerRef, inactivityTimerRef);
            pendingIntroRef.current = null;

            if (shouldMaintainSessionRef.current) {
              reconnectingRef.current = true;
              scheduleReconnect();
              return;
            }

            setStatus("error");
            setErrorMessage(message);
            toast.error("Debugging session connection failed");
          },
        }),
      );

      conversationRef.current = conversation;
      enforceConversationVolume(conversationRef.current);
      startVolumeLock(volumeLockTimerRef, conversationRef);
    } catch (error) {
      pendingIntroRef.current = null;
      const message = error instanceof Error ? error.message : "Unable to start debugging session.";
      if (shouldMaintainSessionRef.current && reason === "reconnect") {
        reconnectingRef.current = true;
        scheduleReconnect();
      } else {
        setStatus("error");
        setErrorMessage(message);
        toast.error(message);
      }
    }
  }, [session.language, code]);

  useEffect(() => {
    connectFnRef.current = connectDebuggingSession;
  }, [connectDebuggingSession]);

  const beginDebuggingSession = async () => {
    shouldMaintainSessionRef.current = true;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    await connectDebuggingSession("initial");
  };

  const endDebuggingSession = async () => {
    shouldMaintainSessionRef.current = false;
    reconnectingRef.current = false;
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    stopSessionMaintenance(keepAliveTimerRef, inactivityTimerRef);
    if (!conversationRef.current) return;
    if (codeSyncTimerRef.current) window.clearTimeout(codeSyncTimerRef.current);
    pendingIntroRef.current = null;
    await conversationRef.current.endSession();
    stopVolumeLock(volumeLockTimerRef);
    conversationRef.current = null;
    setStatus("ended");
    setMode("listening");
  };

  const saveDraft = async () => {
    setSaving(true);
    const ok = saveDebuggingSessionCode(session.id, code);
    setSaving(false);
    if (ok) toast.success("Code saved");
    else toast.error("Could not save code");
  };

  useEffect(() => {
    if (codeSyncTimerRef.current) window.clearTimeout(codeSyncTimerRef.current);
    if (!conversationRef.current || status !== "live" || mode === "speaking") return;
    if (!userHasEditedCodeRef.current) return;
    if (code === lastSentCodeRef.current) return;

    codeSyncTimerRef.current = window.setTimeout(() => {
      if (!conversationRef.current || !conversationRef.current.isOpen()) return;

      const snippet = code.length > 1400 ? `${code.slice(0, 1400)}\n...` : code;
      safeSendContextualUpdate(
        conversationRef.current,
        `Candidate is debugging in ${session.language}. Current code:\n${snippet || "<empty>"}\nObserve their changes and ask about their debugging approach. Only provide subtle hints if they're stuck.`,
      );
      lastSentCodeRef.current = code;
    }, 900);

    return () => {
      if (codeSyncTimerRef.current) window.clearTimeout(codeSyncTimerRef.current);
    };
  }, [code, session.language, status, mode]);

  const highlightedCode = useMemo(() => {
    return highlightCode(code, session.language as "python" | "cpp" | "javascript");
  }, [code, session.language]);

  const isSpeaking = status === "live" && mode === "speaking";

  return (
    <main className="container mx-auto max-w-6xl px-4 py-4">
      <Link
        to="/debugging"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6" style={{ boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              <Bug className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Debugging Challenge</h1>
              <p className="text-sm text-muted-foreground">Find and fix the bugs with guidance from a senior engineer.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${status === "live" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-primary"}`}
            />
            {status === "live" && mode === "speaking"
              ? "Agent speaking"
              : status === "live"
                ? "Agent listening"
                : status === "idle"
                  ? "Ready"
                  : status === "connecting"
                    ? "Connecting"
                    : status === "ended"
                      ? "Ended"
                      : "Error"}
          </div>
        </div>

        {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}

        <div className="mt-6 flex gap-4">
          <Button
            size="sm"
            onClick={() => void beginDebuggingSession()}
            disabled={status === "connecting" || status === "live"}
            style={status !== "live" && status !== "connecting" ? { backgroundImage: "var(--gradient-brand)" } : undefined}
          >
            {status === "connecting"
              ? "Connecting..."
              : status === "live"
                ? "Debugging..."
                : "Start Debugging"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void endDebuggingSession()}
            disabled={status !== "live"}
          >
            End Session
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={saveDraft}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Code"}
          </Button>
        </div>

        {status === "live" && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Debugging session is active
          </p>
        )}
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e] text-[#d4d4d4] shadow-2xl" style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
        <div className="flex items-center justify-between border-b border-white/5 bg-[#252526] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-[#858585]">
            <Terminal className="h-4 w-4" />
            <span className="font-mono">debug.{extFor(session.language as "python" | "cpp" | "javascript")}</span>
          </div>
          <p className="text-xs text-[#6a6a6a]">Debugging workspace</p>
        </div>

        <div className="relative min-h-[64vh] bg-[#1e1e1e] overflow-hidden">
          <pre
            ref={highlightedPreRef}
            aria-hidden
            className="pointer-events-none min-h-[64vh] overflow-auto px-4 py-5 font-mono text-sm leading-7"
            style={{
              fontFamily: "ui-monospace, 'Monaco', 'Menlo', 'Consolas', 'Liberation Mono', monospace",
              tabSize: 2,
              letterSpacing: "0.3px",
            }}
            dangerouslySetInnerHTML={{ __html: withLineNumbers(highlightedCode || " ") }}
          />
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              userHasEditedCodeRef.current = true;
              setCode(e.target.value);
            }}
            onScroll={(event) => {
              if (!highlightedPreRef.current) return;
              highlightedPreRef.current.scrollTop = event.currentTarget.scrollTop;
              highlightedPreRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }}
            wrap="off"
            spellCheck={false}
            className="absolute inset-0 min-h-[64vh] w-full resize-none overflow-auto bg-transparent px-4 py-5 pl-[68px] font-mono text-sm leading-7 text-transparent caret-[#aeafad] outline-none focus:outline-none"
            style={{
              fontFamily: "ui-monospace, 'Monaco', 'Menlo', 'Consolas', 'Liberation Mono', monospace",
              tabSize: 2,
              letterSpacing: "0.3px",
            }}
          />
        </div>
      </section>
    </main>
  );
}

function extFor(lang: "python" | "cpp" | "javascript") {
  if (lang === "python") return "py";
  if (lang === "cpp") return "cpp";
  return "js";
}

function withLineNumbers(html: string) {
  return html
    .split("\n")
    .map(
      (line, idx) =>
        `<span class="code-line"><span class="code-ln">${idx + 1}</span><span class="code-content">${line || " "}</span></span>`,
    )
    .join("\n");
}

function highlightCode(code: string, language: "python" | "cpp" | "javascript") {
  const escaped = escapeHtml(code);
  const commentPatterns: RegExp[] =
    language === "python" ? [/#.*$/gm] : [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g];

  const stringPattern = /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)/g;
  const numberPattern = /\b(\d+(?:\.\d+)?)\b/g;

  const keywords =
    language === "python"
      ? ["def", "return", "for", "while", "if", "elif", "else", "class", "import", "from", "in", "and", "or", "not", "None", "True", "False"]
      : language === "cpp"
        ? ["int", "long", "double", "float", "bool", "char", "void", "return", "for", "while", "if", "else", "class", "struct", "include", "using", "namespace", "const", "auto", "vector", "string"]
        : ["function", "return", "const", "let", "var", "if", "else", "for", "while", "class", "import", "from", "export", "new", "true", "false", "null", "undefined", "try", "catch"];

  const keywordPattern = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");

  let html = escaped;
  commentPatterns.forEach((pattern) => {
    html = html.replace(pattern, '<span class="code-comment">$&</span>');
  });
  html = html.replace(stringPattern, '<span class="code-string">$1</span>');
  html = html.replace(numberPattern, '<span class="code-number">$1</span>');
  html = html.replace(keywordPattern, '<span class="code-keyword">$1</span>');
  return html;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

async function requestMicrophonePermission() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported in this browser.");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: false,
        noiseSuppression: true,
        echoCancellation: true,
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
        noiseSuppression: true,
        echoCancellation: true,
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
    conversation.setVolume({ volume: 1.0 });
  } catch {
    // Ignore
  }
}

function startVolumeLock(
  volumeLockTimerRef: React.MutableRefObject<number | null>,
  conversationRef: React.MutableRefObject<ElevenConversation | null>,
) {
  if (volumeLockTimerRef.current) window.clearInterval(volumeLockTimerRef.current);
  volumeLockTimerRef.current = window.setInterval(() => {
    enforceConversationVolume(conversationRef.current);
  }, 250);
}

function stopVolumeLock(volumeLockTimerRef: React.MutableRefObject<number | null>) {
  if (volumeLockTimerRef.current) {
    window.clearInterval(volumeLockTimerRef.current);
    volumeLockTimerRef.current = null;
  }
}

function startSessionMaintenance({
  keepAliveTimerRef,
  inactivityTimerRef,
  conversationRef,
  lastActivityAtRef,
  lastInactivityNudgeAtRef,
  modeRef,
  KEEPALIVE_MS,
  INACTIVITY_CHECK_MS,
  INACTIVITY_NUDGE_MS,
}: {
  keepAliveTimerRef: React.MutableRefObject<number | null>;
  inactivityTimerRef: React.MutableRefObject<number | null>;
  conversationRef: React.MutableRefObject<ElevenConversation | null>;
  lastActivityAtRef: React.MutableRefObject<number>;
  lastInactivityNudgeAtRef: React.MutableRefObject<number>;
  modeRef: React.MutableRefObject<Mode>;
  KEEPALIVE_MS: number;
  INACTIVITY_CHECK_MS: number;
  INACTIVITY_NUDGE_MS: number;
}) {
  if (keepAliveTimerRef.current) window.clearInterval(keepAliveTimerRef.current);
  keepAliveTimerRef.current = window.setInterval(() => {
    if (!conversationRef.current?.isOpen()) return;
    try {
      conversationRef.current.sendUserActivity();
    } catch {
      // Ignore
    }
  }, KEEPALIVE_MS);

  if (inactivityTimerRef.current) window.clearInterval(inactivityTimerRef.current);
  inactivityTimerRef.current = window.setInterval(() => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityAtRef.current;

    if (timeSinceActivity > INACTIVITY_NUDGE_MS && modeRef.current === "listening") {
      const timeSinceNudge = now - lastInactivityNudgeAtRef.current;
      if (timeSinceNudge > INACTIVITY_NUDGE_MS) {
        lastInactivityNudgeAtRef.current = now;
        if (conversationRef.current?.isOpen()) {
          safeSendUserMessage(
            conversationRef.current,
            "I'm still here. Can you continue with the debugging challenge?",
          );
        }
      }
    }
  }, INACTIVITY_CHECK_MS);
}

function stopSessionMaintenance(
  keepAliveTimerRef: React.MutableRefObject<number | null>,
  inactivityTimerRef: React.MutableRefObject<number | null>,
) {
  if (keepAliveTimerRef.current) {
    window.clearInterval(keepAliveTimerRef.current);
    keepAliveTimerRef.current = null;
  }
  if (inactivityTimerRef.current) {
    window.clearInterval(inactivityTimerRef.current);
    inactivityTimerRef.current = null;
  }
}

function safeSendContextualUpdate(conversation: ElevenConversation, text: string) {
  try {
    if (!conversation.isOpen()) return;
    conversation.sendUserMessage(text);
  } catch {
    // Ignore
  }
}

function safeSendUserMessage(conversation: ElevenConversation, text: string) {
  try {
    if (!conversation.isOpen()) return;
    conversation.sendUserMessage(text);
  } catch {
    // Ignore
  }
}
