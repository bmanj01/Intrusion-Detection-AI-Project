import os
from pathlib import Path

import kagglehub
import numpy as np
import pandas as pd

DATASET = "prantokumar/ids-dataset-2025"
OUT = Path("data/raw/IDS2025_merged.csv")

# knobs
MAX_ROWS_PER_FILE = 100_000   # cap per CSV
TOTAL_ROWS_CAP = 600_000      # cap overall
RANDOM_SEED = 42

LABEL_CANDIDATES = [
    "label", "Label", "Label_", "class", "Class",
    "attack", "Attack", "Category", "category",
    "Output", "output", "y", "target"
]


def detect_label_column(cols):
    cols = [c.strip() for c in cols]

    # 1) try common names
    for cand in LABEL_CANDIDATES:
        if cand in cols:
            return cand

    # 2) CIC-style: sometimes last column is label
    if cols:
        return cols[-1]

    return None


def map_to_class(df, label_col):
    """
    Make 'class' column: normal/anomaly from label_col.
    Handles numeric (0/1) or string labels ("BENIGN", attack names, etc).
    """
    s = df[label_col]

    # numeric: assume 0=normal, >0=attack
    if np.issubdtype(s.dropna().dtype, np.number):
        s = s.astype(float)
        df["class"] = s.map(lambda x: "normal" if x == 0.0 else "anomaly")
        return df

    # strings
    s_str = s.astype(str).str.strip().str.lower()
    normal_tokens = {"benign", "normal", "background", "0"}

    def to_class(v):
        if v in normal_tokens:
            return "normal"
        return "anomaly"

    df["class"] = s_str.map(to_class)
    return df


def find_all_csvs(root: Path):
    files = []
    for r, _, fs in os.walk(root):
        for f in fs:
            if f.lower().endswith(".csv"):
                files.append(Path(r) / f)
    return sorted(files)


def main():
    print("[ids2025_sample] Locating dataset ...")
    root = kagglehub.dataset_download(DATASET)
    print("[ids2025_sample] Dataset root:", root)

    csv_files = find_all_csvs(Path(root))
    print(f"[ids2025_sample] Found {len(csv_files)} CSV files.\n")

    OUT.parent.mkdir(parents=True, exist_ok=True)

    wrote_header = False
    total_rows = 0
    rng = np.random.RandomState(RANDOM_SEED)

    for i, path in enumerate(csv_files, start=1):
        if total_rows >= TOTAL_ROWS_CAP:
            print(f"[ids2025_sample] Reached TOTAL_ROWS_CAP={TOTAL_ROWS_CAP}, stopping.")
            break

        print(f"[ids2025_sample] ({i}/{len(csv_files)}) Reading: {path}")
        try:
            df = pd.read_csv(path)
        except Exception as e:
            print(f"[ids2025_sample] ERROR reading {path}: {e}")
            continue

        df.columns = df.columns.str.strip()
        if not len(df.columns):
            print("[ids2025_sample] No columns, skipping.")
            continue

        label_col = detect_label_column(list(df.columns))
        if label_col is None or label_col not in df.columns:
            print("[ids2025_sample] No valid label column found, skipping this file.")
            continue

        print(f"[ids2025_sample] Using label column: '{label_col}'")

        # downsample if file is big
        if MAX_ROWS_PER_FILE and len(df) > MAX_ROWS_PER_FILE:
            df = df.sample(n=MAX_ROWS_PER_FILE, random_state=rng).reset_index(drop=True)

        # map -> class
        df = map_to_class(df, label_col)

        # Optional: keep scenario/file name
        df["source_file"] = path.name

        # ensure 'class' is last column
        cols = [c for c in df.columns if c != "class"] + ["class"]
        df = df[cols]

        # append
        mode = "w" if not wrote_header else "a"
        header = not wrote_header
        df.to_csv(OUT, index=False, mode=mode, header=header)
        wrote_header = True

        total_rows += len(df)
        print(f"[ids2025_sample] Appended {len(df)} rows, total so far = {total_rows}")

    print(f"\n[ids2025_sample] DONE. Final sample: {OUT} with {total_rows} rows.")


if __name__ == "__main__":
    main()
