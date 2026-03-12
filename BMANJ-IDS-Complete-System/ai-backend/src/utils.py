import json, os, random
import numpy as np
import pandas as pd
from typing import Tuple
from sklearn.model_selection import train_test_split

def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)

def load_csv(path: str) -> pd.DataFrame:
    return pd.read_csv(path)

def split_save(df: pd.DataFrame, target: str, out_dir: str, test_size: float = 0.2, val_size: float = 0.1, seed: int = 42):
    os.makedirs(out_dir, exist_ok=True)
    y = df[target]
    X = df.drop(columns=[target])

    # stratified split to preserve class ratios
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=seed
    )
    # val split from train
    val_ratio = val_size / (1 - test_size)
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval, test_size=val_ratio, stratify=y_trainval, random_state=seed
    )

    train = X_train.copy(); train[target] = y_train
    val = X_val.copy();     val[target]   = y_val
    test = X_test.copy();   test[target]  = y_test

    train.to_csv(os.path.join(out_dir, "train.csv"), index=False)
    val.to_csv(os.path.join(out_dir, "val.csv"), index=False)
    test.to_csv(os.path.join(out_dir, "test.csv"), index=False)

def save_json(d: dict, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(d, f, indent=2, sort_keys=True)

def numeric_and_categorical_columns(df: pd.DataFrame, exclude: list) -> Tuple[list, list]:
    feats = [c for c in df.columns if c not in exclude]
    num_cols  = [c for c in feats if str(df[c].dtype) not in ("object", "category")]
    cat_cols  = [c for c in feats if c not in num_cols]
    return num_cols, cat_cols
