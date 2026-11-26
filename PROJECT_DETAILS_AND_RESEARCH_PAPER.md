# Equilibrium: Full Project Details and Technical Research Paper

**Generated:** 2026-11-25  
**Repository:** `C:\Users\Sourav Chakraborty\Desktop\TeamFitWorkloadBalancer`  
**Document type:** Project handbook plus project-generated technical research paper  
**Status note:** This document describes the current working tree, including uncommitted changes listed in Section 14.

---

# Part I — Full Project Details

## 1. Executive summary

Equilibrium is a client-side engineering operations portal for fair, transparent, and sustainable task distribution. It combines:

1. A deterministic workload, skill-fit, and burnout-scoring engine.
2. Three in-browser gradient-boosting models for task quality, on-time delivery, and burnout risk.
3. A rule-versus-ML divergence audit.
4. Rebalancing proposals with explicit constraints and rejection reasons.
5. Executive reporting with CSV export and print output.
6. A separate offline real-data benchmark for employee burnout.

The web application does not require a backend. State is persisted in browser `localStorage` under `equilibrium_team_state_v1`. The shipped browser models are trained on controlled synthetic data; the real HR dataset benchmark is offline evidence only and is not used for live scoring.

---

## 2. Repository layout

```text
.
├─ docs/
│  ├─ architecture.md
│  ├─ audit.md
│  └─ decisions.md
├─ e2e/
│  └─ app.spec.js
├─ equilibrium/
│  ├─ README.md                 empty placeholder
│  ├─ backend/README.md         empty placeholder
│  ├─ database/README.md        empty placeholder
│  ├─ docs/README.md            empty placeholder
│  └─ frontend/README.md        empty placeholder
├─ ml/
│  ├─ data/
│  │  ├─ assignments.csv
│  │  ├─ members.csv
│  │  ├─ tasks.csv
│  │  └─ real/                  ignored real datasets and prediction outputs
│  ├─ models/
│  │  ├─ feature_schema.json
│  │  ├─ metrics.json
│  │  ├─ model_burnout.joblib
│  │  ├─ model_burnout.json
│  │  ├─ model_card.md
│  │  ├─ model_ontime.joblib
│  │  ├─ model_ontime.json
│  │  ├─ model_quality.joblib
│  │  ├─ model_quality.json
│  │  ├─ parity_test_cases.json
│  │  └─ real_metrics.json
│  ├─ real/
│  │  ├─ predict_burnout_real.py
│  │  ├─ README.md
│  │  ├─ SOURCES.md
│  │  ├─ train_burnout_real.py
│  │  └─ train_duration_real.py
│  ├─ reports/
│  │  ├─ class_balance.png
│  │  ├─ correlation_matrix.png
│  │  ├─ data_summary.json
│  │  ├─ learning_curve_burnout.png
│  │  └─ learning_curve_quality.png
│  ├─ generate_data.py
│  ├─ requirements.txt
│  ├─ train.py
│  └─ train_real_data.py
├─ src/
│  ├─ components/
│  ├─ context/
│  ├─ models/
│  ├─ pages/
│  ├─ services/
│  ├─ utils/
│  ├─ App.jsx
│  └─ main.jsx
├─ .gitignore
├─ index.html
├─ package.json
├─ playwright.config.js
├─ postcss.config.js
├─ tailwind.config.js
├─ vite.config.js
└─ vitest.config.js
```

`src/models` and `ml/models` contain byte-identical copies of the browser model artifacts, metrics, schema, parity cases, and model card.

---

## 3. Technology stack and commands

### Runtime dependencies

| Package | Declared | Locked | Role |
|---|---:|---:|---|
| `react` | `^19.2.8` | `19.3.0` | UI library |
| `react-dom` | `^19.2.8` | `19.3.0` | DOM renderer |
| `react-router-dom` | `^7.18.4` | `7.18.4` | Client-side routing |
| `recharts` | `^3.10.1` | `3.10.1` | Charts |

### Development dependencies

| Package | Declared | Locked | Role |
|---|---:|---:|---|
| `@axe-core/playwright` | `^4.14.0` | `4.14.0` | Accessibility audits |
| `@playwright/test` | `^1.65.1` | `1.65.1` | E2E browser tests |
| `@tailwindcss/container-queries` | `^0.1.1` | `0.1.1` | Container-query CSS |
| `@tailwindcss/forms` | `^0.5.10` | `0.5.11` | Form styling |
| `@types/react` | `^19.2.18` | `19.3.0` | React type declarations |
| `@types/react-dom` | `^19.2.7` | `19.3.0` | React DOM type declarations |
| `@vitejs/plugin-react` | `^6.1.1` | `6.1.1` | React JSX transform/Fast Refresh |
| `autoprefixer` | `^10.4.20` | `10.6.1` | CSS prefixes |
| `oxlint` | `^1.81.0` | `1.85.0` | Linting |
| `postcss` | `^8.4.49` | `8.5.28` | CSS pipeline |
| `tailwindcss` | `^3.4.17` | `3.4.19` | Utility CSS |
| `vite` | `^8.3.0` | `8.3.1` | Dev server/bundler |
| `vitest` | `^5.1.1` | `5.1.1` | Unit tests |

