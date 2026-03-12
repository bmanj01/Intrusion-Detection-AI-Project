# src/report_plots.py
import json
import joblib
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import (
    RocCurveDisplay,
    ConfusionMatrixDisplay,
    classification_report,
    roc_auc_score
)

# === LOAD DATA & MODEL ===
test = pd.read_csv("data/processed/test.csv")
model = joblib.load("artifacts/model.joblib")

target_col = "class"
assert target_col in test.columns, f"Target column '{target_col}' not found."

y = test[target_col]
X = test.drop(columns=[target_col])

# === PREDICT ===
y_pred = model.predict(X)
try:
    y_proba = model.predict_proba(X)
except Exception:
    y_proba = None

# === CLASSIFICATION REPORT ===
print("\nClassification report:")
print(classification_report(y, y_pred))

# === CONFUSION MATRIX ===
ConfusionMatrixDisplay.from_predictions(y, y_pred)
plt.title("Confusion Matrix - Test")
plt.tight_layout()
plt.savefig("artifacts/confusion_matrix.png", bbox_inches="tight")
plt.close()

# === ROC CURVE ===
if y_proba is not None:
    unique_labels = sorted(list(pd.Series(y).unique()))
    if len(unique_labels) == 2:
        # Binary case → pick which is positive
        positive_label = "anomaly" if "anomaly" in unique_labels else unique_labels[1]
        print(f"\nUsing pos_label='{positive_label}' for ROC curve.")
        RocCurveDisplay.from_predictions(y, y_proba[:, 1], pos_label=positive_label)
        auc_val = roc_auc_score((y == positive_label).astype(int), y_proba[:, 1])
        print(f"Test AUC: {auc_val:.4f}")
    else:
        # Multiclass → One-vs-Rest
        from sklearn.preprocessing import label_binarize
        from itertools import cycle
        from sklearn.metrics import roc_curve, auc

        y_bin = label_binarize(y, classes=unique_labels)
        fpr, tpr, roc_auc = {}, {}, {}
        for i, lbl in enumerate(unique_labels):
            fpr[lbl], tpr[lbl], _ = roc_curve(y_bin[:, i], y_proba[:, i])
            roc_auc[lbl] = auc(fpr[lbl], tpr[lbl])
        plt.figure()
        colors = cycle(["blue", "red", "green", "purple", "orange"])
        for lbl, color in zip(unique_labels, colors):
            plt.plot(fpr[lbl], tpr[lbl], color=color, lw=2,
                     label=f"{lbl} (AUC = {roc_auc[lbl]:.2f})")
        plt.plot([0, 1], [0, 1], "k--", lw=1)
        plt.xlabel("False Positive Rate")
        plt.ylabel("True Positive Rate")
        plt.title("ROC Curves - Multiclass")
        plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig("artifacts/roc_curve.png", bbox_inches="tight")
    plt.close()
    print("Saved ROC curve → artifacts/roc_curve.png")

print("Saved confusion matrix → artifacts/confusion_matrix.png")