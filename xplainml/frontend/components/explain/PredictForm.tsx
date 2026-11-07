"use client";

import { useState } from "react";
import { Loader2, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { explainApi } from "@/lib/api";

interface Props {
  sessionId: string;
  modelId: string;
  featureNames: string[];
  hasShap: boolean;
}

export function PredictForm({ sessionId, modelId, featureNames, hasShap }: Props) {
  const [inputs, setInputs]   = useState<Record<string, string>>({});
  const [result, setResult]   = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    if (!hasShap) {
      toast.error("Run Global SHAP first to enable prediction explanation.");
      return;
    }

    // Parse inputs — default to 0 if empty
    const input_data: Record<string, number> = {};
    featureNames.forEach((f) => {
      input_data[f] = parseFloat(inputs[f] || "0") || 0;
    });

    setLoading(true);
    try {
      const data = await explainApi.predict(sessionId, modelId, input_data);
      setResult(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInputs({});
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {!hasShap && (
        <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-lg px-4 py-3">
          <Zap className="w-4 h-4 shrink-0" />
          Run Global SHAP first (on the Bar Plot tab) to enable SHAP explanation for predictions.
        </div>
      )}

      {/* Input form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input Feature Values</CardTitle>
          <CardDescription>
            Enter values for each feature. Leave blank to use 0 as default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {featureNames.map((feat) => (
              <div key={feat} className="space-y-1">
                <label className="text-xs text-muted-foreground font-mono truncate block">
                  {feat}
                </label>
                <input
                  type="number"
                  value={inputs[feat] || ""}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [feat]: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full h-8 px-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={handlePredict}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Predicting...</>
              ) : (
                <><Zap className="w-4 h-4" /> Predict</>
              )}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={loading}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Prediction output */}
          <Card className="border-blue-400/30 bg-blue-400/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Prediction</p>
                  <div className="flex items-center gap-2">
                    <span className="text-4xl font-bold text-blue-400">
                      Class {result.prediction}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 flex-wrap">
                  {Object.entries(result.probabilities).map(([cls, prob]: [string, any]) => (
                    <div key={cls} className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">P(Class {cls})</p>
                      <div className="relative w-16 h-16">
                        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                          <circle
                            cx="18" cy="18" r="15.9"
                            fill="none"
                            stroke="#1e293b"
                            strokeWidth="3"
                          />
                          <circle
                            cx="18" cy="18" r="15.9"
                            fill="none"
                            stroke={parseInt(cls) === result.prediction ? "#60a5fa" : "#475569"}
                            strokeWidth="3"
                            strokeDasharray={`${prob * 100} 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold">
                          {(prob * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SHAP contribution */}
          {result.shap_contrib.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Feature Contributions (SHAP)</CardTitle>
                <CardDescription>
                  Why did the model predict Class {result.prediction} for this input?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.shap_contrib.slice(0, 10).map((item: any) => {
                    const isPositive = item.shap_value > 0;
                    const maxVal     = Math.max(
                      ...result.shap_contrib.map((d: any) => Math.abs(d.shap_value))
                    );
                    const width = maxVal > 0
                      ? Math.abs(item.shap_value) / maxVal * 100
                      : 0;

                    return (
                      <div key={item.feature} className="flex items-center gap-3 text-sm">
                        {/* Feature name + value */}
                        <div className="w-48 shrink-0 flex items-center gap-2">
                          {isPositive ? (
                            <TrendingUp className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          )}
                          <span className="font-mono text-xs truncate">{item.feature}</span>
                        </div>

                        {/* Feature value */}
                        <span className="text-xs text-muted-foreground w-16 shrink-0 font-mono">
                          = {item.feature_value}
                        </span>

                        {/* Bar */}
                        <div className="flex-1 h-5 bg-accent/30 rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-all ${
                              isPositive ? "bg-red-400/70" : "bg-blue-400/70"
                            }`}
                            style={{ width: `${width}%` }}
                          />
                        </div>

                        {/* SHAP value */}
                        <span className={`text-xs font-mono w-20 text-right shrink-0 ${
                          isPositive ? "text-red-400" : "text-blue-400"
                        }`}>
                          {isPositive ? "+" : ""}{item.shap_value.toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Red = pushes toward predicted class · Blue = pushes away
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}