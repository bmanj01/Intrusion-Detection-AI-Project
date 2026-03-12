import os
from pathlib import Path

import kagglehub
import numpy as np
import pandas as pd

DATASET = "ymirsky/network-attack-dataset-kitsune"
OUT = Path("data/raw/Kitsune_merged.csv")

# knobs you can tweak
MAX_ROWS_PER_SCENARIO = 50_000   # cap per scenario (dataset+labels)
TOTAL_ROWS_CAP = 500_000         # cap overall
RANDOM_SEED = 42

LABEL_CANDIDATES = [
    "label", "Label", "class", "Class",
    "attack", "Attack", "Category", "category",
    "Output", "output", "y"
]


def detect_label_column(cols):
    cols = [c.strip() for c in cols]
    for cand in LABEL_CANDIDATES:
        if cand in cols:
            return cand
    # fallback: first column
    return cols[0] if cols else None


def map_to_class(df, label_col):
    """
    Create a 'class' column: 'normal' / 'anomaly'
    based on numeric or string labels.
    """
    s = df[label_col]

    # numeric label → assume 0=normal, 1=attack
    if np.issubdtype(s.dropna().dtype, np.number):
        s = s.astype(float)
        df["class"] = s.map(lambda x: "normal" if x == 0.0 else "anomaly")
        return df

    # string label
    s_str = s.astype(str).str.strip().str.lower()
    normal_tokens = {"benign", "normal", "0"}
    df["class"] = s_str.map(lambda x: "normal" if x in normal_tokens else "anomaly")
    return df


def find_dataset_label_pairs(root: Path):
    """
    Find pairs like:
      X_dataset.csv + X_labels.csv
    grouped by directory.
    """
    root = Path(root)
    datasets = {}
    labels = {}

    for r, _, fs in os.walk(root):
        r = Path(r)
        for f in fs:
            if not f.lower().endswith(".csv"):
                continue
            p = r / f
            name = f.lower()
            if "dataset" in name:
                key = name.replace("_dataset", "").replace("dataset", "")
                datasets[(r, key)] = p
            elif "label" in name:
                key = name.replace("_labels", "").replace("labels", "")
                labels[(r, key)] = p

    pairs = []
    for (r, key), dpath in datasets.items():
        if (r, key) in labels:
            pairs.append((dpath, labels[(r, key)]))
        else:
            print(f"[kitsune_sample] WARNING: no labels found for dataset {dpath}")

    return pairs


def main():
    print("[kitsune_sample] Locating dataset ...")
    root = kagglehub.dataset_download(DATASET)
    print("[kitsune_sample] Dataset root:", root)

    pairs = find_dataset_label_pairs(Path(root))
    print(f"[kitsune_sample] Found {len(pairs)} dataset+label pairs.\n")

    OUT.parent.mkdir(parents=True, exist_ok=True)

    wrote_header = False
    total_rows = 0
    rng = np.random.RandomState(RANDOM_SEED)

    for i, (dataset_path, labels_path) in enumerate(pairs, start=1):
        if total_rows >= TOTAL_ROWS_CAP:
            print(f"[kitsune_sample] Reached TOTAL_ROWS_CAP={TOTAL_ROWS_CAP}, stopping.")
            break

        print(f"[kitsune_sample] Pair {i}/{len(pairs)}")
        print(f"  dataset: {dataset_path}")
        print(f"  labels : {labels_path}")

        try:
            X = pd.read_csv(dataset_path)
            y = pd.read_csv(labels_path)
        except Exception as e:
            print(f"[kitsune_sample] ERROR reading pair: {e}")
            continue

        print(f"[kitsune_sample] Loaded shapes: X={X.shape}, y={y.shape}")

        # Basic alignment: assume same length, row-wise alignment
        if len(X) != len(y):
            print("[kitsune_sample] WARNING: length mismatch, "
                  "will align on the min length.")
            n = min(len(X), len(y))
            X = X.iloc[:n].reset_index(drop=True)
            y = y.iloc[:n].reset_index(drop=True)
        else:
            X = X.reset_index(drop=True)
            y = y.reset_index(drop=True)

        # Detect label column in labels frame
        y.columns = y.columns.str.strip()
        label_col = detect_label_column(list(y.columns))
        if not label_col:
            print("[kitsune_sample] No label column found in labels file, skipping.")
            continue

        print(f"[kitsune_sample] Using label column from labels file: '{label_col}'")

        # Merge features + labels
        df = X.copy()
        df[label_col] = y[label_col]

        # Downsample per scenario if too large
        if MAX_ROWS_PER_SCENARIO and len(df) > MAX_ROWS_PER_SCENARIO:
            df = df.sample(n=MAX_ROWS_PER_SCENARIO, random_state=rng)
            df = df.reset_index(drop=True)

        # Map label -> class
        df = map_to_class(df, label_col)

        # Optional: record scenario name
        scenario = dataset_path.parent.name
        df["scenario"] = scenario

        # Move 'class' to the end
        cols = [c for c in df.columns if c != "class"] + ["class"]
        df = df[cols]

        # Append to output
        mode = "w" if not wrote_header else "a"
        header = not wrote_header
        df.to_csv(OUT, index=False, mode=mode, header=header)
        wrote_header = True

        total_rows += len(df)
        print(f"[kitsune_sample] Appended {len(df)} rows from scenario '{scenario}', "
              f"total so far = {total_rows}")

    print(f"\n[kitsune_sample] DONE. Final sample: {OUT} with {total_rows} rows.")


if __name__ == "__main__":
    main()
