from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from typing import Optional, Dict, Any
import numpy as np
import pandas as pd
import shap
from utils.session import get_session_value, set_session_value

router = APIRouter()

# ── Request Schemas ──────────────────────────────────────────

class ExplainRequest(BaseModel):
    session_id: str
    model_id: str

class LocalExplainRequest(BaseModel):
    session_id: str
    model_id: str
    row_index: int

class DependenceRequest(BaseModel):
    session_id: str
    model_id: str
    feature_1: str
    feature_2: Optional[str] = None

# ── SHAP Helper ──────────────────────────────────────────────

def _get_explainer(model, X_train: pd.DataFrame, model_id: str):
    tree_models = ["random_forest", "xgboost", "lightgbm", "decision_tree"]
    if model_id in tree_models:
        return shap.TreeExplainer(model)
    else:
        background = shap.maskers.Independent(X_train, max_samples=100)
        return shap.LinearExplainer(model, background)

def _shap_values_to_2d(shap_vals, class_index: int = 1):
    """Normalize SHAP output to 2D array [n_samples, n_features]."""
    if isinstance(shap_vals, list):
        # Old SHAP API: list of arrays per class
        return shap_vals[class_index]
    if hasattr(shap_vals, "values"):
        v = shap_vals.values
        if v.ndim == 3:
            return v[:, :, class_index]
        return v
    return shap_vals

# ── Endpoints ────────────────────────────────────────────────

@router.post("/global")
async def global_explanation(req: ExplainRequest):
    trained_models = get_session_value(req.session_id, "trained_models")
    X_train: pd.DataFrame = get_session_value(req.session_id, "X_train")
    X_test: pd.DataFrame  = get_session_value(req.session_id, "X_test")
    feature_names         = get_session_value(req.session_id, "feature_names")

    if trained_models is None or req.model_id not in trained_models:
        raise HTTPException(400, f"Model '{req.model_id}' belum ditraining.")

    model = trained_models[req.model_id]

    try:
        # Align X_test columns to X_train to fix One-Hot mismatch
        X_test = X_test.reindex(columns=X_train.columns, fill_value=0)
        X_train_aligned = X_train.reindex(columns=X_train.columns, fill_value=0)

        explainer   = _get_explainer(model, X_train_aligned, req.model_id)
        shap_values = explainer(X_test)

        sv_2d = _shap_values_to_2d(shap_values, class_index=1)

        # Update feature_names to match aligned columns
        feature_names = list(X_train.columns)

        mean_abs = np.abs(sv_2d).mean(axis=0)
        feature_importance = [
            {"feature": f, "importance": round(float(v), 6)}
            for f, v in sorted(
                zip(feature_names, mean_abs),
                key=lambda x: x[1], reverse=True
            )
        ]

        X_test_arr = X_test.values
        beeswarm_data = []
        for i, feat in enumerate(feature_names):
            feat_shap   = sv_2d[:, i].tolist()
            feat_values = X_test_arr[:, i].tolist()
            beeswarm_data.append({
                "feature": feat,
                "shap_values": [round(v, 6) for v in feat_shap],
                "feature_values": [round(float(v), 6) for v in feat_values],
            })

        set_session_value(req.session_id, f"shap_{req.model_id}", {
            "explainer": explainer,
            "shap_values": shap_values,
            "sv_2d": sv_2d,
            "X_test": X_test,
            "feature_names": feature_names,
        })

        # Update session feature_names to aligned version
        set_session_value(req.session_id, "feature_names", feature_names)

        return JSONResponse({
            "feature_importance": feature_importance[:20],
            "beeswarm_data": beeswarm_data[:20],
            "n_features": len(feature_names),
            "n_samples": len(X_test),
        })

    except Exception as e:
        raise HTTPException(500, f"SHAP computation failed: {str(e)}")


