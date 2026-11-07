"use client";

import dynamic from "next/dynamic";
import { getPlotConfig } from "@/lib/plotConfig";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface WaterfallItem {
  feature: string;
  shap_value: number;
  feature_value: number;
}

interface Props {
  data: {
    base_value: number;
    waterfall: WaterfallItem[];
    prediction_shap_sum: number;
    row_index: number;
  };
}

export function SHAPWaterfall({ data }: Props) {
  const top    = data.waterfall.slice(0, 12);
  const labels = top.map((d) => `${d.feature} = ${d.feature_value.toFixed(2)}`);
  const values = top.map((d) => d.shap_value);
  const colors = values.map((v) =>
    v > 0 ? "rgba(248, 113, 113, 0.85)" : "rgba(96, 165, 250, 0.85)"
  );
  const finalPred = data.base_value + data.prediction_shap_sum;

  return (
    <div className="space-y-3">
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Base value: </span>
          <span className="font-mono font-medium">{data.base_value.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Prediction: </span>
          <span className="font-mono font-medium text-blue-400">{finalPred.toFixed(4)}</span>
        </div>
      </div>

      <Plot
        data={[{
          type: "bar",
          orientation: "h",
          x: values,
          y: labels,
          marker: { color: colors },
          text: values.map((v) => (v > 0 ? `+${v.toFixed(4)}` : v.toFixed(4))),
          textposition: "outside",
          textfont: { color: "#94a3b8", size: 11 },
        }]}
      layout={{
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        font: { color: "#1e293b", size: 11 },
        title: {
          text: "SHAP Waterfall Plot (Local Explanation)",
          font: { color: "#0f172a", size: 16 },
          x: 0.5,
          xanchor: "center",
        },
        margin: { l: 220, r: 80, t: 60, b: 40 },
        xaxis: {
          title: "SHAP value",
          gridcolor: "#e2e8f0",
          zerolinecolor: "#94a3b8",
          zeroline: true,
        },
        yaxis: { gridcolor: "#e2e8f0" },
        height: 400,
      }}
        config={getPlotConfig("shap_waterfall")}
        style={{ width: "100%" }}
      />
      <p className="text-xs text-muted-foreground">
        Red = pushes prediction higher · Blue = pushes prediction lower
      </p>
    </div>
  );
}