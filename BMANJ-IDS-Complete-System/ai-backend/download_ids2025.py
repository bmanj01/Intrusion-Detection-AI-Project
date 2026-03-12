import kagglehub

DATASET = "prantokumar/ids-dataset-2025"

print("[ids2025] Downloading / locating dataset:", DATASET)
path = kagglehub.dataset_download(DATASET)
print("[ids2025] Dataset root:", path)
