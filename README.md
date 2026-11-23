# Equilibrium — Team Fit & Workload Balancer

[![Vite](https://img.shields.io/badge/Vite-8.3.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-33%20passed-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![ML In-Browser](https://img.shields.io/badge/ML%20In--Browser-Gradient%20Boosting%20(median%200.010ms)-blueviolet)](ml/models/model_card.md)

**Equilibrium** is a modern engineering operations portal designed to distribute software development tasks fairly, transparently, and sustainably. In typical teams, 20% of senior engineers often absorb 70% of organizational friction—leading to silent burnout, sudden turnover, and delayed critical-path features.

Equilibrium replaces intuition-based assignment with an objective **hybrid dual-scoring engine**: combining transparent, deterministic mathematical telemetry with ultra-fast, zero-dependency client-side machine learning.

---

## 🌟 Key Features

- **⚖️ Live Capacity & Workload Balancer (`/workload`)**: Real-time capacity tracking (contracted vs allocated hours) with automated rebalancing proposals that alleviate overloaded engineers while safeguarding receiver headroom.
- **🎯 Multi-Attribute Task Fit (`/tasks`)**: Scores candidate-task assignments on multi-skill overlap depth (1–5 scale) and post-assignment availability headroom, with strict 4-tier deterministic tie-breaking.
- **🛡️ Burnout Risk Fatigue Radar (`/burnout-risk`)**: Predicts exhaustion risk based on active overage, multi-week overload streaks, overtime velocity, and PTO recovery deficits.
- **🧠 In-Browser ML Ensembles (`/insights`)**: Three client-side Gradient Boosting models evaluating continuous outcome quality ($R^2 = 0.798$), on-time delivery likelihood ($\text{ROC-AUC} = 0.845$), and burnout risk ($\text{ROC-AUC} = 0.898$) in median `0.010 ms` (p95 `0.028 ms`) per task without an external backend. Dynamic `import()` bundles keep the main entry chunk at ~43 kB.
- **🔍 Divergence Auditing (`MlVsHeuristicPanel`)**: Proactively flags and explains any assignment where the ML model and the deterministic heuristic diverge by $\ge 15\%$.
- **📊 Executive Operations Reports (`/reports`)**: Filterable, exportable CSV reports and printer-friendly summaries with consolidated capacity metrics and ML intelligence breakdown.
- **💾 Persistent State**: Session state automatically synchronizes to `localStorage` (`equilibrium_team_state_v1`) with full factory reset guardrails.

---

## 🏗️ Architecture & Dual-Engine Overview

```text
                                  ┌──────────────────────────────┐
                                  │   Incoming Task Assignment   │
                                  └──────────────┬───────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │     Deterministic Engine      │                 │    In-Browser ML Pipeline     │
        │      (src/utils/scoring)      │                 │    (src/services/mlModel)     │
        ├───────────────────────────────┤                 ├───────────────────────────────┤
        │ • SkillOverlap (60% weight)   │                 │ • 15 Feature Telemetry Vector │
        │ • AvailabilityScore (40%)     │                 │ • Gradient Boosting Ensembles │
        │ • Bounded in [0, 1]           │                 │ • Outcome Quality Regressor   │
        │ • Deterministic Tie-Break     │                 │ • On-Time Classifier          │
        │ • Overload / Underutil Limits │                 │ • Burnout Classifier (P≥0.35) │
        └───────────────┬───────────────┘                 └───────────────┬───────────────┘
                        │                                                 │
                        └────────────────────────┬────────────────────────┘
                                                 ▼
                               ┌──────────────────────────────────┐
                               │       MlVsHeuristicPanel         │
                               │   Audits Divergence (|Δ| ≥ 15%)  │
                               └──────────────────────────────────┘
```

For complete mathematical definitions and architectural decision records, see:
- [System Architecture](docs/architecture.md)
- [Defect Audit & Verification](docs/audit.md)
- [Architecture Decision Records (ADRs)](docs/decisions.md)
- [ML Model Card](ml/models/model_card.md)

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ (tested on Node.js 20+)
- Python 3.10+ (for synthetic dataset regeneration and ML retraining)

### 2. Frontend Installation & Execution
```bash
# Install frontend dependencies
npm install

# Start development server
npm run dev

# Run full Vitest unit & parity test suite (33 tests)
npm run test

# Run Oxlint static analysis
npm run lint

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

### 3. ML Pipeline Reproduction
The ML models can be retrained and exported from scratch using deterministic random seeds:

```bash
# 1. Install Python ML requirements
pip install -r ml/requirements.txt

# 2. Generate reproducible synthetic dataset (10,000 assignments, seed 42)
python ml/generate_data.py --seed 42 --n_members 300 --n_tasks 4000

# 3. Train models with GroupShuffleSplit (70/15/15 by member) and export JSON bundles
python ml/train.py

# 4. Verify in-browser parity against Python output (< 1e-4 tolerance)
npm run test
```

---

## 📈 Model Performance Benchmark (Held-Out Test Set)

Models are evaluated on a held-out test set ($N = 1,474$ assignments) partitioned strictly by `member_id` via `GroupShuffleSplit` (70% train / 15% validation / 15% test) to prevent cross-person data leakage:

| Target Model | Baseline Metric | Linear Baseline | Equilibrium ML (Gradient Boosting) | Baseline Comparison / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Outcome Quality** (0–100) | Heuristic Spearman $\rho = 0.700$ (scale mismatch, $R^2$ not meaningful) | Ridge $R^2 = 0.784$, MAE = 10.46 | **$R^2 = 0.798$, MAE = 10.13** | Tuned model leads Ridge by $+0.014$ $R^2$ pts |
| **On-Time Delivery** (0/1) | Heuristic ROC-AUC = 0.802 (Spearman $\rho = 0.515$) | Logistic ROC-AUC = 0.848, Acc = 78.2% | **ROC-AUC = 0.845, F1 = 81.5%, Acc = 77.7%** | Logistic regression marginally exceeds Gradient Boosting ($-0.003$ AUC) |
| **Burnout Risk** (0/1) | Heuristic ROC-AUC = 0.763 (Spearman $\rho = 0.378$) | Logistic ROC-AUC = 0.895, PR-AUC = 0.736 | **ROC-AUC = 0.898, PR-AUC = 0.726, F1 = 66.1%** | Calibrated threshold = 0.330 (Recall = 66.5%, Precision = 65.6%) |

---

## ⚠️ Synthetic Data Notice & Production Calibration

All machine learning models included in this repository are trained on a controlled synthetic demonstration dataset (`ml/generate_data.py`) with calibrated interaction terms and noise. Measured on the held-out test set, GBDT beats the linear baseline by 0.014 R2 on quality and 0.003 ROC-AUC on burnout; logistic regression beats GBDT by 0.003 ROC-AUC on on-time delivery. Gradient boosting is kept because it is already integrated and parity-tested, not because nonlinearity was shown to matter. 

In enterprise deployments, these pipelines are designed to be recalibrated against historical engineering telemetry:
- **Task Outcomes**: Pull request cycle times, code review iterations, and deployment rollbacks from GitHub/GitLab.
- **On-Time Delivery**: Story point estimations vs actual resolution times from Jira or Linear.
- **Fatigue Markers**: On-call rotation schedules (PagerDuty), overtime hours, and PTO balances (HRIS).

---

## 📄 License
MIT License. Equilibrium — Team Fit & Workload Balancer.
