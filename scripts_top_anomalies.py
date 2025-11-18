import pandas as pd
df = pd.read_csv("predictions_test.csv")
df.sort_values("anomaly_score", ascending=False).head(50).to_csv("artifacts/top50_anomalies.csv", index=False)
print("Saved artifacts/top50_anomalies.csv")
