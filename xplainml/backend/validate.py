import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix
import shap

print("=" * 50)
print("XplainML Validation Script")
print("=" * 50)

# ── Load dataset ──────────────────────────────────
df = pd.read_csv("data/samples/titanic.csv", sep=None, engine="python")
print(f"\n[Dataset] Titanic: {df.shape[0]} rows x {df.shape[1]} cols")

# ── Preprocessing ─────────────────────────────────
df = df.drop(columns=["Name", "Ticket", "Cabin", "PassengerId"], errors="ignore")
df = df.dropna()

for col in df.select_dtypes("object").columns:
    df[col] = LabelEncoder().fit_transform(df[col])

X = df.drop(columns=["Survived"])
y = df["Survived"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"[Split] Train: {len(X_train)} | Test: {len(X_test)}")

# ── Train ─────────────────────────────────────────
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

acc = accuracy_score(y_test, y_pred)
f1  = f1_score(y_test, y_pred, average="binary")
print(f"\n[Metrics - Random Forest]")
print(f"  Accuracy : {acc:.4f} ({acc*100:.1f}%)")
print(f"  F1 Score : {f1:.4f} ({f1*100:.1f}%)")
print(f"\n[Confusion Matrix]")
print(confusion_matrix(y_test, y_pred))

# ── SHAP ─────────────────────────────────────────
print(f"\n[SHAP] Computing...")
explainer   = shap.TreeExplainer(model)
shap_values = explainer(X_test)

sv = shap_values.values
if sv.ndim == 3:
    sv = sv[:, :, 1]

mean_abs = np.abs(sv).mean(axis=0)
ranking  = sorted(zip(X.columns, mean_abs), key=lambda x: x[1], reverse=True)

print(f"\n[SHAP] Top 10 Feature Importance:")
for i, (feat, val) in enumerate(ranking[:10], 1):
    print(f"  {i:2}. {feat:<35} {val:.6f}")

print("\n" + "=" * 50)
print("Validation complete.")
print("Compare these numbers with what XplainML shows.")
print("=" * 50)