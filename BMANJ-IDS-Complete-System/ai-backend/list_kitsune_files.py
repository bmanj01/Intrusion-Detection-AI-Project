import os
from pathlib import Path
import kagglehub

DATASET = "ymirsky/network-attack-dataset-kitsune"

print("[kitsune] Locating dataset root ...")
root = kagglehub.dataset_download(DATASET)
print("[kitsune] Dataset root:", root)

exts = {".csv"}

files = []
for r, _, fs in os.walk(root):
    for f in fs:
        if Path(f).suffix.lower() in exts:
            files.append(Path(r) / f)

print(f"\n[kitsune] Found {len(files)} CSV files.\n")
for f in files[:50]:
    print("-", f)
