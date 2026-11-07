"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, BarChart3, User, GitBranch, ArrowLeft, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { explainApi } from "@/lib/api";
import { SHAPBarPlot } from "@/components/explain/SHAPBarPlot";
import { SHAPBeeswarm } from "@/components/explain/SHAPBeeswarm";
import { SHAPWaterfall } from "@/components/explain/SHAPWaterfall";
import { SHAPDependence } from "@/components/explain/SHAPDependence";
import { SHAPInteraction } from "@/components/explain/SHAPInteraction";
import { PredictForm } from "@/components/explain/PredictForm";

const MODEL_LABELS: Record<string, string> = {
  logistic_regression: "Logistic Regression",
  decision_tree:       "Decision Tree",
  random_forest:       "Random Forest",
  xgboost:             "XGBoost",
  lightgbm:            "LightGBM",
};

// Wrapper dengan explicit height agar Plotly bisa render
function PlotWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: 320, position: "relative" }}>
      {children}
    </div>
  );
}

interface Props { onNext: () => void; onBack: () => void; }

export default function ExplainStep({ onNext, onBack }: Props) {
  const { dataset, trainResults, bestModelId } = useAppStore();
  const successfulModels = trainResults.filter(r => r.status === "success");

  const [selectedModel, setSelectedModel]     = useState(bestModelId || successfulModels[0]?.model_id || "");
  const [globalData, setGlobalData]           = useState<any>(null);
  const [localData, setLocalData]             = useState<any>(null);
  const [dependenceData, setDependenceData]   = useState<any>(null);
  const [interactionData, setInteractionData] = useState<any>(null);
  const [rowIndex, setRowIndex]               = useState(0);
  const [depFeature1, setDepFeature1]         = useState("");
  const [depFeature2, setDepFeature2]         = useState("");
  const [loading, setLoading]                 = useState<string | null>(null);

  const runGlobal = async () => {
    setLoading("global");
    try {
      const data = await explainApi.global(dataset.session_id!, selectedModel);
      setGlobalData(data);
      if (data.feature_importance?.[0]) setDepFeature1(data.feature_importance[0].feature);
      toast.success("Global SHAP computed.");
    } catch (e: any) { toast.error(e.response?.data?.detail || "Failed."); }
    finally { setLoading(null); }
  };

  const runLocal = async () => {
    if (!globalData) { toast.error("Run global SHAP first."); return; }
    setLoading("local");
    try { setLocalData(await explainApi.local(dataset.session_id!, selectedModel, rowIndex)); }
    catch (e: any) { toast.error(e.response?.data?.detail || "Failed."); }
    finally { setLoading(null); }
  };

  const runDependence = async () => {
    if (!globalData || !depFeature1) return;
    setLoading("dependence");
    try {
      setDependenceData(await explainApi.dependence(
        dataset.session_id!, selectedModel,
        depFeature1, depFeature2 || undefined
      ));
    }
    catch (e: any) { toast.error(e.response?.data?.detail || "Failed."); }
    finally { setLoading(null); }
  };

  const runInteraction = async () => {
    if (!globalData) { toast.error("Run global SHAP first."); return; }
    setLoading("interaction");
    try {
      setInteractionData(await explainApi.interaction(dataset.session_id!, selectedModel));
      toast.success("Interaction values computed.");
    }
    catch (e: any) { toast.error(e.response?.data?.detail || "Failed."); }
    finally { setLoading(null); }
  };

  const featureNames = globalData?.feature_importance?.map((f: any) => f.feature) || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 700, color: "#F5F0F2", marginBottom: 6 }}>
          SHAP Explainability
        </h2>
        <p style={{ fontSize: 13, color: "rgba(245,240,242,0.4)" }}>
          Understand what drives your model's predictions.
        </p>
      </div>

      {/* Model selector + compute button */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Select
          value={selectedModel}
          onValueChange={v => {
            setSelectedModel(v);
            setGlobalData(null);
            setLocalData(null);
            setDependenceData(null);
            setInteractionData(null);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select model..." />
          </SelectTrigger>
          <SelectContent>
            {successfulModels.map(r => (
              <SelectItem key={r.model_id} value={r.model_id}>
                {MODEL_LABELS[r.model_id]}{r.model_id === bestModelId ? " ⭐" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={runGlobal}
          disabled={loading !== null || !selectedModel}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#2DD4BF", border: "none", borderRadius: 8,
            padding: "9px 16px", color: "#080a0f",
            cursor: loading !== null ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600,
            opacity: loading !== null ? 0.6 : 1,
          }}
        >
          {loading === "global"
            ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Computing...</>
            : <><BarChart3 size={13} /> Compute Global SHAP</>
          }
        </button>

        {loading === "global" && (
          <span style={{ fontSize: 11, color: "rgba(245,240,242,0.3)" }}>
            This may take 10–30s...
          </span>
        )}
      </div>

      {/* Tabs — only show after global computed */}
      {globalData && (
        <Tabs defaultValue="bar">
          <TabsList className="grid grid-cols-6 w-full max-w-2xl">
            <TabsTrigger value="bar">Bar</TabsTrigger>
            <TabsTrigger value="beeswarm">Beeswarm</TabsTrigger>
            <TabsTrigger value="local">Local</TabsTrigger>
            <TabsTrigger value="dependence">Dependence</TabsTrigger>
            <TabsTrigger value="interaction">Interaction</TabsTrigger>
            <TabsTrigger value="predict">Predict</TabsTrigger>
          </TabsList>

          {/* Bar plot */}
          <TabsContent value="bar">
            <PlotWrapper>
              <SHAPBarPlot data={globalData.feature_importance} />
            </PlotWrapper>
          </TabsContent>

          {/* Beeswarm */}
          <TabsContent value="beeswarm">
            <PlotWrapper>
              <SHAPBeeswarm data={globalData.beeswarm_data} />
            </PlotWrapper>
          </TabsContent>

          {/* Local */}
          <TabsContent value="local">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="number"
                  min={0}
                  max={globalData.n_samples - 1}
                  value={rowIndex}
                  onChange={e => setRowIndex(parseInt(e.target.value) || 0)}
                  style={{
                    width: 80, height: 32, padding: "0 10px", fontSize: 12,
                    borderRadius: 7, border: "1px solid rgba(245,240,242,0.1)",
                    background: "rgba(245,240,242,0.04)", color: "#F5F0F2", outline: "none",
                  }}
                />
                <span style={{ fontSize: 11, color: "rgba(245,240,242,0.25)" }}>
                  0 – {globalData.n_samples - 1}
                </span>
                <button
                  onClick={runLocal}
                  disabled={loading !== null}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "transparent",
                    border: "1px solid rgba(245,240,242,0.12)",
                    borderRadius: 7, padding: "7px 14px",
                    color: "rgba(245,240,242,0.6)", cursor: "pointer", fontSize: 12,
                  }}
                >
                  {loading === "local"
                    ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                    : <User size={12} />
                  } Explain
                </button>
              </div>
              {localData && (
                <PlotWrapper>
                  <SHAPWaterfall data={localData} />
                </PlotWrapper>
              )}
            </div>
          </TabsContent>

          {/* Dependence */}
          <TabsContent value="dependence">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Select value={depFeature1} onValueChange={setDepFeature1}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Primary feature..." />
                  </SelectTrigger>
                  <SelectContent>
                    {featureNames.map((f: string) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={depFeature2} onValueChange={setDepFeature2}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Color by (auto)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect</SelectItem>
                    {featureNames
                      .filter((f: string) => f !== depFeature1)
                      .map((f: string) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>

                <button
                  onClick={runDependence}
                  disabled={loading !== null || !depFeature1}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "transparent",
                    border: "1px solid rgba(245,240,242,0.12)",
                    borderRadius: 7, padding: "7px 14px",
                    color: "rgba(245,240,242,0.6)", cursor: "pointer", fontSize: 12,
                  }}
                >
                  <GitBranch size={12} /> Generate
                </button>
              </div>
              {dependenceData && (
                <PlotWrapper>
                  <SHAPDependence data={dependenceData} />
                </PlotWrapper>
              )}
            </div>
          </TabsContent>

          {/* Interaction */}
          <TabsContent value="interaction">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={runInteraction}
                disabled={loading !== null}
                style={{
                  display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
                  background: "transparent",
                  border: "1px solid rgba(245,240,242,0.12)",
                  borderRadius: 7, padding: "7px 14px",
                  color: "rgba(245,240,242,0.6)", cursor: "pointer", fontSize: 12,
                }}
              >
                {loading === "interaction"
                  ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Computing (~30s)...</>
                  : <><GitBranch size={12} /> Compute Interaction Values</>
                }
              </button>
              {interactionData && (
                <div style={{ maxHeight: 400, overflowY: "auto", overflowX: "hidden" }}>
                  <SHAPInteraction data={interactionData} />
                </div>
              )}
            </div>
          </TabsContent>

          {/* Predict */}
          <TabsContent value="predict">
            <PredictForm
              sessionId={dataset.session_id!}
              modelId={selectedModel}
              featureNames={featureNames}
              hasShap={!!globalData}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: "rgba(245,240,242,0.35)", cursor: "pointer", fontSize: 12,
          }}
        >
          <ArrowLeft size={13} /> Back
        </button>
        {globalData && (
          <button
            onClick={onNext}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent",
              border: "1px solid rgba(45,212,191,0.3)",
              borderRadius: 8, padding: "8px 16px",
              color: "#2DD4BF", cursor: "pointer", fontSize: 12,
            }}
          >
            Continue <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}