### Scripts

From `package.json:6-13`:

```bash
npm run dev       # vite
npm run build     # vite build
npm run test      # vitest run
npm run test:e2e  # playwright test
npm run lint      # oxlint
npm run preview   # vite preview
```

Vite dev: `host: true`, port `5173`. Preview: port `4173`. Playwright uses `http://localhost:4173` with `npm run preview -- --port 4173`, so build before E2E if `dist/` may be stale.

Python ML requirements: pandas, numpy, scikit-learn, joblib, matplotlib. `scipy` is imported by `ml/train.py` but is not explicitly listed.

---

## 4. Product features

Documented in `README.md:15-23`:

- **Live Capacity & Workload Balancer** at `/workload`: contracted versus allocated hours and rebalancing proposals.
- **Multi-Attribute Task Fit** at `/tasks`: 1–5 skill overlap depth, post-assignment headroom, deterministic four-tier tie-breaking.
- **Burnout Risk Fatigue Radar** at `/burnout-risk`: active overage, multi-week overload streaks, overtime velocity, PTO recovery proxies.
- **In-browser ML ensembles** at `/insights`: quality regressor, on-time classifier, burnout classifier.
- **Divergence auditing**: flags rule-versus-ML disagreement at `|Δ| ≥ 15%`.
- **Executive reports** at `/reports`: filterable CSV export and printer-friendly summary.
- **Persistent state**: versioned `localStorage` key with reset controls.

---

## 5. Routes and frontend architecture

### Routes

Defined in `src/App.jsx:88-182`:

| Route | Page |
|---|---|
| `/` | Landing |
| `/login` | Login |
| `/dashboard` | Dashboard |
| `/workload` | WorkloadView |
| `/workload-view` | Redirect to `/workload` |
| `/tasks` | Tasks |
| `/team-members` | TeamMembers |
| `/skill-matrix` | SkillMatrix |
| `/burnout-risk` | BurnoutRisk |
| `/insights` | Insights |
| `/reports` | Reports |
| `/about` | About |
| `*` | NotFound |

Application routes use `AppLayout` (`src/App.jsx:32-68`) with `Sidebar`, `Topbar`, route titles, and lazy `Suspense`.

### Shared components

| File | Role |
|---|---|
| `src/components/Sidebar.jsx` | Navigation, high-risk badge, AI reasoning modal |
| `src/components/Topbar.jsx` | Title, live search dropdown, notifications, help modal |
| `src/components/Modal.jsx` | Accessible portal dialog with focus trap, escape/outside dismiss |
| `src/components/ui.jsx` | `Icon`, `Card`, `KpiCard`, `Chip`, `UtilizationBar`, `Avatar`, `SkillTag` |
| `src/components/InsightsPanel.jsx` | Assignment explanations and suggestions |
| `src/components/MlVsHeuristicPanel.jsx` | Rule-versus-ML divergence audit |
| `src/components/RealDataBenchmarksSection.jsx` | Public benchmark disclosure |

### Pages

| File | Purpose |
|---|---|
| `src/pages/Dashboard.jsx` | Operations overview, KPIs, Team Workload table, task assignments, recommendations, exports |
| `src/pages/WorkloadView.jsx` | Capacity view, utilization, trend, transfer candidates, Auto-Balance |
| `src/pages/Tasks.jsx` | Task CRUD, filtering, candidate ranking, assignment, ML divergence |
| `src/pages/TeamMembers.jsx` | Member directory, profiles, capacity, skills, recommendations |
| `src/pages/SkillMatrix.jsx` | Skill heatmap, gaps, SPOF and untapped-skill insights |
| `src/pages/BurnoutRisk.jsx` | Risk ranking, gauge, drivers, fatigue radar, action cards |
| `src/pages/Insights.jsx` | Trends, AI analysis, recommendations, ML/real benchmark disclosure |
| `src/pages/Reports.jsx` | Executive report, fit audit, CSV/print actions |
| `src/pages/About.jsx` | Formulas, constants, ML and dataset disclosure |
| `src/pages/Landing.jsx` | Marketing, signup/search dialogs, simulator, FAQ |
| `src/pages/Login.jsx` | Demo authentication UI and provider buttons |

### Dashboard risk table

`src/pages/Dashboard.jsx:221-296` implements the current manager-facing table with columns **Member / Rule risk / ML risk / Load**. Rule and ML chips are shown side by side at `:259-272`; utilization bar/percent at `:273-285`; async ML risk map built at `:27-42`. The landing page was intentionally not changed.

---

## 6. State model

`src/context/TeamContext.jsx` stores `members` and `tasks`.

- Storage key: `equilibrium_team_state_v1` (`:4`).
- Hydration: `:11-39`.
- Persistence: `:41-47`.
- Exposed mutators (`:133-148`):
  - `addMember`, `updateMember`
  - `addTask`, `updateTask`
  - `assignTask`, `reassignTask`, `unassignTask`
  - `applyRebalanceProposal`, `applyAllProposals`
  - `resetToDefaults`
