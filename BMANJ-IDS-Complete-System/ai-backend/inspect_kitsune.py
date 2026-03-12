import pandas as pd

df = pd.read_csv("data/raw/Kitsune_merged.csv")
print("Shape:", df.shape)
print("\nColumns:", df.columns.tolist())
print("\nClass distribution:")
print(df["class"].value_counts())
