# Model Card: Equilibrium Telemetry ML Suite

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
| Dummy (Mean) | 21.67 | 26.24 | -0.001 |
| Heuristic Baseline | 28.67 | 32.53 | -0.539 |
| Linear (Ridge) | 4.03 | 5.09 | 0.962 |
| **Gradient Boosting** | **2.99** | **3.78** | **0.979** |

### Burnout Risk Prediction (Binary, Positive Rate: 65.9% Recall)
| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Dummy (All 0) | 0.829 | 0.000 | 0.000 | 0.000 | 0.500 | 0.171 |
| Heuristic Baseline | 0.253 | 0.186 | 0.996 | 0.313 | 0.548 | 0.186 |
| Logistic (Balanced) | 0.809 | 0.467 | 0.845 | 0.601 | 0.888 | 0.694 |
| **Gradient Boosting** | **0.874** | **0.625** | **0.659** | **0.642** | **0.886** | **0.697** |

## 3. Top Features (Permutation Importance)
### Outcome Quality
{
  "projected_utilization_after_assign": 0.3008,
  "skill_gap_max": 0.1505,
  "seniority_vs_complexity": 0.1191,
  "skill_match_score": 0.0502,
  "skill_coverage_ratio": 0.0275,
  "concurrent_task_count": 0.0245,
  "collaboration_needed": 0.015,
  "hours_to_deadline_ratio": 0.0054,
  "task_hours_to_headroom_ratio": 0.0002,
  "overtime_trend": 0.0,
  "overload_streak_weeks": 0.0,
  "tenure_months": -0.0,
  "task_priority": -0.0,
  "current_utilization": -0.0,
  "recent_pto_days": -0.0
}

### Burnout Risk
{
  "projected_utilization_after_assign": 0.0882,
  "overload_streak_weeks": 0.0254,
  "recent_pto_days": 0.004,
  "tenure_months": 0.0024,
  "concurrent_task_count": 0.0016,
  "skill_match_score": 0.0007,
  "hours_to_deadline_ratio": 0.0005,
  "task_hours_to_headroom_ratio": 0.0,
  "skill_gap_max": 0.0,
  "skill_coverage_ratio": -0.0003,
  "collaboration_needed": -0.0004,
  "task_priority": -0.0007,
  "seniority_vs_complexity": -0.0012,
  "overtime_trend": -0.0012,
  "current_utilization": -0.0012
}
