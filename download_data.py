import kagglehub
import shutil
import os

# Download latest version of the dataset
path = kagglehub.dataset_download("sampadab17/network-intrusion-detection")

print("Path to dataset files:", path)

# Move the CSVs into your project data/raw folder
dest = "data/raw"
os.makedirs(dest, exist_ok=True)

# copy all CSV files to data/raw
for fname in os.listdir(path):
    if fname.endswith(".csv"):
        shutil.copy(os.path.join(path, fname), dest)
        print(f"Copied {fname} to {dest}")
