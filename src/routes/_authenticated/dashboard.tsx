import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic, ArrowRight, Trophy, Cpu, Bug, Zap, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listInterviewSessions } from "@/lib/localData";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Interviewly" }],
  }),
  component: DashboardPage,
});

type InterviewRow = {
  id: string;
  job_role: string;
  status: string;
  total_score: number | null;
  started_at: string;
};

function DashboardPage() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const interviews = listInterviewSessions(user.id, 5).map((s) => ({
      id: s.id,
      job_role: s.job_role,
      status: s.status,
      total_score: s.total_score,
      started_at: s.started_at,
    }));

    setInterviews(interviews);
    setLoading(false);
  }, [user]);

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">Pick a mode and start practicing.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          to="/interview"
          icon={<Mic className="h-6 w-6" />}
          title="Behavioral Interview"
          description="Practice storytelling, communication, and role-specific behavioral prompts."
        />
        <ActionCard
          to="/coding"
          icon={<Cpu className="h-6 w-6" />}
          title="Tech Interview Practice"
          description="Live technical interviewer with coding prompts, language choice, and guided hints."
        />
        <ActionCard
          to="/debugging"
          icon={<Bug className="h-6 w-6" />}
          title="Debugging Challenge"
          description="Fix real-world bugs and learn debugging thinking from a senior engineer."
        />
        <ActionCard
          to="/coding-speed-round"
          icon={<Zap className="h-6 w-6" />}
          title="Speed Round"
          description="Timed coding challenges to build speed and accuracy under pressure."
        />
        <ActionCard
          to="/data-structures-algo"
          icon={<BookOpen className="h-6 w-6" />}
          title="DS&A Drills"
          description="Structured learning with guided problems and progressive hints."
        />
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-1">
        <HistorySection
          title="Recent interviews"
          empty="No interviews yet — start your first one."
          loading={loading}
        >
          {interviews.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3"
            >
              <div>
                <div className="font-medium">{row.job_role}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(row.started_at).toLocaleString()} · {row.status}
                </div>
              </div>
              {row.total_score != null && (
                <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Trophy className="h-4 w-4" />
                  {Number(row.total_score).toFixed(1)}
                </div>
              )}
            </li>
          ))}
        </HistorySection>

      </div>
    </main>
  );
}

function ActionCard({
  to,
  icon,
  title,
  description,
}: {
  to: "/interview" | "/coding" | "/debugging" | "/coding-speed-round" | "/data-structures-algo";
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <div
        className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <ArrowRight className="absolute right-6 top-6 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function HistorySection({
  title,
  empty,
  loading,
  children,
}: {
  title: string;
  empty: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.filter(Boolean).length > 0;
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {loading ? (
        <div className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          Loading...
        </div>
      ) : hasItems ? (
        <ul className="space-y-2">{children}</ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
          {empty}
        </div>
      )}
    </div>
  );
}

// Suppress unused warnings on Button import in production builds
void Button;
