"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, Plus, Trash2, BarChart2, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { trainApi } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { ModelComparisonTable } from "@/components/train/ModelComparisonTable";
import { ConfusionMatrix } from "@/components/train/ConfusionMatrix";
import { ROCCurve } from "@/components/train/ROCCurve";
import { ClassificationReport } from "@/components/train/ClassificationReport";

const AVAILABLE_MODELS = [
  { id: "logistic_regression", label: "Logistic Regression" },
  { id: "decision_tree",       label: "Decision Tree" },
  { id: "random_forest",       label: "Random Forest" },
  { id: "xgboost",             label: "XGBoost" },
  { id: "lightgbm",            label: "LightGBM" },
];

const DEFAULT_HYPERPARAMS: Record<string, Record<string, any>> = {
  logistic_regression: { C: 1.0, max_iter: 1000 },
  decision_tree:       { max_depth: 5, min_samples_split: 2 },
  random_forest:       { n_estimators: 100, max_depth: 10 },
  xgboost:             { n_estimators: 100, max_depth: 6, learning_rate: 0.1 },
  lightgbm:            { n_estimators: 100, max_depth: -1, learning_rate: 0.1 },
};

interface SelectedModel {
  model_id: string;
  hyperparams: Record<string, any>;
}

export default function TrainPage() {
  const router = useRouter();
  const { dataset, preprocessSummary, trainResults, bestModelId, setTrainResults } = useAppStore();

  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([
    { model_id: "random_forest", hyperparams: DEFAULT_HYPERPARAMS["random_forest"] },
    { model_id: "xgboost",       hyperparams: DEFAULT_HYPERPARAMS["xgboost"] },
  ]);
  const [loading, setLoading]             = useState(false);
  const [selectedCM, setSelectedCM]       = useState<string | null>(null);
  const [rocData, setRocData]             = useState<any>(null);
  const [reportData, setReportData]       = useState<any>(null);
  const [activeModel, setActiveModel]     = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  if (!dataset.session_id || !preprocessSummary) {
    return (
      <EmptyState
        title="Preprocessing required"
        description="Complete the preprocessing step before training models."
        actionLabel="Go to Preprocessing"
        actionHref="/dashboard/preprocess"
      />
    );
  }

  const addModel = () => {
    const used = selectedModels.map((m) => m.model_id);
    const next = AVAILABLE_MODELS.find((m) => !used.includes(m.id));
    if (!next) return toast.error("All models already added.");
    setSelectedModels((prev) => [
      ...prev,
      { model_id: next.id, hyperparams: DEFAULT_HYPERPARAMS[next.id] },
    ]);
  };

  const removeModel = (index: number) => {
    setSelectedModels((prev) => prev.filter((_, i) => i !== index));
  };

  const updateModelId = (index: number, model_id: string) => {
    setSelectedModels((prev) =>
      prev.map((m, i) =>
        i === index ? { model_id, hyperparams: DEFAULT_HYPERPARAMS[model_id] } : m
      )
    );
  };

  const updateHyperparam = (index: number, key: string, value: any) => {
    setSelectedModels((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, hyperparams: { ...m.hyperparams, [key]: value } } : m
      )
    );
  };

  const handleLoadAnalysis = async (model_id: string) => {
    setActiveModel(model_id);
    setRocData(null);
    setReportData(null);
    setLoadingAnalysis(true);
    try {
      const [roc, report] = await Promise.all([
        trainApi.rocCurve(dataset.session_id!, model_id),
        trainApi.classificationReport(dataset.session_id!, model_id),
      ]);
      setRocData(roc);
      setReportData(report);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Analysis failed.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleTrain = async () => {
    if (selectedModels.length === 0) return toast.error("Select at least one model.");
    setLoading(true);
    setRocData(null);
    setReportData(null);
    setActiveModel(null);
    try {
      const data = await trainApi.run({
        session_id: dataset.session_id,
        models: selectedModels,
      });
      setTrainResults(data.results, data.best_model_id, data.is_multiclass);
      toast.success(`Training complete. Best: ${data.best_model_id}`);

      // Auto-load analysis for best model
      if (data.best_model_id) {
        await handleLoadAnalysis(data.best_model_id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Training failed.");
    } finally {
      setLoading(false);
    }
  };

  const cmResult = trainResults.find(
    (r) => r.model_id === (activeModel || selectedCM || bestModelId)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Model Training</h1>
        <p className="text-muted-foreground">
          Select models, configure hyperparameters, and compare results.
        </p>
      </div>

      {/* Model selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Models</CardTitle>
              <CardDescription>Add up to 5 models to train simultaneously</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addModel}
              disabled={selectedModels.length >= 5}
              className="gap-2"
            >
              <Plus className="w-4 h-4" /> Add Model
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedModels.map((m, i) => (
            <div key={i} className="flex items-start gap-4 p-4 border border-border rounded-lg">
              <div className="w-48 shrink-0">
                <Select value={m.model_id} onValueChange={(v) => updateModelId(i, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((model) => (
                      <SelectItem
                        key={model.id}
                        value={model.id}
                        disabled={selectedModels.some((s, j) => j !== i && s.model_id === model.id)}
                      >
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-3 flex-1">
                {Object.entries(m.hyperparams).map(([key, val]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">{key}</label>
                    <input
                      type="number"
                      value={val}
                      step={key === "learning_rate" ? 0.01 : 1}
                      onChange={(e) =>
                        updateHyperparam(i, key, parseFloat(e.target.value) || e.target.value)
                      }
                      className="w-24 h-8 px-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeModel(i)}
                disabled={selectedModels.length === 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Train button */}
      <div className="flex justify-end">
        <Button onClick={handleTrain} disabled={loading} size="lg" className="gap-2 min-w-40">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Training...</>
          ) : (
            <><Play className="w-4 h-4" /> Train Models</>
          )}
        </Button>
      </div>

      {/* Results */}
      {trainResults.length > 0 && (
        <div className="space-y-6">
          <ModelComparisonTable
            results={trainResults}
            bestModelId={bestModelId}
            onSelectCM={(id) => {
              setSelectedCM(id);
              handleLoadAnalysis(id);
            }}
            selectedCM={activeModel || selectedCM || bestModelId}
          />

          {/* Detailed Analysis */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Detailed Analysis</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {trainResults
                    .filter((r) => r.status === "success")
                    .map((r) => (
                      <Button
                        key={r.model_id}
                        variant={activeModel === r.model_id ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => handleLoadAnalysis(r.model_id)}
                        disabled={loadingAnalysis}
                      >
                        {r.model_id === bestModelId ? "⭐ " : ""}
                        {AVAILABLE_MODELS.find((m) => m.id === r.model_id)?.label}
                      </Button>
                    ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!activeModel ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a model above to view detailed analysis.
                </p>
              ) : loadingAnalysis ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  <span className="text-muted-foreground">Loading analysis...</span>
                </div>
              ) : (
                <Tabs defaultValue="roc">
                  <TabsList>
                    <TabsTrigger value="roc" className="gap-2">
                      <BarChart2 className="w-4 h-4" /> ROC Curve
                    </TabsTrigger>
                    <TabsTrigger value="report" className="gap-2">
                      <FileBarChart className="w-4 h-4" /> Classification Report
                    </TabsTrigger>
                    <TabsTrigger value="cm">Confusion Matrix</TabsTrigger>
                  </TabsList>

                  <TabsContent value="roc" className="mt-4">
                    {rocData ? (
                      <ROCCurve curves={rocData.curves} />
                    ) : (
                      <p className="text-muted-foreground text-sm py-8 text-center">
                        No ROC data available.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="report" className="mt-4">
                    {reportData ? (
                      <ClassificationReport report={reportData.report} />
                    ) : (
                      <p className="text-muted-foreground text-sm py-8 text-center">
                        No report data available.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="cm" className="mt-4">
                    {cmResult?.metrics?.confusion_matrix ? (
                      <ConfusionMatrix
                        matrix={cmResult.metrics.confusion_matrix}
                        modelId={activeModel}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm py-8 text-center">
                        No confusion matrix available.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => router.push("/dashboard/explain")} className="gap-2">
              Continue to Explainability →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}