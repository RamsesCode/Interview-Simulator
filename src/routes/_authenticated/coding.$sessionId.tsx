import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation as ElevenConversation, Mode } from "@elevenlabs/client";
import { ArrowLeft, Mic, Terminal, SlidersHorizontal } from "lucide-react";
import { getCodingSessionById, saveCodingSessionCode } from "@/lib/localData";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coding/$sessionId")({
  head: () => ({
    meta: [{ title: "Tech Interview Practice — Interviewly" }],
  }),
  component: TechInterviewSessionPage,
});

type InterviewStatus = "idle" | "connecting" | "live" | "ended" | "error";
type Language = "python" | "cpp" | "javascript";

type Session = {
  id: string;
  final_code: string | null;
};

const TECH_AGENT_ID =
  import.meta.env.VITE_ELEVENLABS_TECH_AGENT_ID || "agent_7101kpj1m23mfjsvm90s5de288e9";

const LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
];

function TechInterviewSessionPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [mode, setMode] = useState<Mode>("listening");
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const conversationRef = useRef<ElevenConversation | null>(null);
  const codeSyncTimerRef = useRef<number | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedLanguageRef = useRef<Language | null>(null);
  const terminalVisibleRef = useRef(false);
  const statusRef = useRef<InterviewStatus>("idle");

  useEffect(() => {
    const data = getCodingSessionById(sessionId);
    if (!data) {
      setSession(null);
      setStatus("error");
      setErrorMessage("Technical interview session not found.");
      return;
    }

    setSession({ id: data.id, final_code: data.final_code });
    setCode(data.final_code ?? "");
  }, [sessionId]);

  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    terminalVisibleRef.current = terminalVisible;
  }, [terminalVisible]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const startTechnicalInterview = useCallback(async () => {
    if (statusRef.current === "connecting" || statusRef.current === "live") return;

    setStatus("connecting");
    setErrorMessage(null);

    try {
      if (conversationRef.current) {
        await conversationRef.current.endSession();
        conversationRef.current = null;
      }

      await requestMicrophonePermission();

      const { Conversation } = await import("@elevenlabs/client");

      const conversation = await Conversation.startSession({
        agentId: TECH_AGENT_ID,
        connectionType: "websocket",
        onConnect: () => {
          setStatus("live");
          toast.success("Technical interviewer connected.");
        },
        onModeChange: ({ mode }) => {
          setMode(mode);
        },
        onDisconnect: () => {
          conversationRef.current = null;
          setStatus((prev) => (prev === "error" ? "error" : "ended"));
        },
        onError: (message) => {
          setStatus("error");
          setErrorMessage(message);
          toast.error("Technical interviewer connection failed");
        },
        onMessage: ({ role, message }) => {
          if (!message?.trim()) return;

          if (
            role === "agent" &&
            selectedLanguageRef.current &&
            !terminalVisibleRef.current &&
            asksForCode(message)
          ) {
            setTerminalVisible(true);
            toast.success("Coding terminal unlocked.");
          }
        },
      });

      conversationRef.current = conversation;
      conversation.sendContextualUpdate(
        "You are a technical interviewer. Start by greeting the candidate and asking them to choose one language only: Python, C++, or JavaScript. Do not ask coding questions until language is selected. Once selected, ask first coding question and explicitly ask candidate to write code.",
      );
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to start technical interviewer.");
      toast.error("Failed to start technical interviewer");
    }
  }, []);

  useEffect(() => {
    void startTechnicalInterview();

    return () => {
      if (codeSyncTimerRef.current) {
        window.clearTimeout(codeSyncTimerRef.current);
      }
      if (conversationRef.current) {
        void conversationRef.current.endSession();
        conversationRef.current = null;
      }
    };
  }, [startTechnicalInterview]);

  useEffect(() => {
    if (!terminalVisible) return;
    editorRef.current?.focus();
  }, [terminalVisible]);

  useEffect(() => {
    if (!terminalVisible || !selectedLanguage || status !== "live") return;
    if (!conversationRef.current) return;

    if (codeSyncTimerRef.current) {
      window.clearTimeout(codeSyncTimerRef.current);
    }

    codeSyncTimerRef.current = window.setTimeout(() => {
      if (!conversationRef.current) return;
      const snippet = code.length > 1200 ? `${code.slice(0, 1200)}\n...` : code;
      conversationRef.current.sendContextualUpdate(
        `Candidate is actively coding in ${selectedLanguage}. Current draft:\n${snippet || "<empty>"}\nIf needed, provide subtle interviewer-style hints only (syntax nudges, probing questions, best practices), avoid giving full solutions unless explicitly asked.`,
      );
    }, 1800);
  }, [code, selectedLanguage, status, terminalVisible]);

  const chooseLanguage = (language: Language) => {
    setSelectedLanguage(language);
    setCode(defaultTemplate(language));

    if (!conversationRef.current) return;
    conversationRef.current.sendUserMessage(`I choose ${language}.`);
    conversationRef.current.sendContextualUpdate(
      `Candidate selected ${language}. Start first coding question now and explicitly request them to write code.`,
    );
  };

  const saveDraft = async () => {
    if (!session) return;
    setSaving(true);
    const ok = saveCodingSessionCode(session.id, code);
    setSaving(false);
    if (ok) toast.success("Draft saved");
    else toast.error("Could not save draft");
  };

  const highlightedCode = useMemo(() => {
    return highlightCode(code, selectedLanguage ?? "javascript");
  }, [code, selectedLanguage]);

  const statusLabel =
    status === "live"
      ? mode === "speaking"
        ? "Agent speaking"
        : "Agent listening"
      : status === "idle"
        ? "Ready"
        : status === "connecting"
          ? "Connecting"
          : status === "ended"
            ? "Ended"
            : "Error";

  return (
    <main className="container mx-auto max-w-6xl px-4 py-4">
      <Link
        to="/coding"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6" style={{ boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Tech Interview Practice</h1>
            <p className="text-sm text-muted-foreground">
              Live technical interview simulation. Behavioral mode remains separate at Voice Interview.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${status === "live" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-primary"}`}
            />
            {statusLabel}
          </div>
        </div>

        {errorMessage && <p className="mt-3 text-sm text-destructive">{errorMessage}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mic className="h-4 w-4 text-primary" />
                Interviewer Visualizer
              </div>

              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => void startTechnicalInterview()}
                disabled={status === "connecting" || status === "live"}
              >
                {status === "connecting"
                  ? "Connecting..."
                  : status === "live"
                    ? "Technical Interview Live"
                    : status === "error"
                      ? "Retry Technical Interview"
                      : "Begin Technical Interview"}
              </Button>

              <div className="mt-4 flex items-center justify-center">
                <div className="tech-orb">
                  <div className={`tech-bars ${status === "live" && mode === "speaking" ? "tech-bars-speaking" : ""}`}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <span key={i} style={{ animationDelay: `${i * 80}ms` }} />
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                The interviewer will ask you to select a language first, then request code input.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-xs font-medium text-muted-foreground">Language</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {LANGUAGES.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={selectedLanguage === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => chooseLanguage(opt.value)}
                    disabled={status !== "live"}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </aside>

          <section
            className={`overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e] text-[#d4d4d4] shadow-2xl transition-all duration-500 ${
              terminalVisible ? "max-h-[840px] opacity-100 translate-y-0" : "max-h-0 opacity-0 translate-y-4 pointer-events-none"
            } ${focusMode ? "ring-2 ring-primary/50" : ""}`}
            style={{ boxShadow: focusMode ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(98, 205, 205, 0.2)" : "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
          >
            <div className="flex items-center justify-between border-b border-white/5 bg-[#252526] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-[#858585]">
                <Terminal className="h-4 w-4" />
                <span className="font-mono">tech-interview.{extFor(selectedLanguage ?? "javascript")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setFocusMode((v) => !v)}>
                  <SlidersHorizontal className="mr-1 h-3 w-3" />
                  {focusMode ? "Normal" : "Focus"}
                </Button>
                <Button size="sm" variant="secondary" onClick={saveDraft} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            <div className="relative min-h-[64vh] bg-[#1e1e1e] overflow-hidden">
              <pre
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
                ref={editorRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="absolute inset-0 min-h-[64vh] w-full resize-none bg-transparent px-4 py-5 pl-[68px] font-mono text-sm leading-7 text-transparent caret-[#aeafad] outline-none focus:outline-none"
                style={{
                  fontFamily: "ui-monospace, 'Monaco', 'Menlo', 'Consolas', 'Liberation Mono', monospace",
                  tabSize: 2,
                  letterSpacing: "0.3px",
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function asksForCode(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("write") ||
    normalized.includes("implement") ||
    normalized.includes("code") ||
    normalized.includes("function") ||
    normalized.includes("solve")
  );
}

function defaultTemplate(language: Language) {
  if (language === "python") {
    return "def solve(input_data):\n    # explain your approach before coding\n    pass\n";
  }
  if (language === "cpp") {
    return "#include <bits/stdc++.h>\nusing namespace std;\n\nint solve(vector<int>& input_data) {\n    // explain your approach before coding\n    return 0;\n}\n";
  }
  return "function solve(inputData) {\n  // explain your approach before coding\n  return null;\n}\n";
}

function extFor(lang: Language | "javascript") {
  if (lang === "python") return "py";
  if (lang === "cpp") return "cpp";
  return "js";
}

async function requestMicrophonePermission() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported in this browser.");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      throw new Error("Microphone access was blocked. Please allow microphone access in browser site settings and retry.");
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      throw new Error("No microphone was found. Connect a microphone and retry.");
    }

    throw new Error("Unable to access microphone. Please check browser/device settings and retry.");
  }
}

function withLineNumbers(html: string) {
  return html
    .split("\n")
    .map((line, idx) => `<span class=\"code-line\"><span class=\"code-ln\">${idx + 1}</span><span class=\"code-content\">${line || " "}</span></span>`)
    .join("\n");
}

function highlightCode(code: string, language: Language | "javascript") {
  const escaped = escapeHtml(code);
  const commentPatterns: RegExp[] =
    language === "python"
      ? [/#.*$/gm]
      : [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//g];

  const stringPattern = /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)/g;
  const numberPattern = /\b(\d+(?:\.\d+)?)\b/g;

  const keywords =
    language === "python"
      ? ["def", "return", "for", "while", "if", "elif", "else", "class", "import", "from", "pass", "in", "and", "or", "not"]
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