- `assignTask` moves `estimatedHours` between old and new owners (`:59-94`).
- E2E hooks at `:126-131`:
  - `window.__resetEquilibriumDefaults`
  - `window.__applyAllProposals`

`resetToDefaults()` removes the localStorage key, but the persistence effect writes fresh defaults back after state changes.

Mock data: 10 members (`src/services/mockData.js:9`) and 18 tasks (`:232`), with 8 skills across Technical, Soft Skills, and Domain groups (`:1-7`).

---

## 7. Deterministic scoring engine

All formulas are in `src/utils/scoring.js`.

### Constants (`:1-16`)

```text
SKILL_WEIGHT = 0.6
AVAILABILITY_WEIGHT = 0.4
OVERLOADED_THRESHOLD = 1.0
UNDERUTILIZED_THRESHOLD = 0.5
BURNOUT_HIGH_OVERAGE = 0.3
RISK_OVERAGE_MULTIPLIER = 180
RISK_STREAK_MULTIPLIER = 12
RISK_HIGH_TIER_SCORE = 60
RISK_MEDIUM_TIER_SCORE = 30
MIN_PROPOSAL_FIT = 0.45
STREAK_LOAD_PCT = 100
```

### Fit score (`:24-55`)

```text
skillOverlap = sum(member proficiency for required skills) / (5 × number of required skills)
availability = clamp(1 - (allocatedHours + taskHours) / capacityHours, 0, 1)
fitScore = clamp(0.6 × skillOverlap + 0.4 × availability, 0, 1)
```

Tasks with no required skills get `skillOverlap = 1`. Zero capacity produces zero availability.

### Utilization and risk (`:57-92`)

```text
utilization = allocatedHours / capacityHours
overage = max(0, utilization - 1)
streakWeeks = count(weeklyLoad > 100)
riskScore = clamp(round(180 × overage + 12 × streakWeeks), 0, 100)
tier = High if >= 60, Medium if >= 30, else Low
```

Utilization is intentionally uncapped, so `48/40 = 120%` and `54/40 = 135%` appear in the demo data.

### Ranking and coverage

- `rankCandidates` (`:99-117`) sorts by fit, skillOverlap, availability, then member name.
- `skillCoverage` (`:119-139`) computes best proficiency, expert count, single-point-of-failure, and untapped status.
- `teamMetrics` (`:141-186`) computes team capacity, allocation, utilization, risk counts, average fit, and health score.

### Rebalancing (`:189-308`)

Two phases:

1. Assign unassigned tasks to members under `50%` utilization with fit `≥ 0.45`, up to 3 proposals.
2. Transfer tasks from overloaded donors (`>100%`) to underutilized receivers (`<50%`), stopping donors at `≤100%`, never pushing donors below `50%`, never overloading receivers.

Every proposal contains task, donor/receiver, fit score, hours, and type; rejected cases are recorded in `rejectionReasons`.

---

## 8. In-browser ML architecture

`src/services/mlModel.js` dynamically imports three JSON models plus metrics/schema (`:12-38`):

```text
src/models/model_quality.json
src/models/model_ontime.json
src/models/model_burnout.json
src/models/metrics.json
src/models/feature_schema.json
```

Key exports:

| Function | Line | Role |
|---|---:|---|
| `loadModels` | `:12` | Lazy-load model bundle |
| `predictTree` | `:69` | Traverse one serialized tree |
| `predictEnsemble` | `:86` | Impute, scale, ensemble predict |
| `scoreCandidateML` | `:131` | Async task quality/on-time prediction |
| `predictMemberBurnoutML` | `:177` | Async member burnout prediction |
| `predictTaskFit` | `:246` | Sync task prediction from cache |
| `predictBurnout` | `:297` | Sync burnout prediction from cache |
| `getMLMetrics` | `:367` | Load benchmark metrics |

Burnout threshold comes from the model’s `optimal_threshold`, falling back to `0.33` (`:192`, `:201`, `:316`, `:325`). If model loading fails, predictors return heuristic fallbacks with an explicit disclaimer (`:148`, `:195`, `:268`, `:319`).

`src/utils/featureBuilder.js:69-149` builds the exact 15-feature vector used during training:

```text
skill_match_score
skill_gap_max
skill_coverage_ratio
current_utilization
projected_utilization_after_assign
task_hours_to_headroom_ratio
hours_to_deadline_ratio
seniority_vs_complexity
overtime_trend
overload_streak_weeks
recent_pto_days
tenure_months
task_priority
collaboration_needed
concurrent_task_count
```

Role seniority, priority, deadline, and overtime trend are inferred at `:6-67`. `tenure_months` is a fixed demo baseline of `24` (`:122`), and `recent_pto_days` is `5` when presence is `ooo`, otherwise `2`.

---

## 9. Synthetic ML pipeline

### Data generation

`ml/generate_data.py` creates:

