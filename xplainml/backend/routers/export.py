from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io
import pandas as pd
import numpy as np
from utils.session import get_session_value

router = APIRouter()

# ── Request Schemas ──────────────────────────────────────────

class ExportRequest(BaseModel):
    session_id: str
    model_id: str

class ModelDownloadRequest(BaseModel):
    session_id: str
    model_id: str

# ── Helpers ──────────────────────────────────────────────────

def _make_table(data: list, header_color, row_color):
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors

    t = Table(data, hAlign="LEFT", colWidths=None)
    style = TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  header_color),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  10),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  8),
        ("TOPPADDING",    (0, 0), (-1, 0),  8),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, row_color]),
        ("FONTSIZE",      (0, 1), (-1, -1), 9),
        ("TOPPADDING",    (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ])
    t.setStyle(style)
    return t


def _build_pdf(session_id: str, model_id: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    )

    filename       = get_session_value(session_id, "filename") or "Unknown"
    preprocess_cfg = get_session_value(session_id, "preprocess_config") or {}
    feature_names  = get_session_value(session_id, "feature_names") or []
    X_train        = get_session_value(session_id, "X_train")
    X_test         = get_session_value(session_id, "X_test")
    y_train        = get_session_value(session_id, "y_train")
    y_test         = get_session_value(session_id, "y_test")
    trained_models = get_session_value(session_id, "trained_models") or {}
    shap_cache     = get_session_value(session_id, f"shap_{model_id}")

    if model_id not in trained_models:
        raise ValueError(f"Model '{model_id}' not found in session.")

    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score
    )
    model    = trained_models[model_id]
    y_pred   = model.predict(X_test)
    is_multi = len(np.unique(y_train)) > 2
    avg      = "weighted" if is_multi else "binary"

    metrics = {
        "Accuracy":  round(float(accuracy_score(y_test, y_pred)), 4),
        "Precision": round(float(precision_score(y_test, y_pred, average=avg, zero_division=0)), 4),
        "Recall":    round(float(recall_score(y_test, y_pred, average=avg, zero_division=0)), 4),
        "F1 Score":  round(float(f1_score(y_test, y_pred, average=avg, zero_division=0)), 4),
    }

    shap_rows = []
    if shap_cache:
        sv_2d    = shap_cache["sv_2d"]
        mean_abs = np.abs(sv_2d).mean(axis=0)
        ranked   = sorted(zip(feature_names, mean_abs), key=lambda x: x[1], reverse=True)
        shap_rows = [(f, round(float(v), 6)) for f, v in ranked[:10]]

    buf  = io.BytesIO()
    doc  = SimpleDocTemplate(buf, pagesize=A4,
                              rightMargin=2*cm, leftMargin=2*cm,
                              topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()

    BLUE  = colors.HexColor("#3b82f6")
    DARK  = colors.HexColor("#0f172a")
    GRAY  = colors.HexColor("#64748b")
    LIGHT = colors.HexColor("#f1f5f9")

    h1   = ParagraphStyle("H1", parent=styles["Heading1"],
                           fontSize=22, textColor=BLUE, spaceAfter=4)
    h2   = ParagraphStyle("H2", parent=styles["Heading2"],
                           fontSize=13, textColor=DARK, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("Body", parent=styles["Normal"],
                           fontSize=10, textColor=GRAY, leading=14)

    elements = []

    elements.append(Paragraph("XplainML", h1))
    elements.append(Paragraph("Machine Learning Explainability Report",
                               ParagraphStyle("Sub", parent=styles["Normal"],
                                              fontSize=12, textColor=GRAY)))
    elements.append(Spacer(1, 0.3*cm))
    elements.append(HRFlowable(width="100%", thickness=1, color=BLUE))
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("1. Dataset", h2))
    ds_data = [
        ["Property", "Value"],
        ["Filename", filename],
        ["Training samples", str(len(X_train)) if X_train is not None else "—"],
        ["Test samples", str(len(X_test)) if X_test is not None else "—"],
        ["Number of features", str(len(feature_names))],
        ["Target column", preprocess_cfg.get("target_column", "—")],
    ]
    elements.append(_make_table(ds_data, BLUE, LIGHT))
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("2. Preprocessing Configuration", h2))
    pre_data = [
        ["Parameter", "Value"],
        ["Scaler", preprocess_cfg.get("scaler", "none")],
        ["Imbalance strategy", preprocess_cfg.get("imbalance_strategy", "none")],
        ["Test size", f"{int(preprocess_cfg.get('test_size', 0.2) * 100)}%"],
    ]
    elements.append(_make_table(pre_data, BLUE, LIGHT))
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("3. Model Performance", h2))
    elements.append(Paragraph(f"Model: <b>{model_id.replace('_', ' ').title()}</b>", body))
    elements.append(Spacer(1, 0.2*cm))
    met_data = [["Metric", "Score"]] + [
        [k, f"{v:.4f} ({v*100:.1f}%)"] for k, v in metrics.items()
    ]
    elements.append(_make_table(met_data, BLUE, LIGHT))
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("4. SHAP Feature Importance (Top 10)", h2))
    if shap_rows:
        elements.append(Paragraph(
            "Mean absolute SHAP values indicate the average contribution of each feature "
            "to the model output. Higher values indicate greater influence on predictions.",
            body))
        elements.append(Spacer(1, 0.2*cm))
        shap_data = [["Rank", "Feature", "Mean |SHAP|"]]
        for i, (feat, val) in enumerate(shap_rows, 1):
            shap_data.append([str(i), feat, f"{val:.6f}"])
        elements.append(_make_table(shap_data, BLUE, LIGHT))
    else:
        elements.append(Paragraph(
            "SHAP values not available. Run global explanation on the Explain page first.",
            body))
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("5. Automated Interpretation", h2))
    top_feat = shap_rows[0][0] if shap_rows else "N/A"
    interpretation = (
        f"The {model_id.replace('_', ' ')} model achieved an F1 score of "
        f"{metrics['F1 Score']:.4f} on the test set. "
        f"SHAP analysis reveals that <b>{top_feat}</b> is the most influential feature, "
        f"with a mean absolute SHAP value of {shap_rows[0][1]:.4f if shap_rows else 0}. "
        f"The model was trained on {len(X_train) if X_train is not None else '?'} samples "
        f"with {len(feature_names)} features after preprocessing."
    )
    elements.append(Paragraph(interpretation, body))
    elements.append(Spacer(1, 0.6*cm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    elements.append(Spacer(1, 0.2*cm))
    elements.append(Paragraph(
        "Generated by XplainML · Universitas Negeri Makassar",
        ParagraphStyle("Footer", parent=styles["Normal"],
                       fontSize=8, textColor=GRAY, alignment=1)))

    doc.build(elements)
    return buf.getvalue()

# ── Endpoints ────────────────────────────────────────────────

@router.post("/pdf")
async def export_pdf(req: ExportRequest):
    try:
        pdf_bytes = _build_pdf(req.session_id, req.model_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {str(e)}")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=xplainml_report_{req.model_id}.pdf"}
    )


@router.post("/csv")
async def export_csv(req: ExportRequest):
    trained_models = get_session_value(req.session_id, "trained_models") or {}
    X_test         = get_session_value(req.session_id, "X_test")
    y_test         = get_session_value(req.session_id, "y_test")
    feature_names  = get_session_value(req.session_id, "feature_names") or []

    if req.model_id not in trained_models:
        raise HTTPException(400, f"Model '{req.model_id}' not found.")

    model  = trained_models[req.model_id]
    y_pred = model.predict(X_test)

    df_out = pd.DataFrame(X_test, columns=feature_names)
    df_out["actual"]    = y_test.values if hasattr(y_test, "values") else y_test
    df_out["predicted"] = y_pred
    df_out["correct"]   = (df_out["actual"] == df_out["predicted"]).astype(int)

    buf = io.StringIO()
    df_out.to_csv(buf, index=False)
    buf.seek(0)

    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=xplainml_predictions_{req.model_id}.csv"}
    )


@router.post("/model")
async def download_model(req: ModelDownloadRequest):
    import joblib
    import tempfile
    import os

    trained_models = get_session_value(req.session_id, "trained_models") or {}
    feature_names  = get_session_value(req.session_id, "feature_names") or []
    preprocess_cfg = get_session_value(req.session_id, "preprocess_config") or {}

    if req.model_id not in trained_models:
        raise HTTPException(400, f"Model '{req.model_id}' not found.")

    model = trained_models[req.model_id]

    bundle = {
        "model":          model,
        "model_id":       req.model_id,
        "feature_names":  feature_names,
        "target_column":  preprocess_cfg.get("target_column", ""),
        "scaler":         get_session_value(req.session_id, "scaler"),
        "label_encoders": get_session_value(req.session_id, "label_encoders"),
        "target_encoder": get_session_value(req.session_id, "target_encoder"),
    }

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".joblib")
    joblib.dump(bundle, tmp.name)
    tmp.close()

    def iterfile():
        with open(tmp.name, "rb") as f:
            yield from f
        os.unlink(tmp.name)

    return StreamingResponse(
        iterfile(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=xplainml_{req.model_id}.joblib"
        }
    )