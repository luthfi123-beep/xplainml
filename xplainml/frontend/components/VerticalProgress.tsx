"use client";

import { STEPS, STEP_LABELS, AppStep } from "@/lib/appState";
import { useAppStore } from "@/lib/store";
import { Check, Database, SlidersHorizontal, Cpu, Lightbulb, FileDown } from "lucide-react";

const STEP_ICONS: Record<string, any> = {
  upload:     Database,
  preprocess: SlidersHorizontal,
  train:      Cpu,
  explain:    Lightbulb,
  export:     FileDown,
};

interface Props {
  visible: boolean;
  onStepClick: (step: AppStep) => void;
}

export function VerticalProgress({ visible, onStepClick }: Props) {
  const { currentStep, dataset, preprocessSummary, trainResults } = useAppStore();

  const STEP_ORDER: AppStep[] = ["upload", "preprocess", "train", "explain", "export"];
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const completedSteps = new Set<AppStep>();
  if (dataset.session_id)      completedSteps.add("upload");
  if (preprocessSummary)       completedSteps.add("preprocess");
  if (trainResults.length > 0) completedSteps.add("train");
  // Explain dan export dianggap completed kalau sudah pernah melewatinya
  // (sudah di step setelahnya)
  if (currentIndex > STEP_ORDER.indexOf("explain")) completedSteps.add("explain");
  if (currentIndex > STEP_ORDER.indexOf("export"))  completedSteps.add("export");

  return (
    <div style={{
      position: "fixed",
      left: 28,
      top: "50%",
      transform: `translateY(-50%) translateX(${visible ? "0" : "-80px"})`,
      opacity: visible ? 1 : 0,
      transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease",
      zIndex: 20,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0,
      pointerEvents: visible ? "auto" : "none",
    }}>
      {STEPS.map((step, i) => {
        const Icon      = STEP_ICONS[step];
        const isCurrent = currentStep === step;
        const isDone    = completedSteps.has(step);
        const isReach   = i === 0 || completedSteps.has(STEPS[i - 1]);

        return (
          <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Connector line */}
            {i > 0 && (
              <div style={{
                width: 1,
                height: 28,
                background: isDone || isCurrent
                  ? "linear-gradient(to bottom, #2DD4BF, #2DD4BF44)"
                  : "rgba(245,240,242,0.08)",
                transition: "background 0.4s",
              }} />
            )}

            {/* Step node */}
            <button
              onClick={() => isReach && onStepClick(step)}
              title={STEP_LABELS[step]}
              style={{
                width: 36, height: 36,
                borderRadius: "50%",
                border: `1px solid ${
                  isCurrent ? "#2DD4BF"
                  : isDone   ? "#2DD4BF55"
                  : "rgba(245,240,242,0.1)"
                }`,
                background: isCurrent
                  ? "rgba(45,212,191,0.15)"
                  : isDone
                  ? "rgba(45,212,191,0.06)"
                  : "rgba(8,10,15,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isReach ? "pointer" : "not-allowed",
                transition: "all 0.3s",
                backdropFilter: "blur(8px)",
                boxShadow: isCurrent ? "0 0 16px rgba(45,212,191,0.3)" : "none",
                outline: "none",
                padding: 0,
              }}
              onMouseEnter={e => {
                if (isReach && !isCurrent) {
                  e.currentTarget.style.borderColor = "#2DD4BF88";
                  e.currentTarget.style.background = "rgba(45,212,191,0.08)";
                }
              }}
              onMouseLeave={e => {
                if (!isCurrent) {
                  e.currentTarget.style.borderColor = isDone
                    ? "#2DD4BF55" : "rgba(245,240,242,0.1)";
                  e.currentTarget.style.background = isDone
                    ? "rgba(45,212,191,0.06)" : "rgba(8,10,15,0.6)";
                }
              }}
            >
              {isDone && !isCurrent
                ? <Check size={13} color="#2DD4BF" />
                : <Icon size={13} color={isCurrent ? "#2DD4BF" : "rgba(245,240,242,0.3)"} />
              }
            </button>

            {/* Label */}
            <span style={{
              fontSize: 9,
              color: isCurrent ? "#2DD4BF" : "rgba(245,240,242,0.2)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontFamily: "'Inter', sans-serif",
              marginTop: 4,
              transition: "color 0.3s",
              whiteSpace: "nowrap",
            }}>
              {STEP_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}