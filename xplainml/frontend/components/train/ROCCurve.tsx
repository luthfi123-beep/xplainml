"use client";

import dynamic from "next/dynamic";
import { getPlotConfig } from "@/lib/plotConfig";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const COLORS = [
  "rgba(96, 165, 250, 0.9)",
  "rgba(167, 139, 250, 0.9)",
  "rgba(52, 211, 153, 0.9)",
  "rgba(251, 146, 60, 0.9)",
  "rgba(251, 191, 36, 0.9)",
];

interface Curve {
  label: string;
  fpr: number[];
  tpr: number[];
  auc: number;
}

export function ROCCurve({ curves }: { curves: Curve[] }) {
  const traces = curves.map((c, i) => ({
    type: "scatter" as const,
    mode: "lines" as const,
    name: `${c.label} (AUC = ${c.auc.toFixed(3)})`,
    x: c.fpr,
    y: c.tpr,
    line: { color: COLORS[i % COLORS.length], width: 2 },
  }));

  traces.push({
    type: "scatter",
    mode: "lines",
    name: "Random classifier",
    x: [0, 1],
    y: [0, 1],
    line: { color: "rgba(148, 163, 184, 0.4)", width: 1 },
  } as any);

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        font: { color: "#1e293b", size: 12 },
        title: {
          text: "ROC Curve",
          font: { color: "#0f172a", size: 16 },
          x: 0.5,
          xanchor: "center",
        },
        margin: { l: 60, r: 20, t: 60, b: 60 },
        xaxis: {
          title: "False Positive Rate",
          gridcolor: "#e2e8f0",
          range: [0, 1],
        },
        yaxis: {
          title: "True Positive Rate",
          gridcolor: "#e2e8f0",
          range: [0, 1],
        },
        legend: {
          x: 0.4,
          y: 0.1,
          bgcolor: "rgba(255,255,255,0.9)",
          bordercolor: "#cbd5e1",
          borderwidth: 1,
        },
        height: 420,
      }}
      config={getPlotConfig("roc_curve")}
      style={{ width: "100%" }}
    />
  );
}