# Architecture & Technical Decisions

## Decision 1: Post-Assignment Headroom in Fit Scoring
- **Context**: The heuristic previously scored availability based on the member's current workload before considering the incoming task's size. This allowed nearly full engineers (e.g. 37h on a 40h cap) to score high on availability even when the candidate task demanded 20h.
- **Decision**: Factored `task.estimatedHours` into the availability component of `calculateFitScore`: `availabilityScore = max(0, min(1, 1 - (currentAllocatedHours + taskHours) / capacityHours))`.
- **Consequence**: Engineers without enough remaining capacity to absorb the task cleanly receive an availability score of 0, preventing severe over-allocation.

## Decision 2: 4-Tier Deterministic Tie-Break in `rankCandidates`
- **Context**: In case of identical fit scores, candidate sort order was unstable.
- **Decision**: Implemented strict hierarchical comparator:
  1. Primary: `fitScore` descending
  2. Secondary: `skillOverlap` descending
  3. Tertiary: `availabilityScore` descending
  4. Quaternary: `member.name` alphabetical ascending
- **Consequence**: Produces 100% deterministic, reproducible candidate lists across all runs and platforms.

## Decision 3: In-Browser Client-Side ML Inference
- **Context**: The project is a static frontend web application. Phase 4 requires ML integration without mandating a heavy backend server.
- **Decision**: Models are trained in Python (scikit-learn), evaluated against baselines, and exported as compact JSON tree structures (~135 kB total) for zero-overhead, sub-millisecond client inference in pure JavaScript.

## Decision 4: Leak-Free Synthetic Data Generation & Group Splitting
- **Context**: The application required an ML pipeline demonstrating realistic nonlinear engineering dynamics (skill depth vs workload saturation, multi-week overtime streaks, PTO gaps) rather than re-learning trivial linear formulas.
- **Decision**: `ml/generate_data.py` generates 10,000 assignments with hidden nonlinear interaction terms, Gaussian noise, and calibrated sigmoid probabilities (17.98% burnout rate). Models are partitioned strictly by `member_id` via `GroupShuffleSplit` (70% train / 15% validation / 15% test) to ensure zero data leakage across splits.

## Decision 5: Double-Precision Tree Serialization for Zero Drift
- **Context**: Rounding tree thresholds and leaf values to 5 decimal places produced cumulative floating point error across 75 boosting stages (~0.0037 drift), exceeding the 1e-4 parity tolerance.
- **Decision**: Tree values and split thresholds are serialized as full 64-bit IEEE-754 floats in JSON.
- **Consequence**: Verified exact numerical parity (< 1e-4 difference) between scikit-learn in Python and client-side JavaScript across 200 random held-out test vectors.

## Decision 6: Hybrid Dual-Engine Architecture & Divergence Auditing
- **Context**: Fully replacing the transparent mathematical heuristic with an ML model would introduce opacity into sensitive organizational resource allocations.
- **Decision**: Implemented a dual-scoring model where deterministic formulas provide the baseline and Gradient Boosting ensembles predict delivery likelihood and burnout risk. The `MlVsHeuristicPanel` audits predictions whenever ML and heuristic differ by $\ge 15\%$, surfacing the root causes (e.g. hidden overload streaks or severe skill gaps).

## Decision 7: Versioned Client Storage with Reset Guardrails
- **Context**: Changes to team members and task assignments needed to persist across client navigation without a remote database.
- **Decision**: `TeamContext` synchronizes state to `localStorage` under key `equilibrium_team_state_v1`, with an atomic `resetToDefaults()` action that wipes cached state and cleanly rehydrates pristine seed data from `mockData.js`.
