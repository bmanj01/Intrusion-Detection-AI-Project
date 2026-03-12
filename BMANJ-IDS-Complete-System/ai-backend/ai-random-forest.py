import os
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)
import joblib

# -------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------
DATASETS = [
    ("IDS2025", "data/raw/IDS2025_merged.csv"),
    ("Kitsune", "data/raw/Kitsune_merged.csv"),
    ("LuFlow", "data/raw/LuFlow_merged.csv"),
    ("NFUQ", "data/raw/NF-UQ-NIDS-sample.csv"),
]

LABEL_COL = "class"          # all four datasets use 'class'
POSITIVE_CLASS = "anomaly"   # anomaly considered positive class

MODEL_DIR = "artifacts"
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")

MAX_ROWS_PER_DATASET = 50_000         # sampling limit
MAX_CATEGORIES_FOR_DUMMIES = 50       # one-hot encoding threshold

# any columns we do NOT want as features
NON_FEATURE_COLS = [
    LABEL_COL,
    "Label",
    "label",
    "Attack",
    "Dataset",
    "source_file",
    "scenario",
    "Unnamed: 0",
    "IPV4_SRC_ADDR",
    "IPV4_DST_ADDR",
]

# clipping range for all numeric features
CLIP_MIN = -1e6
CLIP_MAX = 1e6

