import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation as ElevenConversation, Mode } from "@elevenlabs/client";
import { Cpu, ArrowRight, Mic, Terminal, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createCodingSession, saveCodingSessionCode } from "@/lib/localData";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coding")({
  head: () => ({
    meta: [{ title: "Tech Interview Practice — AI Interview Simulator" }],
  }),
  component: TechInterviewSetupPage,
});

function TechInterviewSetupPage() {
  const { user } = useAuth();
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended" | "error">("idle");
  const [mode, setMode] = useState<Mode>("listening");
  const [selectedLanguage, setSelectedLanguage] = useState<"python" | "cpp" | "javascript">("python");
  const [code, setCode] = useState(defaultTemplate("python"));
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const conversationRef = useRef<ElevenConversation | null>(null);
  const statusRef = useRef(status);
  const codeSyncTimerRef = useRef<number | null>(null);
  const volumeLockTimerRef = useRef<number | null>(null);
  const pendingIntroRef = useRef<{ context: string; user: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightedPreRef = useRef<HTMLPreElement | null>(null);

  const TECH_AGENT_ID =
    import.meta.env.VITE_ELEVENLABS_TECH_AGENT_ID || "agent_7101kpj1m23mfjsvm90s5de288e9";

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    return () => {
      if (codeSyncTimerRef.current) {
        window.clearTimeout(codeSyncTimerRef.current);
      }
      stopVolumeLock(volumeLockTimerRef);
      if (conversationRef.current) {
        void conversationRef.current.endSession();
        conversationRef.current = null;
      }
    };
  }, []);

  const startTechInterview = async () => {
    if (!user) {
      toast.error("You need to be signed in to start a technical interview.");
      return;
    }

    setLaunching(true);
    try {
      const data = createCodingSession(
        user.id,
        "Technical interview",
        "Live technical interview simulation with guided coding.",
        "pending",
      );

      if (!data?.id) {
        throw new Error("Could not create a new technical interview session.");
      }

      setSessionId(data.id);
      setCode(data.final_code ?? defaultTemplate("python"));
      setLaunched(true);
      toast.success("Technical workspace is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start technical interview");
    } finally {
      setLaunching(false);
    }
  };

  const beginTechnicalInterview = useCallback(async () => {
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
      const selectedLanguageLabel = languageLabel(selectedLanguage);
      const introContext = `You are a realistic technical interviewer. The candidate selected ${selectedLanguageLabel} and you must fully support that choice. Never ask them to switch to Python or another language unless the candidate explicitly requests a switch. Ask one coding question at a time in ${selectedLanguageLabel}. Wait for the candidate to think and type. Monitor their code progress from context updates and provide short, occasional interviewer-style nudges only when necessary. Do not reveal full solutions unless explicitly asked. After a solution attempt, ask the candidate to explain complexity and possible improvements. Do not require unnecessary C++ boilerplate like '#include <bits/stdc++.h>' or 'using namespace std;' unless the candidate explicitly asks for full boilerplate.`;
      const introUser = `I am ready for a technical interview in ${selectedLanguageLabel}. Please ask the first coding question and then wait for me to code in ${selectedLanguageLabel}.`;
      pendingIntroRef.current = { context: introContext, user: introUser };

      const conversation = await withStableMicCapture(() =>
        Conversation.startSession({
          agentId: TECH_AGENT_ID,
          connectionType: "websocket",
          dynamicVariables: {
            interview_mode: "technical",
            preferred_language: selectedLanguageLabel,
          },
          onConnect: () => {
            setStatus("live");
            startVolumeLock(volumeLockTimerRef, conversationRef);
            const intro = pendingIntroRef.current;
            if (intro && conversationRef.current) {
              safeSendContextualUpdate(conversationRef.current, intro.context);
              safeSendUserMessage(conversationRef.current, intro.user);
              pendingIntroRef.current = null;
            }
            toast.success("Technical interviewer connected.");
          },
          onModeChange: ({ mode }) => {
            setMode(mode);
            enforceConversationVolume(conversationRef.current);
          },
          onDisconnect: () => {
            stopVolumeLock(volumeLockTimerRef);
            stopCodeSyncTimer(codeSyncTimerRef);
            pendingIntroRef.current = null;
            conversationRef.current = null;
            setStatus((prev) => (prev === "error" ? "error" : "ended"));
          },
          onError: (message) => {
            stopVolumeLock(volumeLockTimerRef);
            stopCodeSyncTimer(codeSyncTimerRef);
            pendingIntroRef.current = null;
            setStatus("error");
            setErrorMessage(message);
            toast.error("Technical interviewer connection failed");
          },
        }),
      );

      conversationRef.current = conversation;
      enforceConversationVolume(conversationRef.current);
      startVolumeLock(volumeLockTimerRef, conversationRef);
    } catch (error) {
      pendingIntroRef.current = null;
      setStatus("error");
      const message = error instanceof Error ? error.message : "Unable to start technical interviewer.";
      setErrorMessage(message);
      toast.error(message);
    }
  }, [TECH_AGENT_ID, selectedLanguage]);

  const endTechnicalInterview = async () => {
    if (!conversationRef.current) return;
    stopCodeSyncTimer(codeSyncTimerRef);
    pendingIntroRef.current = null;
    await conversationRef.current.endSession();
    stopVolumeLock(volumeLockTimerRef);
    conversationRef.current = null;
    setStatus("ended");
    setMode("listening");
  };

  const onLanguageChange = (language: "python" | "cpp" | "javascript") => {
    setSelectedLanguage(language);
    setCode(defaultTemplate(language));
    textareaRef.current?.focus();

    if (conversationRef.current && status === "live") {
      const selectedLanguageLabel = languageLabel(language);
      safeSendUserMessage(
        conversationRef.current,
        `I want to solve this in ${selectedLanguageLabel}. Please continue in ${selectedLanguageLabel}.`,
      );
      safeSendContextualUpdate(
        conversationRef.current,
        `Candidate switched language to ${selectedLanguageLabel}. You must continue in ${selectedLanguageLabel} and should not suggest switching languages. Continue interview naturally and ask for code updates in this language.`,
      );
    }
  };

  const saveDraft = async () => {
    if (!sessionId) return;
    setSaving(true);
    const ok = saveCodingSessionCode(sessionId, code);
    setSaving(false);
    if (ok) toast.success("Draft saved");
    else toast.error("Could not save draft");
  };

  useEffect(() => {
    stopCodeSyncTimer(codeSyncTimerRef);
    if (!conversationRef.current || status !== "live") return;

    codeSyncTimerRef.current = window.setTimeout(() => {
      if (!conversationRef.current || !conversationRef.current.isOpen()) return;

      const snippet = code.length > 1400 ? `${code.slice(0, 1400)}\n...` : code;
      safeSendContextualUpdate(
        conversationRef.current,
        `Candidate is coding in ${languageLabel(selectedLanguage)}. Current code:\n${snippet || "<empty>"}\nAssess progress quietly. Only provide concise guidance if needed and avoid interrupting too frequently.`,
      );
    }, 900);

    return () => {
      stopCodeSyncTimer(codeSyncTimerRef);
    };
  }, [code, selectedLanguage, status]);

  const highlightedCode = useMemo(() => {
    return highlightCode(code, selectedLanguage);
  }, [code, selectedLanguage]);

  const isSpeaking = status === "live" && mode === "speaking";

  if (!launched) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <div
          className="rounded-2xl border border-border/60 bg-card p-8"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <div
            className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Cpu className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Technical Interview Mode</h1>
          <p className="mt-2 text-muted-foreground">
            Practice with a realistic technical interviewer. You will choose a language, solve coding
            prompts, and explain your reasoning out loud.
          </p>

          <Button
            size="lg"
            className="mt-8 w-full gap-2"
            onClick={startTechInterview}
            disabled={launching}
          >
            {launching ? "Starting..." : "Tech Interview Practice"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-2xl border border-border/60 bg-card p-6" style={{ boxShadow: "var(--shadow-elegant)" }}>
        {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}

        <div className="mt-6 rounded-2xl border border-border/60 bg-background/30 p-5">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
            <aside className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-xs font-medium text-muted-foreground">Language</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Button
                  size="sm"
                  variant={selectedLanguage === "python" ? "default" : "outline"}
                  onClick={() => onLanguageChange("python")}
                >
                  Python
                </Button>
                <Button
                  size="sm"
                  variant={selectedLanguage === "cpp" ? "default" : "outline"}
                  onClick={() => onLanguageChange("cpp")}
                >
                  C++
                </Button>
                <Button
                  size="sm"
                  variant={selectedLanguage === "javascript" ? "default" : "outline"}
                  onClick={() => onLanguageChange("javascript")}
                >
                  JavaScript
                </Button>
              </div>

              <Button size="sm" variant="secondary" className="mt-4 w-full" onClick={saveDraft} disabled={saving}>
                {saving ? "Saving..." : "Save Draft"}
              </Button>
            </aside>

            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mic className="h-4 w-4 text-primary" />
                Technical Interviewer
              </div>

              <div className="relative mx-auto mt-2 h-32 w-32 -translate-y-1">
                <div
                  className={`orb-shell ${status === "live" ? "orb-live" : ""} ${isSpeaking ? "orb-speaking" : ""} ${status === "live" && !isSpeaking ? "orb-listening" : ""}`}
                >
                  <div className="orb-surface" />
                  <div className="orb-caustic orb-caustic-a" />
                  <div className="orb-caustic orb-caustic-b" />
                  <div className="orb-gloss" />
                  <div className="orb-core-dot" />
                </div>
              </div>

              <div className="mx-auto mt-3 flex max-w-xs flex-col gap-2">
                <Button
                  size="sm"
                  className="w-full"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                  onClick={() => void beginTechnicalInterview()}
                  disabled={status === "connecting" || status === "live"}
                >
                  Begin Interview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={endTechnicalInterview}
                  disabled={status !== "live"}
                >
                  End Interview
                </Button>
              </div>

              {status === "live" && (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Live monitoring is active
                </p>
              )}
            </div>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-[oklch(0.14_0.02_260)] text-[oklch(0.95_0.02_260)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Terminal className="h-4 w-4" />
                tech-interview.{extFor(selectedLanguage)}
              </div>
              <p className="text-xs text-white/60">Real-time coding workspace</p>
            </div>

            <div className="relative min-h-[64vh] bg-[oklch(0.13_0.02_260)]">
              <pre
                ref={highlightedPreRef}
                aria-hidden
                className="pointer-events-none min-h-[64vh] overflow-auto p-5 font-mono text-sm leading-6"
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                  tabSize: 2,
                }}
                dangerouslySetInnerHTML={{ __html: withLineNumbers(highlightedCode || " ") }}
              />
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={(event) => {
                  if (!highlightedPreRef.current) return;
                  highlightedPreRef.current.scrollTop = event.currentTarget.scrollTop;
                  highlightedPreRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }}
                wrap="off"
                spellCheck={false}
                className="absolute inset-0 min-h-[64vh] w-full resize-none overflow-auto bg-transparent p-5 pl-[74px] font-mono text-sm leading-6 text-transparent caret-[oklch(0.95_0.03_260)] outline-none"
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                  tabSize: 2,
                }}
              />
            </div>
          </section>
      </div>
    </main>
  );
}

