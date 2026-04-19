import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic, Construction, ArrowLeft } from "lucide-react";
import { getInterviewSessionById } from "@/lib/localData";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/interview/$sessionId")({
  head: () => ({
    meta: [{ title: "Interview in progress — Interviewly" }],
  }),
  component: InterviewSessionPage,
});

type Session = {
  id: string;
  job_role: string;
  status: string;
};

function InterviewSessionPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = getInterviewSessionById(sessionId);
    setSession(
      data
        ? {
            id: data.id,
            job_role: data.job_role,
            status: data.status,
          }
        : null,
    );
    setLoading(false);
  }, [sessionId]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/interview"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div
        className="mt-6 rounded-2xl border border-border/60 bg-card p-8"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Mic className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{session?.job_role} interview</h1>
            <p className="text-xs text-muted-foreground">Session {sessionId.slice(0, 8)}</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-center">
          <Construction className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Voice agent coming next</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The session was created. The next step is wiring up the ElevenLabs Conversational Agent
            so it can ask role-specific questions, listen to your answers, and score you in real
            time.
          </p>
          <Button className="mt-5" disabled>
            Connect microphone
          </Button>
        </div>
      </div>
    </main>
  );
}
