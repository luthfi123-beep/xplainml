"use client";

import dynamic from "next/dynamic";
import { getPlotConfig } from "@/lib/plotConfig";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface BeeswarmFeature {
  feature: string;
  shap_values: number[];
  feature_values: number[];
}

export function SHAPBeeswarm({ data }: { data: BeeswarmFeature[] }) {
  const top = data.slice(0, 12).reverse();

  const traces = top.map((feat, i) => ({
    type: "scatter" as const,
    mode: "markers" as const,
    name: feat.feature,
    x: feat.shap_values,
    y: feat.shap_values.map(() => feat.feature),
    marker: {
      size: 5,
      color: feat.feature_values,
      colorscale: "RdBu",
      reversescale: true,
      opacity: 0.7,
      showscale: i === top.length - 1,
      colorbar: i === top.length - 1 ? {
        title: "Feature value",
        thickness: 12,
        len: 0.6,
        tickfont: { color: "#94a3b8", size: 10 },
        titlefont: { color: "#94a3b8", size: 11 },
      } : undefined,
    },
    showlegend: false,
  }));

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        font: { color: "#1e293b", size: 12 },
        title: {
          text: "SHAP Beeswarm Plot",
          font: { color: "#0f172a", size: 16 },
          x: 0.5,
          xanchor: "center",
        },
        margin: { l: 160, r: 80, t: 60, b: 40 },
        xaxis: {
          title: "SHAP value",
          gridcolor: "#e2e8f0",
          zerolinecolor: "#94a3b8",
          zeroline: true,
        },
        yaxis: { gridcolor: "#e2e8f0" },
        height: 420,
      }}
      config={getPlotConfig("shap_beeswarm")}
      style={{ width: "100%" }}
    />
  );
}