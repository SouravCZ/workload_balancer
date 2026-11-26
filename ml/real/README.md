# Equilibrium Real-Data Benchmarks

This directory contains pipelines for evaluating Equilibrium's methodology against genuine, public empirical datasets.

> [!IMPORTANT]
> **Methodology & Architectural Separation**:
> These empirical benchmarks are separate evaluations on external public schemas. They **do not validate** the synthetic Equilibrium models because feature schemas, collection methods, and organizational contexts differ. Real-data models are strictly offline benchmarks and are **never** wired into the live in-browser scoring engine.

---

## 1. Datasets & Acquisition

Raw datasets are not committed to git and are excluded via `.gitignore` (`ml/data/`).

### Dataset A: "Are Your Employees Burning Out?"
- **Publisher**: Paras Varshney (HackerEarth ML Challenge)
- **Kaggle Slug**: `parasvarshney/employee-burnout-dataset`
- **Expected Path**: `ml/data/real/employee_burnout.csv` (or `ml/data/real/train.csv`)
- **Download via Kaggle CLI**:
  ```bash
  kaggle datasets download -d parasvarshney/employee-burnout-dataset -p ml/data/real/ --unzip
  # Rename train.csv if needed:
  mv ml/data/real/train.csv ml/data/real/employee_burnout.csv
  ```
- **Manual Download**:
  1. Visit: https://www.kaggle.com/datasets/parasvarshney/employee-burnout-dataset
  2. Download `archive.zip` and extract `train.csv`.
  3. Place it at `ml/data/real/employee_burnout.csv`.

### Dataset B: "Apache's Jira Issues"
- **Publisher**: Ted Lozzo (Apache Software Foundation public issue telemetry)
- **Kaggle Slug**: `tedlozzo/apaches-jira-issues`
- **Expected Path**: `ml/data/real/jira_issues.csv`
- **Download via Kaggle CLI**:
  ```bash
  kaggle datasets download -d tedlozzo/apaches-jira-issues -p ml/data/real/ --unzip
  # Rename the issues file if needed:
  mv ml/data/real/issues.csv ml/data/real/jira_issues.csv
  ```
- **Manual Download**:
  1. Visit: https://www.kaggle.com/datasets/tedlozzo/apaches-jira-issues
  2. Download and extract the dataset.
  3. Place the CSV at `ml/data/real/jira_issues.csv`.

---

## 2. Pipeline Execution

Each script checks for its input file. If missing, it prints exact path and download instructions and exits cleanly with code 0 (no crashes, no fabricated data).

### Run Employee Burnout Benchmark:
```bash
python ml/real/train_burnout_real.py
```
- Trains regression (`Burn Rate`, 0–1) and binary high-burnout classification (`Burn Rate >= 0.6`).
- Uses operational features: `Resource Allocation`, `Designation`, `WFH Setup Available`, `Company Type`, tenure from `Date of Joining`.
- Excludes `Mental Fatigue Score` from the main model (Equilibrium does not collect self-reported subjective fatigue).
- Executes an ablation experiment **with** `Mental Fatigue Score` and reports the performance gap.
- Compares Mean/Majority, Ridge/Logistic Regression, and HistGradientBoosting with 5-fold CV tuning.
- Writes metrics to `ml/models/real_metrics.json`.

### Run Jira Duration Classifier:
```bash
python ml/real/train_duration_real.py
```
- Trains a 3-class resolution-time classifier (`short`, `medium`, `long` based on empirical tertiles).
- Uses temporal split (chronological train/test) to prevent future leakage.
- Compares Majority baseline, Logistic Regression, and HistGradientBoosting.
- Writes metrics to `ml/models/real_metrics.json`.

### Calibrate Synthetic Generator:
```bash
python ml/generate_data.py --calibrate-from-real
```
- When `ml/data/real/jira_issues.csv` is present, calibrates task priority distribution and duration quantiles mapped to `estimated_hours`.
- Member proficiencies and outcome formulas remain synthetic.
- If called without `--calibrate-from-real`, the generator produces byte-identical synthetic telemetry.

---

## 3. Results (Employee Burnout Benchmark)

The two provided dataset parts were combined into `ml/data/real/employee_burnout.csv` (22,750 rows; 21,626 labeled after dropping missing `Burn Rate`; 17,300 train / 4,326 stratified test rows, seed 42). High burnout = `Burn Rate ≥ 0.60` (23.83% test prevalence).

| Target | Mean / Majority Baseline | Linear Baseline | HistGradientBoosting (tuned) |
| :--- | :--- | :--- | :--- |
| Burn Rate (regression) | R² = -0.000, MAE = 0.159 | Ridge R² = 0.713, MAE = 0.085 | **R² = 0.743, MAE = 0.081** |
| High burnout (classification) | ROC-AUC = 0.500, PR-AUC = 0.238, Acc = 76.2% | Logistic ROC-AUC = 0.913, PR-AUC = 0.786, Acc = 82.5% | **ROC-AUC = 0.920, PR-AUC = 0.800, Acc = 86.7%, Precision = 0.764, Recall = 0.639, F1 = 0.696** |

Adding subjective `Mental Fatigue Score` raises regression to R² = 0.910 (+0.167) and classification to ROC-AUC = 0.969 (+0.049), Acc = 91.0%, F1 = 0.803. The live scoring engine deliberately excludes that intrusive input.

Full machine-readable results are written to `ml/models/real_metrics.json` and mirrored to `src/models/real_metrics.json`, which feeds the in-app benchmarks section. On Windows, set `JOBLIB_MULTIPROCESSING=0` before running the script if joblib multiprocessing is unavailable.

### Scoring an Unlabeled Test Set
```bash
python ml/real/predict_burnout_real.py --test-path path/to/test.csv
```
- Refits the tuned operational regressor/classifier on all 21,626 labeled rows using the hyperparameters in `ml/models/real_metrics.json`.
- Writes `ml/data/real/burnout_test_predictions.csv` (Burn Rate, high-burnout probability, binary flag) and `ml/data/real/burnout_test_submission.csv` (`Employee ID,Burn Rate`, matching the challenge submission format).
- An unlabeled test file has no `Burn Rate` column, so accuracy cannot be computed; only predictions can be produced.
