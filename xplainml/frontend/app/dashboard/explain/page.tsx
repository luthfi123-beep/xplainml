"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, BarChart3, User, GitBranch, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { explainApi } from "@/lib/api";
import { SHAPBarPlot } from "@/components/explain/SHAPBarPlot";
import { SHAPBeeswarm } from "@/components/explain/SHAPBeeswarm";
import { SHAPWaterfall } from "@/components/explain/SHAPWaterfall";
import { SHAPDependence } from "@/components/explain/SHAPDependence";
import { EmptyState } from "@/components/EmptyState";
import { PredictForm } from "@/components/explain/PredictForm";
import { SHAPInteraction } from "@/components/explain/SHAPInteraction";

const MODEL_LABELS: Record<string, string> = {
  logistic_regression: "Logistic Regression",
  decision_tree: "Decision Tree",
  random_forest: "Random Forest",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
};

export default function ExplainPage() {
  const router = useRouter();
  const { dataset, trainResults, bestModelId } = useAppStore();

  const successfulModels = trainResults.filter((r) => r.status === "success");
  const [selectedModel, setSelectedModel] = useState(bestModelId || successfulModels[0]?.model_id || "");
  const [globalData, setGlobalData]       = useState<any>(null);
  const [localData, setLocalData]         = useState<any>(null);
  const [dependenceData, setDependenceData] = useState<any>(null);
  const [rowIndex, setRowIndex]           = useState(0);
  const [depFeature1, setDepFeature1]     = useState("");
  const [depFeature2, setDepFeature2]     = useState("");
  const [loading, setLoading]             = useState<string | null>(null);

  if (successfulModels.length === 0) {
    return (
      <EmptyState
        title="No trained models"
        description="Train at least one model before running SHAP explanations."
        actionLabel="Go to Training"
        actionHref="/dashboard/train"
      />
    );
  }

  const runGlobal = async () => {
    if (!dataset.session_id || !selectedModel) return;
    setLoading("global");
    try {
      const data = await explainApi.global(dataset.session_id, selectedModel);
      setGlobalData(data);
      if (data.feature_importance?.[0]) {
        setDepFeature1(data.feature_importance[0].feature);
      }
      toast.success("Global explanation computed.");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "SHAP computation failed.");
    } finally {
      setLoading(null);
    }
  };

  const runLocal = async () => {
    if (!dataset.session_id || !selectedModel) return;
    if (!globalData) { toast.error("Run global explanation first."); return; }
    setLoading("local");
    try {
      const data = await explainApi.local(dataset.session_id, selectedModel, rowIndex);
      setLocalData(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Local explanation failed.");
    } finally {
      setLoading(null);
    }
  };

  const runDependence = async () => {
    if (!dataset.session_id || !selectedModel || !depFeature1) return;
    if (!globalData) { toast.error("Run global explanation first."); return; }
    setLoading("dependence");
    try {
      const data = await explainApi.dependence(
        dataset.session_id,
        selectedModel,
        depFeature1,
        depFeature2 || undefined
      );
      setDependenceData(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Dependence plot failed.");
    } finally {
      setLoading(null);
    }
  };

    const runInteraction = async () => {
    if (!dataset.session_id || !selectedModel) return;
    if (!globalData) {
      toast.error("Run global explanation first.");
      return;
    }
    const treeModels = ["random_forest", "xgboost", "lightgbm", "decision_tree"];
    if (!treeModels.includes(selectedModel)) {
      toast.error("Interaction values only available for tree-based models.");
      return;
    }
    setLoadingInteraction(true);
    try {
      const data = await explainApi.interaction(dataset.session_id, selectedModel);
      setInteractionData(data);
      toast.success("Interaction values computed.");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Interaction computation failed.");
    } finally {
      setLoadingInteraction(false);
    }
  };

  const featureNames = globalData?.feature_importance?.map((f: any) => f.feature) || [];
    const [interactionData, setInteractionData] = useState<any>(null);
  const [loadingInteraction, setLoadingInteraction] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">SHAP Explainability</h1>
        <p className="text-muted-foreground">
          Understand what drives your model's predictions — globally and per sample.
        </p>
      </div>

      {/* Model selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Model to Explain</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4 flex-wrap">
          <Select
            value={selectedModel}
            onValueChange={(v) => {
              setSelectedModel(v);
              setGlobalData(null);
              setLocalData(null);
              setDependenceData(null);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select model..." />
            </SelectTrigger>
            <SelectContent>
              {successfulModels.map((r) => (
                <SelectItem key={r.model_id} value={r.model_id}>
                  {MODEL_LABELS[r.model_id]}
                  {r.model_id === bestModelId ? " ⭐" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={runGlobal}
            disabled={loading !== null || !selectedModel}
            className="gap-2"
          >
            {loading === "global" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Computing SHAP...</>
            ) : (
              <><BarChart3 className="w-4 h-4" /> Compute Global SHAP</>
            )}
          </Button>

          {loading === "global" && (
            <p className="text-xs text-muted-foreground">
              This may take 10–30 seconds depending on dataset size.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs — only show after global SHAP computed */}
      {globalData && (
        <Tabs defaultValue="bar">
          <TabsList className="grid grid-cols-5 w-full max-w-xl">
            <TabsTrigger value="bar">Bar Plot</TabsTrigger>
            <TabsTrigger value="beeswarm">Beeswarm</TabsTrigger>
            <TabsTrigger value="local">Local</TabsTrigger>
            <TabsTrigger value="dependence">Dependence</TabsTrigger>
            <TabsTrigger value="interaction">Interaction</TabsTrigger>
            <TabsTrigger value="predict">Predict</TabsTrigger>
          </TabsList>

          {/* Bar plot */}
          <TabsContent value="bar" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" /> Global Feature Importance
                </CardTitle>
                <CardDescription>
                  Mean absolute SHAP value per feature — higher = more influential
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SHAPBarPlot data={globalData.feature_importance} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Beeswarm */}
          <TabsContent value="beeswarm" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>SHAP Beeswarm Plot</CardTitle>
                <CardDescription>
                  Each dot is one sample. Color = feature value. X-axis = SHAP impact.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SHAPBeeswarm data={globalData.beeswarm_data} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Local */}
          <TabsContent value="local" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" /> Local Explanation (Single Sample)
                </CardTitle>
                <CardDescription>
                  Why did the model predict this specific sample this way?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Sample Index</label>
                    <input
                      type="number"
                      min={0}
                      max={globalData.n_samples - 1}
                      value={rowIndex}
                      onChange={(e) => setRowIndex(parseInt(e.target.value) || 0)}
                      className="w-28 h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <p className="text-xs text-muted-foreground">
                      0 – {globalData.n_samples - 1}
                    </p>
                  </div>
                  <Button
                    onClick={runLocal}
                    disabled={loading !== null}
                    variant="outline"
                    className="mt-4 gap-2"
                  >
                    {loading === "local" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    Explain Sample
                  </Button>
                </div>
                {localData && <SHAPWaterfall data={localData} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dependence */}
          <TabsContent value="dependence" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" /> SHAP Dependence Plot
                </CardTitle>
                <CardDescription>
                  How does one feature's value affect its SHAP impact?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Primary Feature</label>
                    <Select value={depFeature1} onValueChange={setDepFeature1}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select feature..." />
                      </SelectTrigger>
                      <SelectContent>
                        {featureNames.map((f: string) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Color by (optional)</label>
                    <Select value={depFeature2} onValueChange={setDepFeature2}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Auto-detect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Auto-detect</SelectItem>
                        {featureNames
                          .filter((f: string) => f !== depFeature1)
                          .map((f: string) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={runDependence}
                    disabled={loading !== null || !depFeature1}
                    variant="outline"
                    className="mt-4 gap-2"
                  >
                    {loading === "dependence" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <GitBranch className="w-4 h-4" />
                    )}
                    Generate Plot
                  </Button>
                </div>
                {dependenceData && <SHAPDependence data={dependenceData} />}
              </CardContent>
            </Card>
          </TabsContent>
          
                    {/* Interaction */}
          <TabsContent value="interaction" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" /> SHAP Interaction Values
                </CardTitle>
                <CardDescription>
                  Pairwise feature interactions — how much two features jointly influence predictions.
                  Only available for tree-based models.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={runInteraction}
                  disabled={loadingInteraction || loading !== null}
                  variant="outline"
                  className="gap-2"
                >
                  {loadingInteraction ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Computing (may take ~30s)...</>
                  ) : (
                    <><GitBranch className="w-4 h-4" /> Compute Interaction Values</>
                  )}
                </Button>
                {interactionData && <SHAPInteraction data={interactionData} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Predict */}
          <TabsContent value="predict" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Predict New Sample
                </CardTitle>
                <CardDescription>
                  Input feature values manually and get a prediction with SHAP explanation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PredictForm
                  sessionId={dataset.session_id!}
                  modelId={selectedModel}
                  featureNames={featureNames}
                  hasShap={!!globalData}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {globalData && (
        <div className="flex justify-end">
          <Button onClick={() => router.push("/dashboard/export")} className="gap-2">
            Continue to Export →
          </Button>
        </div>
      )}
    </div>
  );
}