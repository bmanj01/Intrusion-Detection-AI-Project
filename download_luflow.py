import kagglehub
from kagglehub import KaggleDatasetAdapter

# The dataset ID on Kaggle
dataset_id = "mryanm/luflow-network-intrusion-detection-data-set"

# If you know which CSV to load, specify it (we’ll detect if not)
file_path = ""

print("Downloading dataset:", dataset_id)
df = kagglehub.load_dataset(
    KaggleDatasetAdapter.PANDAS,
    dataset_id,
    file_path
)

print("Shape:", df.shape)
print("Columns:", df.columns.tolist())
print(df.head())
