# --- src/predict.py ---
import argparse, joblib, pandas as pd

def main(args):
    model = joblib.load(args.model)
    df = pd.read_csv(args.input)

    preds = model.predict(df)
    out = df.copy()
    out["prediction"] = preds

    # try probabilities
    try:
        proba = model.predict_proba(df)
        # if binary, store positive class prob as 'anomaly_score'
        if proba.shape[1] == 2:
            out["anomaly_score"] = proba[:, 1]
        else:
            # multi-class: write one column per class
            classes = model.named_steps["rf"].classes_
            for i, cls in enumerate(classes):
                out[f"proba_{cls}"] = proba[:, i]
    except Exception:
        pass

    out.to_csv(args.out, index=False)
    print(f"Saved predictions to {args.out}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--input", required=True, help="CSV with same feature columns as training (no label)")
    ap.add_argument("--out", default="predictions.csv")
    args = ap.parse_args()
    main(args)
