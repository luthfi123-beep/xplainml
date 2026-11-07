"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileText, Table2, Package, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { exportApi } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";


const MODEL_LABELS: Record<string, string> = {
  logistic_regression: "Logistic Regression",
  decision_tree: "Decision Tree",
  random_forest: "Random Forest",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
};

function downloadBlob(blob: Blob, filename: string) {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { dataset, trainResults, bestModelId, preprocessSummary } = useAppStore();
  const successfulModels = trainResults.filter((r) => r.status === "success");

  const [selectedModel, setSelectedModel] = useState(
    bestModelId || successfulModels[0]?.model_id || ""
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [exported, setExported] = useState<string[]>([]);

  const handleExport = async (type: "pdf" | "csv") => {
    if (!dataset.session_id || !selectedModel) {
      toast.error("No session or model selected.");
      return;
    }

    setLoading(type);
    try {
      const blob = type === "pdf"
        ? await exportApi.pdf(dataset.session_id, selectedModel)
        : await exportApi.csv(dataset.session_id, selectedModel);

      const ext      = type === "pdf" ? "pdf" : "csv";
      const filename = `xplainml_${type}_${selectedModel}.${ext}`;
      downloadBlob(blob, filename);

      setExported((prev) => [...new Set([...prev, type])]);
      toast.success(`${type.toUpperCase()} downloaded successfully.`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(null);
    }
  };

    const handleModelDownload = async () => {
    if (!dataset.session_id || !selectedModel) {
      toast.error("No session or model selected.");
      return;
    }
    setLoading("model");
    try {
      const blob     = await exportApi.model(dataset.session_id, selectedModel);
      const filename = `xplainml_${selectedModel}.joblib`;
      downloadBlob(blob, filename);
      setExported((prev) => [...new Set([...prev, "model"])]);
      toast.success("Model downloaded successfully.");
    } catch (err: any) {
      toast.error(`Export failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const selectedResult = trainResults.find((r) => r.model_id === selectedModel);

    if (successfulModels.length === 0) {
    return (
      <EmptyState
        title="Nothing to export"
        description="Complete training before exporting results."
        actionLabel="Go to Training"
        actionHref="/dashboard/train"
      />
    );
  }
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Export Report</h1>
        <p className="text-muted-foreground">
          Download your analysis as a structured PDF report or raw CSV predictions.
        </p>
      </div>

      {/* Model selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Model</CardTitle>
          <CardDescription>Choose which model's results to export</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
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

          {selectedResult?.metrics && (
            <div className="flex gap-3">
              {["accuracy", "f1"].map((m) => (
                <div key={m} className="text-sm">
                  <span className="text-muted-foreground capitalize">{m}: </span>
                  <span className="font-mono font-medium text-blue-400">
                    {((selectedResult.metrics as any)[m] * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PDF */}
        <Card className="border-border hover:border-blue-400/40 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              PDF Report
              {exported.includes("pdf") && (
                <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              Structured report with dataset summary, preprocessing config,
              model evaluation metrics, and SHAP feature importance ranking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {[
                "Dataset & preprocessing summary",
                "Model performance metrics",
                "SHAP Top-10 feature importance table",
                "Automated interpretation paragraph",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {item}
                </div>
              ))}
            </div>
            <Button
              onClick={() => handleExport("pdf")}
              disabled={loading !== null || !selectedModel}
              className="w-full gap-2"
            >
              {loading === "pdf" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
              ) : (
                <><FileDown className="w-4 h-4" /> Download PDF</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* CSV */}
        <Card className="border-border hover:border-blue-400/40 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="w-5 h-5 text-green-400" />
              CSV Predictions
              {exported.includes("csv") && (
                <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              Raw prediction results with feature values, actual labels,
              predicted labels, and correctness flag per sample.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {[
                "All feature values per test sample",
                "Actual vs predicted labels",
                "Correctness flag (1 = correct)",
                "Ready for further analysis in Excel/Python",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {item}
                </div>
              ))}
            </div>
            <Button
              onClick={() => handleExport("csv")}
              disabled={loading !== null || !selectedModel}
              variant="outline"
              className="w-full gap-2"
            >
              {loading === "csv" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Exporting CSV...</>
              ) : (
                <><FileDown className="w-4 h-4" /> Download CSV</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

              {/* Model */}
        <Card className="border-border hover:border-blue-400/40 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Model File
              {exported.includes("model") && (
                <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              Download the trained model as a .joblib file. Load it directly
              in Python with joblib for inference or further analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {[
                "Trained model object (sklearn-compatible)",
                "Feature names and order",
                "Preprocessing encoders and scaler",
                "Ready to load with joblib.load()",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  {item}
                </div>
              ))}
            </div>

            {/* Usage snippet */}
            <div className="bg-accent/30 rounded-lg p-3 text-xs font-mono text-muted-foreground">
              <p className="text-green-400 mb-1"># Load in Python</p>
              <p>import joblib</p>
              <p>bundle = joblib.load(&apos;model.joblib&apos;)</p>
              <p>model  = bundle[&apos;model&apos;]</p>
              <p>feats  = bundle[&apos;feature_names&apos;]</p>
            </div>

            <Button
              onClick={handleModelDownload}
              disabled={loading !== null || !selectedModel}
              variant="outline"
              className="w-full gap-2 border-purple-400/30 hover:border-purple-400/60"
            >
              {loading === "model" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
              ) : (
                <><FileDown className="w-4 h-4" /> Download .joblib</>
              )}
            </Button>
          </CardContent>
        </Card>

      {/* Session summary */}
      <Card className="bg-accent/20">
        <CardHeader>
          <CardTitle className="text-base">Session Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Dataset</p>
            <p className="font-medium truncate">{dataset.filename || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Rows</p>
            <p className="font-medium">{dataset.n_rows?.toLocaleString() || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Models trained</p>
            <p className="font-medium">{successfulModels.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Best model</p>
            <p className="font-medium">
              {bestModelId ? MODEL_LABELS[bestModelId] : "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}