import os
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
from scipy.stats import randint, uniform
import joblib

# -------------------------------------------------------------
# CONFIG – SAME AS YOUR MAIN MODEL
# -------------------------------------------------------------
DATASETS = [
    ("IDS2025", "data/raw/IDS2025_merged.csv"),
    ("Kitsune", "data/raw/Kitsune_merged.csv"),
    ("LuFlow", "data/raw/LuFlow_merged.csv"),
    ("NFUQ", "data/raw/NF-UQ-NIDS-sample.csv"),
]

LABEL_COL = "class"
POSITIVE_CLASS = "anomaly"

MAX_ROWS_PER_DATASET = 20_000
MAX_CATEGORIES_FOR_DUMMIES = 50

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

CLIP_MIN = -1e6
CLIP_MAX = 1e6

MODEL_DIR = "artifacts"
MODEL_PATH = os.path.join(MODEL_DIR, "model_tuned.pkl")


def print_section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def print_class_dist(name, y):
    print(f"\nClass distribution for {name}:")
    counter = Counter(y)
    total = sum(counter.values())
    for cls, count in counter.items():
        print(f"  {cls:10s}: {count:7d}  ({count/total:6.2%})")
    print(f"  TOTAL      : {total}")


# -------------------------------------------------------------
# STEP 1: LOAD DATA (VERBOSE)
# -------------------------------------------------------------
print_section("STEP 1: LOADING ALL DATASETS (VERBOSE)")

X_parts = []
y_parts = []

for name, path in DATASETS:
    print(f"\n------ Loading dataset: {name} ------")
    print("Path:", path)

    df = pd.read_csv(path)
    print("Original shape:", df.shape)

    # Sample down for tuning
    if df.shape[0] > MAX_ROWS_PER_DATASET:
        df = df.sample(MAX_ROWS_PER_DATASET, random_state=42)
        print("Sampled shape:", df.shape)

    if LABEL_COL not in df.columns:
        raise ValueError(f"ERROR: '{LABEL_COL}' not found in {path}")

    y = df[LABEL_COL].astype(str).str.lower()
    print_class_dist(name, y)

    drop = [c for c in NON_FEATURE_COLS if c in df.columns]
    X = df.drop(columns=drop)

    X["dataset"] = name  # keep origin as feature

    X_parts.append(X)
    y_parts.append(y)

# Combine datasets
X_all = pd.concat(X_parts, ignore_index=True)
y_all = pd.concat(y_parts, ignore_index=True)

print("\n>>> Combined X shape:", X_all.shape)
print(">>> Combined y shape:", y_all.shape)
print_class_dist("ALL DATASETS (COMBINED)", y_all)

# -------------------------------------------------------------
# STEP 2: ENCODING (VERBOSE)
# -------------------------------------------------------------
print_section("STEP 2: FEATURE ENCODING (VERBOSE)")

num_cols = X_all.select_dtypes(include=["number"]).columns.tolist()
cat_cols = X_all.select_dtypes(include=["object"]).columns.tolist()

print("Numeric columns:", len(num_cols))
print("Categorical columns:", len(cat_cols))

low_card = [c for c in cat_cols if X_all[c].nunique() <= MAX_CATEGORIES_FOR_DUMMIES]
print("Low-cardinality categorical columns:", low_card)

X_num = X_all[num_cols]
X_cat = pd.get_dummies(X_all[low_card], drop_first=False)

X_all_enc = pd.concat([X_num, X_cat], axis=1)
print("Encoded shape BEFORE cleaning:", X_all_enc.shape)

# Clean infinite and NaN
print("\nCleaning infinities and NaNs... (verbose)")

X_all_enc = X_all_enc.apply(pd.to_numeric, errors="coerce")
arr = X_all_enc.to_numpy(dtype=np.float64, copy=True)

num_inf_before = np.isinf(arr).sum()
num_nan_before = np.isnan(arr).sum()
print(f"Before cleaning → inf: {num_inf_before}, nan: {num_nan_before}")

