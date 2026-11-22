# Equilibrium Architecture & System Specification

## 1. System Overview
**Equilibrium** (`TeamFitWorkloadBalancer`) is a client-side engineering operations and decision-support portal designed to balance development workloads, match tasks to engineers by multi-skill competency, and predict fatigue/burnout before deadlines slip.

The system features a **hybrid dual-scoring architecture**:
1. **Deterministic Heuristic Engine**: Transparent, auditable mathematical formulas providing clear upper/lower bounds and invariant guarantees for workload balancing and rebalancing proposals.
2. **In-Browser Machine Learning Ensembles**: Lightweight Gradient Boosting tree ensembles (~171 kB JSON models, 47.9 kB gzip) evaluated directly in JavaScript in median `0.010 ms` (p95 `0.028 ms`) per assignment to predict continuous task quality (0–100), binary on-time delivery likelihood, and 4-week burnout manifestation risk. Models are lazy-loaded via dynamic `import()`.
3. **Divergence Auditing**: The `MlVsHeuristicPanel` flags any assignment where ML and heuristic predictions diverge by $\ge 15\%$, explaining latent friction factors (overtime trends, PTO deficits, or capacity saturation).

---

## 2. Directory Structure
```text
TeamFitWorkloadBalancer/
├── docs/
│   ├── architecture.md          # Complete system architecture and pipeline reference
│   ├── audit.md                 # Detailed defect audit, root causes, and test verification
│   └── decisions.md             # Architecture Decision Records (ADRs)
├── ml/
│   ├── data/                    # Generated synthetic datasets (members.csv, tasks.csv, assignments.csv)
│   ├── models/                  # Serialized JSON models, feature schemas, and metrics
│   ├── reports/                 # Distribution charts, correlation heatmaps, data summaries
│   ├── generate_data.py         # Deterministic synthetic data generator (seed=42)
│   ├── train.py                 # Scikit-learn training pipeline with GroupShuffleSplit
│   └── requirements.txt         # Python dependencies
├── src/
│   ├── components/              # UI primitives, Modal, Sidebar, Topbar, and MlVsHeuristicPanel
│   ├── context/                 # TeamContext (localStorage state persistence, atomic mutators)
│   ├── models/                  # Bundled client-side ML models & metrics (exact copies of ml/models)
│   ├── pages/                   # 11 application routes (Dashboard, Workload, Tasks, Burnout, etc.)
│   ├── services/                # mockData.js (seed data), mlModel.js (in-browser inference engine)
│   └── utils/                   # scoring.js (heuristic formulas), featureBuilder.js (15 features)
├── index.html                   # HTML entry point with metadata and Google Fonts
├── package.json                 # Dependencies and npm scripts
├── tailwind.config.js           # Tailwind v3.4 configuration
└── vite.config.js               # Vite 8 build configuration
```

---

## 3. Mathematical & Scoring Engine (`src/utils/scoring.js`)

### 3.1 Task Fit Formula
For engineer $M$ and task $T$:
$$\text{FitScore} = 0.6 \times \text{SkillOverlap} + 0.4 \times \text{AvailabilityScore}$$

Where:
- $\text{SkillOverlap} = \frac{\sum_{s \in T_{\text{req}}} \text{Proficiency}(M, s)}{|T_{\text{req}}| \times 5}$ (clamped to $[0, 1]$).
- $\text{AvailabilityScore} = \max\left(0, \min\left(1, 1 - \frac{\text{AllocatedHours} + \text{TaskHours}}{\text{CapacityHours}}\right)\right)$.
- Factors in post-assignment task hours so engineers near capacity cannot rank top for large tasks.

### 3.2 Candidate Ranking & Tie-Break
When ranking candidates for a task via `rankCandidates(task, members)`:
1. `fitScore` descending
2. `skillOverlap` descending
3. `availabilityScore` descending
4. `member.name` alphabetical ascending (guaranteeing 100% deterministic ordering)

### 3.3 Burnout Risk Scoring
Calculated from active capacity overage and consecutive overload streaks:
$$\text{Overage} = \max\left(0, \frac{\text{AllocatedHours} - \text{CapacityHours}}{\text{CapacityHours}}\right)$$
$$\text{RiskScore} = \min(100, \text{round}(180 \times \text{Overage} + 12 \times \text{StreakWeeks}))$$
- **Tiers**: Low ($0–29$), Medium ($30–59$), High ($60–100$).
- Both `calculateRiskScore` and `calculateBurnoutRisk` derive tiers from identical thresholds.