| File | Profile |
|---|---|
| `ml/data/members.csv` | 300 members × 18 columns; 0 missing |
| `ml/data/tasks.csv` | 4,000 tasks × 7 columns; 0 missing |
| `ml/data/assignments.csv` | 10,000 assignments × 20 columns; 610 missing cells intentionally injected |

Assignment targets:

- `outcome_quality`: 0–100, mean `65.56`.
- `on_time`: 6,050 positive / 3,950 negative.
- `burnout_flag`: 1,816 positive / 8,184 negative (`18.16%`).

Noise for outcome quality is Gaussian with `σ = 13.5` (`ml/generate_data.py:308`).

### Training

`ml/train.py` uses:

- GroupShuffleSplit by `member_id`.
- Saved split: 7,013 train / 1,513 validation / 1,474 test.
- Median imputation and standard scaling fit on training data only.
- GroupKFold(4) RandomizedSearchCV.
- Burnout threshold tuned on validation over `np.linspace(0.20, 0.70, 51)`; exported value `0.32999999999999996`.

Exported models:

| Model | Type | Hyperparameters |
|---|---|---|
| Quality | `GradientBoostingRegressor` | 75 trees, depth 3, LR `0.08`, `min_samples_split=5` |
| On-time | `GradientBoostingClassifier` | 80 trees, depth 3, LR `0.08` |
| Burnout | `GradientBoostingClassifier` | 75 trees, depth 3, LR `0.08`, `min_samples_leaf=15`, threshold `0.33` |

Parity artifact: `ml/models/parity_test_cases.json` contains 200 rows with 15 features each.

### Synthetic held-out results

| Task | Model | Metrics |
|---|---|---|
| Quality | Ridge | R² `0.7843`, MAE `10.4621` |
| Quality | GBDT | R² `0.7977`, MAE `10.1338` |
| Quality | Heuristic | Spearman `0.7003`, MAE `28.5198` |
| On-time | Logistic | ROC-AUC `0.8477`, Acc `0.7822`, F1 `0.8208` |
| On-time | GBDT | ROC-AUC `0.8448`, Acc `0.7768`, F1 `0.8151` |
| Burnout | Logistic | ROC-AUC `0.8953`, PR-AUC `0.7359`, F1 `0.6099` |
| Burnout | GBDT | ROC-AUC `0.8983`, PR-AUC `0.7264`, Acc `0.8752`, Precision `0.6557`, Recall `0.6654`, F1 `0.6605` |

GBDT only improves quality by `+0.014` R² and burnout by `+0.003` ROC-AUC over linear baselines; logistic beats GBDT on on-time ROC-AUC by `0.003`.

---

## 10. Real-data benchmark

### Dataset and methodology

`ml/real/train_burnout_real.py` uses the HackerEarth/Paras Varshney employee-burnout dataset. The local combined file `ml/data/real/employee_burnout.csv` contains:

- 22,750 rows, 22,750 unique employee IDs.
- 21,626 labeled `Burn Rate` rows.
- Missing: `Resource Allocation` 1,381, `Mental Fatigue Score` 2,117, `Burn Rate` 1,124.
- High burnout label: `Burn Rate ≥ 0.60`.
- Train/test split: 17,300 / 4,326, stratified 80/20, `random_state=42`.

Operational features exclude subjective mental fatigue:

```text
Resource Allocation
Designation
tenure_days
WFH Setup Available
Company Type
```

Preprocessing: numeric median imputation/scaling; categorical most-frequent imputation and one-hot encoding with `drop="first"`, `handle_unknown="ignore"`.

Hyperparameter search: 5-fold RandomizedSearchCV, `n_iter=25`.

On Windows, multiprocessing must be disabled:

```powershell
$env:JOBLIB_MULTIPROCESSING=0; python ml/real/train_burnout_real.py
```

### Main results

Regression:

| Model | R² | MAE |
|---|---:|---:|
| Mean dummy | `-0.0001` | `0.1595` |
| Ridge | `0.7135` | `0.0852` |
| HistGradientBoosting | `0.7434` | `0.0806` |

Classification:

| Model | ROC-AUC | PR-AUC | Accuracy | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Majority | `0.5000` | `0.2383` | `0.7617` | — | — | `0.0000` |
| Logistic | `0.9132` | `0.7863` | `0.8250` | `0.5984` | `0.8080` | `0.6876` |
| HistGB | `0.9198` | `0.8003` | `0.8669` | `0.7636` | `0.6392` | `0.6959` |

`gap_gbdt_vs_linear_r2 = 0.0299`; `gap_gbdt_vs_logistic_auc = 0.0066`.

### Mental-fatigue ablation

Adding `Mental Fatigue Score` produces:

| Metric | Value |
|---|---:|
| Regression R² | `0.9100` |
| Regression MAE | `0.0471` |
| Classification ROC-AUC | `0.9692` |
| Classification PR-AUC | `0.9178` |
| Accuracy | `0.9103` |
| F1 | `0.8032` |
| R² lift | `0.1666` |
| ROC-AUC lift | `0.0494` |

Caveat: main models are tuned; ablation models use default HistGradientBoosting settings except `random_state=42`, so the comparison is not fully like-for-like. Mental fatigue is excluded from the operational feature set because it is subjective and not available in the live team telemetry.

