import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createDSASession } from "@/lib/localData";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/data-structures-algo")({
  head: () => ({
    meta: [{ title: "DS&A Drills — Interviewly" }],
  }),
  component: DSASetupPage,
});

type Topic = "arrays" | "strings" | "linkedlists" | "stacks" | "queues" | "trees" | "graphs" | "patterns";

const TOPICS: Record<Topic, { label: string; description: string }> = {
  arrays: { label: "Arrays", description: "Array operations, searching, sorting" },
  strings: { label: "Strings", description: "String manipulation, pattern matching" },
  linkedlists: { label: "Linked Lists", description: "List operations, traversal, reversal" },
  stacks: { label: "Stacks & Queues", description: "Stack/queue operations, applications" },
  queues: { label: "Advanced Queues", description: "Priority queues, deques, BFS" },
  trees: { label: "Trees", description: "BST, traversal, recursion, DFS" },
  graphs: { label: "Graphs", description: "Graph traversal, shortest path, connectivity" },
  patterns: { label: "Patterns", description: "Sliding window, two pointers, prefix sum" },
};

function DSASetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"python" | "cpp" | "javascript">("python");
  const [selectedTopic, setSelectedTopic] = useState<Topic>("arrays");

  const startDSADrill = async () => {
    if (!user) {
      await navigate({ to: "/auth" });
      return;
    }

    setLaunching(true);
    try {
      const data = createDSASession(
        user.id,
        selectedTopic,
        `${TOPICS[selectedTopic].label} Drill`,
        `Master ${TOPICS[selectedTopic].label.toLowerCase()} with guided problem solving. Instructional hints available.`,
        selectedLanguage,
      );

      if (!data?.id) {
        throw new Error("Could not create a DS&A drill session.");
      }

      await navigate({ to: `/data-structures-algo/${data.id}` });
      toast.success("DS&A drill started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start DS&A drill");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <div
        className="rounded-2xl border border-border/60 bg-card p-8"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div
          className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        >
          <BookOpen className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Data Structures & Algorithms Drills</h1>
        <p className="mt-2 text-muted-foreground">
          Structured learning with guided problems. A patient technical instructor will help you master core concepts with progressive hints.
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Choose Your Language</p>
            <div className="grid grid-cols-3 gap-2">
              {(["python", "cpp", "javascript"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-4 py-2 rounded-lg border transition-colors text-center font-medium ${
                    selectedLanguage === lang
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-background hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {lang === "python" ? "Python" : lang === "cpp" ? "C++" : "JavaScript"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Select Topic</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(TOPICS) as [Topic, { label: string; description: string }][]).map(([key, { label, description }]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTopic(key)}
                  className={`p-4 rounded-lg border transition-colors text-left ${
                    selectedTopic === key
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-background hover:bg-accent/30"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          size="lg"
          className="mt-8 w-full gap-2"
          onClick={() => void startDSADrill()}
          disabled={launching}
          style={!launching ? { backgroundImage: "var(--gradient-brand)" } : undefined}
        >
          {launching ? "Starting..." : "Start DS&A Drill"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}
