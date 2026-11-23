"""
Equilibrium Real-Data Pipeline: Jira Resolution Duration Benchmark
------------------------------------------------------------------
Evaluates multi-class resolution time prediction on Apache Software Foundation Jira issues:
"Apache's Jira Issues" (tedlozzo)
https://www.kaggle.com/datasets/tedlozzo/apaches-jira-issues

Dataset File: ml/data/real/jira_issues.csv (or issues.csv)
"""

import argparse
import json
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def load_dataset(csv_path: Path):
    if not csv_path.exists():
        alt_path = csv_path.parent / "issues.csv"
        if alt_path.exists():
            csv_path = alt_path
        else:
            print("=" * 70)
            print("[OFFLINE NOTICE] Jira Issues real dataset not found.")
            print(f"Expected path: {csv_path} (or {alt_path})")
            print("To acquire this dataset:")
            print("  1. Run: kaggle datasets download -d tedlozzo/apaches-jira-issues -p ml/data/real/ --unzip")
            print(f"  2. Rename file to: {csv_path}")
            print("  3. Or download manually from: https://www.kaggle.com/datasets/tedlozzo/apaches-jira-issues")
            print("=" * 70)
            return None, csv_path

    print(f"Loading empirical Apache Jira dataset from: {csv_path}")
    df = pd.read_csv(csv_path)
    return df, csv_path


def parse_jira_data(df: pd.DataFrame):
    # Detect relevant column names across possible Jira exports
    col_map = {col.lower(): col for col in df.columns}

    created_col = col_map.get("created") or col_map.get("created_date") or col_map.get("created_at")
    resolved_col = col_map.get("resolved") or col_map.get("resolutiondate") or col_map.get("resolution_date")
    summary_col = col_map.get("summary") or col_map.get("title")
    desc_col = col_map.get("description")
    priority_col = col_map.get("priority")
    type_col = col_map.get("issuetype") or col_map.get("issue_type") or col_map.get("type")
    project_col = col_map.get("project") or col_map.get("project_key") or col_map.get("key")
    assignee_col = col_map.get("assignee")
    labels_col = col_map.get("labels")

    if not created_col or not resolved_col:
        raise ValueError(f"Required created/resolved date columns not found in Jira dataset: {df.columns.tolist()}")

    # Filter completed issues with non-null created and resolution timestamps
    valid_df = df.dropna(subset=[created_col, resolved_col]).copy()
    valid_df["created_dt"] = pd.to_datetime(valid_df[created_col], errors="coerce")
    valid_df["resolved_dt"] = pd.to_datetime(valid_df[resolved_col], errors="coerce")
    valid_df = valid_df.dropna(subset=["created_dt", "resolved_dt"]).copy()

    # Calculate duration in hours
    valid_df["duration_hours"] = (valid_df["resolved_dt"] - valid_df["created_dt"]).dt.total_seconds() / 3600.0
    valid_df = valid_df[valid_df["duration_hours"] > 0.0].copy()

    # Sort strictly chronologically by created_dt for TIME-BASED split
    valid_df = valid_df.sort_values("created_dt").reset_index(drop=True)

    # Calculate empirical tertiles for resolution-time target classes
    q33 = float(valid_df["duration_hours"].quantile(0.3333))
    q67 = float(valid_df["duration_hours"].quantile(0.6667))

    def categorize_duration(hours):
        if hours <= q33:
            return 0  # short
        elif hours <= q67:
            return 1  # medium
        else:
            return 2  # long

    valid_df["target_class"] = valid_df["duration_hours"].apply(categorize_duration)

    # Feature Engineering
    valid_df["summary_len"] = valid_df[summary_col].fillna("").astype(str).str.len() if summary_col else 0
    valid_df["desc_len"] = valid_df[desc_col].fillna("").astype(str).str.len() if desc_col else 0

    if labels_col and labels_col in valid_df.columns:
        valid_df["labels_count"] = valid_df[labels_col].fillna("").apply(
            lambda x: len(str(x).split(",")) if str(x).strip() and str(x) != "[]" else 0
        )
    else:
        valid_df["labels_count"] = 0

    if assignee_col and assignee_col in valid_df.columns:
        valid_df["has_assignee"] = valid_df[assignee_col].notna().astype(int)
    else:
        valid_df["has_assignee"] = 1

    valid_df["created_month"] = valid_df["created_dt"].dt.month

    # Categorical features
    valid_df["priority_clean"] = valid_df[priority_col].fillna("Normal").astype(str) if priority_col else "Normal"
    valid_df["issuetype_clean"] = valid_df[type_col].fillna("Task").astype(str) if type_col else "Task"

    # Extract clean project key
    if project_col:
        valid_df["project_key"] = valid_df[project_col].fillna("UNK").astype(str).apply(
            lambda x: str(x).split("-")[0] if "-" in str(x) else str(x)
        )
    else:
        valid_df["project_key"] = "DEFAULT"

    num_cols = ["summary_len", "desc_len", "labels_count", "has_assignee", "created_month"]
    cat_cols = ["priority_clean", "issuetype_clean", "project_key"]

    return valid_df, num_cols, cat_cols, q33, q67