### Prediction script

`ml/real/predict_burnout_real.py`:

- Requires `--test-path`.
- Refits tuned operational preprocessor/models on all labeled rows.
- Predicts clipped `Burn Rate` in `[0,1]`.
- Computes `high_burnout_probability`.
- Produces hard class at probability `≥ 0.5`.
- Writes:
  - `ml/data/real/burnout_test_predictions.csv`
  - `ml/data/real/burnout_test_submission.csv`

The supplied `test.csv` had no `Burn Rate`, so accuracy cannot be computed. Current outputs: 12,250 scored rows, mean predicted Burn Rate `0.4499`, 2,332 high-burnout predictions (`19.04%`).

Important distinction: `0.60` defines the training label; `0.50` is the classifier decision threshold.

### Other real-data scripts

- `ml/real/train_duration_real.py`: Apache Jira resolution-time benchmark; dataset and results absent.
- `ml/train_real_data.py`: IBM HR Attrition benchmark; dataset and results absent.

---

## 11. Verification and tests

### Unit/component tests

| File | Cases | Coverage |
|---|---:|---|
| `src/utils/scoring.test.js` | 21 | Constants, fit, utilization, risk, ranking, skill coverage, team metrics, rebalance invariants |
| `src/context/TeamContext.test.js` | 5 | Seed integrity, ID uniqueness, allocated-hour conservation, reset data |
| `src/services/mlModel.test.js` | 6 | 200-row Python/JS parity plus load-failure fallback |
| `src/components/RealDataBenchmarksSection.test.jsx` | 2 | Benchmark not-run and populated rendering |

Total unit/component: **37 cases**.

### E2E tests

`e2e/app.spec.js` contains 55 cases:

- 33 responsive console/overflow checks: 11 routes × 3 viewports.
- 11 desktop axe accessibility audits.
- 404 route handling.
- Empty-state resilience.
- Reports CSV export and print.
- Rebalance/reset via debug hooks.
- Modal focus trap and escape dismissal.
- 5 interactive-control tests at `e2e/app.spec.js:272-326`:
  1. Topbar search navigates to a matching member.
  2. Skill-matrix recommendation selects the suggested member.
  3. Burnout recommendation cards navigate to `/workload` and `/insights`.
  4. Login notice and remember-me toggle respond.
  5. Task-row Assign acts on that row, not the selected task.

### Latest verified commands

```text
npm run test       -> 37/37 passed
npx playwright test -> 55/55 passed
npm run lint       -> 4 pre-existing warnings only
npm run build      -> passed
```

Coverage gaps:

- Most pages/components have no unit tests.
- `TeamContext` is not tested through a mounted provider.
- `featureBuilder.js` has no direct tests.
- Axe audits run desktop-only.
- E2E depends on a prebuilt `dist`.

---

## 12. Documentation map

| File | Role |
|---|---|
| `README.md` | Positioning, features, architecture, commands, metrics, limitations |
| `docs/architecture.md` | Formulas, ML pipeline, bundle/latency claims, UI integration |
| `docs/audit.md` | Nine earlier defects and fixes |
| `docs/decisions.md` | Seven architecture decisions |
| `ml/models/model_card.md`, `src/models/model_card.md` | Curated synthetic/real model card |
| `ml/real/README.md` | Real-data commands, dataset acquisition, results, prediction |
| `ml/real/SOURCES.md` | Dataset provenance and compliance |
| `equilibrium/**/README.md` | Empty placeholders |

Known stale or inconsistent documentation:

1. README badges use declared versions, not locked versions.
2. README says Node 18+, but Vite 8 requires `^20.19.0 || >=22.12.0`.
3. README says burnout threshold `P≥0.35`; code/model uses `0.33`.
4. `docs/architecture.md` says noise `σ=2.5`; generator uses `13.5`.
5. Architecture says positive rate `17.98%`; data/model cards say `18.16%`.
6. `ml/train.py` regenerates a less accurate model-card template.
7. Latency numbers have no reproducible benchmark script.
8. README declares MIT without a `LICENSE` file.
9. README Quick Start omits `npm run test:e2e`.
10. “11 application routes” counts page components, not actual core app routes.

---

## 13. Current interaction fixes

Recent work completed:

- Recommendation cards in `SkillMatrix.jsx` and `BurnoutRisk.jsx` now perform selection/navigation.
- `Forgot password?` now shows a demo notice instead of `href="#"`.
- Remember-me checkbox is bound to state and passed into navigation state.
- Per-row task Assign now assigns that row’s task, not the selected task.
- Topbar search now returns and navigates to member/task matches.
- Clickable rows in Tasks, TeamMembers, SkillMatrix, and BurnoutRisk are keyboard-operable.
- Dashboard Team Workload table shows rule and ML risk side by side.
- Landing page diff is empty.

---

## 14. Current working-tree state

No commit has been made. Current `git status --short` shows:

