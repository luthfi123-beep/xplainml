"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { preprocessApi } from "@/lib/api";
import { ColumnConfig } from "@/types";
import { PreprocessSummaryCard } from "@/components/preprocess/PreprocessSummaryCard";
import { ColumnConfigRow } from "@/components/preprocess/ColumnConfigRow";

interface Props { onNext: () => void; onBack: () => void; }

export default function PreprocessStep({ onNext, onBack }: Props) {
  const { dataset, setPreprocessSummary, preprocessSummary } = useAppStore();
  const [targetColumn, setTargetColumn]   = useState("");
  const [scaler, setScaler]               = useState("none");
  const [imbalanceStrategy, setImbalance] = useState("none");
  const [testSize, setTestSize]           = useState(0.2);
  const [columnConfigs, setColumnConfigs] = useState<Record<string, ColumnConfig>>({});
  const [hints, setHints]                 = useState<Record<string, any>>({});
  const [loading, setLoading]             = useState(false);
  const [loadingHints, setLoadingHints]   = useState(false);

  useEffect(() => {
    if (!dataset.session_id || dataset.columns.length === 0) return;
    const init = async () => {
      setLoadingHints(true);
      try {
        const data = await preprocessApi.getHints(dataset.session_id!);
        setHints(data.hints);
        const configs: Record<string, ColumnConfig> = {};
        dataset.columns.forEach((col) => {
          const hint = data.hints[col.name] || {};
          configs[col.name] = { missing_strategy: hint.suggested_missing || "mean", encoding: hint.suggested_encoding || null, include: true };
        });
        setColumnConfigs(configs);
        const lastCol = dataset.columns[dataset.columns.length - 1]?.name;
        if (lastCol) setTargetColumn(lastCol);
      } catch { toast.error("Failed to load hints."); }
      finally { setLoadingHints(false); }
    };
    init();
  }, [dataset.session_id]);

  const updateColumnConfig = (col: string, update: Partial<ColumnConfig>) =>
    setColumnConfigs(prev => ({ ...prev, [col]: { ...prev[col], ...update } }));

  const handleRun = async () => {
    if (!targetColumn) { toast.error("Select a target column."); return; }
    setLoading(true);
    try {
      const result = await preprocessApi.run({
        session_id: dataset.session_id, target_column: targetColumn,
        column_configs: columnConfigs, scaler,
        imbalance_strategy: imbalanceStrategy, test_size: testSize,
      });
      setPreprocessSummary(result.summary);
      toast.success("Preprocessing complete!");
    } catch (e: any) { toast.error(e.response?.data?.detail || "Failed."); }
    finally { setLoading(false); }
  };

  if (loadingHints) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
      <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "#2DD4BF" }} />
      <span style={{ color: "rgba(245,240,242,0.4)", fontSize: 13 }}>Analyzing dataset...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 700, color: "#F5F0F2", marginBottom: 6 }}>Preprocessing</h2>
        <p style={{ fontSize: 13, color: "rgba(245,240,242,0.4)" }}>Configure how your data is cleaned and prepared.</p>
      </div>

      {/* Global settings */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <div className="space-y-2">
          <label className="text-sm font-medium">Target Column</label>
          <Select value={targetColumn} onValueChange={setTargetColumn}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{dataset.columns.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Scaling</label>
          <Select value={scaler} onValueChange={setScaler}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="standard">StandardScaler</SelectItem>
              <SelectItem value="minmax">MinMaxScaler</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Imbalance</label>
          <Select value={imbalanceStrategy} onValueChange={setImbalance}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="smote">SMOTE</SelectItem>
              <SelectItem value="class_weight">Class Weight</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Test Size: <span style={{ color: "#2DD4BF" }}>{Math.round(testSize * 100)}%</span></label>
          <input type="range" min={0.1} max={0.4} step={0.05} value={testSize}
            onChange={e => setTestSize(parseFloat(e.target.value))}
            className="w-full accent-teal-400" />
        </div>
      </div>

      {/* Column configs */}
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        <div style={{ fontSize: 11, color: "rgba(245,240,242,0.3)", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
          Column Configuration
          <Badge variant="outline">{dataset.columns.filter(c => columnConfigs[c.name]?.include !== false).length} / {dataset.columns.length} included</Badge>
        </div>
        {dataset.columns.map((col, i) => (
          <div key={col.name}>
            <ColumnConfigRow col={col} config={columnConfigs[col.name]} isTarget={col.name === targetColumn} onChange={u => updateColumnConfig(col.name, u)} />
            {i < dataset.columns.length - 1 && <Separator className="opacity-20" />}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "rgba(245,240,242,0.35)", cursor: "pointer", fontSize: 12 }}>
          <ArrowLeft size={13} /> Back
        </button>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {preprocessSummary && (
            <button onClick={onNext} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 8, padding: "8px 16px", color: "#2DD4BF", cursor: "pointer", fontSize: 12 }}>
              Continue <ArrowRight size={13} />
            </button>
          )}
          <button
            onClick={handleRun} disabled={loading || !targetColumn}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#2DD4BF", border: "none", borderRadius: 8, padding: "9px 18px", color: "#080a0f", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            {loading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Running...</> : "Run Preprocessing"}
          </button>
        </div>
      </div>

      {preprocessSummary && <PreprocessSummaryCard summary={preprocessSummary} />}
    </div>
  );
}