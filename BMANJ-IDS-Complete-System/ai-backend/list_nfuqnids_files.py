import os
from pathlib import Path
import kagglehub

dataset = "aryashah2k/nfuqnidsv2-network-intrusion-detection-dataset"

path = kagglehub.dataset_download(dataset)
print("Dataset root:", path)

exts = {".csv", ".parquet"}

files = []
for root, _, filenames in os.walk(path):
    for f in filenames:
        if Path(f).suffix.lower() in exts:
            files.append(Path(root) / f)

print(f"\nFound {len(files)} dataset files:")
for f in files[:30]:
    print("-", f)
