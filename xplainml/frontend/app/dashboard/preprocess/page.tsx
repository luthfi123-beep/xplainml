"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { preprocessApi } from "@/lib/api";
import { ColumnConfig } from "@/types";
import { PreprocessSummaryCard } from "@/components/preprocess/PreprocessSummaryCard";
import { ColumnConfigRow } from "@/components/preprocess/ColumnConfigRow";
import { EmptyState } from "@/components/EmptyState";

export default function PreprocessPage() {
  const router = useRouter();
  const { dataset, setPreprocessSummary, preprocessSummary } = useAppStore();

  const [targetColumn, setTargetColumn] = useState<string>("");
  const [scaler, setScaler] = useState("none");
  const [imbalanceStrategy, setImbalanceStrategy] = useState("none");
  const [testSize, setTestSize] = useState(0.2);
  const [columnConfigs, setColumnConfigs] = useState<Record<string, ColumnConfig>>({});
  const [hints, setHints] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [loadingHints, setLoadingHints] = useState(false);

  // Redirect if no session
  useEffect(() => {
    if (!dataset.session_id) {
      toast.error("No dataset loaded. Please upload first.");
      router.push("/dashboard/upload");
    }
  }, [dataset.session_id]);

  // Load hints and init configs
  useEffect(() => {
    if (!dataset.session_id || dataset.columns.length === 0) return;

    const init = async () => {
      setLoadingHints(true);
      try {
        const data = await preprocessApi.getHints(dataset.session_id!);
        setHints(data.hints);

        // Init column configs from hints
        const configs: Record<string, ColumnConfig> = {};
        dataset.columns.forEach((col) => {
          const hint = data.hints[col.name] || {};
          configs[col.name] = {
            missing_strategy: hint.suggested_missing || "mean",
            encoding: hint.suggested_encoding || null,
            include: true,
          };
        });
        setColumnConfigs(configs);

        // Auto-detect target column (last column)
        const lastCol = dataset.columns[dataset.columns.length - 1]?.name;
        if (lastCol) setTargetColumn(lastCol);
      } catch {
        toast.error("Failed to load preprocessing hints.");
      } finally {
        setLoadingHints(false);
      }
    };

    init();
  }, [dataset.session_id]);

  const updateColumnConfig = (col: string, update: Partial<ColumnConfig>) => {
    setColumnConfigs((prev) => ({
      ...prev,
      [col]: { ...prev[col], ...update },
    }));
  };

  const handleRun = async () => {
    if (!targetColumn) {
      toast.error("Please select a target column.");
      return;
    }

    setLoading(true);
    try {
      const result = await preprocessApi.run({
        session_id: dataset.session_id,
        target_column: targetColumn,
        column_configs: columnConfigs,
        scaler,
        imbalance_strategy: imbalanceStrategy,
        test_size: testSize,
      });

      setPreprocessSummary(result.summary);
      toast.success("Preprocessing complete!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Preprocessing failed.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingHints) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="text-muted-foreground">Analyzing dataset...</span>
      </div>
    );
  }

    if (!dataset.session_id) {
    return (
      <EmptyState
        title="No dataset loaded"
        description="You need to upload or select a dataset before preprocessing."
        actionLabel="Go to Upload"
        actionHref="/dashboard/upload"
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Preprocessing</h1>
        <p className="text-muted-foreground">
          Configure how your data is cleaned and prepared for training.
        </p>
      </div>

      {/* Global settings */}
      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>Applied to the entire dataset</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Target column */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Column</label>
            <Select value={targetColumn} onValueChange={setTargetColumn}>
              <SelectTrigger>
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent>
                {dataset.columns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scaler */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Feature Scaling</label>
            <Select value={scaler} onValueChange={setScaler}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="standard">StandardScaler (Z-score)</SelectItem>
                <SelectItem value="minmax">MinMaxScaler (0–1)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Imbalance */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Imbalance Strategy</label>
            <Select value={imbalanceStrategy} onValueChange={setImbalanceStrategy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="smote">SMOTE (oversample)</SelectItem>
                <SelectItem value="class_weight">Class Weight</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Test size */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Test Size: <span className="text-blue-400">{Math.round(testSize * 100)}%</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={0.4}
              step={0.05}
              value={testSize}
              onChange={(e) => setTestSize(parseFloat(e.target.value))}
              className="w-full accent-blue-400"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10%</span><span>40%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column configs */}
      <Card>
        <CardHeader>
          <CardTitle>Column Configuration</CardTitle>
          <CardDescription>
            Configure missing value handling and encoding per column.
            <Badge variant="outline" className="ml-2">
              {dataset.columns.filter(c => columnConfigs[c.name]?.include !== false).length} / {dataset.columns.length} included
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {dataset.columns.map((col, i) => (
              <div key={col.name}>
                <ColumnConfigRow
                  col={col}
                  config={columnConfigs[col.name]}
                  isTarget={col.name === targetColumn}
                  onChange={(update) => updateColumnConfig(col.name, update)}
                />
                {i < dataset.columns.length - 1 && (
                  <Separator className="opacity-30" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Run button */}
      <div className="flex justify-end">
        <Button
          onClick={handleRun}
          disabled={loading || !targetColumn}
          size="lg"
          className="gap-2 min-w-40"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
          ) : (
            <><Play className="w-4 h-4" /> Run Preprocessing</>
          )}
        </Button>
      </div>

      {/* Result */}
      {preprocessSummary && (
        <div className="space-y-4">
          <PreprocessSummaryCard summary={preprocessSummary} />
          <div className="flex justify-end">
            <Button onClick={() => router.push("/dashboard/train")} className="gap-2">
              Continue to Training →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}