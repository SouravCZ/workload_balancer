# Phase 1: Targeted Audit of the Numbers & Telemetry

## 1. Failing Sanity Check Script Analysis (Step 1a)

### Root Cause Analysis
During an earlier automated turn, an inline Node.js verification script executed:
```js
node -e "
import('./src/services/mockData.js').then(data => {
  return import('./src/utils/scoring.js').then(scoring => {
    const { initialMembers, initialTasks } = data;
    const { teamMetrics } = scoring;
    teamMetrics(initialMembers, initialTasks);
  });
})
"
```
**Failure Output**:
`TypeError: Cannot read properties of undefined (reading 'reduce') at teamMetrics (scoring.js:101:33)`

**Determination**:
1. **Script Bug**: The test script attempted to destructure `initialMembers` and `initialTasks` from `mockData.js`. The actual exported identifiers in `mockData.js` are `mockMembers` and `mockTasks`.
2. **Real Scoring Engine Defect**: In `src/utils/scoring.js`, `teamMetrics(members, tasks)` lacked safe parameter defaults (`members = [], tasks = []`) and direct null/undefined checks, causing `members.reduce` to immediately throw an unhandled exception whenever invoked with missing arguments or empty sets.

**Fix**:
In `src/utils/scoring.js`, added safe defensive defaults and null-guards:
`const safeMembers = members ?? []; const safeTasks = tasks ?? [];`
Covered by: `src/utils/scoring.test.js` -> `teamMetrics > handles null or undefined inputs without throwing`.

---

## 2. Defects Verified & Fixed (Steps 1b, 1c, 1d, 1e)

| # | File | Problem | Fix | Covering Unit Test |
| :--- | :--- | :--- | :--- | :--- |
| **D1** | `src/utils/scoring.js` | **Fit ignores task size**: Availability was calculated using prior headroom (`1 - currentAllocated / capacity`). A member with 3h remaining could rank #1 for a 20h task and be overloaded to 142.5%. | Factored in `task.estimatedHours` so availability represents remaining headroom after assignment: `1 - (currentAllocated + taskHours) / capacity`, clamped to `[0, 1]`. | `calculateFitScore > factors in task size: member with 3 free hours cannot rank well for a 20h task` |
| **D2** | `src/utils/scoring.js` | **Negative headroom & unclamped fit**: When member utilization was > 100%, availability could go negative without explicit bounds, distorting overall fit. | Clamped availability score to `[0, 1]` and final `fitScore` to `[0, 1]`. | `calculateFitScore > clamps negative headroom to 0 when member is already overloaded` |
| **D3** | `src/utils/scoring.js` | **Division by zero & unhandled empty skills**: Tasks with no required skills or members with 0 capacity caused division by zero or NaN. | Added explicit guards: `reqSkills.length === 0` defaults to 1.0 skill match; zero capacity defaults availability to 0.0 with no NaN. | `calculateFitScore > handles tasks with no required skills gracefully` and `handles zero or missing capacity without NaN` |
| **D4** | `src/utils/scoring.js` | **Non-deterministic candidate ranking**: `rankCandidates` sorted solely by `fitScore`. Ties had undefined sorting order across JS engines. | Implemented 4-tier deterministic tie-break: `fitScore` &rarr; `skillOverlap` &rarr; `availabilityScore` &rarr; `member.name.localeCompare()`. | `rankCandidates > provides deterministic tie-break` |
| **D5** | `src/utils/scoring.js` | **Burnout score & risk tier synchronization**: Risk calculation needed verification that both score (0–100) and tiers agreed consistently across functions. | Unified `calculateBurnoutRisk` and `calculateRiskScore` to derive directly from identical formula and streak cutoffs (`STREAK_LOAD_PCT`). | `calculateBurnoutRisk and calculateRiskScore agreement > agree on score, tier, and streakWeeks for all mockMembers` |
| **D6** | `src/utils/scoring.js` | **Rebalance invariants & graceful rejection**: When no underutilized receivers were available, proposal generation needed explicit rejection metadata and strict capacity bounds. | Enforced receiver utilization $\le 100\%$, donor utilization $\ge 50\%$, dynamic projected load tracking, and `proposals.rejectionReasons` array. Added seeded property test across randomized teams. | `rebalanceProposals invariants & property tests > strictly enforces...` and `property-style test: randomized seeded teams...` |
| **D7** | `src/context/TeamContext.jsx` | **Missing required state mutators**: Context lacked `reassignTask`, `applyRebalanceProposal`, `applyAllProposals`, and `resetToDefaults`. Also read stale state from outer closure. | Added all missing methods, updated state atomically, and added `STORAGE_KEY` persistence with versioning. | `src/context/TeamContext.test.js > conserves total allocated hours across assign, reassign, and unassign operations` |
| **D8** | `src/pages/BurnoutRisk.jsx` | **Hardcoded threshold literals**: Contained literal `0.5`, `100`, and `0.35` instead of exported constants. | Replaced with `UNDERUTILIZED_THRESHOLD`, `STREAK_LOAD_PCT`, and `MIN_PROPOSAL_FIT`. | Production build check & integration audit |
| **D9** | `src/pages/About.jsx` | **Formula description out of sync**: Formula showed `1 - AllocatedHours / CapacityHours` instead of reflecting `TaskHours`. | Updated formula explanation to include task hours: `max(0, min(1, 1 - ((AllocatedHours + TaskHours) / CapacityHours)))`. | Production build check & UI inspection |
