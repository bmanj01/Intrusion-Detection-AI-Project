import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict

MODEL_PATH = "artifacts/model_tuned.pkl"  # or "artifacts/model.pkl"

print(f"Loading model from: {MODEL_PATH}")
bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
label_encoder = bundle["label_encoder"]
feature_columns = bundle["feature_columns"]

print(f"Model loaded. Number of features expected: {len(feature_columns)}")

app = FastAPI(
    title="NIDS Anomaly Detection API",
    description="Random Forest model trained on IDS2025, Kitsune, LuFlow, NF-UQ",
    version="1.0.0",
)

class PredictionItem(BaseModel):
    features: Dict[str, float]

class PredictionRequest(BaseModel):
    items: List[PredictionItem]

class PredictionResponseItem(BaseModel):
    predicted_label: str
    predicted_label_encoded: int
    anomaly_score: float
    raw_proba: Dict[str, float]

class PredictionResponse(BaseModel):
    results: List[PredictionResponseItem]


def build_feature_matrix(items: List[PredictionItem]) -> pd.DataFrame:
    raw_df = pd.DataFrame([item.features for item in items])

    # Ensure all expected feature columns exist
    for col in feature_columns:
        if col not in raw_df.columns:
            raw_df[col] = 0.0

    X = raw_df[feature_columns].copy()
    X = X.fillna(0.0)
    return X


@app.get("/")
def root():
    return {
        "message": "NIDS API is running",
        "model_path": MODEL_PATH,
        "n_features": len(feature_columns),
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    X = build_feature_matrix(req.items)

    proba = model.predict_proba(X)
    y_pred_enc = model.predict(X)
    y_pred = label_encoder.inverse_transform(y_pred_enc)

    classes = list(label_encoder.classes_)
    anomaly_index = classes.index("anomaly") if "anomaly" in classes else 0

    results = []
    for i in range(len(req.items)):
        row_proba = proba[i]
        proba_dict = {cls: float(row_proba[j]) for j, cls in enumerate(classes)}

        results.append(
            PredictionResponseItem(
                predicted_label=str(y_pred[i]),
                predicted_label_encoded=int(y_pred_enc[i]),
                anomaly_score=float(row_proba[anomaly_index]),
                raw_proba=proba_dict,
            )
        )

    return PredictionResponse(results=results)