```text
 M README.md
 M e2e/app.spec.js
 M ml/models/model_card.md
 M ml/models/real_metrics.json
 M ml/real/README.md
 M ml/real/train_burnout_real.py
 M src/components/RealDataBenchmarksSection.jsx
 M src/components/RealDataBenchmarksSection.test.jsx
 M src/components/Topbar.jsx
 M src/models/model_card.md
 M src/models/real_metrics.json
 M src/pages/BurnoutRisk.jsx
 M src/pages/Dashboard.jsx
 M src/pages/Login.jsx
 M src/pages/SkillMatrix.jsx
 M src/pages/Tasks.jsx
 M src/pages/TeamMembers.jsx
?? ml/real/predict_burnout_real.py
```

Diff summary: about **680 insertions and 96 deletions** across 17 tracked files, plus the new untracked prediction script.

---

# Part II — Technical Research Paper

## Title

**Equilibrium: A Hybrid Deterministic and In-Browser Machine Learning System for Team Fit, Workload Balancing, and Burnout Risk Intelligence**

## Authors

TeamFitWorkloadBalancer project contributors.

## Abstract

Engineering managers must allocate limited engineering capacity across tasks while considering skill fit, delivery risk, and employee fatigue. We present Equilibrium, a client-side decision-support system that combines deterministic workload scoring with three lazily loaded in-browser gradient-boosting models. The deterministic engine computes skill overlap, post-assignment headroom, utilization, burnout tier, candidate ranking, and constraint-aware rebalancing proposals. The machine learning layer predicts task quality, on-time delivery, and elevated burnout risk from a 15-feature telemetry vector. Models are trained on a controlled synthetic dataset of 10,000 assignments and exported as dependency-free JSON trees for browser inference. A separate real-data benchmark on 22,750 employee records evaluates operational features that exclude subjective mental fatigue. The best real-data classifier achieved ROC-AUC `0.9198`, accuracy `86.69%`, precision `0.7636`, recall `0.6392`, and F1 `0.6959`; the corresponding regressor achieved R² `0.7434` and MAE `0.0806`. Adding mental fatigue improved R² to `0.9100` and ROC-AUC to `0.9692`, but the ablation was not hyperparameter-matched and the feature is unsuitable for the live demo telemetry. The system ships with 37 unit/component tests and 55 end-to-end tests, including accessibility and interaction coverage. We conclude that hybrid rule-plus-ML decision support is practical in a zero-backend web application, while emphasizing that synthetic-trained models require real organizational telemetry before production use.

**Keywords:** workload balancing, burnout prediction, gradient boosting, in-browser inference, decision support, software engineering management, human-centered AI.

---

## 1. Introduction

Task assignment is a recurring managerial problem with competing objectives: maximize skill fit, avoid overloading individuals, distribute organizational friction fairly, and protect long-term team health. Simple capacity rules are transparent but may miss nonlinear interactions among deadlines, seniority, task complexity, overtime trends, and concurrent work. Machine learning can capture such patterns but may be opaque, expensive to serve, or trained on data that does not match the deployment context.

Equilibrium addresses this tension with a hybrid architecture. A deterministic scoring engine provides explainable recommendations and guardrails. Three in-browser models provide a second, independent signal. The interface shows both signals side by side rather than replacing human judgment.

The project has three contributions:

1. A transparent scoring and rebalancing engine with deterministic tie-breaking and explicit constraints.
2. A zero-backend browser inference design using serialized GBDT JSON models.
3. An empirical evaluation on both synthetic engineering telemetry and a public employee-burnout dataset.

---

## 2. System architecture

The application is a React 19 single-page app built with Vite. Routes are lazy-loaded, state is held in `TeamProvider`, and data persists in `localStorage`. The UI consists of eleven page components plus shared navigation, modal, chart, and analytics components.

The scoring engine is implemented in `src/utils/scoring.js`. It exposes pure functions for fit, utilization, risk, ranking, coverage, team metrics, and rebalancing. This design allows direct unit testing and deterministic reproducibility.

The ML service in `src/services/mlModel.js` dynamically imports model JSON and implements tree traversal in JavaScript. Dynamic import keeps the main entry bundle near 44 kB; model artifacts form a separate chunk of about 155 kB raw and 51 kB gzip. If loading fails, the service falls back to deterministic heuristics and labels the result.

The browser models are trained on synthetic data. The real-data benchmark is kept offline and documented separately; it does not validate the shipped synthetic models.

---

## 3. Methods

### 3.1 Deterministic fit and workload scoring

Let `P_i(s)` be member `i`’s proficiency in required skill `s`, and let `S` be the required-skill set. Skill overlap is:

```text
SkillOverlap(i, t) = Σ P_i(s) / (5 × |S|)
```

For `|S| = 0`, overlap is defined as `1`. Let `A_i` be current allocated hours, `h_t` task hours, and `C_i` capacity. Post-assignment availability is:

```text
Availability(i, t) = clamp(1 - (A_i + h_t) / C_i, 0, 1)
FitScore(i, t) = clamp(0.6 × SkillOverlap + 0.4 × Availability, 0, 1)
```

Utilization is `U_i = A_i / C_i`. Burnout risk is:

