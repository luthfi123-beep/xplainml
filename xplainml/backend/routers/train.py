from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import numpy as np
import pandas as pd
from utils.session import get_session_value, set_session_value

router = APIRouter()

# ── Request Schemas ──────────────────────────────────────────

class ModelConfig(BaseModel):
    model_id: str
    hyperparams: Dict[str, Any] = {}

class TrainRequest(BaseModel):
    session_id: str
    models: List[ModelConfig]

class RocRequest(BaseModel):
    session_id: str
    model_id: str

class ClassReportRequest(BaseModel):
    session_id: str
    model_id: str

# ── Model Factory ────────────────────────────────────────────

def _build_model(model_id: str, hyperparams: dict, use_class_weight: bool):
    cw = "balanced" if use_class_weight else None

    if model_id == "logistic_regression":
        from sklearn.linear_model import LogisticRegression
        return LogisticRegression(
            C=hyperparams.get("C", 1.0),
            max_iter=hyperparams.get("max_iter", 1000),
            class_weight=cw,
            random_state=42
        )
    elif model_id == "decision_tree":
        from sklearn.tree import DecisionTreeClassifier
        return DecisionTreeClassifier(
            max_depth=hyperparams.get("max_depth", None),
            min_samples_split=hyperparams.get("min_samples_split", 2),
            class_weight=cw,
            random_state=42
        )
    elif model_id == "random_forest":
        from sklearn.ensemble import RandomForestClassifier
        return RandomForestClassifier(
            n_estimators=hyperparams.get("n_estimators", 100),
            max_depth=hyperparams.get("max_depth", None),
            class_weight=cw,
            random_state=42,
            n_jobs=-1
        )
    elif model_id == "xgboost":
        from xgboost import XGBClassifier
        return XGBClassifier(
            n_estimators=hyperparams.get("n_estimators", 100),
            max_depth=hyperparams.get("max_depth", 6),
            learning_rate=hyperparams.get("learning_rate", 0.1),
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1
        )
    elif model_id == "lightgbm":
        from lightgbm import LGBMClassifier
        return LGBMClassifier(
            n_estimators=hyperparams.get("n_estimators", 100),
            max_depth=hyperparams.get("max_depth", -1),
            learning_rate=hyperparams.get("learning_rate", 0.1),
            class_weight=cw,
            random_state=42,
            n_jobs=-1,
            verbose=-1
        )
    else:
        raise ValueError(f"Unknown model: {model_id}")

# ── Metrics ──────────────────────────────────────────────────

def _compute_metrics(model, X_test, y_test, is_multiclass: bool) -> dict:
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score,
        f1_score, roc_auc_score, confusion_matrix
    )

    y_pred = model.predict(X_test)
    avg = "weighted" if is_multiclass else "binary"

    metrics = {
        "accuracy":  round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, average=avg, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_test, y_pred, average=avg, zero_division=0)), 4),
        "f1":        round(float(f1_score(y_test, y_pred, average=avg, zero_division=0)), 4),
    }

    try:
        if is_multiclass:
            y_prob = model.predict_proba(X_test)
            metrics["roc_auc"] = round(float(roc_auc_score(
                y_test, y_prob, multi_class="ovr", average="weighted"
            )), 4)
        else:
            y_prob = model.predict_proba(X_test)[:, 1]
            metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_prob)), 4)
    except Exception:
        metrics["roc_auc"] = None

    cm = confusion_matrix(y_test, y_pred)
    metrics["confusion_matrix"] = cm.tolist()

    return metrics

# ── Endpoints ────────────────────────────────────────────────

@router.post("/run")
async def run_training(req: TrainRequest):
    X_train = get_session_value(req.session_id, "X_train")
    X_test  = get_session_value(req.session_id, "X_test")
    y_train = get_session_value(req.session_id, "y_train")
    y_test  = get_session_value(req.session_id, "y_test")
    use_cw  = get_session_value(req.session_id, "class_weight_strategy") or False

    if X_train is None:
        raise HTTPException(400, "Preprocessing belum dijalankan.")

    is_multiclass = len(np.unique(y_train)) > 2
    results       = []
    trained_models = get_session_value(req.session_id, "trained_models") or {}

    for model_cfg in req.models:
        try:
            model = _build_model(model_cfg.model_id, model_cfg.hyperparams, use_cw)
            model.fit(X_train, y_train)
            metrics = _compute_metrics(model, X_test, y_test, is_multiclass)
            trained_models[model_cfg.model_id] = model
            results.append({
                "model_id": model_cfg.model_id,
                "status":   "success",
                "metrics":  metrics,
                "hyperparams": model_cfg.hyperparams,
            })
        except Exception as e:
            results.append({
                "model_id": model_cfg.model_id,
                "status":   "error",
                "error":    str(e),
                "metrics":  None,
            })

    set_session_value(req.session_id, "trained_models", trained_models)

    successful = [r for r in results if r["status"] == "success"]
    best = max(successful, key=lambda r: r["metrics"]["f1"]) if successful else None
    if best:
        set_session_value(req.session_id, "best_model_id", best["model_id"])

    return JSONResponse({
        "results":       results,
        "best_model_id": best["model_id"] if best else None,
        "is_multiclass": is_multiclass,
    })


