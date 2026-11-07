"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileText, Table2, Package, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { exportApi } from "@/lib/api";

const MODEL_LABELS: Record<string, string> = {
  logistic_regression: "Logistic Regression",
  decision_tree: "Decision Tree",
  random_forest: "Random Forest",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface Props { onNext: () => void; onBack: () => void; }

export default function ExportStep({ onBack }: Props) {
  const { dataset, trainResults, bestModelId } = useAppStore();
  const successfulModels = trainResults.filter(r => r.status === "success");
  const [selectedModel, setSelectedModel] = useState(bestModelId || successfulModels[0]?.model_id || "");
  const [loading, setLoading]   = useState<string | null>(null);
  const [exported, setExported] = useState<string[]>([]);

  const handleExport = async (type: "pdf" | "csv" | "model") => {
    if (!dataset.session_id || !selectedModel) { toast.error("No session or model."); return; }
    setLoading(type);
    try {
      let blob: Blob;
      let filename: string;
      if (type === "pdf")   { blob = await exportApi.pdf(dataset.session_id, selectedModel);   filename = `xplainml_report_${selectedModel}.pdf`; }
      else if (type === "csv") { blob = await exportApi.csv(dataset.session_id, selectedModel); filename = `xplainml_predictions_${selectedModel}.csv`; }
      else                  { blob = await exportApi.model(dataset.session_id, selectedModel); filename = `xplainml_${selectedModel}.joblib`; }
      downloadBlob(blob, filename);
      setExported(prev => [...new Set([...prev, type])]);
      toast.success(`${type.toUpperCase()} downloaded.`);
    } catch (e: any) { toast.error(e.response?.data?.detail || "Export failed."); }
    finally { setLoading(null); }
  };

  const exports = [
    { id: "pdf",   label: "PDF Report",      icon: FileText, color: "#3b82f6", desc: "Dataset summary, metrics, SHAP table, interpretation." },
    { id: "csv",   label: "CSV Predictions", icon: Table2,   color: "#10b981", desc: "Actual vs predicted, correctness flag per sample." },
    { id: "model", label: "Model (.joblib)", icon: Package,  color: "#8b5cf6", desc: "Trained model + feature names + encoders." },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 700, color: "#F5F0F2", marginBottom: 6 }}>Export</h2>
        <p style={{ fontSize: 13, color: "rgba(245,240,242,0.4)" }}>Download your analysis results.</p>
      </div>

      {/* Model selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select model..." /></SelectTrigger>
          <SelectContent>{successfulModels.map(r => <SelectItem key={r.model_id} value={r.model_id}>{MODEL_LABELS[r.model_id]}{r.model_id === bestModelId ? " ⭐" : ""}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Export cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {exports.map(exp => {
          const Icon = exp.icon;
          const done = exported.includes(exp.id);
          return (
            <div key={exp.id} style={{ border: `1px solid ${done ? exp.color + "33" : "rgba(245,240,242,0.07)"}`, borderRadius: 12, padding: 20, background: done ? exp.color + "08" : "rgba(245,240,242,0.02)", transition: "all 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: exp.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} color={exp.color} />
                </div>
                {done && <CheckCircle2 size={15} color="#10b981" />}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F0F2", marginBottom: 4 }}>{exp.label}</p>
              <p style={{ fontSize: 11, color: "rgba(245,240,242,0.3)", lineHeight: 1.5, marginBottom: 16 }}>{exp.desc}</p>
              <button
                onClick={() => handleExport(exp.id as any)}
                disabled={loading !== null || !selectedModel}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: `1px solid ${exp.color}44`, borderRadius: 7, padding: "8px", color: exp.color, cursor: "pointer", fontSize: 11, fontWeight: 500, transition: "all 0.2s", opacity: loading !== null ? 0.5 : 1 }}
                onMouseEnter={e => e.currentTarget.style.background = exp.color + "10"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {loading === exp.id ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Exporting...</> : <><FileDown size={12} /> Download</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Session summary */}
      <div style={{ borderTop: "1px solid rgba(245,240,242,0.06)", paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[["Dataset", dataset.filename || "—"], ["Rows", dataset.n_rows?.toLocaleString() || "—"], ["Models", String(successfulModels.length)], ["Best", bestModelId ? MODEL_LABELS[bestModelId] : "—"]].map(([label, val]) => (
          <div key={label}>
            <p style={{ fontSize: 10, color: "rgba(245,240,242,0.25)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#F5F0F2" }}>{val}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "rgba(245,240,242,0.35)", cursor: "pointer", fontSize: 12 }}>
          <ArrowLeft size={13} /> Back
        </button>
      </div>
    </div>
  );
}