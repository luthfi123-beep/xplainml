export interface ColumnInfo {
  name: string;
  dtype: string;
  type: "numerical" | "categorical" | "other";
  missing: number;
  missing_pct: number;
  unique: number;
  sample_values: string[];
}

export interface DatasetState {
  session_id: string | null;
  filename: string | null;
  n_rows: number | null;
  n_cols: number | null;
  columns: ColumnInfo[];
  preview: Record<string, string>[];
}

export interface AppState {
  dataset: DatasetState;
  setDataset: (data: Partial<DatasetState>) => void;
  resetDataset: () => void;
}

export interface ColumnConfig {
  missing_strategy: string;
  missing_constant?: string;
  encoding?: string | null;
  include: boolean;
}

export interface PreprocessConfig {
  session_id: string;
  target_column: string;
  column_configs: Record<string, ColumnConfig>;
  scaler: string;
  imbalance_strategy: string;
  test_size: number;
}

export interface PreprocessSummary {
  rows_after_cleaning: number;
  rows_dropped: number;
  n_features: number;
  train_size: number;
  test_size: number;
  smote_applied: boolean;
  class_distribution_before: Record<string, number>;
  class_distribution_after: Record<string, number>;
  feature_names: string[];
  total_features: number;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number | null;
  confusion_matrix: number[][];
}

export interface TrainResult {
  model_id: string;
  status: "success" | "error";
  metrics: ModelMetrics | null;
  hyperparams: Record<string, any>;
  error?: string;
}

export interface TrainResponse {
  results: TrainResult[];
  best_model_id: string | null;
  is_multiclass: boolean;
}