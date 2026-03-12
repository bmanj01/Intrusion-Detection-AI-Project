# src/evaluate.py
import argparse, json
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score


def log(msg):
    print(f"[eval] {msg}", flush=True)


def normalize_headers_and_target(df: pd.DataFrame, target_arg: str):
    df.columns = df.columns.str.strip().str.replace(r"\s+", "_", regex=True)
    target = target_arg.strip().replace(" ", "_")
    return df, target


def try_find_alt_target(df: pd.DataFrame, requested: str):
    """Try common alternatives if requested target not present."""
    candidates = [requested, "class", "Class", "label", "Label", "category", "Category"]
    for c in candidates:
        c_norm = c.strip().replace(" ", "_")
        if c_norm in df.columns:
            if c_norm != requested:
                log(f"Target '{requested}' not found. Using detected '{c_norm}' instead.")
            return c_norm
    return None


def main(args):
    # === LOAD ARTIFACTS ===
    log(f"Loading model from {args.model}")
    model = joblib.load(args.model)

    log(f"Loading test data from {args.test}")
    test = pd.read_csv(args.test, encoding="utf-8-sig", low_memory=False)
    log(f"Test shape (raw): {test.shape}")

    test, target = normalize_headers_and_target(test, args.target)

    # === FIND TARGET ===
    if target not in test.columns:
        alt = try_find_alt_target(test, target)
        if alt is not None:
            target = alt

    if target not in test.columns:
        if args.predict_only_if_no_label:
            log(f"Target '{args.target}' not found. Running prediction-only mode.")
            X = test.copy()
            preds = model.predict(X)
            out = X.copy()
            out["prediction"] = preds

            # Try probabilities
            try:
                proba = model.predict_proba(X)
                if proba.shape[1] == 2:
                    out["anomaly_score"] = proba[:, 1]
                else:
                    classes = getattr(model.named_steps.get("rf", None), "classes_", None)
                    if classes is None:
                        try:
                            classes = model.classes_
                        except Exception:
                            classes = [f"class_{i}" for i in range(proba.shape[1])]
                    for i, cls in enumerate(classes):
                        out[f"proba_{cls}"] = proba[:, i]
            except Exception:
                pass

            out_path = args.out_predictions or "predictions_from_evaluate.csv"
            out.to_csv(out_path, index=False)
            log(f"Saved predictions to {out_path}")
            return
        else:
            raise KeyError(
                f"Target column not found. Tried '{args.target}' and common alternatives. "
                f"Use --predict-only-if-no-label to run without labels."
            )

    # === SPLIT X/Y ===
    y = test[target]
    X = test.drop(columns=[target])
    log(f"Using target='{target}'. X: {X.shape}, y: {y.shape}. Labels: {sorted(list(pd.Series(y).unique()))[:20]}")

    # === PREDICT ===
    log("Running predictions ...")
    y_pred = model.predict(X)

    try:
        y_proba = model.predict_proba(X)
    except Exception:
        y_proba = None

    # === METRICS ===
    log("Computing metrics ...")
    rep = classification_report(y, y_pred, output_dict=True)
    cm = confusion_matrix(y, y_pred)

    print("\nClassification report:")
    print(classification_report(y, y_pred))
    print("\nConfusion matrix:")
    print(cm)

    auc_val = None
    if y_proba is not None:
        try:
            classes = sorted(list(pd.Series(y).unique()))
            if len(classes) > 2:
                auc_val = roc_auc_score(y, y_proba, multi_class="ovr")
            else:
                auc_val = roc_auc_score(y, y_proba[:, 1])
            print(f"\nTest AUC: {auc_val:.4f}")
        except Exception as e:
            log(f"AUC computation skipped: {e}")

    metrics = {
        "classification_report": rep,
        "confusion_matrix": cm.tolist(),
    }
    if auc_val is not None:
        metrics["auc"] = float(auc_val)

    # === SAVE METRICS JSON ===
    if args.save_metrics:
        with open(args.save_metrics, "w") as f:
            json.dump(metrics, f, indent=2)
        log(f"Saved metrics JSON to {args.save_metrics}")

    # === SAVE PREDICTIONS CSV ===
    if args.out_predictions:
        out = X.copy()
        out[target] = y
        out["prediction"] = y_pred
        if y_proba is not None:
            if y_proba.shape[1] == 2:
                out["anomaly_score"] = y_proba[:, 1]
            else:
                classes = getattr(model.named_steps.get("rf", None), "classes_", None)
                if classes is None:
                    try:
                        classes = model.classes_
                    except Exception:
                        classes = [f"class_{i}" for i in range(y_proba.shape[1])]
                for i, cls in enumerate(classes):
                    out[f"proba_{cls}"] = y_proba[:, i]
        out.to_csv(args.out_predictions, index=False)
        log(f"Saved predictions CSV to {args.out_predictions}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", required=True, help="Path to test CSV")
    ap.add_argument("--model", required=True, help="Path to model.joblib")
    ap.add_argument("--target", default="class", help="Target column name (default: 'class')")
    ap.add_argument("--predict-only-if-no-label", action="store_true",
                    help="If target column is missing, run prediction-only and save CSV instead of erroring.")
    ap.add_argument("--out-predictions", default=None,
                    help="Optional path to save per-row predictions (CSV).")
    ap.add_argument("--save-metrics", default=None,
                    help="Optional path to save metrics JSON.")
    args = ap.parse_args()
    main(args)
