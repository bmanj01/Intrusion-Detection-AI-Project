import pandas as pd
from pathlib import Path

# 👇 Paste any 3–5 of your CSV paths below
CANDIDATE_FILES = [
    r"C:\Users\Manja Brewah\.cache\kagglehub\datasets\mryanm\luflow-network-intrusion-detection-data-set\versions\277\2020\06\2020.06.19\2020.06.19.csv",
    r"C:\Users\Manja Brewah\.cache\kagglehub\datasets\mryanm\luflow-network-intrusion-detection-data-set\versions\277\2020\06\2020.06.20\2020.06.20.csv",
    r"C:\Users\Manja Brewah\.cache\kagglehub\datasets\mryanm\luflow-network-intrusion-detection-data-set\versions\277\2020\06\2020.06.21\2020.06.21.csv",
]

LABEL_CANDIDATES = [
    "label","Label","class","Class","attack","Attack","target","Target",
    "category","Category","is_malicious","malicious","anomaly","Anomaly","type","Type"
]

for path in CANDIDATE_FILES:
    print(f"\n🔍 Checking: {path}")
    try:
        df = pd.read_csv(path, nrows=10000, low_memory=False)
    except Exception as e:
        print(f"❌ Failed to load: {e}")
        continue

    print("Shape:", df.shape)
    print("Columns:", list(df.columns)[:30])
    found = [c for c in LABEL_CANDIDATES if c in df.columns]
    print("→ Found possible labels:", found)

    for c in found:
        print(f"\nValue counts for '{c}':")
        print(df[c].value_counts(dropna=False).head(15))
