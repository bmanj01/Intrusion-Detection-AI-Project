import pandas as pd
from pathlib import Path

p = Path("data/raw/Train_data.csv")
# handle BOM + stray spaces in headers
df = pd.read_csv(p, encoding="utf-8-sig")
df.columns = df.columns.str.strip()

print("Shape:", df.shape)
print("\nColumns:")
print(df.columns.tolist())

# Common label names seen in IDS datasets
candidates = ["label","Label","class","Class","attack","Attack","attack_type","Attack_type",
              "category","Category","target","Target","outcome","Outcome","intrusion","Intrusion"]

found = [c for c in candidates if c in df.columns]
print("\nTargets found among common names:", found)

if found:
    t = found[0]
    print(f"\nValue counts for '{t}':")
    print(df[t].value_counts().head(30))
else:
    # Heuristic: show small-cardinality columns (likely labels)
    low_card = [(c, df[c].nunique()) for c in df.columns if df[c].nunique() <= 30]
    low_card.sort(key=lambda x: x[1])
    print("\nLow-cardinality columns (<=30 uniques):")
    for c, n in low_card:
        print(f"{c}: {n} uniques")
