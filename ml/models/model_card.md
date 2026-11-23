# Model Card: Equilibrium Telemetry ML Suite

> [!WARNING]
> **SYNTHETIC DATA DISCLAIMER & CALIBRATION NOTE**:
> These models were trained on synthetically generated engineering telemetry (`ml/generate_data.py`).
> **Noise Calibration Note**: The outcome noise ($\sigma = 13.5$) and unobserved friction factors were deliberately tuned so that held-out test $R^2$ landed in the calibration target range of $0.60–0.85$ for a synthetic dataset. This calibration is an explicit experimental control on synthetic data generated from mathematical formulas; it **does not** validate real-world performance or substitute for empirical validation on genuine software engineering teams.
>
> Measured on the held-out test set, GBDT beats the linear baseline by 0.014 R2 on quality and 0.003 ROC-AUC on burnout; logistic regression beats GBDT by 0.003 ROC-AUC on on-time delivery. Gradient boosting is kept because it is already integrated and parity-tested, not because nonlinearity was shown to matter.

## 1. Overview & System Telemetry
The Equilibrium ML suite evaluates three operational dimensions on engineering task assignments:
1. **Outcome Quality Regressor (Model 1A)**: Predicts expected engineering output quality (0–100 continuous scale) based on skill coverage, complexity deltas, and overtime fatigue penalties.
2. **On-Time Delivery Classifier (Model 1B)**: Predicts likelihood of delivering the task within schedule.
3. **Burnout Fatigue Risk Classifier (Model 2)**: Binary probability of critical burnout within 4 weeks, sensitive to multi-week overtime streaks, low PTO, and capacity overages.

### Measured Deployment Profile
- **Inference Latency** (1,000 runs benchmarked in Node/V8):
  - **Median**: **0.010 ms** (~10 µs)
  - **p95**: **0.028 ms** (~28 µs)
  - **Mean**: 0.015 ms
- **Model Bundle Size** (JSON trees in `src/models/*.json`):
  - `model_quality.json`: 55.51 kB (15.76 kB gzip)
  - `model_ontime.json`: 59.75 kB (16.78 kB gzip)
  - `model_burnout.json`: 55.86 kB (15.32 kB gzip)
  - Total Models: **171.12 kB raw** (**47.86 kB gzip**)
  - Total including metrics & schema: **177.56 kB raw** (**49.82 kB gzip**)

---

## 2. Fair Evaluation: Model Comparison vs Baselines (Held-Out Test Set, N = 1,474)
*Partitioning discipline: Strictly partitioned by `member_id` via `GroupShuffleSplit` (70% Train, 15% Val, 15% Test) with zero individual overlap across splits. Hyperparameter search performed exclusively on train set using 4-fold `GroupKFold` (`n_iter=6` iterations across `n_estimators`, `max_depth`, `learning_rate`).*

### Unified Comparison Table
| Task / Target | Model / Baseline | Primary Metric | Secondary Metric | Notes & Baseline Gap |
| :--- | :--- | :--- | :--- | :--- |
| **Outcome Quality** (0–100) | Dummy (Mean) | $R^2 = -0.003$ | MAE = 23.11 | Predicts training mean (65.6) |
| | Heuristic Baseline | Spearman $\rho = \mathbf{0.700}$ (scale mismatch, $R^2$ not meaningful) | MAE = 28.52 | Rescaled FitScore ($100 \times \text{fit}$) |
| | Linear (Ridge) | $R^2 = \mathbf{0.784}$ | MAE = 10.46 | Ridge regression on standardized features |
| | **Gradient Boosting (Tuned)** | **$R^2 = \mathbf{0.798}$** | **MAE = 10.13** | **Gap vs Linear: $+0.014$ $R^2$ pts.** The linear model captures almost all explainable variance. |
| **On-Time Delivery** (0/1) | Dummy (Majority) | ROC-AUC = 0.500 | Accuracy = 58.1% | Predicts majority class |
| | Heuristic Baseline | ROC-AUC = 0.802 | Accuracy = 71.1% | Availability & deadline threshold; Spearman $\rho = \mathbf{0.515}$ |
| | **Logistic Regression** | **ROC-AUC = \mathbf{0.848}** | **Accuracy = 78.2%** | F1 = 82.1% |
| | Gradient Boosting (Tuned) | ROC-AUC = 0.845 | Accuracy = 77.7% | **Gap vs Logistic: $-0.003$ ROC-AUC.** Logistic regression slightly beats Gradient Boosting. |
| **Burnout Risk** (0/1) | Dummy (All 0) | ROC-AUC = 0.500 | PR-AUC = 0.182 | Predicts non-burnout for all members (base rate: 18.2%) |
| | Heuristic Baseline | ROC-AUC = 0.763 | PR-AUC = 0.331 | Overload streak & overage cutoff; Spearman $\rho = \mathbf{0.378}$ |
| | Logistic (Balanced) | ROC-AUC = 0.895 | PR-AUC = \mathbf{0.736} | Balanced class weights; Recall = 82.5%, F1 = 61.0% |
| | **Gradient Boosting (Tuned)** | **ROC-AUC = \mathbf{0.898}** | PR-AUC = 0.726 | **Gap vs Logistic: $+0.003$ ROC-AUC.** Calibrated threshold = 0.330; Recall = 66.5%, Precision = 65.6%, F1 = 66.1% |

