import io
import json
import uuid
import pandas as pd
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from utils.session import create_session, set_session_value

router = APIRouter()

BUILTIN_DATASETS = {
    "titanic": "data/samples/titanic.csv",
    "dropout": "data/samples/dropout.csv",
    "breast_cancer": "data/samples/breast_cancer.csv",
}

MAX_FILE_SIZE_MB = 10
MAX_ROWS = 50_000
MAX_COLS = 100

def _analyze_dataframe(df: pd.DataFrame) -> dict:
    columns = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        if dtype in ["object", "category", "bool"]:
            col_type = "categorical"
        elif dtype in ["int64", "int32", "float64", "float32"]:
            col_type = "numerical"
        else:
            col_type = "other"

        columns.append({
            "name": col,
            "dtype": dtype,
            "type": col_type,
            "missing": int(df[col].isnull().sum()),
            "missing_pct": round(df[col].isnull().sum() / len(df) * 100, 2),
            "unique": int(df[col].nunique()),
            "sample_values": df[col].dropna().head(5).astype(str).tolist(),
        })

    return {
        "n_rows": len(df),
        "n_cols": len(df.columns),
        "columns": columns,
        "preview": df.head(10).fillna("").astype(str).to_dict(orient="records"),
    }

@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    # Validate file type
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "File harus berformat CSV atau Excel.")

    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File terlalu besar. Maksimum {MAX_FILE_SIZE_MB}MB.")

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), sep=None, engine="python")
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Gagal membaca file: {str(e)}")

    if len(df) > MAX_ROWS:
        raise HTTPException(400, f"Dataset terlalu banyak baris. Maksimum {MAX_ROWS} baris.")

    if len(df.columns) > MAX_COLS:
        raise HTTPException(400, f"Dataset terlalu banyak kolom. Maksimum {MAX_COLS} kolom.")

    if len(df) < 50:
        raise HTTPException(400, "Dataset terlalu kecil. Minimal 50 baris.")

    # Create session and store dataframe
    session_id = create_session()
    set_session_value(session_id, "df_raw", df)
    set_session_value(session_id, "filename", file.filename)

    analysis = _analyze_dataframe(df)

    return JSONResponse({
        "session_id": session_id,
        "filename": file.filename,
        **analysis
    })

@router.get("/builtin/{name}")
async def load_builtin_dataset(name: str):
    if name not in BUILTIN_DATASETS:
        raise HTTPException(404, f"Dataset '{name}' tidak tersedia. Pilih dari: {list(BUILTIN_DATASETS.keys())}")

    try:
        df = pd.read_csv(BUILTIN_DATASETS[name], sep=None, engine="python")
    except FileNotFoundError:
        raise HTTPException(500, f"File dataset '{name}' tidak ditemukan di server.")

    session_id = create_session()
    set_session_value(session_id, "df_raw", df)
    set_session_value(session_id, "filename", f"{name}.csv")

    analysis = _analyze_dataframe(df)

    return JSONResponse({
        "session_id": session_id,
        "filename": f"{name}.csv",
        **analysis
    })

@router.get("/builtins")
async def list_builtin_datasets():
    return {"datasets": list(BUILTIN_DATASETS.keys())}