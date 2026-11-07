"use client";

// Re-export the existing train page content as a step
// Import semua yang dibutuhkan dari train page yang lama
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Plus, Trash2, BarChart2, FileBarChart, ArrowLeft, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { trainApi } from "@/lib/api";
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

interface Props { onNext: () => void; onBack: () => void; }

export default function TrainStep({ onNext, onBack }: Props) {
  const { dataset, trainResults, bestModelId, setTrainResults } = useAppStore();
  const [selectedModels, setSelectedModels] = useState([
    { model_id: "random_forest", hyperparams: DEFAULT_HYPERPARAMS["random_forest"] },
    { model_id: "xgboost",       hyperparams: DEFAULT_HYPERPARAMS["xgboost"] },
  ]);
  const [loading, setLoading]           = useState(false);
  const [selectedCM, setSelectedCM]     = useState<string | null>(null);
  const [rocData, setRocData]           = useState<any>(null);
  const [reportData, setReportData]     = useState<any>(null);
  const [activeModel, setActiveModel]   = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const handleLoadAnalysis = async (model_id: string) => {
    setActiveModel(model_id); setRocData(null); setReportData(null); setLoadingAnalysis(true);
    try {
      const [roc, report] = await Promise.all([
        trainApi.rocCurve(dataset.session_id!, model_id),
        trainApi.classificationReport(dataset.session_id!, model_id),
      ]);
      setRocData(roc); setReportData(report);
    } catch (e: any) { toast.error(e.response?.data?.detail || "Analysis failed."); }
    finally { setLoadingAnalysis(false); }
  };

  const handleTrain = async () => {
    if (!selectedModels.length) return toast.error("Select at least one model.");
    setLoading(true); setRocData(null); setReportData(null); setActiveModel(null);
    try {
      const data = await trainApi.run({ session_id: dataset.session_id, models: selectedModels });
      setTrainResults(data.results, data.best_model_id, data.is_multiclass);
      toast.success(`Done. Best: ${data.best_model_id}`);
      if (data.best_model_id) await handleLoadAnalysis(data.best_model_id);
    } catch (e: any) { toast.error(e.response?.data?.detail || "Training failed."); }
    finally { setLoading(false); }
  };

  const cmResult = trainResults.find(r => r.model_id === (activeModel || selectedCM || bestModelId));

  return (
    <div className="space-y-5">
      <div>
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 700, color: "#F5F0F2", marginBottom: 6 }}>Model Training</h2>
        <p style={{ fontSize: 13, color: "rgba(245,240,242,0.4)" }}>Select models, configure hyperparameters, compare results.</p>
      </div>

      {/* Model selector */}
      <div style={{ border: "1px solid rgba(245,240,242,0.08)", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(245,240,242,0.5)" }}>Models</span>
          <button
            onClick={() => {
              const used = selectedModels.map(m => m.model_id);
              const next = AVAILABLE_MODELS.find(m => !used.includes(m.id));
              if (next) setSelectedModels(prev => [...prev, { model_id: next.id, hyperparams: DEFAULT_HYPERPARAMS[next.id] }]);
            }}
            disabled={selectedModels.length >= 5}
            style={{ fontSize: 11, color: "#2DD4BF", background: "transparent", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            + Add Model
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {selectedModels.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid rgba(245,240,242,0.06)", borderRadius: 8 }}>
              <Select value={m.model_id} onValueChange={v => setSelectedModels(prev => prev.map((x, j) => j === i ? { model_id: v, hyperparams: DEFAULT_HYPERPARAMS[v] } : x))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(model => (
                    <SelectItem key={model.id} value={model.id} disabled={selectedModels.some((s, j) => j !== i && s.model_id === model.id)}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
                {Object.entries(m.hyperparams).map(([key, val]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <label style={{ fontSize: 9, color: "rgba(245,240,242,0.3)" }}>{key}</label>
                    <input type="number" value={val} step={key === "learning_rate" ? 0.01 : 1}
                      onChange={e => setSelectedModels(prev => prev.map((x, j) => j === i ? { ...x, hyperparams: { ...x.hyperparams, [key]: parseFloat(e.target.value) || e.target.value } } : x))}
                      style={{ width: 72, height: 28, padding: "0 8px", fontSize: 11, borderRadius: 6, border: "1px solid rgba(245,240,242,0.1)", background: "rgba(245,240,242,0.04)", color: "#F5F0F2", outline: "none" }}
                    />
                  </div>
                ))}
              </div>
              <button onClick={() => setSelectedModels(prev => prev.filter((_, j) => j !== i))} disabled={selectedModels.length === 1}
                style={{ background: "transparent", border: "none", color: "rgba(245,240,242,0.2)", cursor: "pointer", padding: 4 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Train button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={handleTrain} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#2DD4BF", border: "none", borderRadius: 8, padding: "10px 20px", color: "#080a0f", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          {loading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Training...</> : <><Play size={13} /> Train Models</>}
        </button>
      </div>

      {/* Results */}
      {trainResults.length > 0 && (
        <div className="space-y-4">
          <ModelComparisonTable results={trainResults} bestModelId={bestModelId} onSelectCM={id => { setSelectedCM(id); handleLoadAnalysis(id); }} selectedCM={activeModel || selectedCM || bestModelId} />

          {/* Analysis tabs */}
          <div style={{ border: "1px solid rgba(245,240,242,0.08)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "rgba(245,240,242,0.3)" }}>Detailed Analysis</span>
              <div style={{ display: "flex", gap: 6 }}>
                {trainResults.filter(r => r.status === "success").map(r => (
                  <button key={r.model_id}
                    onClick={() => handleLoadAnalysis(r.model_id)}
                    style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: `1px solid ${activeModel === r.model_id ? "rgba(45,212,191,0.5)" : "rgba(245,240,242,0.08)"}`, background: activeModel === r.model_id ? "rgba(45,212,191,0.1)" : "transparent", color: activeModel === r.model_id ? "#2DD4BF" : "rgba(245,240,242,0.4)", cursor: "pointer" }}>
                    {r.model_id === bestModelId ? "⭐ " : ""}{AVAILABLE_MODELS.find(m => m.id === r.model_id)?.label}
                  </button>
                ))}
              </div>
            </div>
            {loadingAnalysis ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, gap: 10 }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "#2DD4BF" }} />
                <span style={{ fontSize: 12, color: "rgba(245,240,242,0.3)" }}>Loading analysis...</span>
              </div>
            ) : activeModel ? (
              <Tabs defaultValue="roc">
                <TabsList><TabsTrigger value="roc">ROC Curve</TabsTrigger><TabsTrigger value="report">Report</TabsTrigger><TabsTrigger value="cm">Matrix</TabsTrigger></TabsList>
                <TabsContent value="roc">{rocData && <ROCCurve curves={rocData.curves} />}</TabsContent>
                <TabsContent value="report">{reportData && <ClassificationReport report={reportData.report} />}</TabsContent>
                <TabsContent value="cm">{cmResult?.metrics?.confusion_matrix && <ConfusionMatrix matrix={cmResult.metrics.confusion_matrix} modelId={activeModel} />}</TabsContent>
              </Tabs>
            ) : (
              <p style={{ fontSize: 12, color: "rgba(245,240,242,0.25)", textAlign: "center", padding: "24px 0" }}>Select a model above to view analysis.</p>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "rgba(245,240,242,0.35)", cursor: "pointer", fontSize: 12 }}>
          <ArrowLeft size={13} /> Back
        </button>
        {trainResults.length > 0 && (
          <button onClick={onNext} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 8, padding: "8px 16px", color: "#2DD4BF", cursor: "pointer", fontSize: 12 }}>
            Continue <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}