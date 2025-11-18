import kagglehub

dataset = "aryashah2k/nfuqnidsv2-network-intrusion-detection-dataset"

print("Downloading dataset:", dataset)
path = kagglehub.dataset_download(dataset)

print("\nDataset downloaded to:")
print(path)
