# Model Card: Equilibrium Telemetry ML Suite

> [!WARNING]
> **SYNTHETIC DATA DISCLAIMER**: These models were trained on synthetically generated engineering telemetry simulating workload distribution, multi-proficiency skill match, and burnout dynamics. This suite demonstrates nonlinear machine learning integration for engineering resource management and has not been validated on real enterprise teams.

## 1. Overview
The Equilibrium ML suite evaluates three operational dimensions on engineering task assignments:
1. **Outcome Quality Regressor (Model 1A)**: Predicts expected engineering output quality (0–100 scale) based on skill coverage, complexity deltas, and overtime fatigue penalties.
2. **On-Time Delivery Classifier (Model 1B)**: Predicts likelihood of delivering the task within schedule.
3. **Burnout Fatigue Risk Classifier (Model 2)**: Binary probability of critical burnout within 4 weeks, sensitive to multi-week overtime streaks, low PTO, and capacity overages.

## 2. Fair Evaluation: Model Comparison vs Baselines (Held-Out Test Set, N = 1474)
*GroupShuffleSplit strictly partitioned by `member_id` (70% Train, 15% Val, 15% Test) with zero individual overlap across splits.*

### Unified Comparison Table
| Task / Target | Model / Baseline | Primary Metric | Secondary Metric | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Outcome Quality** (0–100) | Dummy (Mean) | $R^2 = -0.003$ | MAE = 23.11 | Predicts mean outcome quality (65.6) |
| | Heuristic Baseline | $R^2 = -0.464$ | MAE = 28.52 | Rescaled FitScore ($100 \times \text{fit}$); Spearman $\rho = 0.700$ |
| | Linear (Ridge) | $R^2 = 0.784$ | MAE = 10.46 | Ridge regression on standardized features |
| | **Gradient Boosting** | **$R^2 = 0.798$** | **MAE = 10.13** | Hyperparameters tuned via GroupKFold RandomizedSearchCV |
| **On-Time Delivery** (0/1) | Dummy (Majority) | ROC-AUC = 0.500 | Accuracy = 58.1% | Predicts majority class |
| | Heuristic Baseline | ROC-AUC = 0.802 | Accuracy = 71.1% | Availability & deadline threshold; Spearman $\rho = 0.515$ |
| | Logistic Regression | ROC-AUC = 0.848 | Accuracy = 78.2% | Logistic regression on standardized features |
| | **Gradient Boosting** | **ROC-AUC = 0.845** | **Accuracy = 77.7%** | F1 = 81.5% |
| **Burnout Risk** (0/1) | Dummy (All 0) | ROC-AUC = 0.500 | PR-AUC = 0.182 | Predicts non-burnout for all members |
| | Heuristic Baseline | ROC-AUC = 0.763 | PR-AUC = 0.331 | Overload streak & overage cutoff; Spearman $\rho = 0.378$ |
| | Logistic (Balanced) | ROC-AUC = 0.895 | PR-AUC = 0.736 | Balanced class weights; Recall = 82.5% |
| | **Gradient Boosting** | **ROC-AUC = 0.898** | **PR-AUC = 0.726** | Calibrated threshold = 0.330; Recall = 66.5%, F1 = 66.1% |

## 3. Top Permutation Feature Importances (Held-Out Test Set)
### Outcome Quality
{
  "projected_utilization_after_assign": 0.2566,
  "skill_gap_max": 0.12,
  "seniority_vs_complexity": 0.0998,
  "skill_match_score": 0.0469,
  "concurrent_task_count": 0.019,
  "skill_coverage_ratio": 0.0084,
  "collaboration_needed": 0.0083,
  "task_hours_to_headroom_ratio": 0.0046,
  "hours_to_deadline_ratio": 0.0013,
  "tenure_months": 0.0007,
  "current_utilization": 0.0001,
  "recent_pto_days": 0.0001,
  "task_priority": 0.0,
  "overload_streak_weeks": -0.0,
  "overtime_trend": -0.0005
}

### Burnout Risk
{
  "projected_utilization_after_assign": 0.1042,
  "overload_streak_weeks": 0.0251,
  "recent_pto_days": 0.0057,
  "task_priority": 0.0034,
  "concurrent_task_count": 0.0019,
  "task_hours_to_headroom_ratio": 0.0015,
  "hours_to_deadline_ratio": 0.0011,
  "tenure_months": 0.0011,
  "current_utilization": 0.0009,
  "overtime_trend": 0.0007,
  "skill_coverage_ratio": 0.0,
  "skill_gap_max": -0.0003,
  "collaboration_needed": -0.0004,
  "skill_match_score": -0.0005,
  "seniority_vs_complexity": -0.0008
}