def run_pipeline(data_path: Path):
    df, resolved_path = load_dataset(data_path)
    if df is None:
        return 0

    print(f"Total raw Jira issue records: {len(df)}")
    valid_df, num_cols, cat_cols, q33, q67 = parse_jira_data(df)
    print(f"Completed issues with valid timestamps: {len(valid_df)}")
    print(f"Empirical resolution duration tertiles:")
    print(f"  - Short  (Class 0): <= {q33:.1f} hours ({q33/24:.1f} days)")
    print(f"  - Medium (Class 1): {q33:.1f} to {q67:.1f} hours ({q33/24:.1f} to {q67/24:.1f} days)")
    print(f"  - Long   (Class 2): > {q67:.1f} hours ({q67/24:.1f} days)")

    # TIME-BASED SPLIT: Train on earlier 80%, Test on later 20%
    n_total = len(valid_df)
    split_idx = int(n_total * 0.80)
    train_df = valid_df.iloc[:split_idx].copy()
    test_df = valid_df.iloc[split_idx:].copy()

    print("\nTime-Based Split (to eliminate temporal leakage):")
    print(f"  Train: N = {len(train_df)} ({train_df['created_dt'].min().strftime('%Y-%m-%d')} to {train_df['created_dt'].max().strftime('%Y-%m-%d')})")
    print(f"  Test:  N = {len(test_df)}  ({test_df['created_dt'].min().strftime('%Y-%m-%d')} to {test_df['created_dt'].max().strftime('%Y-%m-%d')})")

    X_train = train_df[num_cols + cat_cols]
    y_train = train_df["target_class"].to_numpy()

    X_test = test_df[num_cols + cat_cols]
    y_test = test_df["target_class"].to_numpy()

    # Preprocessing
    numeric_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    preprocessor = ColumnTransformer([
        ("num", numeric_pipe, num_cols),
        ("cat", cat_pipe, cat_cols),
    ])

    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)

    # 1. Majority Dummy Baseline
    dummy_clf = DummyClassifier(strategy="most_frequent")
    dummy_clf.fit(X_train_proc, y_train)
    dummy_pred = dummy_clf.predict(X_test_proc)
    dummy_acc = float(accuracy_score(y_test, dummy_pred))
    dummy_f1 = float(f1_score(y_test, dummy_pred, average="macro"))

    # 2. Logistic Regression Baseline
    logit_clf = LogisticRegression(max_iter=1000, random_state=42)
    logit_clf.fit(X_train_proc, y_train)
    logit_pred = logit_clf.predict(X_test_proc)
    logit_acc = float(accuracy_score(y_test, logit_pred))
    logit_f1 = float(f1_score(y_test, logit_pred, average="macro"))

    # 3. HistGradientBoostingClassifier
    gbdt_clf = HistGradientBoostingClassifier(max_iter=100, learning_rate=0.08, max_depth=6, random_state=42)
    gbdt_clf.fit(X_train_proc, y_train)
    gbdt_pred = gbdt_clf.predict(X_test_proc)
    gbdt_acc = float(accuracy_score(y_test, gbdt_pred))
    gbdt_f1 = float(f1_score(y_test, gbdt_pred, average="macro"))
    cm = confusion_matrix(y_test, gbdt_pred).tolist()

    print("\nEmpirical Jira Duration Classification Results (Test Set, N = {}):".format(len(test_df)))
    print(f"  - Dummy (Majority):     Accuracy = {dummy_acc*100:.2f}%, Macro-F1 = {dummy_f1:.4f}")
    print(f"  - Logistic Regression:  Accuracy = {logit_acc*100:.2f}%, Macro-F1 = {logit_f1:.4f}")
    print(f"  - HistGradientBoosting: Accuracy = {gbdt_acc*100:.2f}%, Macro-F1 = {gbdt_f1:.4f}")
    print("  Confusion Matrix (Rows: Actual [Short, Medium, Long], Cols: Predicted):")
    for row in cm:
        print(f"    {row}")

    output_metrics = {
        "status": "completed",
        "dataset": {
            "name": "Apache's Jira Issues (tedlozzo)",
            "source": "https://www.kaggle.com/datasets/tedlozzo/apaches-jira-issues",
            "total_records": len(df),
            "completed_issues": len(valid_df),
            "train_samples": len(train_df),
            "test_samples": len(test_df),
            "split_type": "time_based_chronological",
            "tertiles_hours": {
                "short_under": q33,
                "medium_under": q67,
            },
        },
        "models": {
            "Dummy (Majority)": {"accuracy": dummy_acc, "macro_f1": dummy_f1},
            "Logistic Regression": {"accuracy": logit_acc, "macro_f1": logit_f1},
            "HistGradientBoosting": {"accuracy": gbdt_acc, "macro_f1": gbdt_f1, "confusion_matrix": cm},
        },
        "features": num_cols + cat_cols,
    }

    metrics_file = Path("ml/models/real_metrics.json")
    metrics_file.parent.mkdir(parents=True, exist_ok=True)

    current_data = {}
    if metrics_file.exists():
        try:
            with open(metrics_file, "r") as f:
                current_data = json.load(f)
        except Exception:
            current_data = {}

    current_data["jira_duration_real"] = output_metrics
    with open(metrics_file, "w") as f:
        json.dump(current_data, f, indent=2)

    src_file = Path("src/models/real_metrics.json")
    src_file.parent.mkdir(parents=True, exist_ok=True)
    with open(src_file, "w") as f:
        json.dump(current_data, f, indent=2)

    print(f"\nReal Jira metrics successfully written to {metrics_file} and {src_file}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Empirical Jira Issue Duration Classification")
    parser.add_argument(
        "--data-path",
        type=Path,
        default=Path("ml/data/real/jira_issues.csv"),
        help="Path to Jira issues CSV",
    )
    args = parser.parse_args()
    sys.exit(run_pipeline(args.data_path))
