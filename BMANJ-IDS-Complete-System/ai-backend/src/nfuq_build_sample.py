import kagglehub
from pathlib import Path
import pandas as pd
import numpy as np

DATASET = "aryashah2k/nfuqnidsv2-network-intrusion-detection-dataset"
OUT = Path("data/raw/NF-UQ-NIDS-sample.csv")

# knobs you can tweak if needed
CHUNKSIZE = 200_000        # rows per chunk
SAMPLE_FRAC = 0.05         # 5% of each chunk
TOTAL_ROWS_CAP = 1_000_000 # max rows total
RANDOM_SEED = 42

def detect_label_column(cols):
    candidates = ["Label", "label", "class", "Class", "Attack", "attack", "Category", "category"]
    cols = [c.strip() for c in cols]
    for c in candidates:
        if c in cols:
            return c
    return None

def map_to_class(df, label_col):
    """Create 'class' column as 'normal' or 'anomaly' based on label/attack."""
    col = label_col
    s = df[col]

    # numeric 0/1 label -> assume 0 = normal, 1 = anomaly
    if np.issubdtype(s.dropna().dtype, np.number):
        df["class"] = s.astype(float).map(lambda x: "normal" if x == 0.0 else "anomaly")
        return df

    # string labels (fallback)
    s = s.astype(str).str.strip().str.lower()
    if col.lower() in ("attack", "category"):
        df["class"] = s.map(lambda x: "normal" if x in {"benign", "normal"} else "anomaly")
    else:
        df["class"] = s.map(lambda x: "normal" if x in {"benign", "normal"} else "anomaly")
    return df

def main():
    print("[nfuq_sample] Locating dataset ...")
    root = kagglehub.dataset_download(DATASET)
    csv_path = Path(root) / "NF-UQ-NIDS-v2.csv"
    print(f"[nfuq_sample] Reading from {csv_path}")

    OUT.parent.mkdir(parents=True, exist_ok=True)

    # detect label column from a small head
    head = pd.read_csv(csv_path, nrows=5000, low_memory=False)
    head.columns = head.columns.str.strip()
    label_col = detect_label_column(head.columns)
    if label_col is None:
        raise RuntimeError("Could not detect label column automatically.")
    print(f"[nfuq_sample] Detected label column: '{label_col}'")

    wrote_header = False
    total_rows = 0

    for i, chunk in enumerate(pd.read_csv(csv_path, chunksize=CHUNKSIZE, low_memory=False)):
        if total_rows >= TOTAL_ROWS_CAP:
            print(f"[nfuq_sample] Reached TOTAL_ROWS_CAP={TOTAL_ROWS_CAP}, stopping.")
            break

        print(f"[nfuq_sample] Chunk {i} - original shape: {chunk.shape}")

        chunk.columns = chunk.columns.str.strip()
        if label_col not in chunk.columns:
            print(f"[nfuq_sample] WARNING: label column '{label_col}' missing in this chunk, skipping.")
            continue

        # drop very high-cardinality purely identifier columns if you like
        drop_cols = ["IPV6_SRC_ADDR", "IPV6_DST_ADDR"]
        chunk = chunk.drop(columns=[c for c in drop_cols if c in chunk.columns], errors="ignore")

        # sample down the chunk
        if SAMPLE_FRAC < 1.0:
            chunk = chunk.sample(frac=SAMPLE_FRAC, random_state=RANDOM_SEED)
        if chunk.empty:
            continue

        # map label -> class
        chunk = map_to_class(chunk, label_col)

        # move 'class' to last column
        cols = [c for c in chunk.columns if c != "class"] + ["class"]
        chunk = chunk[cols]

        mode = "w" if not wrote_header else "a"
        header = not wrote_header
        chunk.to_csv(OUT, index=False, mode=mode, header=header)
        wrote_header = True

        total_rows += len(chunk)
        print(f"[nfuq_sample] Wrote {len(chunk)} rows, total so far = {total_rows}")

    print(f"\n[nfuq_sample] Done. Final sample written to {OUT} with {total_rows} rows.")

if __name__ == "__main__":
    main()
