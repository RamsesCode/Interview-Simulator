import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bug, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createDebuggingSession } from "@/lib/localData";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debugging")({
  head: () => ({
    meta: [{ title: "Debugging Challenge — Interviewly" }],
  }),
  component: DebuggingSetupPage,
});

function DebuggingSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"python" | "cpp" | "javascript">("python");

  const startDebuggingChallenge = async () => {
    if (!user) {
      await navigate({ to: "/auth" });
      return;
    }

    setLaunching(true);
    try {
      const brokenCode = getBrokenCodeSample(selectedLanguage);
      const data = createDebuggingSession(
        user.id,
        "Debugging Challenge",
        "Find and fix the bugs in the code. A senior engineer will guide your thinking.",
        selectedLanguage,
        brokenCode,
      );

      if (!data?.id) {
        throw new Error("Could not create a debugging challenge session.");
      }

      await navigate({ to: `/debugging/${data.id}` });
      toast.success("Debugging challenge started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start debugging challenge");
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
          <Bug className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Debugging Challenge Mode</h1>
        <p className="mt-2 text-muted-foreground">
          Practice real-world debugging by identifying and fixing bugs in realistic code. A senior software engineer will observe your debugging process and ask probing questions.
        </p>

        <div className="mt-6 space-y-4">
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
        </div>

        <Button
          size="lg"
          className="mt-8 w-full gap-2"
          onClick={() => void startDebuggingChallenge()}
          disabled={launching}
          style={!launching ? { backgroundImage: "var(--gradient-brand)" } : undefined}
        >
          {launching ? "Starting..." : "Start Debugging Challenge"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}

function getBrokenCodeSample(language: "python" | "cpp" | "javascript"): string {
  if (language === "python") {
    return `def find_duplicate(arr):
    """Find first duplicate element in array"""
    for i in range(len(arr)):
        for j in range(i + 1, len(arr)):
            if arr[i] == arr[j]
                return arr[i]
    return None

def process_data(numbers):
    # Bug: doesn't handle edge case
    total = 0
    for i in range(len(numbers)):
        total += numbers[i]
    average = total / len(numbers)
    return average

# Test
data = [10, 20, 30, None, 40]
print(process_data(data))`;
  }

  if (language === "cpp") {
    return `#include <vector>
using namespace std;

int findMax(vector<int> arr) {
    int max = arr[0];
    for (int i = 1; i < arr.size(); i++) {
        if (arr[i] > max)
            max = arr[i];
    }
    return max;
}

string reverseString(string s) {
    // Bug: off-by-one error
    for (int i = 0; i <= s.length(); i++) {
        char temp = s[i];
        s[i] = s[s.length() - 1 - i];
        s[s.length() - 1 - i] = temp;
    }
    return s;
}`;
  }

  return `function filterOdd(numbers) {
  const result = [];
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] % 2 = 0) {  // Bug: assignment instead of comparison
      result.push(numbers[i]);
    }
  }
  return result;
}

function countVowels(str) {
  let count = 0;
  const vowels = 'aeiou';
  for (let i = 0; i < str.length; i++) {
    // Bug: case-sensitive comparison
    if (vowels.includes(str[i])) {
      count++;
    }
  }
  return count;
}

// Test
console.log(filterOdd([1, 2, 3, 4, 5]));
console.log(countVowels("Hello World"));`;
}
