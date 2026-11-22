"""
Equilibrium Real-Data Pipeline: IBM HR Analytics Employee Attrition & Performance
---------------------------------------------------------------------------------
Evaluates a burnout/attrition classification pipeline against a public real-world
organizational dataset (1,470 employees, 35 features) published by IBM.

Dataset Source:
https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset
Place the downloaded CSV at:
ml/data/WA_Fn-UseC_-HR-Employee-Attrition.csv

NOTE ON METHODOLOGY & VALIDATION:
Real-world employee attrition data captures voluntary turnover, which correlates
with chronic burnout but represents a distinct construct. This pipeline serves as
an offline real-data reference benchmark and DOES NOT validate the synthetic
engineering workload model.
"""

import json
import os
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline


def run_ibm_hr_pipeline(csv_path: Path):
    if not csv_path.exists():
        print(f"[OFFLINE NOTICE] Real dataset not found at {csv_path}")
        print("To run the real-world benchmark:")
        print("1. Download 'WA_Fn-UseC_-HR-Employee-Attrition.csv' from Kaggle or IBM Watson.")
        print(f"2. Save to '{csv_path}'.")
        print("3. Re-run: python ml/train_real_data.py")
        return None

    print(f"Loading real-world IBM HR Attrition dataset from {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} employee records with {len(df.columns)} attributes.")

    # Target: Attrition (Yes=1, No=0)
    y = (df["Attrition"].str.strip() == "Yes").astype(int)
    attrition_rate = y.mean()
    print(f"Real Attrition / Departure Rate: {attrition_rate * 100:.2f}%")

    drop_cols = ["Attrition", "EmployeeCount", "StandardHours", "Over18", "EmployeeNumber"]
    X = df.drop(columns=[c for c in drop_cols if c in df.columns])

    num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = X.select_dtypes(include=["object"]).columns.tolist()

    # Preprocessing
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
        ]
    )

    # Stratified Split (70% train, 15% val, 15% test)
    sss = StratifiedShuffleSplit(n_splits=1, train_size=0.70, random_state=42)
    train_idx, temp_idx = next(sss.split(X, y))

    X_train, y_train = X.iloc[train_idx], y.iloc[train_idx]
    X_temp, y_temp = X.iloc[temp_idx], y.iloc[temp_idx]

    sss_val = StratifiedShuffleSplit(n_splits=1, train_size=0.50, random_state=42)
    val_idx, test_idx = next(sss_val.split(X_temp, y_temp))

    X_val, y_val = X_temp.iloc[val_idx], y_temp.iloc[val_idx]
    X_test, y_test = X_temp.iloc[test_idx], y_temp.iloc[test_idx]

    X_train_trans = preprocessor.fit_transform(X_train)
    X_val_trans = preprocessor.transform(X_val)
    X_test_trans = preprocessor.transform(X_test)

    # Baselines
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(X_train_trans, y_train)
    pred_dummy = dummy.predict(X_test_trans)

    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    lr.fit(X_train_trans, y_train)
    pred_lr_prob = lr.predict_proba(X_test_trans)[:, 1]

    # Gradient Boosting
    gb = GradientBoostingClassifier(n_estimators=75, max_depth=3, learning_rate=0.08, random_state=42)
    gb.fit(X_train_trans, y_train)

    val_probs = gb.predict_proba(X_val_trans)[:, 1]
    best_thresh = 0.5
    best_f1 = 0.0
    for t in np.linspace(0.15, 0.65, 51):
        f1_v = f1_score(y_val, (val_probs >= t).astype(int), zero_division=0)
        if f1_v > best_f1:
            best_f1 = f1_v
            best_thresh = float(t)

    pred_gb_prob = gb.predict_proba(X_test_trans)[:, 1]
    pred_gb_class = (pred_gb_prob >= best_thresh).astype(int)

    results = {
        "dataset": "IBM HR Analytics Employee Attrition (Real-World)",
        "samples": len(df),
        "test_samples": len(y_test),
        "positive_rate": float(attrition_rate),
        "baselines": {
            "Dummy (Majority)": {
                "Accuracy": float(accuracy_score(y_test, pred_dummy)),
                "ROC-AUC": 0.5,
                "PR-AUC": float(average_precision_score(y_test, pred_dummy)),
            },
            "Logistic (Balanced)": {
                "Accuracy": float(accuracy_score(y_test, (pred_lr_prob >= 0.5).astype(int))),
                "ROC-AUC": float(roc_auc_score(y_test, pred_lr_prob)),
                "PR-AUC": float(average_precision_score(y_test, pred_lr_prob)),
                "Recall": float(recall_score(y_test, (pred_lr_prob >= 0.5).astype(int))),
                "F1": float(f1_score(y_test, (pred_lr_prob >= 0.5).astype(int))),
            },
            "Gradient Boosting": {
                "Accuracy": float(accuracy_score(y_test, pred_gb_class)),
                "ROC-AUC": float(roc_auc_score(y_test, pred_gb_prob)),
                "PR-AUC": float(average_precision_score(y_test, pred_gb_prob)),
                "Recall": float(recall_score(y_test, pred_gb_class)),
                "F1": float(f1_score(y_test, pred_gb_class)),
                "Threshold": best_thresh,
            },
        },
    }

    print("\nIBM HR Real Data Benchmark Results:")
    print(f"Gradient Boosting ROC-AUC: {results['baselines']['Gradient Boosting']['ROC-AUC']:.3f}")
    print(f"Logistic Regression ROC-AUC: {results['baselines']['Logistic (Balanced)']['ROC-AUC']:.3f}")
    print(f"Optimal Threshold: {best_thresh:.3f}")

    out_file = Path("ml/models/ibm_hr_results.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"Results saved to {out_file}")
    return results


if __name__ == "__main__":
    csv_target = Path("ml/data/WA_Fn-UseC_-HR-Employee-Attrition.csv")
    run_ibm_hr_pipeline(csv_target)
