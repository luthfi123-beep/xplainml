"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Upload, SlidersHorizontal, Cpu, Lightbulb, FileDown, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const steps = [
  { href: "/dashboard/upload",     label: "Dataset",    icon: Upload,             step: 1 },
  { href: "/dashboard/preprocess", label: "Preprocess", icon: SlidersHorizontal,  step: 2 },
  { href: "/dashboard/train",      label: "Train",      icon: Cpu,                step: 3 },
  { href: "/dashboard/explain",    label: "Explain",    icon: Lightbulb,          step: 4 },
  { href: "/dashboard/export",     label: "Export",     icon: FileDown,           step: 5 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname        = usePathname();
  const { dataset, preprocessSummary, trainResults } = useAppStore();

  const router = useRouter();

const handleReset = () => {
  const confirmed = window.confirm(
    "Are you sure you want to reset your project? All current progress will be lost."
  );

  if (!confirmed) return;

  useAppStore.getState().reset();
  toast.success("Project has been reset.");
  router.push("/dashboard/upload");
};

  // Determine which steps are completed
  const completedSteps = new Set<number>();
  if (dataset.session_id)          completedSteps.add(1);
  if (preprocessSummary)           completedSteps.add(2);
  if (trainResults.length > 0)     completedSteps.add(3);

  const currentStep = steps.find((s) => pathname.startsWith(s.href))?.step ?? 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight shrink-0">
            Xplain<span className="text-blue-400">ML</span>
          </Link>

          {/* Step progress */}
          <nav className="flex items-center gap-1">
            {steps.map((s, i) => {
              const isCompleted = completedSteps.has(s.step);
              const isCurrent   = currentStep === s.step;
              const isReachable = s.step === 1 || completedSteps.has(s.step - 1) || isCompleted;

              return (
                <div key={s.href} className="flex items-center">
                  {/* Connector line */}
                  {i > 0 && (
                    <div className={cn(
                      "w-8 h-px mx-1 transition-colors",
                      completedSteps.has(s.step - 1) ? "bg-blue-400" : "bg-border"
                    )} />
                  )}

                  <Link
                    href={isReachable ? s.href : "#"}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isCurrent
                        ? "bg-blue-400/15 text-blue-400 border border-blue-400/30"
                        : isCompleted
                        ? "text-green-400 hover:bg-green-400/10"
                        : isReachable
                        ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                        : "text-muted-foreground/40 cursor-not-allowed"
                    )}
                  >
                    {isCompleted && !isCurrent ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <s.icon className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden md:inline">{s.label}</span>
                  </Link>
                </div>
              );
            })}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-xs">Reset</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  );
}