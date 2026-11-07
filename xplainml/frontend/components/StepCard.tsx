"use client";

import { useEffect, useState } from "react";

type CardState = "hidden-below" | "visible" | "hidden-above";

interface Props {
  state: CardState;
  children: React.ReactNode;
  onAnimationEnd?: () => void;
}

export function StepCard({ state, children, onAnimationEnd }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay so initial render doesn't skip animation
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  const getTransform = () => {
    if (!mounted || state === "hidden-below") return "translateY(100vh) scale(0.96)";
    if (state === "hidden-above")             return "translateY(-100vh) scale(0.96)";
    return "translateY(0) scale(1)";
  };

  const getOpacity = () => {
    if (!mounted || state === "hidden-below") return 0;
    if (state === "hidden-above")             return 0;
    return 1;
  };

  return (
    <div
      onTransitionEnd={onAnimationEnd}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: `translateX(-50%) translateY(-50%)`,
        width: "min(1100px, 94vw)",
        maxHeight: "88vh",
        zIndex: 10,
        pointerEvents: state === "visible" ? "auto" : "none",
      }}
    >
      <div style={{
        transform: getTransform(),
        opacity: getOpacity(),
        transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1), opacity 0.45s ease",
        borderRadius: 20,
        border: "1px solid rgba(45,212,191,0.12)",
        background: "rgba(8,10,15,0.82)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(45,212,191,0.06)",
        overflow: "hidden",
        maxHeight: "82vh",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Card header glow line */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(45,212,191,0.4), transparent)",
          flexShrink: 0,
        }} />

        {/* Scrollable content */}
        <div style={{
          overflowY: "auto",
          flex: 1,
          padding: "32px 36px",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(45,212,191,0.2) transparent",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}