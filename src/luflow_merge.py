# src/luflow_merge.py
import os
from pathlib import Path
import pandas as pd
import kagglehub

DATASET = "mryanm/luflow-network-intrusion-detection-data-set"
OUT = Path("data/raw/LuFlow_merged.csv")

# --- knobs you can tweak ---
PER_FILE_TARGET_ROWS = 4000     # ~4k rows per file after stratified sampling
TOTAL_ROWS_CAP = 1_000_000      # stop writing after this many rows
DROP_COLS = ["src_ip", "dest_ip", "time_start", "time_end"]
RANDOM_SEED = 42
# ---------------------------

def normalize_and_sample(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = df.columns.str.strip()
    if "label" not in df.columns:
        raise KeyError("Expected 'label' column not found")
    # drop heavy identifier columns if present
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns], errors="ignore")
    # map labels to binary class
    lab = df["label"].astype(str).str.lower()
    df["class"] = lab.replace({"benign": "normal", "malicious": "anomaly", "outlier": "anomaly"})
    # stratified downsample to keep class balance
    if PER_FILE_TARGET_ROWS and len(df) > PER_FILE_TARGET_ROWS:
        frac_normal = 0.5  # aim roughly half/half if possible
        g = df.groupby("class", group_keys=False)
        # compute per-class quotas
        counts = g.size()
        total = counts.sum()
        # desired per-class sizes
        desired = {
            "anomaly": int(PER_FILE_TARGET_ROWS * (1 - frac_normal)),
            "normal": int(PER_FILE_TARGET_ROWS * frac_normal),
        }
        parts = []
        for cls, sub in g:
            k = desired.get(cls, PER_FILE_TARGET_ROWS // 2)
            if len(sub) <= k:
                parts.append(sub)
            else:
                parts.append(sub.sample(n=k, random_state=RANDOM_SEED))
        df = pd.concat(parts, ignore_index=True)
    # keep only features + 'class' (move class to last col)
    cols = [c for c in df.columns if c != "class"] + ["class"]
    return df[cols]

def main():
    root = kagglehub.dataset_download(DATASET)
    print("Merging from:", root)

    # collect CSV files
    files = []
    for r, _, fs in os.walk(root):
        for f in fs:
            if f.endswith(".csv"):
                files.append(Path(r) / f)
    files = sorted(files)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wrote_header = False
    total_rows = 0

    for i, fp in enumerate(files, 1):
        if total_rows >= TOTAL_ROWS_CAP:
            print(f"Reached TOTAL_ROWS_CAP={TOTAL_ROWS_CAP}, stopping.")
            break
        print(f"[{i}/{len(files)}] {fp}")
        try:
            df = pd.read_csv(fp, low_memory=False)
            df = normalize_and_sample(df)
            # append to OUT
            mode = "w" if not wrote_header else "a"
            header = not wrote_header
            df.to_csv(OUT, index=False, mode=mode, header=header)
            wrote_header = True
            total_rows += len(df)
        except Exception as e:
            print(f"  -> skipped due to error: {e}")

    print(f"\n✅ Wrote {total_rows:,} rows to {OUT}")

if __name__ == "__main__":
    main()
