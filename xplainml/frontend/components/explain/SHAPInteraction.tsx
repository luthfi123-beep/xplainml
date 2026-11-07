"use client";

import dynamic from "next/dynamic";
import { getPlotConfig } from "@/lib/plotConfig";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface MatrixCell {
  feature_i: string;
  feature_j: string;
  value: number;
}

interface TopInteraction {
  feature_i: string;
  feature_j: string;
  value: number;
}

interface Props {
  data: {
    matrix: MatrixCell[];
    top_interactions: TopInteraction[];
    feature_names: string[];
    n_samples: number;
  };
}

export function SHAPInteraction({ data }: Props) {
  const { feature_names, matrix, top_interactions } = data;
  const n = feature_names.length;

  const z: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  matrix.forEach((cell) => {
    const i = feature_names.indexOf(cell.feature_i);
    const j = feature_names.indexOf(cell.feature_j);
    if (i >= 0 && j >= 0) z[i][j] = cell.value;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          Computed on {data.n_samples} samples.
          Diagonal = main effect. Off-diagonal = interaction between two features.
        </p>
        <Plot
          data={[{
            type: "heatmap",
            z,
            x: feature_names,
            y: feature_names,
            colorscale: [
              [0,    "#0f172a"],
              [0.15, "#1e3a5f"],
              [0.35, "#1d4ed8"],
              [0.55, "#3b82f6"],
              [0.75, "#93c5fd"],
              [1.0,  "#ffffff"],
            ],
            showscale: true,
            hoverongaps: false,
            colorbar: {
              title: "Mean |SHAP interaction|",
              thickness: 12,
              tickfont: { color: "#94a3b8", size: 10 },
              titlefont: { color: "#94a3b8", size: 11 },
            },
          }]}
          layout={{
            paper_bgcolor: "#ffffff",
            plot_bgcolor:  "#ffffff",
            font:  { color: "#1e293b", size: 10 },
            title: {
              text: "SHAP Interaction Values Heatmap",
              font: { color: "#0f172a", size: 16 },
              x: 0.5,
              xanchor: "center",
            },
            margin: { l: 120, r: 80, t: 60, b: 120 },
            xaxis: { tickangle: -45, gridcolor: "#e2e8f0" },
            yaxis: { gridcolor: "#e2e8f0" },
            height: 480,
          }}
          config={getPlotConfig("shap_interaction_heatmap")}
          style={{ width: "100%" }}
        />
      </div>

      {/* Top interactions bar chart */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          Top Feature Interactions (off-diagonal)
        </h3>
        <Plot
          data={[{
            type: "bar",
            orientation: "h",
            x: top_interactions.slice(0, 10).map((d) => d.value).reverse(),
            y: top_interactions.slice(0, 10)
              .map((d) => `${d.feature_i} × ${d.feature_j}`)
              .reverse(),
            marker: { color: "rgba(167, 139, 250, 0.8)" },
          }]}
          layout={{
            paper_bgcolor: "#ffffff",
            plot_bgcolor:  "#ffffff",
            font: { color: "#1e293b", size: 11 },
            title: {
              text: "Top Feature Interaction Ranking",
              font: { color: "#0f172a", size: 16 },
              x: 0.5,
              xanchor: "center",
            },
            margin: { l: 200, r: 20, t: 60, b: 40 },
            xaxis: {
              title: "Mean |SHAP interaction value|",
              gridcolor: "#e2e8f0",
              zerolinecolor: "#cbd5e1",
            },
            yaxis: { gridcolor: "#e2e8f0" },
            height: 360,
          }}
          config={getPlotConfig("shap_interaction_ranking")}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}