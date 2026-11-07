"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Upload, Database, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { datasetApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { DataPreview } from "@/components/dataset/DataPreview";
import { ColumnSummary } from "@/components/dataset/ColumnSummary";
import { EmptyState } from "@/components/EmptyState";

const BUILTIN_DATASETS = [
  { id: "titanic", label: "Titanic", desc: "Binary classification · 891 rows · Survival prediction" },
  { id: "dropout", label: "Student Dropout", desc: "Multiclass · Dropout prediction · Imbalanced" },
  { id: "breast_cancer", label: "Breast Cancer", desc: "Binary classification · 569 rows · Medical" },
];

export default function UploadPage() {
  const router = useRouter();
  const { setDataset } = useAppStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleResponse = (data: any) => {
    setDataset({
      session_id: data.session_id,
      filename: data.filename,
      n_rows: data.n_rows,
      n_cols: data.n_cols,
      columns: data.columns,
      preview: data.preview,
    });
    setResult(data);
    toast.success(`Dataset loaded: ${data.n_rows} rows × ${data.n_cols} columns`);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading("upload");
    try {
      const data = await datasetApi.upload(file);
      handleResponse(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Upload failed.");
    } finally {
      setLoading(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: loading !== null,
  });

  const loadBuiltin = async (name: string) => {
    setLoading(name);
    try {
      const data = await datasetApi.loadBuiltin(name);
      handleResponse(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to load dataset.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Load Dataset</h1>
        <p className="text-muted-foreground">
          Upload your own CSV/Excel file or start with a built-in dataset.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload dropzone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Upload File
            </CardTitle>
            <CardDescription>CSV or Excel · Max 10MB · Max 50,000 rows</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${isDragActive ? "border-blue-400 bg-blue-400/5" : "border-border hover:border-blue-400/50"}
                ${loading ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              <input {...getInputProps()} />
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-blue-400 font-medium">Drop it here...</p>
              ) : (
                <>
                  <p className="font-medium mb-1">Drag & drop your file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Built-in datasets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" /> Built-in Datasets
            </CardTitle>
            <CardDescription>Pre-loaded datasets to explore the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {BUILTIN_DATASETS.map((ds) => (
              <button
                key={ds.id}
                onClick={() => loadBuiltin(ds.id)}
                disabled={loading !== null}
                className="w-full text-left border border-border rounded-lg px-4 py-3 hover:border-blue-400/50 hover:bg-accent transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{ds.label}</span>
                  {loading === ds.id && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{ds.desc}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{result.filename}</h2>
              <Badge variant="secondary">{result.n_rows} rows</Badge>
              <Badge variant="secondary">{result.n_cols} columns</Badge>
            </div>
            <Button onClick={() => router.push("/dashboard/preprocess")} className="gap-2">
              Continue to Preprocessing <span>→</span>
            </Button>
          </div>

          <ColumnSummary columns={result.columns} />
          <DataPreview preview={result.preview} columns={result.columns} />
        </div>
      )}
    </div>
  );
}