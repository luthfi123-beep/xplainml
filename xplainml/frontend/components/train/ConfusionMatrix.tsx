"use client";

import dynamic from "next/dynamic";
import { getPlotConfig } from "@/lib/plotConfig";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const MODEL_LABELS: Record<string, string> = {
  logistic_regression: "Logistic Regression",
  decision_tree:       "Decision Tree",
  random_forest:       "Random Forest",
  xgboost:             "XGBoost",
  lightgbm:            "LightGBM",
};

export function ConfusionMatrix({
  matrix,
  modelId,
}: {
  matrix: number[][];
  modelId: string;
}) {
  const n      = matrix.length;
  const labels = Array.from({ length: n }, (_, i) => `Class ${i}`);

  // Plotly heatmap expects y reversed
  const z      = [...matrix].reverse();
  const yLabels = [...labels].reverse();

  // Annotations
  const annotations: any[] = [];
  z.forEach((row, i) => {
    row.forEach((val, j) => {
      annotations.push({
        x: labels[j],
        y: yLabels[i],
        text: String(val),
        font: { color: val > matrix.flat().reduce((a, b) => a + b, 0) / (n * n) ? "#0f172a" : "#e2e8f0", size: 14 },
        showarrow: false,
      });
    });
  });

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Model: <span className="font-medium text-foreground">{MODEL_LABELS[modelId] || modelId}</span>
      </p>
      <Plot
        data={[{
          type: "heatmap",
          z,
          x: labels,
          y: yLabels,
          colorscale: [
            [0,   "#0f172a"],
            [0.5, "#1d4ed8"],
            [1.0, "#60a5fa"],
          ],
          showscale: false,
        }]}
        layout={{
          paper_bgcolor: "#ffffff",
          plot_bgcolor:  "#ffffff",
          font:  { color: "#1e293b", size: 12 },
          title: {
            text: `Confusion Matrix — ${MODEL_LABELS[modelId] || modelId}`,
            font: { color: "#0f172a", size: 16 },
            x: 0.5,
            xanchor: "center",
          },
          margin: { l: 80, r: 20, t: 60, b: 60 },
          xaxis: {
            title: "Predicted",
            gridcolor: "#e2e8f0",
          },
          yaxis: {
            title: "Actual",
            gridcolor: "#e2e8f0",
          },
          annotations,
          height: 380,
        }}
        config={getPlotConfig(`confusion_matrix_${modelId}`)}
        style={{ width: "100%" }}
      />
      <p className="text-xs text-muted-foreground">
        Diagonal = correct predictions · Off-diagonal = misclassifications
      </p>
    </div>
  );
}