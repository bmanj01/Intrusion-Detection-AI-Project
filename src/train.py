# src/train.py
import argparse
import os
import time

import joblib
import numpy as np
import pandas as pd

from imblearn.pipeline import Pipeline as ImbPipeline

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier

from utils import (
    set_seed,
    load_csv,
    split_save,
    numeric_and_categorical_columns,
    save_json,
)

# -----------------------
# Helper: Build preprocessing pipeline
# -----------------------
def build_preprocess(num_cols, cat_cols):
    """Build a ColumnTransformer with numeric + categorical pipelines."""
    num_pipe = ImbPipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    cat_pipe = ImbPipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("ohe", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    pre = ColumnTransformer(
        transformers=[
            ("num", num_pipe, num_cols),
            ("cat", cat_pipe, cat_cols),
        ]
    )
    return pre


# -----------------------
# Helper: Verbose printer
# -----------------------
def log(msg: str) -> None:
    print(f"[train] {msg}", flush=True)


# -----------------------
# Main training logic
# -----------------------
def main(args):
    set_seed(42)

    # === LOAD DATA ===
    log(f"Loading dataset from {args.data} ...")
    df = load_csv(args.data)

    # normalise column names
    df.columns = df.columns.str.strip().str.replace(r"\s+", "_", regex=True)
    target = args.target.strip().replace(" ", "_")

    assert target in df.columns, f"Target '{args.target}' not found in columns."

    log(f"Loaded dataframe shape: {df.shape}, target='{target}'")

    # === TRAIN / VAL / TEST SPLIT ===
    log("Splitting dataset into train/val/test (80/10/10) ...")
    split_save(
        df,
        target=target,
        out_dir="data/processed",
        test_size=0.2,
        val_size=0.1,
        seed=42,
    )

    train = pd.read_csv("data/processed/train.csv")
    val = pd.read_csv("data/processed/val.csv")

    y_train = train[target]
    X_train = train.drop(columns=[target])

    y_val = val[target]
    X_val = val.drop(columns=[target])

    log(f"Train shape: {X_train.shape}, Val shape: {X_val.shape}")

    # === FEATURE TYPES ===
    num_cols, cat_cols = numeric_and_categorical_columns(train, exclude=[target])
    log(f"Numeric columns: {len(num_cols)}, Categorical columns: {len(cat_cols)}")

    preprocess = build_preprocess(num_cols, cat_cols)

    # === MODEL PIPELINE (NO SMOTE ON FULL DATA) ===
    log("Building RandomForest pipeline (no SMOTE on full data) ...")
    clf = ImbPipeline(
        steps=[
            ("preprocess", preprocess),
            (
                "rf",
                RandomForestClassifier(
                    n_estimators=200,  # slightly reduced for speed
                    max_depth=None,
                    min_samples_split=2,
                    min_samples_leaf=1,
                    n_jobs=-1,
                    class_weight="balanced_subsample",
                    random_state=42,
                    verbose=1,  # RF internal verbosity
                ),
            ),
        ]
    )

    # === CROSS-VALIDATION ON A SUBSET ===
    MAX_CV_SAMPLES = 200_000  # cap for CV subset

    if len(X_train) > MAX_CV_SAMPLES:
        log(
            f"Train set is large ({len(X_train)} rows). "
            f"Using subset of {MAX_CV_SAMPLES} rows for cross-validation."
        )
        cv_indices = y_train.sample(n=MAX_CV_SAMPLES, random_state=42).index
        X_cv = X_train.loc[cv_indices]
        y_cv = y_train.loc[cv_indices]
    else:
        X_cv, y_cv = X_train, y_train

    log(f"CV subset shape: {X_cv.shape}")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = []
    n_splits = cv.get_n_splits()

    log("Running manual 5-fold StratifiedKFold cross-validation (AUC) ...")
    t0 = time.time()

    for fold, (tr_idx, te_idx) in enumerate(cv.split(X_cv, y_cv), start=1):
        log(
            f"[cv] Fold {fold}/{n_splits} - "
            f"train={len(tr_idx)} rows, val={len(te_idx)} rows"
        )

        X_tr, X_te = X_cv.iloc[tr_idx], X_cv.iloc[te_idx]
        y_tr, y_te = y_cv.iloc[tr_idx], y_cv.iloc[te_idx]

        # fresh copy of the pipeline per fold
        clf_fold = clone(clf)

        t_fold_start = time.time()
        clf_fold.fit(X_tr, y_tr)
        t_fold_fit = time.time() - t_fold_start
        log(f"[cv] Fold {fold} fit done in {t_fold_fit:.1f} sec")

        proba = None
        try:
            proba = clf_fold.predict_proba(X_te)
        except Exception:
            log(f"[cv] Fold {fold} has no predict_proba; skipping AUC.")

        if proba is not None:
            try:
                if len(np.unique(y_cv)) > 2:
                    auc = roc_auc_score(y_te, proba, multi_class="ovr")
                else:
                    auc = roc_auc_score(y_te, proba[:, 1])
                scores.append(auc)
                log(f"[cv] Fold {fold} AUC = {auc:.4f}")
            except Exception as e:
                log(f"[cv] Fold {fold} AUC computation failed: {e}")

    t_cv = time.time() - t0
    if scores:
        cv_auc = np.array(scores)
        log(f"[cv] Completed {len(scores)} folds in {t_cv/60:.1f} min")
        log(f"[cv] AUC mean±std = {cv_auc.mean():.4f} ± {cv_auc.std():.4f}")
        cv_auc_mean = float(cv_auc.mean())
        cv_auc_std = float(cv_auc.std())
    else:
        log("[cv] No valid AUC scores computed; setting to NaN.")
        cv_auc_mean = float("nan")
        cv_auc_std = float("nan")

    # === TRAIN FINAL MODEL ON FULL TRAINING DATA ===
    log("Fitting full training data (no SMOTE) ...")
    t_fit0 = time.time()
    clf.fit(X_train, y_train)
    log(f"Full training fit done in {(time.time() - t_fit0)/60:.1f} min")

    # === VALIDATION EVALUATION ===
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
        "cv_auc_mean": cv_auc_mean,
        "cv_auc_std": cv_auc_std,
        "val_classification_report": report,
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
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data",
        required=True,
        help="Path to labelled CSV file (e.g., data/raw/NF-UQ-NIDS-sample.csv)",
    )
    parser.add_argument(
        "--target",
        default="label",
        help="Target column name (default: 'label'; use 'class' for your IDS datasets)",
    )
    args = parser.parse_args()
    main(args)