# -------------------------------------------------------------
# UTILS
# -------------------------------------------------------------
def print_section(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def print_class_distribution(name, y):
    counts = Counter(y)
    total = sum(counts.values())
    print(f"\nClass distribution for {name}:")
    for cls, cnt in counts.items():
        print(f"  {cls:8s}: {cnt:7d} ({cnt / total:6.2%})")
    print(f"  TOTAL  : {total:7d}")


# -------------------------------------------------------------
# STEP 1: LOAD DATASETS
# -------------------------------------------------------------
print_section("STEP 1: LOADING INDIVIDUAL DATASETS")

X_parts = []
y_parts = []

for name, path in DATASETS:
    print(f"\n--- Dataset: {name} ---")
    print(f"Loading: {path}")

    df = pd.read_csv(path)
    print(f"Original shape: {df.shape}")

    # sample to avoid RAM issues
    if df.shape[0] > MAX_ROWS_PER_DATASET:
        df = df.sample(n=MAX_ROWS_PER_DATASET, random_state=42)
        print(f"Sampled down to: {df.shape}")
    else:
        print("Using full dataset (no sampling).")

    if LABEL_COL not in df.columns:
        raise KeyError(f"ERROR: '{LABEL_COL}' column missing in {path}")

    y = df[LABEL_COL].astype(str).str.lower()
    print_class_distribution(name, y)

    drop_cols = [c for c in NON_FEATURE_COLS if c in df.columns]
    print(f"Dropping columns: {drop_cols}")

    X = df.drop(columns=drop_cols)
    X["dataset"] = name  # keep dataset origin as a feature

    X_parts.append(X)
    y_parts.append(y)

    print(f"Feature shape after cleaning: {X.shape}")

# -------------------------------------------------------------
# STEP 2: COMBINE ALL DATASETS
# -------------------------------------------------------------
print_section("STEP 2: COMBINING DATASETS")

X_all = pd.concat(X_parts, ignore_index=True)
y_all = pd.concat(y_parts, ignore_index=True)

print(f"Combined features: {X_all.shape}")
print(f"Combined labels:   {y_all.shape}")

print_class_distribution("COMBINED DATA", y_all)

# -------------------------------------------------------------
# STEP 3: ENCODE FEATURES
# -------------------------------------------------------------
print_section("STEP 3: ENCODING FEATURES")

num_cols = X_all.select_dtypes(include=["number"]).columns.tolist()
cat_cols = X_all.select_dtypes(include=["object"]).columns.tolist()

print(f"Numeric columns: {len(num_cols)}")
print(f"Categorical columns: {len(cat_cols)}")

low_card_cols = []
high_card_cols = []

for col in cat_cols:
    uniq = X_all[col].nunique(dropna=False)
    if uniq <= MAX_CATEGORIES_FOR_DUMMIES:
        low_card_cols.append(col)
    else:
        high_card_cols.append((col, uniq))

print(f"\nCategorical (low-card) to one-hot encode: {low_card_cols}")
print("\nDropped high-card categorical columns:")
for c, n in high_card_cols:
    print(f"  {c}: {n} unique")

X_num = X_all[num_cols]

if low_card_cols:
    X_cat = pd.get_dummies(X_all[low_card_cols], drop_first=False)
    X_all_enc = pd.concat([X_num, X_cat], axis=1)
else:
    X_all_enc = X_num

print(f"\nEncoded feature matrix shape (before cleaning): {X_all_enc.shape}")

# -------------------------------------------------------------
# STEP 4: CLEAN / CLIP NUMERIC VALUES
# -------------------------------------------------------------
print_section("STEP 4: CLEANING & CLIPPING FEATURE VALUES")

# coerce all to numeric, non-numeric -> NaN
X_all_enc = X_all_enc.apply(pd.to_numeric, errors="coerce")

# to numpy for brute-force cleaning
arr = X_all_enc.to_numpy(dtype=np.float64, copy=True)

# replace NaNs with 0, +inf with CLIP_MAX, -inf with CLIP_MIN
arr = np.nan_to_num(arr, nan=0.0, posinf=CLIP_MAX, neginf=CLIP_MIN)

# clip all values into [CLIP_MIN, CLIP_MAX]
arr = np.clip(arr, CLIP_MIN, CLIP_MAX)

# back to DataFrame, keep float64
X_all_enc = pd.DataFrame(arr, columns=X_all_enc.columns)

print("Dtype summary (first few columns):")
print(X_all_enc.dtypes.head())
print("Feature matrix shape after cleaning:", X_all_enc.shape)

# -------------------------------------------------------------
# STEP 5: TRAIN/TEST SPLIT
# -------------------------------------------------------------
print_section("STEP 5: TRAIN / TEST SPLIT")

X_train, X_test, y_train, y_test = train_test_split(
    X_all_enc,
    y_all,
    test_size=0.2,
    stratify=y_all,
    random_state=42,
)

print(f"Train shape: {X_train.shape}")
print(f"Test shape:  {X_test.shape}")

print_class_distribution("TRAIN", y_train)
print_class_distribution("TEST", y_test)

# -------------------------------------------------------------
# STEP 6: LABEL ENCODING
# -------------------------------------------------------------
print_section("STEP 6: LABEL ENCODING")

le = LabelEncoder()
y_train_enc = le.fit_transform(y_train)
y_test_enc = le.transform(y_test)

print("Label mapping:")
print(dict(zip(le.classes_, le.transform(le.classes_))))

# -------------------------------------------------------------
# STEP 7: TRAIN MODEL
# -------------------------------------------------------------
print_section("STEP 7: TRAINING RANDOM FOREST")

rf = RandomForestClassifier(
    n_estimators=200,
    n_jobs=-1,
    random_state=42,
    verbose=1,
)

print("Fitting model...")
rf.fit(X_train, y_train_enc)
print("Training done.")

# -------------------------------------------------------------
# STEP 8: SAVE MODEL
# -------------------------------------------------------------
print_section("STEP 8: SAVING MODEL")

os.makedirs(MODEL_DIR, exist_ok=True)
joblib.dump(
    {
        "model": rf,
        "label_encoder": le,
        "feature_columns": list(X_all_enc.columns),
    },
    MODEL_PATH,
)

print(f"Model saved to {MODEL_PATH}")

# -------------------------------------------------------------
# STEP 9: EVALUATION
# -------------------------------------------------------------
print_section("STEP 9: EVALUATION")

y_pred_enc = rf.predict(X_test)
y_pred = le.inverse_transform(y_pred_enc)

y_true = y_test.str.lower()
y_pred = pd.Series(y_pred).str.lower()

accuracy = accuracy_score(y_true, y_pred)
precision = precision_score(y_true, y_pred, pos_label=POSITIVE_CLASS, zero_division=0)
recall = recall_score(y_true, y_pred, pos_label=POSITIVE_CLASS, zero_division=0)
f1 = f1_score(y_true, y_pred, pos_label=POSITIVE_CLASS, zero_division=0)

print("\n==============================")
print("  FINAL MODEL PERFORMANCE")
print("==============================")
print(f"Accuracy : {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall   : {recall:.4f}")
print(f"F1 Score : {f1:.4f}")

print("\nConfusion Matrix (rows/cols = [anomaly, normal]):")
print(confusion_matrix(y_true, y_pred, labels=[POSITIVE_CLASS, "normal"]))

print("\nClassification Report:")
print(classification_report(y_true, y_pred))

print_section("DONE")
print("Training + evaluation finished successfully.")
