import os
from pathlib import Path
import kagglehub

DATASET = "prantokumar/ids-dataset-2025"

print("[ids2025] Locating dataset root ...")
root = kagglehub.dataset_download(DATASET)
print("[ids2025] Dataset root:", root)

exts = {".csv"}

files = []
for r, _, fs in os.walk(root):
    for f in fs:
        if Path(f).suffix.lower() in exts:
            files.append(Path(r) / f)

print(f"\n[ids2025] Found {len(files)} CSV files.\n")
for f in files[:50]:
    print("-", f)
