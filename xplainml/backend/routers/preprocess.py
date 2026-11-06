from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
from utils.session import get_session_value, set_session_value

router = APIRouter()

# ── Request Schemas ──────────────────────────────────────────

class ColumnConfig(BaseModel):
    missing_strategy: Optional[str] = "mean"   # mean | median | mode | constant | drop
    missing_constant: Optional[str] = None
    encoding: Optional[str] = None             # label | onehot (only for categorical)
    include: bool = True                        # False = drop column

class PreprocessConfig(BaseModel):
    session_id: str
    target_column: str
    column_configs: Dict[str, ColumnConfig]
    scaler: Optional[str] = "none"             # none | standard | minmax
    imbalance_strategy: Optional[str] = "none" # none | smote | class_weight
    test_size: float = 0.2

# ── Helpers ──────────────────────────────────────────────────

def _apply_missing(df: pd.DataFrame, col: str, cfg: ColumnConfig) -> pd.DataFrame:
    if df[col].isnull().sum() == 0:
        return df
    strategy = cfg.missing_strategy
    if strategy == "mean":
        df[col] = df[col].fillna(df[col].mean())
    elif strategy == "median":
        df[col] = df[col].fillna(df[col].median())
    elif strategy == "mode":
        df[col] = df[col].fillna(df[col].mode()[0])
    elif strategy == "constant":
        df[col] = df[col].fillna(cfg.missing_constant or 0)
    elif strategy == "drop":
        df = df.dropna(subset=[col])
    return df

# ── Endpoints ────────────────────────────────────────────────

@router.post("/run")
async def run_preprocessing(config: PreprocessConfig):
    df: pd.DataFrame = get_session_value(config.session_id, "df_raw")
    if df is None:
        raise HTTPException(400, "Session tidak ditemukan. Upload dataset terlebih dahulu.")

    if config.target_column not in df.columns:
        raise HTTPException(400, f"Kolom target '{config.target_column}' tidak ditemukan.")

    df = df.copy()

    # ── 1. Drop excluded columns ──
    cols_to_drop = [
        col for col, cfg in config.column_configs.items()
        if not cfg.include and col != config.target_column
    ]
    df = df.drop(columns=cols_to_drop, errors="ignore")

    # ── 2. Handle missing values ──
    for col, cfg in config.column_configs.items():
        if col not in df.columns or col == config.target_column:
            continue
        df = _apply_missing(df, col, cfg)

    # Drop remaining rows with any missing
    before = len(df)
    df = df.dropna()
    dropped = before - len(df)

    # ── 3. Separate features and target ──
    X = df.drop(columns=[config.target_column])
    y = df[config.target_column]

    # ── 4. Encoding ──
    onehot_cols = []
    label_cols = []
    for col, cfg in config.column_configs.items():
        if col not in X.columns:
            continue
        if cfg.encoding == "onehot":
            onehot_cols.append(col)
        elif cfg.encoding == "label":
            label_cols.append(col)

    # Label encoding
    from sklearn.preprocessing import LabelEncoder
    label_encoders = {}
    for col in label_cols:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        label_encoders[col] = le

    # One-hot encoding
    if onehot_cols:
        X = pd.get_dummies(X, columns=onehot_cols)

    # Encode target if categorical
    target_encoder = None
    if y.dtype == "object" or str(y.dtype) == "category":
        target_encoder = LabelEncoder()
        y = pd.Series(target_encoder.fit_transform(y.astype(str)), name=config.target_column)

    # ── 5. Scaling ──
    scaler_obj = None
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()

    if config.scaler == "standard":
        from sklearn.preprocessing import StandardScaler
        scaler_obj = StandardScaler()
        X[numeric_cols] = scaler_obj.fit_transform(X[numeric_cols])
    elif config.scaler == "minmax":
        from sklearn.preprocessing import MinMaxScaler
        scaler_obj = MinMaxScaler()
        X[numeric_cols] = scaler_obj.fit_transform(X[numeric_cols])

    # ── 6. Train-test split ──
    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=config.test_size,
        random_state=42,
        stratify=y if y.nunique() <= 20 else None
    )

    # ── 7. Imbalance handling ──
    smote_applied = False
    class_dist_before = y_train.value_counts().to_dict()

    if config.imbalance_strategy == "smote":
        try:
            from imblearn.over_sampling import SMOTE
            y_train_int = y_train.astype(int)
            
            # Validasi: pastikan ini klasifikasi, bukan regresi
            if y_train_int.nunique() > 50:
                raise HTTPException(
                    400,
                    "SMOTE hanya untuk klasifikasi. Target column tampaknya continuous (>50 unique values). Gunakan 'None' atau 'Class Weight'."
                )
            
            sm = SMOTE(random_state=42)
            X_train, y_train = sm.fit_resample(X_train, y_train_int)
            y_train = pd.Series(y_train, name=config.target_column)
            smote_applied = True
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, f"SMOTE gagal: {str(e)}")

    class_dist_after = pd.Series(y_train).value_counts().to_dict()

    # ── 8. Store in session ──
    set_session_value(config.session_id, "X_train", X_train)
    set_session_value(config.session_id, "X_test", X_test)
    set_session_value(config.session_id, "y_train", y_train)
    set_session_value(config.session_id, "y_test", y_test)
    set_session_value(config.session_id, "feature_names", list(X.columns))
    set_session_value(config.session_id, "target_column", config.target_column)
    set_session_value(config.session_id, "scaler", scaler_obj)
    set_session_value(config.session_id, "label_encoders", label_encoders)
    set_session_value(config.session_id, "target_encoder", target_encoder)
    set_session_value(config.session_id, "preprocess_config", config.dict())
    set_session_value(config.session_id, "class_weight_strategy",
                      config.imbalance_strategy == "class_weight")

    return JSONResponse({
        "status": "success",
        "summary": {
            "rows_after_cleaning": len(df),
            "rows_dropped": dropped,
            "n_features": X_train.shape[1],
            "train_size": len(X_train),
            "test_size": len(X_test),
            "smote_applied": smote_applied,
            "class_distribution_before": {str(k): int(v) for k, v in class_dist_before.items()},
            "class_distribution_after": {str(k): int(v) for k, v in class_dist_after.items()},
            "feature_names": list(X.columns)[:20],  # preview only
            "total_features": X_train.shape[1],
        }
    })


@router.get("/config-hint/{session_id}")
async def get_config_hint(session_id: str):
    """Return suggested preprocessing config based on dataset analysis."""
    df: pd.DataFrame = get_session_value(session_id, "df_raw")
    if df is None:
        raise HTTPException(400, "Session tidak ditemukan.")

    hints = {}
    for col in df.columns:
        dtype = str(df[col].dtype)
        is_categorical = dtype in ["object", "category", "bool"]
        hints[col] = {
            "suggested_missing": "mode" if is_categorical else "mean",
            "suggested_encoding": "onehot" if is_categorical and df[col].nunique() <= 10
                                  else "label" if is_categorical else None,
            "missing_count": int(df[col].isnull().sum()),
            "unique_count": int(df[col].nunique()),
            "is_categorical": is_categorical,
        }

    return JSONResponse({"hints": hints})