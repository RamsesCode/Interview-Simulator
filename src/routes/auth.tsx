import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Interviewly" },
      {
        name: "description",
        content: "Sign in with Google to start practicing interviews.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, user, navigate]);

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <Link to="/" className="inline-flex items-center justify-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Brain className="h-6 w-6" />
          </span>
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with Google to start practicing interviews and save your progress.
        </p>

        <Button
          onClick={handleGoogle}
          disabled={submitting}
          size="lg"
          variant="outline"
          className="mt-8 w-full gap-3"
        >
          <GoogleIcon />
          Log in with Google
        </Button>

        <p className="mt-6 text-xs text-muted-foreground">
          By continuing you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