### Key Observations & Honest Assessment
1. **Linear Baselines Are Extremely Competitive**: With realistic unobserved noise in the data ($R^2 \approx 0.80$), Ridge regression is only 0.014 $R^2$ behind Gradient Boosting, and Logistic Regression actually slightly exceeds Gradient Boosting on on-time prediction ($0.848$ vs $0.845$ ROC-AUC).
2. **Heuristic Rank Ordering is Substantial**: While the heuristic baseline produces negative $R^2$ due to uncalibrated scale, its Spearman rank correlation is high ($\rho = 0.700$ for quality, $\rho = 0.515$ for on-time delivery), demonstrating strong monotonic signal despite scale misalignment.
3. **Threshold Calibration**: Burnout risk is class-imbalanced (18.16% positive rate). Operating at standard 0.50 threshold yields low recall; calibrating to threshold $0.330$ balances Precision (65.6%) and Recall (66.5%).

---

## 3. Real-Data Benchmarks (`ml/real/`)
> **Real-data benchmarks: not yet run.**
>
> *Separate public benchmarks. They do not validate the synthetic Equilibrium models; feature schemas differ.*
>
> These offline empirical benchmarks evaluate whether organizational burnout and engineering resolution times can be predicted from public, empirical telemetry. They are strictly decoupled from the live in-browser scoring engine.
>
> ### Execution Commands
> To evaluate these benchmarks locally:
> 1. Download empirical datasets into `ml/data/real/` following instructions in `ml/real/README.md` and `ml/real/SOURCES.md`.
> 2. Run the Employee Burnout benchmark (HackerEarth / Paras Varshney):
>    ```bash
>    python ml/real/train_burnout_real.py
>    ```
>    - Evaluates continuous Burn Rate regression and binary high burnout classification (Burn Rate $\ge 0.60$, justified by clinical upper-quartile acute exhaustion cutoffs).
>    - Uses operational features only: Resource Allocation, Designation, WFH Setup, Company Type, tenure from Date of Joining.
>    - Excludes subjective `Mental Fatigue Score` from the main model; runs an explicit ablation with it to measure the subjective fatigue lift.
>    - Evaluates 5-fold CV tuning, Ridge / Logistic linear baselines, and HistGradientBoosting.
> 3. Run the Jira Issue Duration benchmark (Apache Software Foundation / Ted Lozzo):
>    ```bash
>    python ml/real/train_duration_real.py
>    ```
>    - Evaluates 3-class resolution time prediction (Short, Medium, Long based on empirical duration tertiles).
>    - Enforces a strict time-based train/test split to prevent temporal data leakage.
>    - Evaluates Majority baseline, Logistic Regression, and HistGradientBoosting.
> 4. Calibrate synthetic task marginals from empirical Jira telemetry:
>    ```bash
>    python ml/generate_data.py --calibrate-from-real
>    ```

---

## 4. Top Permutation Feature Importances (Held-Out Test Set)
### Outcome Quality
- `projected_utilization_after_assign`: +0.2566
- `skill_gap_max`: +0.1200
- `seniority_vs_complexity`: +0.0998
- `skill_match_score`: +0.0469
- `concurrent_task_count`: +0.0190
- `skill_coverage_ratio`: +0.0084

### Burnout Risk
- `projected_utilization_after_assign`: +0.1042
- `overload_streak_weeks`: +0.0251
- `recent_pto_days`: +0.0057
- `task_priority`: +0.0034
- `concurrent_task_count`: +0.0019
