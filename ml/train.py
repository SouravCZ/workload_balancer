import json
import os
import tempfile
from pathlib import Path

# Ensure Matplotlib doesn't crash on Windows permission restrictions
os.environ["MPLCONFIGDIR"] = tempfile.gettempdir()

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, RandomizedSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


FEATURE_COLS = [
    "skill_match_score",
    "skill_gap_max",
    "skill_coverage_ratio",
    "current_utilization",
    "projected_utilization_after_assign",
    "task_hours_to_headroom_ratio",
    "hours_to_deadline_ratio",
    "seniority_vs_complexity",
    "overtime_trend",
    "overload_streak_weeks",
    "recent_pto_days",
    "tenure_months",
    "task_priority",
    "collaboration_needed",
    "concurrent_task_count",
]

FEATURE_SCHEMA = {
    "skill_match_score": {"type": "float", "range": [0.0, 1.0], "unit": "ratio", "desc": "Weighted match of candidate skills to required levels"},
    "skill_gap_max": {"type": "int", "range": [0, 5], "unit": "levels", "desc": "Maximum deficit between member proficiency and required level"},
    "skill_coverage_ratio": {"type": "float", "range": [0.0, 1.0], "unit": "ratio", "desc": "Proportion of required skills fully satisfied"},
    "current_utilization": {"type": "float", "range": [0.0, 3.0], "unit": "ratio", "desc": "Current allocated hours divided by weekly capacity"},
    "projected_utilization_after_assign": {"type": "float", "range": [0.0, 3.5], "unit": "ratio", "desc": "Projected utilization if task is assigned"},
    "task_hours_to_headroom_ratio": {"type": "float", "range": [0.0, 100.0], "unit": "ratio", "desc": "Task hours divided by available headroom hours"},
    "hours_to_deadline_ratio": {"type": "float", "range": [0.0, 10.0], "unit": "ratio", "desc": "Task hours divided by working hours before deadline"},
    "seniority_vs_complexity": {"type": "int", "range": [-4, 4], "unit": "delta", "desc": "Member seniority level minus task complexity rating"},
    "overtime_trend": {"type": "float", "range": [-20.0, 20.0], "unit": "pct_slope", "desc": "5-week historical overtime slope"},
    "overload_streak_weeks": {"type": "int", "range": [0, 5], "unit": "weeks", "desc": "Consecutive weeks where utilization exceeded 100%"},
    "recent_pto_days": {"type": "int", "range": [0, 20], "unit": "days", "desc": "PTO taken in recent 30-day window"},
    "tenure_months": {"type": "int", "range": [1, 150], "unit": "months", "desc": "Total months at organization"},
    "task_priority": {"type": "int", "range": [1, 4], "unit": "tier", "desc": "Task priority (1: Low to 4: Critical)"},
    "collaboration_needed": {"type": "int", "range": [0, 1], "unit": "binary", "desc": "Whether task requires active cross-team pairing"},
    "concurrent_task_count": {"type": "int", "range": [1, 10], "unit": "tasks", "desc": "Active in-flight tasks assigned to member"},
}


def serialize_tree_ensemble(ensemble, imputer, scaler, feature_names):
    """
    Serializes a scikit-learn GradientBoosting or RandomForest model into a lightweight,
    dependency-free JSON object that pure JavaScript can execute in microseconds.
    """
    is_classifier = hasattr(ensemble, "classes_")
    init_val = 0.0

    if hasattr(ensemble, "init_"):
        if hasattr(ensemble.init_, "class_prior_"):
            p = ensemble.init_.class_prior_[1]
            init_val = float(np.log(p / (1.0 - p)))
        elif hasattr(ensemble.init_, "constant_"):
            init_val = float(ensemble.init_.constant_[0][0])

    learning_rate = getattr(ensemble, "learning_rate", 1.0)
    trees_data = []

    # Handle GradientBoosting
    if hasattr(ensemble, "estimators_"):
        estimators = ensemble.estimators_
        if estimators.ndim == 2:
            estimators = estimators[:, 0]

        for estimator in estimators:
            tree = estimator.tree_ if hasattr(estimator, "tree_") else estimator
            tree_dict = {
                "children_left": tree.children_left.tolist(),
                "children_right": tree.children_right.tolist(),
                "feature": tree.feature.tolist(),
                "threshold": [float(t) for t in tree.threshold],
                "value": [float(v[0][0]) for v in tree.value],
            }
            trees_data.append(tree_dict)

    return {
        "is_classifier": is_classifier,
        "init_val": float(init_val),
        "learning_rate": float(learning_rate),
        "feature_names": feature_names,
        "imputer_medians": [float(m) for m in imputer.statistics_],
        "scaler_means": [float(m) for m in scaler.mean_],
        "scaler_scales": [float(s) for s in scaler.scale_],
        "trees": trees_data,
    }


