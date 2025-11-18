import pandas as pd
df = pd.read_csv("data/raw/Test_data.csv", encoding="utf-8-sig")
df.columns = df.columns.str.strip()
print("Columns:", df.columns.tolist())
candidates = ["class","Class","label","Label","category","Category"]
print("Found:", [c for c in candidates if c in df.columns])
if "class" in df.columns:
    print("class values:", df["class"].unique()[:10])
