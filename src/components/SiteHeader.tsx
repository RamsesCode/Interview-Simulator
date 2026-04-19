import { Link } from "@tanstack/react-router";
import { Brain, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Brain className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">AI Interview Simulator</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Link to="/interview">
                <Button variant="ghost" size="sm">
                  Behavioral Interview
                </Button>
              </Link>
              <Link to="/coding">
                <Button variant="ghost" size="sm">
                  Tech Interview Practice
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
