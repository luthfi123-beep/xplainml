export type AppStep =
  | "home"
  | "upload"
  | "preprocess"
  | "train"
  | "explain"
  | "export";

export const STEPS: AppStep[] = [
  "upload",
  "preprocess",
  "train",
  "explain",
  "export",
];

export const STEP_LABELS: Record<AppStep, string> = {
  home:       "Home",
  upload:     "Dataset",
  preprocess: "Preprocess",
  train:      "Train",
  explain:    "Explain",
  export:     "Export",
};

export const STEP_INDEX: Record<AppStep, number> = {
  home:       -1,
  upload:     0,
  preprocess: 1,
  train:      2,
  explain:    3,
  export:     4,
};