@router.get("/results/{session_id}")
async def get_results(session_id: str):
    trained_models = get_session_value(session_id, "trained_models")
    if not trained_models:
        raise HTTPException(400, "Belum ada model yang ditraining.")
    return JSONResponse({"trained_model_ids": list(trained_models.keys())})


@router.post("/roc-curve")
async def get_roc_curve(req: RocRequest):
    from sklearn.metrics import roc_curve, auc
    from sklearn.preprocessing import label_binarize

    trained_models = get_session_value(req.session_id, "trained_models") or {}
    X_test  = get_session_value(req.session_id, "X_test")
    y_test  = get_session_value(req.session_id, "y_test")
    y_train = get_session_value(req.session_id, "y_train")

    if req.model_id not in trained_models:
        raise HTTPException(400, f"Model '{req.model_id}' not found.")

    model    = trained_models[req.model_id]
    classes  = sorted(np.unique(y_train))
    is_multi = len(classes) > 2

    print(f"[ROC] model={req.model_id} | classes={classes} | is_multi={is_multi}")
    print(f"[ROC] y_test dtype={y_test.dtype} | unique={np.unique(y_test)}")

    try:
        y_prob = model.predict_proba(X_test)
        print(f"[ROC] y_prob shape={y_prob.shape}")
    except Exception as e:
        print(f"[ROC] predict_proba failed: {e}")
        raise HTTPException(400, f"Model does not support predict_proba: {str(e)}")

    curves = []

    if not is_multi:
        fpr, tpr, _ = roc_curve(y_test.astype(int), y_prob[:, 1])
        roc_auc     = auc(fpr, tpr)
        curves.append({
            "label": "ROC Curve",
            "fpr":   [round(float(v), 4) for v in fpr],
            "tpr":   [round(float(v), 4) for v in tpr],
            "auc":   round(float(roc_auc), 4),
        })
    else:
        y_bin = label_binarize(y_test, classes=classes)
        if y_bin.ndim == 1:
            y_bin = y_bin.reshape(-1, 1)
        for i, cls in enumerate(classes):
            try:
                fpr, tpr, _ = roc_curve(y_bin[:, i], y_prob[:, i])
                roc_auc     = auc(fpr, tpr)
                curves.append({
                    "label": f"Class {cls}",
                    "fpr":   [round(float(v), 4) for v in fpr],
                    "tpr":   [round(float(v), 4) for v in tpr],
                    "auc":   round(float(roc_auc), 4),
                })
            except Exception as e:
                print(f"[ROC] Class {cls} failed: {e}")
                continue

    print(f"[ROC] curves generated: {len(curves)}")

    return JSONResponse({
        "curves":       curves,
        "is_multiclass": is_multi,
    })


@router.post("/classification-report")
async def get_classification_report(req: ClassReportRequest):
    from sklearn.metrics import classification_report

    trained_models = get_session_value(req.session_id, "trained_models") or {}
    X_test = get_session_value(req.session_id, "X_test")
    y_test = get_session_value(req.session_id, "y_test")

    if req.model_id not in trained_models:
        raise HTTPException(400, f"Model '{req.model_id}' not found.")

    model  = trained_models[req.model_id]
    y_pred = model.predict(X_test)

    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

    rows = []
    for key, val in report.items():
        if key == "accuracy":
            continue
        if isinstance(val, dict):
            rows.append({
                "class":     str(key),
                "precision": round(val.get("precision", 0), 4),
                "recall":    round(val.get("recall", 0), 4),
                "f1":        round(val.get("f1-score", 0), 4),
                "support":   int(val.get("support", 0)),
            })

    return JSONResponse({"report": rows})