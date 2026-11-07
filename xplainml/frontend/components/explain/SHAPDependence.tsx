"use client";

import dynamic from "next/dynamic";
import { getPlotConfig } from "@/lib/plotConfig";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  data: {
    feature: string;
    feature_values: number[];
    shap_values: number[];
    color_feature: string | null;
    color_values: number[] | null;
  };
}

export function SHAPDependence({ data }: Props) {
  return (
    <div className="space-y-2">
      {data.color_feature && (
        <p className="text-xs text-muted-foreground">
          Colored by: <span className="text-blue-400">{data.color_feature}</span>
          {" "}(auto-detected interaction feature)
        </p>
      )}
      <Plot
        data={[{
          type: "scatter",
          mode: "markers",
          x: data.feature_values,
          y: data.shap_values,
          marker: {
            size: 6,
            color: data.color_values || "rgba(96, 165, 250, 0.7)",
            colorscale: data.color_values ? "Viridis" : undefined,
            showscale: !!data.color_values,
            opacity: 0.75,
            colorbar: data.color_values ? {
              title: data.color_feature || "",
              thickness: 12,
              tickfont: { color: "#94a3b8", size: 10 },
              titlefont: { color: "#94a3b8", size: 11 },
            } : undefined,
          },
        }]}
      layout={{
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        font: { color: "#1e293b", size: 12 },
        title: {
          text: `SHAP Dependence Plot — ${data.feature}`,
          font: { color: "#0f172a", size: 16 },
          x: 0.5,
          xanchor: "center",
        },
        margin: { l: 60, r: 80, t: 60, b: 60 },
        xaxis: {
          title: data.feature,
          gridcolor: "#e2e8f0",
          zerolinecolor: "#cbd5e1",
        },
        yaxis: {
          title: `SHAP value for ${data.feature}`,
          gridcolor: "#e2e8f0",
          zerolinecolor: "#94a3b8",
          zeroline: true,
        },
        height: 420,
      }}
        config={getPlotConfig(`shap_dependence_${data.feature}`)}
        style={{ width: "100%" }}
      />
    </div>
  );
}