import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DatasetState, PreprocessSummary, TrainResult } from "@/types";
import { AppStep } from "./appState";

const initialDataset: DatasetState = {
  session_id: null,
  filename: null,
  n_rows: null,
  n_cols: null,
  columns: [],
  preview: [],
};

interface FullState {
  // Navigation
  currentStep: AppStep;
  previousStep: AppStep | null;
  setStep: (step: AppStep) => void;

  // Data
  dataset: DatasetState;
  preprocessSummary: PreprocessSummary | null;
  trainResults: TrainResult[];
  bestModelId: string | null;
  isMulticlass: boolean;

  // Actions
  setDataset: (data: Partial<DatasetState>) => void;
  setPreprocessSummary: (s: PreprocessSummary) => void;
  setTrainResults: (
    results: TrainResult[],
    bestModelId: string | null,
    isMulticlass: boolean
  ) => void;
  resetAll: () => void;
}

export const useAppStore = create<FullState>()(
  persist(
    (set) => ({
      currentStep:    "home",
      previousStep:   null,
      setStep: (step) =>
        set((state) => ({
          currentStep:  step,
          previousStep: state.currentStep,
        })),

      dataset:           initialDataset,
      preprocessSummary: null,
      trainResults:      [],
      bestModelId:       null,
      isMulticlass:      false,

      setDataset: (data) =>
        set((state) => ({ dataset: { ...state.dataset, ...data } })),
      setPreprocessSummary: (s) => set({ preprocessSummary: s }),
      setTrainResults: (results, bestModelId, isMulticlass) =>
        set({ trainResults: results, bestModelId, isMulticlass }),
      resetAll: () =>
        set({
          currentStep:       "home",
          previousStep:      null,
          dataset:           initialDataset,
          preprocessSummary: null,
          trainResults:      [],
          bestModelId:       null,
          isMulticlass:      false,
        }),
    }),
    {
      name: "xplainml-storage",
      partialize: (state) => ({
        currentStep: state.currentStep,
        dataset: {
          session_id: state.dataset.session_id,
          filename:   state.dataset.filename,
          n_rows:     state.dataset.n_rows,
          n_cols:     state.dataset.n_cols,
          columns:    state.dataset.columns,
        },
        bestModelId:  state.bestModelId,
        isMulticlass: state.isMulticlass,
      }),
    }
  )
);