@router.post("/local")
async def local_explanation(req: LocalExplainRequest):
    cache = get_session_value(req.session_id, f"shap_{req.model_id}")
    if cache is None:
        raise HTTPException(400, "Run global explanation first.")

    sv_2d        = cache["sv_2d"]
    X_test       = cache["X_test"]
    feature_names = cache["feature_names"]

    n_samples = sv_2d.shape[0]
    if req.row_index < 0 or req.row_index >= n_samples:
        raise HTTPException(400, f"row_index harus antara 0 dan {n_samples - 1}.")

    shap_row   = sv_2d[req.row_index]
    X_test_arr = X_test.values if hasattr(X_test, "values") else X_test
    feat_row   = X_test_arr[req.row_index]

    waterfall = [
        {
            "feature": feat,
            "shap_value": round(float(sv), 6),
            "feature_value": round(float(fv), 6),
        }
        for feat, sv, fv in zip(feature_names, shap_row, feat_row)
    ]
    waterfall.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    # Base value
    explainer = cache["explainer"]
    try:
        base_value = float(explainer.expected_value[1]) \
            if hasattr(explainer.expected_value, "__len__") \
            else float(explainer.expected_value)
    except Exception:
        base_value = 0.0

    return JSONResponse({
        "row_index": req.row_index,
        "base_value": round(base_value, 6),
        "waterfall": waterfall[:20],
        "prediction_shap_sum": round(float(shap_row.sum()), 6),
    })


@router.post("/dependence")
async def dependence_plot(req: DependenceRequest):
    cache = get_session_value(req.session_id, f"shap_{req.model_id}")
    if cache is None:
        raise HTTPException(400, "Run global explanation first.")

    sv_2d         = cache["sv_2d"]
    X_test        = cache["X_test"]
    feature_names = cache["feature_names"]

    if req.feature_1 not in feature_names:
        raise HTTPException(400, f"Feature '{req.feature_1}' not found.")

    X_test_arr = X_test.values if hasattr(X_test, "values") else X_test
    idx1 = feature_names.index(req.feature_1)

    feat_vals  = X_test_arr[:, idx1].tolist()
    shap_vals  = sv_2d[:, idx1].tolist()

    # Interaction coloring
    color_vals = None
    color_feature = None
    if req.feature_2 and req.feature_2 in feature_names:
        idx2       = feature_names.index(req.feature_2)
        color_vals = X_test_arr[:, idx2].tolist()
        color_feature = req.feature_2
    elif req.feature_2 is None:
        # Auto: pick feature with highest interaction
        correlations = []
        for i, fn in enumerate(feature_names):
            if i == idx1:
                continue
            corr = abs(np.corrcoef(sv_2d[:, idx1], X_test_arr[:, i])[0, 1])
            correlations.append((fn, corr, i))
        if correlations:
            correlations.sort(key=lambda x: x[1], reverse=True)
            best_name, _, best_idx = correlations[0]
            color_vals    = X_test_arr[:, best_idx].tolist()
            color_feature = best_name

    return JSONResponse({
        "feature": req.feature_1,
        "feature_values": [round(float(v), 4) for v in feat_vals],
        "shap_values": [round(float(v), 6) for v in shap_vals],
        "color_feature": color_feature,
        "color_values": [round(float(v), 4) for v in color_vals] if color_vals else None,
    })


@router.get("/feature-names/{session_id}")
async def get_feature_names(session_id: str):
    feature_names = get_session_value(session_id, "feature_names")
    if not feature_names:
        raise HTTPException(400, "Preprocessing belum dijalankan.")
    return JSONResponse({"feature_names": feature_names})

class PredictRequest(BaseModel):
    session_id: str
    model_id: str
    input_data: Dict[str, Any]