def main():
    print("=" * 60)
    print("PHASE 3: MODEL TRAINING & BENCHMARKING")
    print("=" * 60)

    data_dir = Path("ml/data")
    models_dir = Path("ml/models")
    reports_dir = Path("ml/reports")
    models_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(data_dir / "assignments.csv")
    print(f"Loaded {len(df)} assignment rows from {data_dir / 'assignments.csv'}")

    # ----------------------------------------------------
    # 1. GroupSplit by Member (70% Train, 15% Val, 15% Test)
    # ----------------------------------------------------
    gss = GroupShuffleSplit(n_splits=1, train_size=0.70, random_state=42)
    train_idx, temp_idx = next(gss.split(df, groups=df["member_id"]))

    df_train = df.iloc[train_idx].copy()
    df_temp = df.iloc[temp_idx].copy()

    gss_val = GroupShuffleSplit(n_splits=1, train_size=0.50, random_state=42)
    val_idx, test_idx = next(gss_val.split(df_temp, groups=df_temp["member_id"]))

    df_val = df_temp.iloc[val_idx].copy()
    df_test = df_temp.iloc[test_idx].copy()

    train_members = set(df_train["member_id"].unique())
    val_members = set(df_val["member_id"].unique())
    test_members = set(df_test["member_id"].unique())

    assert len(train_members & val_members) == 0, "Data leakage between train and val!"
    assert len(train_members & test_members) == 0, "Data leakage between train and test!"
    assert len(val_members & test_members) == 0, "Data leakage between val and test!"

    print(f"Split sizes: Train={len(df_train)} ({len(train_members)} members), Val={len(df_val)} ({len(val_members)} members), Test={len(df_test)} ({len(test_members)} members)")

    X_train = df_train[FEATURE_COLS]
    X_val = df_val[FEATURE_COLS]
    X_test = df_test[FEATURE_COLS]

    # Preprocessing
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()

    X_train_trans = scaler.fit_transform(imputer.fit_transform(X_train))
    X_val_trans = scaler.transform(imputer.transform(X_val))
    X_test_trans = scaler.transform(imputer.transform(X_test))

    # Reimplemented heuristic from scoring.js for baseline comparison
    # fitScore = 0.6 * skillOverlap + 0.4 * (1 - postAllocated/capacity)
    # outcome_quality heuristic: fitScore * 100
    y_test_heuristic_quality = np.clip(
        (0.6 * df_test["skill_coverage_ratio"].fillna(0.5) + 0.4 * np.clip(1.0 - df_test["projected_utilization_after_assign"].fillna(1.0), 0.0, 1.0)) * 100.0,
        0.0, 100.0
    )
    y_test_heuristic_ontime = (df_test["projected_utilization_after_assign"].fillna(1.0) <= 1.0) & (df_test["hours_to_deadline_ratio"].fillna(1.0) <= 1.0)
    y_test_heuristic_burnout = (df_test["overload_streak_weeks"].fillna(0) >= 2) | (df_test["projected_utilization_after_assign"].fillna(1.0) >= 1.0)

    # ----------------------------------------------------
    # Model 1A: Outcome Quality (Regression)
    # ----------------------------------------------------
    print("\n--- Training Model 1A: Outcome Quality Regressor ---")
    y_train_q = df_train["outcome_quality"]
    y_val_q = df_val["outcome_quality"]
    y_test_q = df_test["outcome_quality"]

    # Baseline 1: Dummy mean
    dummy_reg = DummyRegressor(strategy="mean")
    dummy_reg.fit(X_train_trans, y_train_q)
    pred_dummy_q = dummy_reg.predict(X_test_trans)

    # Baseline 2: Ridge
    ridge = Ridge(alpha=1.0)
    ridge.fit(X_train_trans, y_train_q)
    pred_ridge_q = ridge.predict(X_test_trans)

    # Candidate: GradientBoostingRegressor
    model_q = GradientBoostingRegressor(
        n_estimators=70,
        max_depth=4,
        learning_rate=0.08,
        min_samples_split=10,
        random_state=42
    )
    model_q.fit(X_train_trans, y_train_q)
    pred_gb_q = model_q.predict(X_test_trans)

    reg_metrics = {
        "Dummy (Mean)": {"MAE": float(mean_absolute_error(y_test_q, pred_dummy_q)), "RMSE": float(np.sqrt(mean_squared_error(y_test_q, pred_dummy_q))), "R2": float(r2_score(y_test_q, pred_dummy_q))},
        "Heuristic Baseline": {"MAE": float(mean_absolute_error(y_test_q, y_test_heuristic_quality)), "RMSE": float(np.sqrt(mean_squared_error(y_test_q, y_test_heuristic_quality))), "R2": float(r2_score(y_test_q, y_test_heuristic_quality))},
        "Linear (Ridge)": {"MAE": float(mean_absolute_error(y_test_q, pred_ridge_q)), "RMSE": float(np.sqrt(mean_squared_error(y_test_q, pred_ridge_q))), "R2": float(r2_score(y_test_q, pred_ridge_q))},
        "GradientBoosting (Candidate)": {"MAE": float(mean_absolute_error(y_test_q, pred_gb_q)), "RMSE": float(np.sqrt(mean_squared_error(y_test_q, pred_gb_q))), "R2": float(r2_score(y_test_q, pred_gb_q))},
    }

    # ----------------------------------------------------
    # Model 1B: On-Time Completion (Binary Classifier)
    # ----------------------------------------------------
    print("\n--- Training Model 1B: On-Time Classifier ---")
    y_train_ot = df_train["on_time"]
    y_val_ot = df_val["on_time"]
    y_test_ot = df_test["on_time"]

    dummy_clf_ot = DummyClassifier(strategy="most_frequent")
    dummy_clf_ot.fit(X_train_trans, y_train_ot)
    pred_dummy_ot = dummy_clf_ot.predict(X_test_trans)

    log_reg_ot = LogisticRegression(max_iter=500, random_state=42)
    log_reg_ot.fit(X_train_trans, y_train_ot)
    pred_lr_ot = log_reg_ot.predict_proba(X_test_trans)[:, 1]

    model_ot = GradientBoostingClassifier(
        n_estimators=60,
        max_depth=3,
        learning_rate=0.08,
        random_state=42
    )
    model_ot.fit(X_train_trans, y_train_ot)
    pred_gb_ot_proba = model_ot.predict_proba(X_test_trans)[:, 1]
    pred_gb_ot_class = (pred_gb_ot_proba >= 0.5).astype(int)

    ontime_metrics = {
        "Dummy (Majority)": {"Accuracy": float(accuracy_score(y_test_ot, pred_dummy_ot)), "F1": float(f1_score(y_test_ot, pred_dummy_ot, zero_division=0)), "ROC-AUC": 0.5},
        "Heuristic Baseline": {"Accuracy": float(accuracy_score(y_test_ot, y_test_heuristic_ontime)), "F1": float(f1_score(y_test_ot, y_test_heuristic_ontime)), "ROC-AUC": float(roc_auc_score(y_test_ot, y_test_heuristic_ontime))},
        "Logistic Regression": {"Accuracy": float(accuracy_score(y_test_ot, (pred_lr_ot >= 0.5).astype(int))), "F1": float(f1_score(y_test_ot, (pred_lr_ot >= 0.5).astype(int))), "ROC-AUC": float(roc_auc_score(y_test_ot, pred_lr_ot))},
        "GradientBoosting (Candidate)": {"Accuracy": float(accuracy_score(y_test_ot, pred_gb_ot_class)), "F1": float(f1_score(y_test_ot, pred_gb_ot_class)), "ROC-AUC": float(roc_auc_score(y_test_ot, pred_gb_ot_proba))},
    }

    # ----------------------------------------------------
    # Model 2: Burnout Risk Predictor (Binary Classifier with Class Imbalance Tuning)
    # ----------------------------------------------------
    print("\n--- Training Model 2: Burnout Risk Classifier ---")
    y_train_bo = df_train["burnout_flag"]
    y_val_bo = df_val["burnout_flag"]
    y_test_bo = df_test["burnout_flag"]

    dummy_clf_bo = DummyClassifier(strategy="most_frequent")
    dummy_clf_bo.fit(X_train_trans, y_train_bo)
    pred_dummy_bo = dummy_clf_bo.predict(X_test_trans)

    log_reg_bo = LogisticRegression(class_weight="balanced", max_iter=500, random_state=42)
    log_reg_bo.fit(X_train_trans, y_train_bo)
    pred_lr_bo = log_reg_bo.predict_proba(X_test_trans)[:, 1]

    model_bo = GradientBoostingClassifier(
        n_estimators=75,
        max_depth=3,
        learning_rate=0.08,
        min_samples_leaf=15,
        random_state=42
    )
    model_bo.fit(X_train_trans, y_train_bo)

    # Threshold tuning on validation set to optimize F1 while prioritizing recall
    val_probs = model_bo.predict_proba(X_val_trans)[:, 1]
    best_thresh = 0.5
    best_f1 = 0.0
    for t in np.linspace(0.20, 0.70, 51):
        f1_val = f1_score(y_val_bo, (val_probs >= t).astype(int), zero_division=0)
        if f1_val > best_f1:
            best_f1 = f1_val
            best_thresh = float(t)

    print(f"Optimal decision threshold selected on validation set: {best_thresh:.3f} (Val F1: {best_f1:.4f})")

    pred_gb_bo_proba = model_bo.predict_proba(X_test_trans)[:, 1]
    pred_gb_bo_class = (pred_gb_bo_proba >= best_thresh).astype(int)

    cm = confusion_matrix(y_test_bo, pred_gb_bo_class).tolist()

    burnout_metrics = {
        "Dummy (All 0)": {
            "Accuracy": float(accuracy_score(y_test_bo, pred_dummy_bo)),
            "Precision": float(precision_score(y_test_bo, pred_dummy_bo, zero_division=0)),
            "Recall": float(recall_score(y_test_bo, pred_dummy_bo, zero_division=0)),
            "F1": float(f1_score(y_test_bo, pred_dummy_bo, zero_division=0)),
            "ROC-AUC": 0.5,
            "PR-AUC": float(average_precision_score(y_test_bo, pred_dummy_bo)),
        },
        "Heuristic Baseline": {
            "Accuracy": float(accuracy_score(y_test_bo, y_test_heuristic_burnout)),
            "Precision": float(precision_score(y_test_bo, y_test_heuristic_burnout)),
            "Recall": float(recall_score(y_test_bo, y_test_heuristic_burnout)),
            "F1": float(f1_score(y_test_bo, y_test_heuristic_burnout)),
            "ROC-AUC": float(roc_auc_score(y_test_bo, y_test_heuristic_burnout)),
            "PR-AUC": float(average_precision_score(y_test_bo, y_test_heuristic_burnout)),
        },
        "Logistic (Balanced)": {
            "Accuracy": float(accuracy_score(y_test_bo, (pred_lr_bo >= 0.5).astype(int))),
            "Precision": float(precision_score(y_test_bo, (pred_lr_bo >= 0.5).astype(int))),
            "Recall": float(recall_score(y_test_bo, (pred_lr_bo >= 0.5).astype(int))),
            "F1": float(f1_score(y_test_bo, (pred_lr_bo >= 0.5).astype(int))),
            "ROC-AUC": float(roc_auc_score(y_test_bo, pred_lr_bo)),
            "PR-AUC": float(average_precision_score(y_test_bo, pred_lr_bo)),
        },
        "GradientBoosting (Candidate)": {
            "Accuracy": float(accuracy_score(y_test_bo, pred_gb_bo_class)),
            "Precision": float(precision_score(y_test_bo, pred_gb_bo_class)),
            "Recall": float(recall_score(y_test_bo, pred_gb_bo_class)),
            "F1": float(f1_score(y_test_bo, pred_gb_bo_class)),
            "ROC-AUC": float(roc_auc_score(y_test_bo, pred_gb_bo_proba)),
            "PR-AUC": float(average_precision_score(y_test_bo, pred_gb_bo_proba)),
            "Threshold": best_thresh,
            "ConfusionMatrix": cm,
        },
    }

    # ----------------------------------------------------
    # Permutation Feature Importance
    # ----------------------------------------------------
    perm_q = permutation_importance(model_q, X_test_trans, y_test_q, n_repeats=5, random_state=42)
    perm_bo = permutation_importance(model_bo, X_test_trans, y_test_bo, n_repeats=5, random_state=42)

    importances_q = {FEATURE_COLS[i]: round(float(perm_q.importances_mean[i]), 4) for i in np.argsort(perm_q.importances_mean)[::-1]}
    importances_bo = {FEATURE_COLS[i]: round(float(perm_bo.importances_mean[i]), 4) for i in np.argsort(perm_bo.importances_mean)[::-1]}

    # ----------------------------------------------------
    # Export Models and Artifacts
    # ----------------------------------------------------
    # 1. JSON Models for zero-overhead in-browser JS execution
    json_model_q = serialize_tree_ensemble(model_q, imputer, scaler, FEATURE_COLS)
    json_model_ot = serialize_tree_ensemble(model_ot, imputer, scaler, FEATURE_COLS)
    json_model_bo = serialize_tree_ensemble(model_bo, imputer, scaler, FEATURE_COLS)
    json_model_bo["optimal_threshold"] = best_thresh

    with open(models_dir / "model_quality.json", "w", encoding="utf-8") as f:
        json.dump(json_model_q, f)
    with open(models_dir / "model_ontime.json", "w", encoding="utf-8") as f:
        json.dump(json_model_ot, f)
    with open(models_dir / "model_burnout.json", "w", encoding="utf-8") as f:
        json.dump(json_model_bo, f)

    # 2. Python joblib models
    joblib.dump(Pipeline([("imputer", imputer), ("scaler", scaler), ("regressor", model_q)]), models_dir / "model_quality.joblib")
    joblib.dump(Pipeline([("imputer", imputer), ("scaler", scaler), ("classifier", model_ot)]), models_dir / "model_ontime.joblib")
    joblib.dump(Pipeline([("imputer", imputer), ("scaler", scaler), ("classifier", model_bo)]), models_dir / "model_burnout.joblib")

    # 3. Feature schema
    with open(models_dir / "feature_schema.json", "w", encoding="utf-8") as f:
        json.dump(FEATURE_SCHEMA, f, indent=2)

    # 4. Metrics.json
    all_metrics = {
        "dataset": {"train_rows": len(df_train), "val_rows": len(df_val), "test_rows": len(df_test)},
        "outcome_quality": reg_metrics,
        "on_time": ontime_metrics,
        "burnout_risk": burnout_metrics,
        "permutation_importance": {
            "outcome_quality": importances_q,
            "burnout_risk": importances_bo,
        },
    }

    with open(models_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(all_metrics, f, indent=2)

    # 5. Generate Parity Test Cases (200 random rows for JS parity validation)
    rng_parity = np.random.RandomState(999)
    sample_indices = rng_parity.choice(len(df_test), size=200, replace=False)
    df_sample = df_test.iloc[sample_indices].copy()

    sample_X = df_sample[FEATURE_COLS]
    sample_trans = scaler.transform(imputer.transform(sample_X))

    py_pred_q = model_q.predict(sample_trans).tolist()
    py_pred_ot = model_ot.predict_proba(sample_trans)[:, 1].tolist()
    py_pred_bo = model_bo.predict_proba(sample_trans)[:, 1].tolist()

    parity_cases = []
    for idx, (real_idx, row) in enumerate(df_sample.iterrows()):
        features_dict = {col: (None if pd.isna(row[col]) else float(row[col])) for col in FEATURE_COLS}
        parity_cases.append({
            "id": int(idx),
            "features": features_dict,
            "py_pred_quality": float(py_pred_q[idx]),
            "py_pred_ontime": float(py_pred_ot[idx]),
            "py_pred_burnout": float(py_pred_bo[idx]),
        })

    with open(models_dir / "parity_test_cases.json", "w", encoding="utf-8") as f:
        json.dump(parity_cases, f, indent=2)

    # 6. Model Card Markdown
    model_card_content = f"""# Model Card: Equilibrium Telemetry ML Suite

> [!WARNING]
> **SYNTHETIC DATA DISCLAIMER**: These models were trained on synthetically generated engineering telemetry simulating workload distribution, multi-proficiency skill match, and burnout dynamics. This suite demonstrates nonlinear machine learning integration for engineering resource management and has not been validated on real enterprise teams.

## 1. Overview
The Equilibrium ML suite replaces static heuristic formulas with three complementary models:
1. **Outcome Quality Regressor (Model 1A)**: Predicts expected engineering output quality (0–100 scale) based on skill coverage, complexity deltas, and overtime fatigue penalties.
2. **On-Time Delivery Classifier (Model 1B)**: Predicts likelihood of delivering the task within schedule.
3. **Burnout Fatigue Risk Classifier (Model 2)**: Binary probability of critical burnout within 4 weeks, sensitive to multi-week overtime streaks, low PTO, and capacity overages.

## 2. Test Set Performance vs Baselines

### Outcome Quality (Continuous 0–100)
| Model | MAE | RMSE | $R^2$ |
| :--- | :--- | :--- | :--- |
| Dummy (Mean) | {reg_metrics['Dummy (Mean)']['MAE']:.2f} | {reg_metrics['Dummy (Mean)']['RMSE']:.2f} | {reg_metrics['Dummy (Mean)']['R2']:.3f} |
| Heuristic Baseline | {reg_metrics['Heuristic Baseline']['MAE']:.2f} | {reg_metrics['Heuristic Baseline']['RMSE']:.2f} | {reg_metrics['Heuristic Baseline']['R2']:.3f} |
| Linear (Ridge) | {reg_metrics['Linear (Ridge)']['MAE']:.2f} | {reg_metrics['Linear (Ridge)']['RMSE']:.2f} | {reg_metrics['Linear (Ridge)']['R2']:.3f} |
| **Gradient Boosting** | **{reg_metrics['GradientBoosting (Candidate)']['MAE']:.2f}** | **{reg_metrics['GradientBoosting (Candidate)']['RMSE']:.2f}** | **{reg_metrics['GradientBoosting (Candidate)']['R2']:.3f}** |

### Burnout Risk Prediction (Binary, Positive Rate: {all_metrics['burnout_risk']['GradientBoosting (Candidate)']['Recall']*100:.1f}% Recall)
| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Dummy (All 0) | {burnout_metrics['Dummy (All 0)']['Accuracy']:.3f} | 0.000 | 0.000 | 0.000 | 0.500 | {burnout_metrics['Dummy (All 0)']['PR-AUC']:.3f} |
| Heuristic Baseline | {burnout_metrics['Heuristic Baseline']['Accuracy']:.3f} | {burnout_metrics['Heuristic Baseline']['Precision']:.3f} | {burnout_metrics['Heuristic Baseline']['Recall']:.3f} | {burnout_metrics['Heuristic Baseline']['F1']:.3f} | {burnout_metrics['Heuristic Baseline']['ROC-AUC']:.3f} | {burnout_metrics['Heuristic Baseline']['PR-AUC']:.3f} |
| Logistic (Balanced) | {burnout_metrics['Logistic (Balanced)']['Accuracy']:.3f} | {burnout_metrics['Logistic (Balanced)']['Precision']:.3f} | {burnout_metrics['Logistic (Balanced)']['Recall']:.3f} | {burnout_metrics['Logistic (Balanced)']['F1']:.3f} | {burnout_metrics['Logistic (Balanced)']['ROC-AUC']:.3f} | {burnout_metrics['Logistic (Balanced)']['PR-AUC']:.3f} |
| **Gradient Boosting** | **{burnout_metrics['GradientBoosting (Candidate)']['Accuracy']:.3f}** | **{burnout_metrics['GradientBoosting (Candidate)']['Precision']:.3f}** | **{burnout_metrics['GradientBoosting (Candidate)']['Recall']:.3f}** | **{burnout_metrics['GradientBoosting (Candidate)']['F1']:.3f}** | **{burnout_metrics['GradientBoosting (Candidate)']['ROC-AUC']:.3f}** | **{burnout_metrics['GradientBoosting (Candidate)']['PR-AUC']:.3f}** |

## 3. Top Features (Permutation Importance)
### Outcome Quality
{json.dumps(importances_q, indent=2)}

### Burnout Risk
{json.dumps(importances_bo, indent=2)}
"""
    with open(models_dir / "model_card.md", "w", encoding="utf-8") as f:
        f.write(model_card_content)

    # Print summary table
    print("\n" + "=" * 60)
    print("TEST SET EVALUATION SUMMARY")
    print("=" * 60)
    print(f"Outcome Quality: Candidate R2 = {reg_metrics['GradientBoosting (Candidate)']['R2']:.3f} (vs Heuristic R2 = {reg_metrics['Heuristic Baseline']['R2']:.3f})")
    print(f"On-Time Pred:    Candidate ROC-AUC = {ontime_metrics['GradientBoosting (Candidate)']['ROC-AUC']:.3f} (vs Heuristic ROC-AUC = {ontime_metrics['Heuristic Baseline']['ROC-AUC']:.3f})")
    print(f"Burnout Pred:    Candidate ROC-AUC = {burnout_metrics['GradientBoosting (Candidate)']['ROC-AUC']:.3f}, PR-AUC = {burnout_metrics['GradientBoosting (Candidate)']['PR-AUC']:.3f}, Recall = {burnout_metrics['GradientBoosting (Candidate)']['Recall']*100:.1f}%, F1 = {burnout_metrics['GradientBoosting (Candidate)']['F1']:.3f}")
    print(f"Artifacts saved to {models_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()
