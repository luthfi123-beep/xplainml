import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 60000,
});

export const datasetApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post("/api/dataset/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  loadBuiltin: async (name: string) => {
    const res = await api.get(`/api/dataset/builtin/${name}`);
    return res.data;
  },

  listBuiltins: async () => {
    const res = await api.get("/api/dataset/builtins");
    return res.data;
  },
};

export const preprocessApi = {
  getHints: async (session_id: string) => {
    const res = await api.get(`/api/preprocess/config-hint/${session_id}`);
    return res.data;
  },

  run: async (config: any) => {
    const res = await api.post("/api/preprocess/run", config);
    return res.data;
  },
};

// export const trainApi = {
//   run: async (payload: any) => {
//     const res = await api.post("/api/train/run", payload);
//     return res.data;
//   },
// };

export const explainApi = {
  global: async (session_id: string, model_id: string) => {
    const res = await api.post("/api/explain/global", { session_id, model_id });
    return res.data;
  },

  local: async (session_id: string, model_id: string, row_index: number) => {
    const res = await api.post("/api/explain/local", { session_id, model_id, row_index });
    return res.data;
  },

  dependence: async (session_id: string, model_id: string, feature_1: string, feature_2?: string) => {
    const res = await api.post("/api/explain/dependence", {
      session_id, model_id, feature_1,
      feature_2: feature_2 || null,
    });
    return res.data;
  },

  featureNames: async (session_id: string) => {
    const res = await api.get(`/api/explain/feature-names/${session_id}`);
    return res.data;
  },

    predict: async (session_id: string, model_id: string, input_data: Record<string, number>) => {
    const res = await api.post("/api/explain/predict", { session_id, model_id, input_data });
    return res.data;
  },

    interaction: async (session_id: string, model_id: string) => {
    const res = await api.post("/api/explain/interaction", { session_id, model_id });
    return res.data;
  },
};

export const exportApi = {
  pdf: async (session_id: string, model_id: string): Promise<Blob> => {
    const res = await api.post(
      "/api/export/pdf",
      { session_id, model_id },
      { responseType: "blob" }
    );
    return res.data;
  },

  csv: async (session_id: string, model_id: string): Promise<Blob> => {
    const res = await api.post(
      "/api/export/csv",
      { session_id, model_id },
      { responseType: "blob" }
    );
    return res.data;
  },
   
  model: async (session_id: string, model_id: string): Promise<Blob> => {
    const res = await api.post(
      "/api/export/model",
      { session_id, model_id },
      { responseType: "blob" }
    );
    return res.data;
  },
};

export const trainApi = {
  run: async (payload: any) => {
    const res = await api.post("/api/train/run", payload);
    return res.data;
  },

  rocCurve: async (session_id: string, model_id: string) => {
    const res = await api.post("/api/train/roc-curve", { session_id, model_id });
    return res.data;
  },

  classificationReport: async (session_id: string, model_id: string) => {
    const res = await api.post("/api/train/classification-report", { session_id, model_id });
    return res.data;
  },
};

export default api;