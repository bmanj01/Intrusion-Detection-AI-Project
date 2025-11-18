import kagglehub, os
from pathlib import Path

DATASET = "mryanm/luflow-network-intrusion-detection-data-set"

# Download the dataset
path = kagglehub.dataset_download(DATASET)
print("Dataset root:", path)

# File extensions we care about
exts = {".csv", ".parquet"}

# Collect files recursively
files = []
for root, _, fnames in os.walk(path):
    for f in fnames:
        if Path(f).suffix.lower() in exts:
            files.append(Path(root) / f)

print(f"\nFound {len(files)} data files.\n")
for f in files[:20]:
    print("-", f)
