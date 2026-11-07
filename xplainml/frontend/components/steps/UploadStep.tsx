"use client";

import { useAppStore } from "@/lib/store";
import { datasetApi } from "@/lib/api";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Upload, Database, FileSpreadsheet, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataPreview } from "@/components/dataset/DataPreview";
import { ColumnSummary } from "@/components/dataset/ColumnSummary";

const BUILTIN_DATASETS = [
  { id: "titanic",      label: "Titanic",         desc: "Binary · 891 rows · Survival prediction" },
  { id: "dropout",      label: "Student Dropout",  desc: "Multiclass · Dropout · Imbalanced" },
  { id: "breast_cancer", label: "Breast Cancer",   desc: "Binary · 569 rows · Medical" },
];

interface Props { onNext: () => void; onBack: () => void; }

export default function UploadStep({ onNext }: Props) {
  const { setDataset } = useAppStore();
  const [loading, setLoading]   = useState<string | null>(null);
  const [result, setResult]     = useState<any>(null);

  const handleResponse = (data: any) => {
    setDataset({
      session_id: data.session_id, filename: data.filename,
      n_rows: data.n_rows, n_cols: data.n_cols,
      columns: data.columns, preview: data.preview,
    });
    setResult(data);
    toast.success(`Loaded: ${data.n_rows} rows × ${data.n_cols} columns`);
  };

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]; if (!file) return;
    setLoading("upload");
    try { handleResponse(await datasetApi.upload(file)); }
    catch (e: any) { toast.error(e.response?.data?.detail || "Upload failed."); }
    finally { setLoading(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1, disabled: loading !== null,
  });

  const loadBuiltin = async (name: string) => {
    setLoading(name);
    try { handleResponse(await datasetApi.loadBuiltin(name)); }
    catch (e: any) { toast.error(e.response?.data?.detail || "Failed."); }
    finally { setLoading(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 700, color: "#F5F0F2", marginBottom: 6 }}>
          Load Dataset
        </h2>
        <p style={{ fontSize: 13, color: "rgba(245,240,242,0.4)", fontFamily: "'Inter',sans-serif" }}>
          Upload your own file or start with a built-in dataset.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Dropzone */}
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? "#2DD4BF" : "rgba(245,240,242,0.1)"}`,
            borderRadius: 12, padding: "32px 20px", textAlign: "center",
            cursor: "pointer", transition: "border-color 0.2s",
            background: isDragActive ? "rgba(45,212,191,0.04)" : "transparent",
          }}
        >
          <input {...getInputProps()} />
          <FileSpreadsheet size={28} color="rgba(245,240,242,0.25)" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13, color: "rgba(245,240,242,0.6)", marginBottom: 4 }}>
            {isDragActive ? "Drop it here..." : "Drag & drop your file"}
          </p>
          <p style={{ fontSize: 11, color: "rgba(245,240,242,0.25)" }}>CSV or Excel · Max 10MB</p>
        </div>

        {/* Built-ins */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 10, color: "rgba(245,240,242,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Built-in Datasets</p>
          {BUILTIN_DATASETS.map((ds) => (
            <button
              key={ds.id}
              onClick={() => loadBuiltin(ds.id)}
              disabled={loading !== null}
              style={{
                textAlign: "left", border: "1px solid rgba(245,240,242,0.08)",
                borderRadius: 8, padding: "10px 14px",
                background: "rgba(245,240,242,0.02)", cursor: "pointer",
                transition: "all 0.2s", color: "#F5F0F2",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(45,212,191,0.3)"; e.currentTarget.style.background = "rgba(45,212,191,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(245,240,242,0.08)"; e.currentTarget.style.background = "rgba(245,240,242,0.02)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{ds.label}</span>
                {loading === ds.id && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
              </div>
              <p style={{ fontSize: 10, color: "rgba(245,240,242,0.3)", marginTop: 2 }}>{ds.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{ borderTop: "1px solid rgba(245,240,242,0.06)", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#F5F0F2" }}>{result.filename}</span>
              <span style={{ fontSize: 10, color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 4, padding: "2px 7px" }}>{result.n_rows} rows</span>
              <span style={{ fontSize: 10, color: "#2DD4BF", border: "1px solid rgba(45,212,191,0.3)", borderRadius: 4, padding: "2px 7px" }}>{result.n_cols} cols</span>
            </div>
            <button
              onClick={onNext}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#2DD4BF", color: "#080a0f",
                border: "none", borderRadius: 8, padding: "9px 18px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Continue <ArrowRight size={13} />
            </button>
          </div>
          <ColumnSummary columns={result.columns} />
          <DataPreview preview={result.preview} columns={result.columns} />
        </div>
      )}
    </div>
  );
}