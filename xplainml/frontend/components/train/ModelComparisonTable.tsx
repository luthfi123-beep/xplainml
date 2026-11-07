import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrainResult } from "@/types";
import { Trophy } from "lucide-react";

const MODEL_LABELS: Record<string, string> = {
  logistic_regression: "Logistic Regression",
  decision_tree: "Decision Tree",
  random_forest: "Random Forest",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
};

const METRICS = ["accuracy", "precision", "recall", "f1", "roc_auc"] as const;

interface Props {
  results: TrainResult[];
  bestModelId: string | null;
  selectedCM: string | null;
  onSelectCM: (modelId: string) => void;
}

export function ModelComparisonTable({ results, bestModelId, selectedCM, onSelectCM }: Props) {
  const successful = results.filter((r) => r.status === "success");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Model Comparison
          {bestModelId && (
            <Badge className="bg-yellow-400/20 text-yellow-400 border-yellow-400/30 gap-1">
              <Trophy className="w-3 h-3" /> Best: {MODEL_LABELS[bestModelId]}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-3 pr-4">Model</th>
                {METRICS.map((m) => (
                  <th key={m} className="text-right py-3 px-3 capitalize">
                    {m.replace("_", " ")}
                  </th>
                ))}
                <th className="text-right py-3 pl-3">Confusion Matrix</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.model_id}
                  className={`border-b border-border/50 transition-colors ${
                    r.model_id === bestModelId ? "bg-yellow-400/5" : "hover:bg-accent/30"
                  }`}
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      {r.model_id === bestModelId && (
                        <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                      )}
                      <span className="font-medium">{MODEL_LABELS[r.model_id]}</span>
                      {r.status === "error" && (
                        <Badge variant="destructive" className="text-xs">Error</Badge>
                      )}
                    </div>
                  </td>
                  {METRICS.map((metric) => (
                    <td key={metric} className="text-right py-3 px-3">
                      {r.metrics ? (
                        <MetricCell
                          value={r.metrics[metric]}
                          isBest={r.model_id === bestModelId && metric === "f1"}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {r.error?.slice(0, 30)}...
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="text-right py-3 pl-3">
                    {r.status === "success" && (
                      <Button
                        variant={selectedCM === r.model_id ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => onSelectCM(r.model_id)}
                      >
                        View
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {successful.length === 0 && (
          <p className="text-center text-muted-foreground py-6">
            No models trained successfully.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCell({ value, isBest }: { value: number | null; isBest: boolean }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const pct = (value * 100).toFixed(1);
  return (
    <span className={`font-mono ${isBest ? "text-yellow-400 font-bold" : ""}`}>
      {pct}%
    </span>
  );
}