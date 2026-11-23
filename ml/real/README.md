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
