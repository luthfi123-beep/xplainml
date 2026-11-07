"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, Upload, SlidersHorizontal,
  Cpu, Lightbulb, FileDown, Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { AppStep, STEPS, STEP_INDEX } from "@/lib/appState";
import { VerticalProgress } from "@/components/VerticalProgress";
import { StepCard } from "@/components/StepCard";

const DioramaScene   = dynamic(() => import("@/components/diorama/DioramaScene"),  { ssr: false });
const UploadPage     = dynamic(() => import("@/components/steps/UploadStep"),    { ssr: false });
const PreprocessPage = dynamic(() => import("@/components/steps/PreprocessStep"), { ssr: false });
const TrainPage      = dynamic(() => import("@/components/steps/TrainStep"),     { ssr: false });
const ExplainPage    = dynamic(() => import("@/components/steps/ExplainStep"),   { ssr: false });
const ExportPage     = dynamic(() => import("@/components/steps/ExportStep"),    { ssr: false });

const features = [
  { icon: Upload,            label: "Flexible Input",       desc: "CSV, Excel, or built-in datasets." },
  { icon: SlidersHorizontal, label: "Visual Preprocessing", desc: "Missing values, encoding, SMOTE." },
  { icon: Cpu,               label: "Multi-Model Training", desc: "XGBoost, LightGBM, RF — side by side." },
  { icon: Lightbulb,         label: "Full SHAP Toolkit",    desc: "Bar, beeswarm, waterfall, interaction." },
  { icon: Zap,               label: "Live Prediction",      desc: "Input samples, get SHAP explanation." },
  { icon: FileDown,          label: "Research Export",      desc: "PDF, CSV, model, and PNG charts." },
];

// Depth scale entries — maps feature index to a "depth" reading
const depthScale = [
  { depth: "00", unit: "upload" },
  { depth: "01", unit: "preprocess" },
  { depth: "02", unit: "train" },
  { depth: "03", unit: "explain" },
  { depth: "04", unit: "predict" },
  { depth: "05", unit: "export" },
];

type CardState = "hidden-below" | "visible" | "hidden-above";

const STEP_COMPONENTS: Record<string, React.ComponentType<any>> = {
  upload:     UploadPage,
  preprocess: PreprocessPage,
  train:      TrainPage,
  explain:    ExplainPage,
  export:     ExportPage,
};

