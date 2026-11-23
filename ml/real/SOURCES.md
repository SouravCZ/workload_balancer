# Real-Data Sources & Licensing Terms

This document records the provenance, licensing terms, and access details for public empirical datasets used as reference benchmarks in Equilibrium.

---

## Dataset A: Employee Burnout Challenge

- **Dataset Title**: "Are Your Employees Burning Out?"
- **Author / Host**: Paras Varshney / HackerEarth ML Challenge
- **Source URL**: https://www.kaggle.com/datasets/parasvarshney/employee-burnout-dataset
- **Original Challenge**: HackerEarth "Burnout Rate Challenge"
- **License**: CC0: Public Domain (or standard Kaggle Open Access Community Data)
- **Target Variable**:
  - `Burn Rate`: Continuous measure [0.0, 1.0] indicating employee burnout level.
- **Key Attributes**:
  - `Date of Joining`: Date employee joined company.
  - `Gender`: Gender identity (Male/Female).
  - `Company Type`: Service or Product.
  - `WFH Setup Available`: Binary (Yes/No).
  - `Designation`: Seniority / grade level (1.0 to 5.0).
  - `Resource Allocation`: Hours/resources assigned (1.0 to 10.0).
  - `Mental Fatigue Score`: Subjective psychological fatigue rating (0.0 to 10.0).
- **Equilibrium Usage Note**:
  - The main Equilibrium model **strictly excludes** `Mental Fatigue Score` because Equilibrium operates on objective telemetry (allocations, velocity, calendar streaks) without intrusive psychological surveys.
  - An explicit ablation experiment evaluates the model with and without `Mental Fatigue Score` to measure the gap between objective operational telemetry and subjective fatigue reporting.

---

## Dataset B: Apache's Jira Issues

- **Dataset Title**: "Apache's Jira Issues"
- **Author / Host**: Ted Lozzo / Apache Software Foundation Jira
- **Source URL**: https://www.kaggle.com/datasets/tedlozzo/apaches-jira-issues
- **License**: Apache 2.0 / Open Source Community Data
- **Target Construct**:
  - Issue resolution time duration: `resolved - created` (tertiles: `short`, `medium`, `long`).
- **Key Attributes**:
  - `key` / `project`: Apache project identifier.
  - `issuetype`: Bug, Improvement, New Feature, Task, Sub-task.
  - `priority`: Blocker, Critical, Major, Minor, Trivial.
  - `summary`: Issue title text.
  - `description`: Issue description text.
  - `created`, `resolved`: Timestamps.
  - `assignee`: Presence of assigned contributor.
- **Equilibrium Usage Note**:
  - Used for issue resolution duration classification using strict time-based train/test splits.
  - Used to calibrate empirical marginals (priority distributions and duration quantiles) in `ml/generate_data.py --calibrate-from-real`.

---

## Compliance & Storage Policy

- Raw CSV datasets are gitignored under `ml/data/` and must not be committed to source control.
- Only aggregated summary statistics and metric evaluation tables are stored in `ml/models/real_metrics.json`.
- These datasets represent external organizational contexts and do not constitute ground truth validation for Equilibrium's internal synthetic engineering heuristics.