@router.post("/predict")
async def predict_single(req: PredictRequest):
    trained_models = get_session_value(req.session_id, "trained_models") or {}
    feature_names  = get_session_value(req.session_id, "feature_names")
    shap_cache     = get_session_value(req.session_id, f"shap_{req.model_id}")

    if req.model_id not in trained_models:
        raise HTTPException(400, f"Model '{req.model_id}' not found.")
    if not feature_names:
        raise HTTPException(400, "Feature names not found. Run preprocessing first.")

    model = trained_models[req.model_id]

    # Build input dataframe in correct feature order
    try:
        row = {f: req.input_data.get(f, 0) for f in feature_names}
        X_input = pd.DataFrame([row])[feature_names]
    except Exception as e:
        raise HTTPException(400, f"Input data error: {str(e)}")

    # Predict
    try:
        prediction  = int(model.predict(X_input)[0])
        proba       = model.predict_proba(X_input)[0].tolist()
        proba_dict  = {str(i): round(float(p), 4) for i, p in enumerate(proba)}
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {str(e)}")

    # SHAP for this input
    shap_contrib = []
    if shap_cache:
        try:
            explainer = shap_cache["explainer"]
            sv        = explainer(X_input)

            if hasattr(sv, "values"):
                v = sv.values
                if v.ndim == 3:
                    v = v[0, :, 1]
                else:
                    v = v[0]
            elif isinstance(sv, list):
                v = sv[1][0]
            else:
                v = sv[0]

            shap_contrib = [
                {
                    "feature":       feat,
                    "shap_value":    round(float(sv_val), 6),
                    "feature_value": round(float(X_input.iloc[0][feat]), 4),
                }
                for feat, sv_val in zip(feature_names, v)
            ]
            shap_contrib.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        except Exception as e:
            print(f"[PREDICT SHAP] failed: {e}")
            shap_contrib = []

    return JSONResponse({
        "prediction":   prediction,
        "probabilities": proba_dict,
        "shap_contrib": shap_contrib[:15],
        "feature_names": feature_names,
    })

class InteractionRequest(BaseModel):
    session_id: str
    model_id: str

@router.post("/interaction")
async def shap_interaction(req: InteractionRequest):
    trained_models = get_session_value(req.session_id, "trained_models") or {}
    X_train: pd.DataFrame = get_session_value(req.session_id, "X_train")
    X_test: pd.DataFrame  = get_session_value(req.session_id, "X_test")
    feature_names         = get_session_value(req.session_id, "feature_names")

    if req.model_id not in trained_models:
        raise HTTPException(400, f"Model '{req.model_id}' not found.")

    # Only tree models support interaction values
    tree_models = ["random_forest", "xgboost", "lightgbm", "decision_tree"]
    if req.model_id not in tree_models:
        raise HTTPException(400, "SHAP interaction values only supported for tree-based models.")

    model = trained_models[req.model_id]

    try:
        # Align columns
        X_test_aligned = X_test.reindex(columns=X_train.columns, fill_value=0)

        explainer = shap.TreeExplainer(model)

        # Limit samples for performance
        n_samples  = min(200, len(X_test_aligned))
        X_sample   = X_test_aligned.iloc[:n_samples]

        print(f"[INTERACTION] Computing for {n_samples} samples, {len(feature_names)} features...")
        interaction_values = explainer.shap_interaction_values(X_sample)

        # Handle multiclass — use class 1
        if isinstance(interaction_values, list):
            iv = interaction_values[1]
        elif interaction_values.ndim == 4:
            iv = interaction_values[:, :, :, 1]
        else:
            iv = interaction_values

        # Mean absolute interaction matrix [n_features x n_features]
        mean_interaction = np.abs(iv).mean(axis=0)

        # Build matrix data
        n_feat = len(feature_names)
        matrix = []
        for i in range(n_feat):
            for j in range(n_feat):
                matrix.append({
                    "feature_i": feature_names[i],
                    "feature_j": feature_names[j],
                    "value":     round(float(mean_interaction[i, j]), 6),
                })

        # Top interactions (off-diagonal)
        off_diag = [
            m for m in matrix if m["feature_i"] != m["feature_j"]
        ]
        off_diag.sort(key=lambda x: x["value"], reverse=True)

        return JSONResponse({
            "matrix":           matrix,
            "top_interactions": off_diag[:20],
            "feature_names":    feature_names,
            "n_samples":        n_samples,
        })

    except Exception as e:
        raise HTTPException(500, f"Interaction values failed: {str(e)}")