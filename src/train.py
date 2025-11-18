# src/train.py
import argparse, os, sys
import joblib
import numpy as np
import pandas as pd

from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier

from utils import set_seed, load_csv, split_save, numeric_and_categorical_columns, save_json


# -----------------------
# Helper: Build preprocessing pipeline
# -----------------------
def build_preprocess(num_cols, cat_cols):
    num_pipe = ImbPipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler())
    ])
    cat_pipe = ImbPipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("ohe",     OneHotEncoder(handle_unknown="ignore"))
    ])
    pre = ColumnTransformer(
        transformers=[
            ("num", num_pipe, num_cols),
            ("cat", cat_pipe, cat_cols)
        ]
    )
    return pre


# -----------------------
# Helper: Verbose printer
# -----------------------
def log(msg):
    print(f"[train] {msg}", flush=True)


# -----------------------
# Main training logic
# -----------------------
def main(args):
    set_seed(42)

    # === LOAD DATA ===
    log(f"Loading dataset from {args.data} ...")
    df = load_csv(args.data)
    df.columns = df.columns.str.strip().str.replace(r"\s+", "_", regex=True)
    target = args.target.strip().replace(" ", "_")
    assert target in df.columns, f"Target '{args.target}' not found."
    log(f"Loaded dataframe shape: {df.shape}, target='{target}'")

    # === SPLIT DATA ===
    log("Splitting dataset into train/val/test (80/10/10) ...")
    split_save(df, target=target, out_dir="data/processed", test_size=0.2, val_size=0.1, seed=42)

    train = pd.read_csv("data/processed/train.csv")
    val   = pd.read_csv("data/processed/val.csv")

    y_train = train[target]
    X_train = train.drop(columns=[target])
    y_val   = val[target]
    X_val   = val.drop(columns=[target])

    log(f"Train shape: {X_train.shape}, Val shape: {X_val.shape}")

    # === FEATURE TYPES ===
    num_cols, cat_cols = numeric_and_categorical_columns(train, exclude=[target])
    log(f"Numeric columns: {len(num_cols)}, Categorical columns: {len(cat_cols)}")

    preprocess = build_preprocess(num_cols, cat_cols)

    # === MODEL PIPELINE ===
    log("Building RandomForest + SMOTE pipeline ...")
    clf = ImbPipeline(steps=[
        ("preprocess", preprocess),
        ("smote", SMOTE(random_state=42)),
        ("rf", RandomForestClassifier(
            n_estimators=400,
            max_depth=None,
            min_samples_split=2,
            min_samples_leaf=1,
            n_jobs=-1,
            class_weight="balanced_subsample",
            random_state=42,
            verbose=1   # <-- enables RandomForest verbosity
        ))
    ])

    # === CROSS-VALIDATION ===
    log("Running 5-fold StratifiedKFold cross-validation (AUC) ...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scoring = "roc_auc_ovr" if len(np.unique(y_train)) > 2 else "roc_auc"
    cv_auc = cross_val_score(clf, X_train, y_train, scoring=scoring, cv=cv, n_jobs=-1)
    log(f"Cross-val AUC mean±std = {np.mean(cv_auc):.4f} ± {np.std(cv_auc):.4f}")

    # === TRAIN MODEL ===
    log("Fitting full training data ...")
    clf.fit(X_train, y_train)

    # === VALIDATION ===
    log("Evaluating on validation split ...")
    y_val_pred = clf.predict(X_val)
    try:
        y_val_proba = clf.predict_proba(X_val)
    except Exception:
        y_val_proba = None

    # === METRICS ===
    log("Calculating metrics ...")
    report = classification_report(y_val, y_val_pred, output_dict=True)
    metrics = {
        "cv_auc_mean": float(np.mean(cv_auc)),
        "cv_auc_std":  float(np.std(cv_auc)),
        "val_classification_report": report
    }
    if y_val_proba is not None:
        try:
            if len(np.unique(y_train)) > 2:
                auc_val = roc_auc_score(y_val, y_val_proba, multi_class="ovr")
            else:
                auc_val = roc_auc_score(y_val, y_val_proba[:, 1])
            metrics["val_auc"] = float(auc_val)
            log(f"Validation AUC: {auc_val:.4f}")
        except Exception as e:
            log(f"AUC computation failed: {e}")

    # === SAVE ARTIFACTS ===
    os.makedirs("artifacts", exist_ok=True)
    joblib.dump(clf, "artifacts/model.joblib")
    save_json(metrics, "artifacts/metrics.json")
    log("Saved model and metrics to artifacts/")

    # === CONSOLE SUMMARY ===
    print("\n==================== RESULTS SUMMARY ====================")
    print(f"CV AUC (mean±std): {metrics['cv_auc_mean']:.4f} ± {metrics['cv_auc_std']:.4f}")
    if "val_auc" in metrics:
        print(f"Validation AUC: {metrics['val_auc']:.4f}")
    print("\nValidation classification report:")
    from pprint import pprint
    pprint(report)
    print("=========================================================")


# -----------------------
# Entry point
# -----------------------
if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True, help="Path to labelled CSV file")
    p.add_argument("--target", default="label", help="Target column name (default: 'label')")
    args = p.parse_args()
    main(args)