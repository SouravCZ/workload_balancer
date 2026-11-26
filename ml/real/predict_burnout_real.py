"""
Equilibrium Real-Data Pipeline: Burnout Inference
-------------------------------------------------
Applies the tuned operational burnout models to an unlabeled employee CSV.
Hyperparameters are read from ml/models/real_metrics.json, which is produced
by ml/real/train_burnout_real.py.

The main model deliberately excludes the subjective Mental Fatigue Score.
"""

import argparse
import json
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

METRICS_PATH = Path("ml/models/real_metrics.json")
BURNOUT_THRESHOLD = 0.60


def build_preprocessor(num_cols, cat_cols):
    numeric_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("ohe", OneHotEncoder(drop="first", handle_unknown="ignore", sparse_output=False)),
    ])
    return ColumnTransformer([
        ("num", numeric_pipe, num_cols),
        ("cat", cat_pipe, cat_cols),
    ])


def run_inference(train_path: Path, test_path: Path, output_dir: Path):
    if not train_path.exists():
        print(f"[ERROR] Training dataset not found: {train_path}")
        return 1
    if not test_path.exists():
        print(f"[ERROR] Test dataset not found: {test_path}")
        return 1
    if not METRICS_PATH.exists():
        print(f"[ERROR] Tuned metrics not found: {METRICS_PATH}. Run train_burnout_real.py first.")
        return 1

    train_df = pd.read_csv(train_path)
    test_df = pd.read_csv(test_path)
    with open(METRICS_PATH, "r") as f:
        tuned = json.load(f)["burnout_real"]["operational_model_main"]

    labeled = train_df.dropna(subset=["Burn Rate"]).copy()
    labeled["Date of Joining"] = pd.to_datetime(labeled["Date of Joining"])
    reference_date = labeled["Date of Joining"].max()
    labeled["tenure_days"] = (reference_date - labeled["Date of Joining"]).dt.days

    test_df = test_df.copy()
    test_df["Date of Joining"] = pd.to_datetime(test_df["Date of Joining"])
    test_df["tenure_days"] = (reference_date - test_df["Date of Joining"]).dt.days

    num_cols = ["Resource Allocation", "Designation", "tenure_days"]
    cat_cols = ["WFH Setup Available", "Company Type"]

    preprocessor = build_preprocessor(num_cols, cat_cols)
    X_train = preprocessor.fit_transform(labeled[num_cols + cat_cols])
    X_test = preprocessor.transform(test_df[num_cols + cat_cols])

    y_reg = labeled["Burn Rate"].astype(float).to_numpy()
    y_clf = (y_reg >= BURNOUT_THRESHOLD).astype(int)

    reg_params = dict(tuned["regression"]["HistGradientBoosting"]["best_params"])
    clf_params = dict(tuned["classification"]["HistGradientBoosting"]["best_params"])
    reg_params["random_state"] = 42
    clf_params["random_state"] = 42

    regressor = HistGradientBoostingRegressor(**reg_params).fit(X_train, y_reg)
    classifier = HistGradientBoostingClassifier(**clf_params).fit(X_train, y_clf)

    burn_rate = np.clip(regressor.predict(X_test), 0.0, 1.0)
    probability = classifier.predict_proba(X_test)[:, 1]
    predicted_class = (probability >= 0.5).astype(int)

    predictions = pd.DataFrame({
        "Employee ID": test_df["Employee ID"],
        "Burn Rate": burn_rate,
        "high_burnout_probability": probability,
        "predicted_high_burnout": predicted_class,
    })

    output_dir.mkdir(parents=True, exist_ok=True)
    predictions_path = output_dir / "burnout_test_predictions.csv"
    submission_path = output_dir / "burnout_test_submission.csv"
    predictions.to_csv(predictions_path, index=False)
    predictions[["Employee ID", "Burn Rate"]].to_csv(submission_path, index=False)

    print(f"Training rows: {len(labeled)} (reference tenure date: {reference_date.date()})")
    print(f"Scored rows: {len(predictions)}")
    print(f"Mean predicted Burn Rate: {burn_rate.mean():.4f} (range {burn_rate.min():.4f}-{burn_rate.max():.4f})")
    print(f"Predicted high burnout (>= {BURNOUT_THRESHOLD:.2f}): {predicted_class.sum()} ({predicted_class.mean() * 100:.2f}%)")
    print(f"Predictions written to {predictions_path}")
    print(f"Submission-format file written to {submission_path}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score unlabeled employees with the tuned burnout model")
    parser.add_argument("--train-path", type=Path, default=Path("ml/data/real/employee_burnout.csv"))
    parser.add_argument("--test-path", type=Path, required=True, help="Path to the unlabeled test CSV")
    parser.add_argument("--output-dir", type=Path, default=Path("ml/data/real"))
    args = parser.parse_args()
    sys.exit(run_inference(args.train_path, args.test_path, args.output_dir))