function defaultTemplate(language: "python" | "cpp" | "javascript") {
  if (language === "python") {
    return "def solve(input_data):\n    # explain your approach before coding\n    return None\n";
  }
  if (language === "cpp") {
    return "int solve(vector<int>& input_data) {\n    // explain your approach before coding\n    return 0;\n}\n";
  }
  return "function solve(inputData) {\n  // explain your approach before coding\n  return null;\n}\n";
}

function extFor(lang: "python" | "cpp" | "javascript") {
  if (lang === "python") return "py";
  if (lang === "cpp") return "cpp";
  return "js";
}

function languageLabel(lang: "python" | "cpp" | "javascript") {
  if (lang === "python") return "Python";
  if (lang === "cpp") return "C++";
  return "JavaScript";
}

function withLineNumbers(html: string) {
  return html
    .split("\n")
    .map(
      (line, idx) =>
        `<span class=\"code-line\"><span class=\"code-ln\">${idx + 1}</span><span class=\"code-content\">${line || " "}</span></span>`,
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
  enforceConversationVolume(conversationRef.current);

  timerRef.current = window.setInterval(() => {
    enforceConversationVolume(conversationRef.current);
  }, 250);
}

function stopVolumeLock(timerRef: { current: number | null }) {
  if (!timerRef.current) return;
  window.clearInterval(timerRef.current);
  timerRef.current = null;
}

function stopCodeSyncTimer(timerRef: { current: number | null }) {
  if (!timerRef.current) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function safeSendContextualUpdate(conversation: ElevenConversation, text: string) {
  if (!conversation.isOpen()) return;

  try {
    conversation.sendContextualUpdate(text);
  } catch {
    // Ignore send failures during close transitions.
  }
}

function safeSendUserMessage(conversation: ElevenConversation, text: string) {
  if (!conversation.isOpen()) return;

  try {
    conversation.sendUserMessage(text);
  } catch {
    // Ignore send failures during close transitions.
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