arr = np.nan_to_num(arr, nan=0.0, posinf=CLIP_MAX, neginf=CLIP_MIN)
arr = np.clip(arr, CLIP_MIN, CLIP_MAX)

num_inf_after = np.isinf(arr).sum()
num_nan_after = np.isnan(arr).sum()
print(f"After cleaning  → inf: {num_inf_after}, nan: {num_nan_after}")

X_all_enc = pd.DataFrame(arr, columns=X_all_enc.columns)

print("Encoded shape AFTER cleaning:", X_all_enc.shape)

# -------------------------------------------------------------
# STEP 3: TRAIN/VALID SPLIT
# -------------------------------------------------------------
print_section("STEP 3: TRAIN/VALIDATION SPLIT")

X_train, X_valid, y_train, y_valid = train_test_split(
    X_all_enc,
    y_all,
    test_size=0.2,
    random_state=42,
    stratify=y_all
)

print("X_train:", X_train.shape)
print("X_valid:", X_valid.shape)
print_class_dist("TRAIN", y_train)
print_class_dist("VALID", y_valid)

# -------------------------------------------------------------
# STEP 4: LABEL ENCODING
# -------------------------------------------------------------
print_section("STEP 4: LABEL ENCODING")

le = LabelEncoder()
y_train_enc = le.fit_transform(y_train)
y_valid_enc = le.transform(y_valid)

print("Label mapping:")
for cls, enc in zip(le.classes_, le.transform(le.classes_)):
    print(f"  {cls:10s} → {enc}")

# -------------------------------------------------------------
# STEP 5: RANDOM FOREST TUNING (VERY VERBOSE)
# -------------------------------------------------------------
print_section("STEP 5: RANDOM FOREST HYPERPARAMETER TUNING (VERBOSE)")

rf = RandomForestClassifier(random_state=42, n_jobs=-1)

param_space = {
    "n_estimators": randint(50, 300),
    "max_depth": [None] + list(range(5, 31, 5)),
    "min_samples_split": randint(2, 20),
    "min_samples_leaf": randint(1, 10),
    "max_features": ["sqrt", "log2", None],
    "bootstrap": [True, False],
    "class_weight": [None, "balanced"],
}

print("\nParameter search space:")
for k, v in param_space.items():
    print(f"  {k}: {v}")

search = RandomizedSearchCV(
    estimator=rf,
    param_distributions=param_space,
    n_iter=20,
    cv=3,
    scoring="f1",
    n_jobs=-1,
    verbose=3,   # VERY VERBOSE OUTPUT
    random_state=42,
)

print("\nStarting RandomizedSearchCV (this will print each fold)...")
search.fit(X_train, y_train_enc)

print("\n>>> BEST PARAMETERS FOUND:")
print(search.best_params_)
print(f"Best Cross-Validation F1 Score: {search.best_score_:.4f}")

# -------------------------------------------------------------
# STEP 6: FINAL VALIDATION
# -------------------------------------------------------------
print_section("STEP 6: FINAL VALIDATION RESULTS")

best = search.best_estimator_
pred_valid = best.predict(X_valid)
pred_valid_labels = le.inverse_transform(pred_valid)

print("\nValidation Classification Report:")
print(classification_report(y_valid, pred_valid_labels))

# -------------------------------------------------------------
# STEP 7: SAVE TUNED MODEL
# -------------------------------------------------------------
print_section("STEP 7: SAVING TUNED MODEL")

os.makedirs(MODEL_DIR, exist_ok=True)

bundle = {
    "model": best,
    "label_encoder": le,
    "feature_columns": list(X_all_enc.columns),
    "best_params": search.best_params_,
    "best_cv_f1": search.best_score_,
}

joblib.dump(bundle, MODEL_PATH)

print(f"Tuned model saved → {MODEL_PATH}")
print("\nAll done! 🎉")
