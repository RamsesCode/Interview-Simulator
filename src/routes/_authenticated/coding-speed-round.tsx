import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createSpeedRoundSession } from "@/lib/localData";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coding-speed-round")({
  head: () => ({
    meta: [{ title: "Speed Round — Interviewly" }],
  }),
  component: SpeedRoundSetupPage,
});

type RoundDifficulty = "easy" | "medium" | "hard";

function SpeedRoundSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"python" | "cpp" | "javascript">("python");
  const [selectedDifficulty, setSelectedDifficulty] = useState<RoundDifficulty>("medium");

  const getDifficultyConfig = (difficulty: RoundDifficulty) => {
    switch (difficulty) {
      case "easy":
        return { questions: 3, timePerQuestion: 300, description: "3 questions, 5 min each" };
      case "medium":
        return { questions: 5, timePerQuestion: 420, description: "5 questions, 7 min each" };
      case "hard":
        return { questions: 5, timePerQuestion: 600, description: "5 questions, 10 min each" };
    }
  };

  const config = getDifficultyConfig(selectedDifficulty);

  const startSpeedRound = async () => {
    if (!user) {
      await navigate({ to: "/auth" });
      return;
    }

    setLaunching(true);
    try {
      const data = createSpeedRoundSession(
        user.id,
        `Speed Round: ${selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)}`,
        config.questions,
        selectedLanguage,
        config.timePerQuestion,
      );

      if (!data?.id) {
        throw new Error("Could not create a speed round session.");
      }

      await navigate({ to: `/coding-speed-round/${data.id}` });
      toast.success("Speed round started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start speed round");
    } finally {
      setLaunching(false);
    }
  };

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
          <Zap className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Speed Round Mode</h1>
        <p className="mt-2 text-muted-foreground">
          Timed coding challenges under pressure. Code fast and accurately to simulate real technical screenings.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Choose Your Language</p>
            <div className="grid gap-2">
              {(["python", "cpp", "javascript"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-4 py-2 rounded-lg border transition-colors text-left font-medium ${
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
            <p className="text-sm font-medium text-muted-foreground mb-3">Select Difficulty</p>
            <div className="grid grid-cols-3 gap-2">
              {(["easy", "medium", "hard"] as const).map((difficulty) => {
                const cfg = getDifficultyConfig(difficulty);
                return (
                  <button
                    key={difficulty}
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={`px-4 py-3 rounded-lg border transition-colors text-center ${
                      selectedDifficulty === difficulty
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="font-medium capitalize">{difficulty}</div>
                    <div className="text-xs mt-1">{cfg.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Button
          size="lg"
          className="mt-8 w-full gap-2"
          onClick={() => void startSpeedRound()}
          disabled={launching}
          style={!launching ? { backgroundImage: "var(--gradient-brand)" } : undefined}
        >
          {launching ? "Starting..." : "Start Speed Round"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}
