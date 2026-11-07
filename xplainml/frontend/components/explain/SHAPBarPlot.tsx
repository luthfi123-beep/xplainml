"use client";

import dynamic from "next/dynamic";
import { getPlotConfig } from "@/lib/plotConfig";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function SHAPBarPlot({ data }: { data: { feature: string; importance: number }[] }) {
  const top = data.slice(0, 15).reverse();

  return (
    <Plot
      data={[{
        type: "bar",
        orientation: "h",
        x: top.map((d) => d.importance),
        y: top.map((d) => d.feature),
        marker: { color: "rgba(96, 165, 250, 0.8)" },
      }]}
      layout={{
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        font: { color: "#1e293b", size: 12 },
        title: {
          text: "Global Feature Importance (Mean |SHAP Value|)",
          font: { color: "#0f172a", size: 16 },
          x: 0.5,
          xanchor: "center",
        },
        margin: { l: 160, r: 20, t: 60, b: 40 },
        xaxis: {
          title: "Mean |SHAP value|",
          gridcolor: "#e2e8f0",
          zerolinecolor: "#cbd5e1",
        },
        yaxis: { gridcolor: "#e2e8f0" },
        height: 420,
      }}
      config={getPlotConfig("shap_bar_plot")}
      style={{ width: "100%" }}
    />
  );
}