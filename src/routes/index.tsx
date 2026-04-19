import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, Sparkles, Trophy, Brain, ArrowRight, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import heroBg from "@/assets/hero-bg.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Interview Simulator — Practice Tech Interviews with AI" },
      {
        name: "description",
        content:
          "Prepare for technical interviews with an AI voice interviewer and detailed scoring tailored to your target role.",
      },
      { property: "og:title", content: "AI Interview Simulator" },
      {
        property: "og:description",
        content:
          "Practice job-specific interviews with voice AI and get realistic interview feedback.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroBg}
          alt=""
          aria-hidden
          width={1920}
          height={1080}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-60"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-background/30 via-background/60 to-background"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        />
        <div className="relative z-20 container mx-auto px-4 py-20 sm:py-28 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Powered by ElevenLabs Voice + Lovable AI
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Ace your next{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                technical interview
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Practice voice-based interviews tailored to your target role with realistic follow-up
              questions and actionable feedback.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/coding">
                <Button size="lg" variant="outline">
                  Tech Interview Practice
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Modes */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          <ModeCard
            icon={<Mic className="h-6 w-6" />}
            title="Behavioral Interview"
            description="Focus on communication, leadership stories, and structured answers with a live voice interviewer."
            ctaTo="/interview"
            ctaLabel="Start behavioral"
          />
          <ModeCard
            icon={<Cpu className="h-6 w-6" />}
            title="Tech Interview Practice"
            description="Simulate a real engineering interview with coding questions, progressive difficulty, and live interviewer guidance."
            ctaTo="/coding"
            ctaLabel="Start technical"
          />
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">Everything you need</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<Brain className="h-5 w-5" />}
            title="Job-specific questions"
            text="Tailored question sets for your target role."
          />
          <Feature
            icon={<Mic className="h-5 w-5" />}
            title="Voice-activated"
            text="Speak your answers naturally, just like the real thing."
          />
          <Feature
            icon={<Trophy className="h-5 w-5" />}
            title="Scoring & feedback"
            text="Per-question scores and actionable improvements."
          />
        </div>
      </section>

      <footer className="border-t border-border/50 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AI Interview Simulator
      </footer>
    </div>
  );
}

function ModeCard({
  icon,
  title,
  description,
  ctaTo,
  ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaTo: "/interview" | "/coding";
  ctaLabel: string;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-8 transition-all hover:-translate-y-1"
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <div
        aria-hidden
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      />
      <div
        className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      >
        {icon}
      </div>
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-muted-foreground">{description}</p>
      <Link to={ctaTo}>
        <Button className="mt-6 gap-2">
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