### 3.4 Rebalancing Engine Invariants
`rebalanceProposals(members, tasks)`:
1. **Phase A (Backlog Assignment)**: Assigns unassigned backlog tasks to underutilized members ($< 50\%$ capacity) with fit $\ge 0.45$ (`type: "assign"`, up to 3 proposals).
2. **Phase B (Donor Relief)**: Moves tasks from overloaded donors ($> 100\%$ capacity) to underutilized receivers ($< 50\%$ capacity). Stops once donor is $\le 100\%$; never drops donor below $50\%$ or pushes receiver above $100\%$.
3. Returns `rejectionReasons` metadata if no valid proposals can be formed.

---

## 4. Machine Learning Architecture (`/ml` & `src/services/mlModel.js`)

### 4.1 Synthetic Data Pipeline (`ml/generate_data.py`)
- Seeded and reproducible (`--seed 42 --n_members 300 --n_tasks 4000`).
- Generates 10,000 assignments with correlated features, realistic tenure/seniority distributions, and 15 features matching the app's schema.
- **Ground Truth Target Functions**:
  - `outcome_quality` ($0–100$): Complex nonlinear formula penalizing over-allocation ($>110\%$) even with perfect skill match, rewarding seniority-complexity alignment, and adding Gaussian noise ($\sigma=2.5$).
  - `on_time` ($0/1$): Logistic probability dependent on deadline ratio, complexity gap, and schedule headroom.
  - `burnout_flag` ($0/1$): Calibrated sigmoid logit on sustained overload streaks, lack of PTO ($<2$ days), concurrent critical tasks, and overtime trends. Calibrated positive rate: **17.98%** (within the $12–20\%$ target).

### 4.2 Model Training & Benchmarking (`ml/train.py`)
- **Leak-Free Partitioning**: Split strictly by `member_id` via `GroupShuffleSplit` (70% Train, 15% Validation, 15% Test). No individual appears in multiple splits.
- **Ensemble Architecture**: Scikit-learn Pipeline with `SimpleImputer(strategy='median')`, `StandardScaler()`, and `GradientBoostingRegressor` / `GradientBoostingClassifier` (`n_estimators=75`, `max_depth=3`, `learning_rate=0.08`).

#### Benchmark Comparison Table (Held-Out Test Set, N = 1,474)
| Model Target | Baseline Metric | Linear Baseline | Candidate (Gradient Boosting) Metric | Comparison / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Outcome Quality** | Heuristic $R^2 = -0.464$ (Spearman $\rho = 0.700$) | Ridge $R^2 = 0.784$, MAE = 10.46 | **$R^2 = 0.798$, MAE = 10.13, RMSE = 12.64** | Tuned model leads Ridge by $+0.014$ $R^2$ pts |
| **On-Time Delivery** | Heuristic ROC-AUC = 0.802 (Spearman $\rho = 0.515$) | Logistic ROC-AUC = 0.848, Acc = 78.2% | **ROC-AUC = 0.845, F1 = 0.815, Acc = 77.7%** | Logistic regression slightly outperforms Gradient Boosting ($-0.003$ AUC) |
| **Burnout Risk** | Heuristic ROC-AUC = 0.763 (Spearman $\rho = 0.378$) | Logistic ROC-AUC = 0.895, PR-AUC = 0.736 | **ROC-AUC = 0.898, PR-AUC = 0.726, F1 = 0.661** | Calibrated threshold = 0.330 (Recall = 66.5%, Precision = 65.6%) |

### 4.3 In-Browser Client Inference (`src/services/mlModel.js`)
- Models are serialized to pure JSON trees and lazy-loaded on demand via dynamic `import()`.
- Model JSON bundle size: 171.1 kB raw (47.9 kB gzip).
- Single tree traversal executes in microseconds; full ensemble evaluation takes median `0.010 ms` (p95 `0.028 ms`).
- Exact floating-point parity verified by automated regression test (`src/services/mlModel.test.js`) across 200 random test vectors ($< 10^{-4}$ tolerance).

---

## 5. UI Integration Points
1. **Tasks View (`/tasks`)**: Displays candidate fit card showing deterministic Fit Score, ML Quality ($0–100$), ML On-Time likelihood, and the `MlVsHeuristicPanel` when divergence $\ge 15\%$.
2. **Burnout Risk View (`/burnout-risk`)**: Renders ML-predicted burnout probability alongside the heuristic tier, displaying contributing risk factors (streak, utilization, PTO gap).
3. **Workload View (`/workload`)**: Shows before/after impact of rebalancing proposals with ML predicted outcome quality.
4. **Insights View (`/insights`)**: Displays dedicated "Model Performance & Verification" section with test $R^2$, ROC-AUC, PR-AUC, confusion matrix, and permutation feature importances.
5. **Reports View (`/reports`)**: Embeds ML telemetry breakdown, includes ML metrics in CSV export, and formats printable executive reports.
6. **About View (`/about`)**: Full architectural disclosure of mathematical formulas, constants, synthetic ML training methodology, and GroupShuffleSplit partitioning.
