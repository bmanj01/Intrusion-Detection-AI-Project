import kagglehub
from pathlib import Path
import pandas as pd

DATASET = "aryashah2k/nfuqnidsv2-network-intrusion-detection-dataset"

print("[nfuq_probe] Downloading / locating dataset ...")
root = kagglehub.dataset_download(DATASET)
csv_path = Path(root) / "NF-UQ-NIDS-v2.csv"

print(f"[nfuq_probe] Using file: {csv_path}")

# Read just a sample (dataset is huge)
df = pd.read_csv(csv_path, nrows=20000, low_memory=False)
df.columns = df.columns.str.strip()
print("[nfuq_probe] Shape (sample):", df.shape)

print("\n[nfuq_probe] Columns:")
print(df.columns.tolist())

possible_labels = [
    "Label", "label", "class", "Class",
    "Attack", "attack", "Category", "category"
]
found = [c for c in possible_labels if c in df.columns]
print("\n[nfuq_probe] Possible label columns found:", found)

if found:
    c = found[0]
    print(f"\n[nfuq_probe] Value counts for '{c}':")
    print(df[c].value_counts().head(30))
else:
    print("\n[nfuq_probe] No obvious label column found in the sample.")