export default function HomePage() {
  const { currentStep, setStep, resetAll } = useAppStore();
  const [mounted, setMounted]   = useState(false);
  const [heroOut, setHeroOut]   = useState(false);
  const [inApp, setInApp]       = useState(false);
  const [visitedSteps, setVisitedSteps] = useState<Set<AppStep>>(new Set());
  const lockSceneRef   = useRef<() => void>(() => {});
  const unlockSceneRef = useRef<() => void>(() => {});

  useEffect(() => {
    setMounted(true);
    const hash = window.location.hash.replace("#", "") as AppStep;
    if (hash && STEPS.includes(hash)) {
      setInApp(true);
      setHeroOut(true);
      setStep(hash);
      setVisitedSteps(new Set([hash]));
    } else if (currentStep !== "home") {
      setInApp(true);
      setHeroOut(true);
      setVisitedSteps(new Set([currentStep]));
    }
  }, []);

  useEffect(() => {
    if (currentStep === "home") {
      window.history.replaceState(null, "", "/");
    } else {
      window.history.replaceState(null, "", `#${currentStep}`);
    }
  }, [currentStep]);

  const launchApp = useCallback(() => {
    setHeroOut(true);
    lockSceneRef.current();
    setTimeout(() => {
      setInApp(true);
      setStep("upload");
      setVisitedSteps(new Set(["upload"]));
    }, 600);
  }, [setStep]);

  const goToStep = useCallback((step: AppStep) => {
    setStep(step);
    setVisitedSteps(prev => new Set([...prev, step]));
  }, [setStep]);

  const goHome = useCallback(() => {
    setHeroOut(false);
    setInApp(false);
    setStep("home");
    resetAll();
    unlockSceneRef.current();
    window.history.replaceState(null, "", "/");
  }, [setStep, resetAll]);

  const getCardState = (step: AppStep): CardState => {
    const cur = STEP_INDEX[currentStep];
    const own = STEP_INDEX[step];
    if (own === cur)  return "visible";
    if (own < cur)    return "hidden-above";
    return "hidden-below";
  };

  return (
    <div style={{
      position: "relative", width: "100vw", height: "100vh",
      overflow: "hidden", background: "#080a0f",
    }}>

      {/* 3D Background */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        {mounted && <DioramaScene locked={inApp} />}
      </div>

      {/* Vignettes */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 70% at 50% 55%, transparent 30%, rgba(8,10,15,0.55) 75%, rgba(8,10,15,0.92) 100%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        opacity: heroOut ? 0 : 1,
        transition: "opacity 0.5s ease",
        background: "linear-gradient(to right, rgba(8,10,15,0.96) 0%, rgba(8,10,15,0.7) 22%, transparent 38%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        opacity: heroOut ? 0 : 1,
        transition: "opacity 0.5s ease",
        background: "linear-gradient(to left, rgba(8,10,15,0.96) 0%, rgba(8,10,15,0.7) 22%, transparent 38%)",
      }} />

      {/* App blur overlay */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        background: "rgba(8,10,15,0.45)",
        opacity: inApp ? 1 : 0,
        transition: "opacity 0.6s ease",
      }} />

      {/* HERO */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 3,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        pointerEvents: "none",
        transform: heroOut ? "translateX(0)" : "translateX(0)",
      }}>

        {/* ── LEFT — Atlas-style hero ── */}
        <div style={{
          gridColumn: "1",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 0 0 52px",
          pointerEvents: heroOut ? "none" : "auto",
          transform: heroOut ? "translateX(-120%)" : "translateX(0)",
          opacity: heroOut ? 0 : 1,
          transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease",
        }}>

          {/* Eyebrow — small caps label like "01 / OCEAN LOG" */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 20,
          }}>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10, fontWeight: 500,
              color: "rgba(245,240,242,0.35)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}>
              01 / XplainML
            </span>
          </div>

          {/* Display headline — heavy serif, massive, tight leading */}
          <h1 style={{
            fontFamily: "'Voor', Georgia, serif",
            fontSize: "clamp(62px,3.2vw,52px)",
            fontWeight: 400,
            lineHeight: 0.92,
            letterSpacing: "-0.03em",
            color: "#F5F0F2",
            margin: "0 0 28px 0",
            maxWidth: 520,
            whiteSpace: "nowrap",
          }}>
            &#305;n leven — Explain<br />
            Machine Learning
          </h1>

          {/* Caption block — like "A tiny boat. / A giant companion." */}
          <div style={{
            marginBottom: 36,
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            {[
              "Upload your data.",
              "Train any model.",
              "Understand every prediction.",
              "No code required.",
            ].map((line) => (
              <p key={line} style={{
                fontFamily: "'CaviarDreams', sans-serif",
                fontSize: "clamp(12px,1.1vw,15px)",
                fontWeight: 400,
                letterSpacing: "0.03em",
                color: "rgba(245,240,242,0.5)",
                lineHeight: 1.6,
                margin: 0,
              }}>{line}</p>
            ))}
          </div>

          {/* CTA row — pill button + ghost text link */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <button
              onClick={launchApp}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: "#F5F0F2", color: "#080a0f",
                border: "none", borderRadius: 3,
                padding: "12px 22px",
                fontFamily: "'Inter', sans-serif",
                fontSize: 11, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 0 32px rgba(45,212,191,0.15)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#2DD4BF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#F5F0F2"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Begin Journey <ArrowRight size={12} />
            </button>

            <button
              onClick={() => window.open("https://github.com", "_blank")}
              style={{
                background: "transparent", color: "rgba(245,240,242,0.3)",
                border: "none", padding: "8px 0", fontSize: 11,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "0.1em", textTransform: "uppercase",
                transition: "color 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(245,240,242,0.7)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(245,240,242,0.3)"}
            >
              Explore GitHub &nbsp;○
            </button>
          </div>

          {/* Stats */}
          <div style={{
            display: "flex", gap: 28, marginTop: 48,
            paddingTop: 28, borderTop: "1px solid rgba(245,240,242,0.06)",
          }}>
            {[["5+", "Algorithms"], ["6", "SHAP Plots"], ["4", "Export Formats"]].map(([val, label]) => (
              <div key={label}>
                <p style={{
                  fontFamily: "'CaviarDreams', sans-serif",
                  fontStyle: "italic",
                  fontSize: 22, fontWeight: 700,
                  color: "#e8a020", lineHeight: 1, marginBottom: 4,
                }}>{val}</p>
                <p style={{
                  fontSize: 10, color: "rgba(245,240,242,0.3)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  fontFamily: "'CaviarDreams', sans-serif",
                }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Center — empty */}
        <div style={{ gridColumn: "2", pointerEvents: "none" }} />

        {/* ── RIGHT — Depth scale instrument ── */}
        <div style={{
          gridColumn: "3",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 52px 0 0", alignItems: "flex-end",
          pointerEvents: heroOut ? "none" : "auto",
          transform: heroOut ? "translateX(120%)" : "translateX(0)",
          opacity: heroOut ? 0 : 1,
          transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease",
        }}>

          {/* Depth instrument wrapper */}
          <div style={{
            display: "flex", flexDirection: "row", alignItems: "stretch",
            gap: 20, width: "100%", maxWidth: 320,
          }}>

            {/* Vertical tick line + markers */}
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center",
              paddingTop: 4, paddingBottom: 4,
              flexShrink: 0,
            }}>
              {/* Top tick + label */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }}>
                <div style={{ width: 10, height: 1, background: "rgba(245,240,242,0.3)" }} />
                <span style={{
                  fontFamily: "'Inter', monospace",
                  fontSize: 9, color: "rgba(245,240,242,0.3)",
                  letterSpacing: "0.12em",
                }}>00</span>
              </div>

              {/* Continuous line */}
              <div style={{
                width: 1,
                flex: 1,
                background: "linear-gradient(to bottom, rgba(245,240,242,0.2), #e4bf80, rgba(245,240,242,0.1))",
                margin: "4px 0",
                position: "relative",
              }}>
                {/* Active node — glowing circle like gambar 2 */}
                <div style={{
                  position: "absolute",
                  top: "12%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 10, height: 10,
                  borderRadius: "50%",
                  border: "1.5px solid #e8a020",
                  background: "rgba(45,212,191,0.15)",
                  boxShadow: "0 0 10px rgba(45,212,191,0.5)",
                }} />
              </div>

              {/* Bottom tick + label */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 0 }}>
                <div style={{ width: 10, height: 1, background: "rgba(245,240,242,0.3)" }} />
                <span style={{
                  fontFamily: "'Inter', monospace",
                  fontSize: 9, color: "rgba(245,240,242,0.3)",
                  letterSpacing: "0.12em",
                }}>05</span>
              </div>
            </div>

            {/* Right side — label + feature list */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>

              {/* Header label — like "EXPLORE THE DEPTHS" */}
              <div style={{ marginBottom: 20 }}>
                <p style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.2em", textTransform: "uppercase",
                  color: "rgba(245,240,242,0.55)",
                  lineHeight: 1.3,
                  margin: 0,
                }}>
                  Explore<br />the Pipeline
                </p>
              </div>

              {/* Feature entries — spaced like depth markers */}
              <div style={{
                display: "flex", flexDirection: "column",
                gap: 0, flex: 1, justifyContent: "space-between",
              }}>
                {features.map((f, i) => {
                  const Icon = f.icon;
                  const isActive = i === 0;
                  return (
                    <div
                      key={f.label}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "9px 0",
                        borderTop: i === 0 ? "1px solid rgba(245,240,242,0.07)" : "none",
                        borderBottom: "1px solid rgba(245,240,242,0.05)",
                        opacity: isActive ? 1 : 0.55,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = isActive ? "1" : "0.55")}
                    >
                      <Icon
                        size={11}
                        color={isActive ? "#e8a020" : "rgba(245,240,242,0.4)"}
                        style={{ marginTop: 2, flexShrink: 0 }}
                      />
                      <div>
                        <p style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 12, fontWeight: isActive ? 600 : 400,
                          color: isActive ? "rgba(245,240,242,0.9)" : "rgba(245,240,242,0.55)",
                          margin: "0 0 2px 0",
                          letterSpacing: "-0.01em",
                        }}>{f.label}</p>
                        <p style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 10, fontWeight: 300,
                          color: "rgba(245,240,242,0.28)",
                          lineHeight: 1.5, margin: 0,
                          letterSpacing: "0.01em",
                        }}>{f.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom credit */}
              <p style={{
                fontSize: 10, color: "rgba(245,240,242,0.12)",
                marginTop: 16, fontFamily: "'Inter', sans-serif",
                letterSpacing: "0.04em",
              }}>
                Built by{" "}
                <span style={{
                  fontFamily: "Georgia, serif", fontStyle: "italic",
                  color: "rgba(45,212,191,0.35)",
                }}>&#305;n leven</span>
                {" "}· Ave · UNM · 2026
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vertical Progress */}
      <VerticalProgress
        visible={inApp}
        onStepClick={goToStep}
      />

      {/* Back to home */}
      <button
        onClick={goHome}
        style={{
          position: "fixed", top: 24, left: 24, zIndex: 20,
          background: "rgba(8,10,15,0.7)",
          border: "1px solid rgba(245,240,242,0.08)",
          borderRadius: 8, padding: "7px 14px",
          fontSize: 11, color: "rgba(245,240,242,0.4)",
          cursor: "pointer", fontFamily: "'Inter',sans-serif",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: 6,
          opacity: inApp ? 1 : 0,
          pointerEvents: inApp ? "auto" : "none",
          transition: "opacity 0.4s ease, color 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "rgba(245,240,242,0.8)"}
        onMouseLeave={e => e.currentTarget.style.color = "rgba(245,240,242,0.4)"}
      >
        ← XplainML
      </button>

      {/* Step Cards */}
      {inApp && (
        <>
          {(STEPS as AppStep[]).map((step) => {
            const Component = STEP_COMPONENTS[step];
            const cardState = getCardState(step);
            if (!visitedSteps.has(step) && cardState === "hidden-below") return null;

            return (
              <StepCard key={step} state={cardState}>
                <Component
                  onNext={() => {
                    const idx  = STEPS.indexOf(step);
                    const next = STEPS[idx + 1] as AppStep | undefined;
                    if (next) goToStep(next);
                  }}
                  onBack={() => {
                    const idx  = STEPS.indexOf(step);
                    const prev = STEPS[idx - 1] as AppStep | undefined;
                    if (prev) goToStep(prev);
                    else goHome();
                  }}
                />
              </StepCard>
            );
          })}
        </>
      )}
    </div>
  );
}