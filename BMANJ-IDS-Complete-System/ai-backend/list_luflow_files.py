import kagglehub
import os

dataset_id = "mryanm/luflow-network-intrusion-detection-data-set"
path = kagglehub.dataset_download(dataset_id)
print("Files inside dataset folder:\n")
for f in os.listdir(path):
    print(f)
