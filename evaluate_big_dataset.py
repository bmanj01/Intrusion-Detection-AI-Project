import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

# -------------------------------------------------------------
# Paths
# -------------------------------------------------------------
TRUTH_PATH = "data/raw/Test_data.csv"      # true labels live here
PRED_PATH = "predictions_test.csv"        # your model outputs

PRED_COL = "prediction"                   # from predictions_test.csv
POSITIVE_CLASS = "anomaly"                # treat "anomaly" as positive class

# -------------------------------------------------------------
# Load data
# -------------------------------------------------------------
print(f"Loading true data from: {TRUTH_PATH}")
df_true = pd.read_csv(TRUTH_PATH)
print("True data shape:", df_true.shape)

print(f"\nLoading predictions from: {PRED_PATH}")
df_pred = pd.read_csv(PRED_PATH)
print("Predictions shape:", df_pred.shape)

print("\nColumns in predictions_test.csv:")
print(df_pred.columns.tolist())

# Feature columns = everything except prediction + anomaly_score
feature_cols = [c for c in df_pred.columns if c not in ["prediction", "anomaly_score"]]

print("\nFeature columns used for matching:")
print(feature_cols)

# -------------------------------------------------------------
# Guess the label column in Test_data.csv
# -------------------------------------------------------------
candidate_label_cols = [c for c in df_true.columns if c not in feature_cols]

print("\nColumns in Test_data.csv that are NOT features (candidates for label):")
print(candidate_label_cols)

preferred_names = ["class", "label", "attack", "target"]
label_col = None

for name in preferred_names:
    if name in candidate_label_cols:
        label_col = name
        break

if label_col is None:
    # fallback: last candidate
    label_col = candidate_label_cols[-1]

print(f"\nUsing '{label_col}' as label column.")

# -------------------------------------------------------------
# Merge on feature columns to align rows one-to-one
# -------------------------------------------------------------
print("\nMerging true data with predictions on feature columns...")
merged = df_pred.merge(
    df_true[feature_cols + [label_col]],
    on=feature_cols,
    how="inner",
    suffixes=("", "_true"),
)

print("Merged shape:", merged.shape)

if len(merged) != len(df_pred):
    print(
        f"WARNING: Only {len(merged)} of {len(df_pred)} prediction rows "
        f"could be matched to Test_data.csv by features."
    )

# -------------------------------------------------------------
# Extract y_true / y_pred
# -------------------------------------------------------------
y_pred = merged[PRED_COL].astype(str).str.lower()
y_true = merged[label_col].astype(str).str.lower()

print("\nSample y_true vs y_pred:")
print(merged[[label_col, PRED_COL]].head())

# -------------------------------------------------------------
# Metrics
# -------------------------------------------------------------
accuracy = accuracy_score(y_true, y_pred)
precision = precision_score(y_true, y_pred, pos_label=POSITIVE_CLASS, zero_division=0)
recall = recall_score(y_true, y_pred, pos_label=POSITIVE_CLASS, zero_division=0)
f1 = f1_score(y_true, y_pred, pos_label=POSITIVE_CLASS, zero_division=0)

print("\n==============================")
print(" MODEL EVALUATION ON BIG DATA")
print("==============================")
print(f"Accuracy : {accuracy:.4f}")
print(f"Precision: {precision:.4f} (positive class: '{POSITIVE_CLASS}')")
print(f"Recall   : {recall:.4f}")
print(f"F1-score : {f1:.4f}")

print("\nConfusion Matrix (rows/cols = [anomaly, normal]):")
labels_order = [POSITIVE_CLASS, "normal"]
print(confusion_matrix(y_true, y_pred, labels=labels_order))

print("\nDetailed Classification Report:")
print(classification_report(y_true, y_pred, zero_division=0))
