import joblib, pandas as pd
from sklearn.compose import ColumnTransformer

model = joblib.load("artifacts/model.joblib")
train = pd.read_csv("data/processed/train.csv")
X_train = train.drop(columns=["class"])

pre = model.named_steps["preprocess"]
def names(ct: ColumnTransformer):
    out=[]
    for name, trans, cols in ct.transformers_:
        if name=="remainder": continue
        if hasattr(trans,"named_steps") and "ohe" in trans.named_steps:
            ohe = trans.named_steps["ohe"]
            out += ohe.get_feature_names_out(cols).tolist()
        else:
            out += list(cols)
    return out

feat_names = names(pre)
rf = model.named_steps["rf"]
imp = pd.DataFrame({"feature": feat_names, "importance": rf.feature_importances_})
imp.sort_values("importance", ascending=False).head(30).to_csv("artifacts/feature_importance_top30.csv", index=False)
print("Saved artifacts/feature_importance_top30.csv")