```text
Overage_i = max(0, U_i - 1)
Streak_i = count(weeklyLoad_week > 100)
RiskScore_i = clamp(round(180 × Overage_i + 12 × Streak_i), 0, 100)
```

Tiers are Low `<30`, Medium `30–59`, High `≥60`.

Candidates are ranked by fit score, skill overlap, availability, and finally name, ensuring deterministic output.

### 3.2 Rebalancing

The rebalancing algorithm operates in two phases:

1. Assign up to three unassigned tasks to members below `50%` utilization where fit is at least `0.45` and the receiver remains at or below `100%`.
2. Transfer tasks from donors above `100%` to receivers below `50%`, stopping once the donor reaches `100%`, never dropping a donor below `50%`, and never overloading a receiver.

Rules are recorded as `rejectionReasons` when no valid proposal exists.

### 3.3 Feature engineering

The ML feature vector contains 15 engineered signals:

- Skill: match score, maximum gap, coverage ratio.
- Capacity: current utilization, projected utilization, task-hours/headroom ratio.
- Deadline: hours-to-deadline ratio.
- Complexity: seniority minus inferred task complexity.
- Fatigue: overtime trend, overload streak weeks, recent PTO proxy.
- Context: tenure, task priority, collaboration need, concurrent task count.

Role seniority is inferred from role text (`junior=1`, `mid=2`, `senior=4`, `staff/lead/principal=5`, default `3`). Priority is inferred as low/medium/high/critical mapped to `1–4`. Overtime trend is the ordinary least-squares slope over five weekly load values.

### 3.4 Synthetic data and training

The synthetic generator creates 300 members, 4,000 tasks, and 10,000 assignments with seed 42. Outcome quality includes deliberate noise `σ=13.5`; on-time and burnout labels are generated from logistic/sigmoid functions of workload and fatigue signals.

Training uses member-disjoint GroupShuffleSplit and GroupKFold(4) to reduce identity leakage. Imputation and scaling are fit on training data only. Three gradient-boosting models are tuned with randomized search and exported as JSON tree ensembles plus medians, scaler statistics, feature names, and thresholds.

Burnout threshold is tuned on validation only and exported as `0.32999999999999996`.

### 3.5 Real-data benchmark

The employee-burnout benchmark uses 22,750 records with 21,626 labeled Burn Rate values. The operational feature set excludes mental fatigue and uses resource allocation, designation, tenure, WFH availability, and company type. Missing targets are dropped; missing features are imputed from training folds only.

Models compared:

- Mean/majority dummy baselines.
- Ridge/logistic regression.
- HistGradientBoosting regressor/classifier.
- Ablation models that add mental fatigue.

Classification precision, recall, and F1 are computed at probability threshold `0.5`; the `0.60` value defines the label, not the decision rule.

### 3.6 Evaluation and reliability

Unit tests cover scoring invariants, state data integrity, model parity, and benchmark rendering. Browser parity is checked against 200 Python-generated cases with tolerance `1e-4`. End-to-end tests cover responsive layout, console errors, overflow, accessibility with axe-core, reports, empty states, modal behavior, rebalance/reset hooks, and the interactive controls added during development.

---

## 4. Results

### 4.1 Synthetic benchmark

Quality prediction improved from Ridge R² `0.7843` to GBDT R² `0.7977`, an increase of `0.0134`. On-time logistic regression achieved ROC-AUC `0.8477`, slightly above GBDT `0.8448`. Burnout GBDT achieved ROC-AUC `0.8983` and F1 `0.6605`, while logistic achieved ROC-AUC `0.8953` and PR-AUC `0.7359`, higher than GBDT PR-AUC `0.7264`.

These results indicate that the synthetic task is largely learnable by linear models. The value of gradient boosting is integration consistency and acceptable latency rather than a large accuracy gain.

### 4.2 Real-data benchmark

For Burn Rate regression, HistGradientBoosting achieved R² `0.7434` and MAE `0.0806`, compared with Ridge R² `0.7135` and MAE `0.0852`.

For high-burnout classification, HistGradientBoosting achieved ROC-AUC `0.9198`, PR-AUC `0.8003`, accuracy `86.69%`, precision `0.7636`, recall `0.6392`, and F1 `0.6959`. Logistic regression had lower ROC-AUC (`0.9132`) and accuracy (`82.50%`) but much higher recall (`80.80%`).

The choice between models therefore depends on operating policy: HistGB maximizes overall discrimination and accuracy, while logistic is preferable when catching more at-risk employees is prioritized over precision.

### 4.3 Mental-fatigue ablation

Adding mental fatigue increased regression R² from `0.7434` to `0.9100` and classification ROC-AUC from `0.9198` to `0.9692`. However, the ablation models were untuned defaults while the main models were tuned, so the reported lift may overstate the feature’s standalone contribution. Additionally, mental fatigue is subjective and unavailable in the live demo, so it is excluded from operational scoring.

### 4.4 Prediction outputs

The unlabeled 12,250-row test file was scored by refitting the tuned operational models on all labeled rows. Mean predicted Burn Rate was `0.4499`; 2,332 employees (`19.04%`) were predicted as high burnout. No accuracy can be reported because the test file contains no labels.

### 4.5 Engineering verification

The current working tree passes 37 unit/component tests and 55 Playwright tests. Lint reports only four pre-existing warnings. The production build succeeds. Accessibility audits pass on all 11 routes at desktop width, and the newly added interaction tests verify that key controls perform real actions.

---

## 5. Discussion

### 5.1 Hybrid decision support

The deterministic engine provides auditability: every fit score, utilization value, risk tier, and rebalancing proposal is explainable from explicit formulas. The ML layer adds an independent estimate that can reveal disagreement. Showing rule and ML risk side by side avoids presenting a single opaque score as ground truth.

### 5.2 Generalization limits

The shipped browser models are trained on synthetic labels generated from known formulas. They demonstrate an engineering pattern, not validated real-world predictive performance. The real burnout benchmark uses different features and is not wired into live scoring. Production deployment would require real organizational telemetry: PR cycle time, review iterations, rollback history, story-point estimates, on-call load, overtime, and PTO balances.

### 5.3 Fairness and human factors

Burnout prediction can affect employee workload and perceived fairness. The system should be used as decision support, not as an automated personnel action. High-risk flags should be reviewed by humans, with employees able to contest or contextualize signals. The current demo uses proxies such as `recentPtoDays = 5` when presence is `ooo`; these are not clinically meaningful and should not be interpreted as health assessments.

### 5.4 Threats to validity

Threats include:

- Synthetic labels may encourage the model to relearn the generator.
- Grouped splitting reduces but does not eliminate deployment drift.
- The ablation comparison is not hyperparameter-matched.
- Real-data label `Burn Rate ≥ 0.60` may not match organizational definitions of burnout.
- Recall is only `63.92%` for theHistGB classifier, so many high-burnout cases would be missed.
- Latency numbers in documentation lack reproducible benchmark scripts.
- Several documentation values are stale relative to code.

### 5.5 Security and privacy

The application is entirely client-side and stores demo data in browser `localStorage`. No telemetry is sent to a server. Real employee data should not be entered into the demo without appropriate consent, access controls, and retention policies. Raw real datasets are ignored by Git, and only aggregate metrics are committed.

---

## 6. Conclusion

Equilibrium demonstrates that a zero-backend web application can combine deterministic scoring, constraint-aware rebalancing, and in-browser machine learning in a usable manager-facing portal. The deterministic engine is fully explainable; the ML layer is fast and gracefully degrades; the real-data benchmark provides credible offline evidence but also shows that linear and boosted models are often close.

The strongest practical lesson is architectural: keep rules transparent, keep models inspectable, expose disagreement, and avoid treating either signal as ground truth. Before real deployment, the system requires real telemetry, calibrated thresholds, matched ablations, fairness review, and reproducible latency benchmarks.

---

## 7. Future work

1. Replace synthetic browser models with calibrated models trained on consented organizational telemetry.
2. Evaluate precision-recall trade-offs against an explicit managerial policy, especially recall for high-risk employees.
3. Add fairness audits across role, seniority, tenure, and protected-group attributes where legally and ethically appropriate.
4. Add reproducible browser inference latency benchmarks to the repository.
5. Make mental-fatigue ablation hyperparameter-matched and test alternative subjective-feature handling.
6. Add mounted-provider tests for `TeamContext`, direct tests for `featureBuilder.js`, and mobile axe audits.
7. Add a build-before-e2e script so Playwright never tests a stale `dist`.
8. Reconcile stale documentation values and add a `LICENSE` file if MIT is intended.

---

## References

1. Repository root: `C:\Users\Sourav Chakraborty\Desktop\TeamFitWorkloadBalancer`.
2. `README.md`, lines 9–146.
3. `docs/architecture.md`, lines 4–110.
4. `docs/audit.md`, lines 3–44.
5. `docs/decisions.md`, lines 3–36.
6. `src/App.jsx`, lines 32–182.
7. `src/context/TeamContext.jsx`, lines 1–157.
8. `src/utils/scoring.js`, lines 1–308.
9. `src/utils/featureBuilder.js`, lines 1–149.
10. `src/services/mlModel.js`, lines 1–367.
11. `src/pages/Dashboard.jsx`, lines 221–296.
12. `ml/generate_data.py`, lines 1–470.
13. `ml/train.py`, lines 1–569.
14. `ml/models/metrics.json`.
15. `ml/models/model_card.md`.
16. `ml/real/train_burnout_real.py`, lines 1–405.
17. `ml/real/predict_burnout_real.py`, lines 1–115.
18. `ml/models/real_metrics.json`.
19. `ml/real/README.md`.
20. `ml/real/SOURCES.md`.
21. HackerEarth employee-burnout dataset: `https://www.kaggle.com/datasets/parasvarshney/employee-burnout-dataset`.
22. `e2e/app.spec.js`, lines 1–327.
23. `package.json`, lines 1–35.
24. `playwright.config.js`, lines 1–29.
25. `tailwind.config.js`, lines 1–142.
