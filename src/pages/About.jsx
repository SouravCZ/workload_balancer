import {
  Card,
  CardHeader,
  Chip,
  SectionHeading,
} from "../components/ui";
import {
  AVAILABILITY_WEIGHT,
  BURNOUT_HIGH_OVERAGE,
  MAX_PROFICIENCY,
  MIN_PROPOSAL_FIT,
  OVERLOADED_THRESHOLD,
  RISK_HIGH_TIER_SCORE,
  RISK_MEDIUM_TIER_SCORE,
  RISK_OVERAGE_MULTIPLIER,
  RISK_STREAK_MULTIPLIER,
  SKILL_WEIGHT,
  STREAK_LOAD_PCT,
  UNDERUTILIZED_THRESHOLD,
} from "../utils/scoring";

export default function About() {
  return (
    <main className="flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop custom-scrollbar space-y-xl max-w-5xl">
      <SectionHeading
        title="About Equilibrium"
        description="Architecture, mathematical formulas, and operational design of the Workload Balancer."
      />

      {/* Block 1: What it does */}
      <Card className="p-lg">
        <CardHeader
          title="1. What Equilibrium Does"
          subtitle="Objective workload balancing without surveillance or guesswork"
          icon="balance"
        />
        <div className="mt-md space-y-md text-body-sm text-secondary leading-relaxed">
          <p>
            Equilibrium is an engineering operations system designed to distribute software development
            tasks fairly, transparently, and sustainably. In typical teams, 20% of senior engineers often absorb
            70% of organizational friction—leading to silent burnout, sudden turnover, and delayed critical-path features.
          </p>
          <p>
            Equilibrium replaces intuition-based assignment with deterministic mathematical telemetry. It tracks:
          </p>
          <ul className="list-disc pl-lg space-y-xs">
            <li>
              <strong className="text-primary">Live Capacity Telemetry:</strong> Each member has a baseline capacity (typically 40h/week) and tracked sprint allocations.
            </li>
            <li>
              <strong className="text-primary">Multi-Skill Competency Mapping:</strong> Detailed 1–{MAX_PROFICIENCY} proficiency ratings across Technical, Soft, and Domain skill groups.
            </li>
            <li>
              <strong className="text-primary">Proactive Rebalancing:</strong> Automated transfer suggestions moving tasks from overloaded donors to available receivers before deadlines slip.
            </li>
          </ul>
        </div>
      </Card>

      {/* Block 2: How Fit Score is calculated */}
      <Card className="p-lg">
        <CardHeader
          title="2. How the Fit Score is Calculated"
          subtitle="A deterministic weighted formula balancing competency depth and current bandwidth"
          icon="calculate"
        />
        <div className="mt-md space-y-lg text-body-sm leading-relaxed">
          <p className="text-secondary">
            For any given member <code className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-xs">M</code> and task <code className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-xs">T</code>, the candidate fit score is calculated using exact constants exported directly from our scoring engine:
          </p>

          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant font-mono text-xs space-y-2">
            <div className="text-primary font-bold">
              FitScore = ({SKILL_WEIGHT} × SkillOverlap) + ({AVAILABILITY_WEIGHT} × AvailabilityScore)
            </div>
            <div className="text-secondary">
              SkillOverlap = (Sum of member proficiencies on required skills) / (RequiredSkills.length × {MAX_PROFICIENCY})
            </div>
            <div className="text-secondary">
              AvailabilityScore = max(0, min(1, 1 - (AllocatedHours / CapacityHours)))
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md pt-xs">
            <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant space-y-xs">
              <div className="flex items-center gap-xs">
                <Chip tone="primary">Weight: {Math.round(SKILL_WEIGHT * 100)}%</Chip>
                <span className="font-headline-sm text-sm font-semibold text-primary">Skill Overlap</span>
              </div>
              <p className="text-xs text-secondary">
                Each required skill is scored against the engineer's proficiency on a 1–{MAX_PROFICIENCY} scale.
                Normalized so 1.0 represents master-level coverage of all required skills.
              </p>
            </div>

            <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant space-y-xs">
              <div className="flex items-center gap-xs">
                <Chip tone="primary">Weight: {Math.round(AVAILABILITY_WEIGHT * 100)}%</Chip>
                <span className="font-headline-sm text-sm font-semibold text-primary">Availability Score</span>
              </div>
              <p className="text-xs text-secondary">
                Calculated from remaining bandwidth. An engineer with 0 allocated hours receives an availability score of 1.0. At or above 100% capacity, availability clamps to 0.0.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Block 3: How Burnout Risk is calculated */}
      <Card className="p-lg">
        <CardHeader
          title="3. How Burnout Risk is Calculated"
          subtitle="Two-tier algorithmic assessment of current overage and sustained overtime streaks"
          icon="psychiatry"
        />
        <div className="mt-md space-y-lg text-body-sm leading-relaxed">
          <p className="text-secondary">
            Equilibrium models burnout without intrusive monitoring (no keystrokes or camera tracking).
            Instead, it monitors pure project telemetry:
          </p>

          {/* Utilization thresholds */}
          <div className="space-y-sm">
            <h4 className="font-headline-sm text-sm font-semibold text-primary">
              A. Workload Utilization Status
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm text-xs">
              <div className="p-sm rounded-lg bg-error-container/20 border border-error-container">
                <span className="font-bold text-error uppercase block">Overloaded</span>
                <span className="text-secondary mt-0.5 block">Utilization &gt; {OVERLOADED_THRESHOLD * 100}% of capacity</span>
              </div>
              <div className="p-sm rounded-lg bg-surface-container-lowest border border-outline-variant">
                <span className="font-bold text-primary-container uppercase block">Healthy</span>
                <span className="text-secondary mt-0.5 block">{UNDERUTILIZED_THRESHOLD * 100}% – {OVERLOADED_THRESHOLD * 100}% band</span>
              </div>
              <div className="p-sm rounded-lg bg-[#FAF0D7] border border-[#E8D49E]">
                <span className="font-bold text-[#8C6A1D] uppercase block">Underutilized</span>
                <span className="text-secondary mt-0.5 block">Utilization &lt; {UNDERUTILIZED_THRESHOLD * 100}% of capacity</span>
              </div>
            </div>
          </div>

          {/* Burnout risk formulas */}
          <div className="space-y-sm">
            <h4 className="font-headline-sm text-sm font-semibold text-primary">
              B. Risk Tier & Cumulative Fatigue Score
            </h4>
            <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant font-mono text-xs space-y-2">
              <div className="text-primary font-bold">
                Overage = max(0, Utilization - 1.0)
              </div>
              <div className="text-secondary">
                BurnoutTier (Unified) = Derived directly from RiskScore tiers ({RISK_HIGH_TIER_SCORE}+ &rarr; &quot;High&quot; | {RISK_MEDIUM_TIER_SCORE}+ &rarr; &quot;Medium&quot; | &quot;Low&quot;)
              </div>
              <div className="text-primary font-bold pt-1 border-t border-outline-variant/60">
                RiskScore (0–100) = clamp(round(Overage × {RISK_OVERAGE_MULTIPLIER} + StreakWeeks × {RISK_STREAK_MULTIPLIER}), 0, 100)
              </div>
              <div className="text-secondary">
                RiskTier = Score &ge; {RISK_HIGH_TIER_SCORE} &rarr; &quot;High&quot; | Score &ge; {RISK_MEDIUM_TIER_SCORE} &rarr; &quot;Medium&quot; | &quot;Low&quot;
              </div>
            </div>
            <p className="text-xs text-secondary">
              A single intense week won't trigger false alarms. Sustained overage across multi-week rolling windows (<code className="font-mono">StreakWeeks &gt; {STREAK_LOAD_PCT}%</code>) compounds the risk score exponentially.
            </p>
          </div>
        </div>
      </Card>

      {/* Block 4: How Workload Rebalancing Works */}
      <Card className="p-lg">
        <CardHeader
          title="4. Automated Workload Rebalancing Engine"
          subtitle="Deterministic rules for backlog assignment and overloaded donor relief"
          icon="swap_horiz"
        />
        <div className="mt-md space-y-md text-body-sm text-secondary leading-relaxed">
          <p>
            Equilibrium computes real-time reassignment and backlog dispatch recommendations using a strict two-phase algorithm that respects individual capacity limits and skill alignments:
          </p>
          <ul className="list-disc pl-lg space-y-sm">
            <li>
              <strong className="text-primary">Phase A (Backlog Assignment):</strong> Unassigned tasks are matched to available teammates below the underutilized threshold (&lt;{Math.round(UNDERUTILIZED_THRESHOLD * 100)}% capacity). The engine generates up to 3 <code className="font-mono text-xs px-1 py-0.5 rounded bg-surface-container">assign</code> proposals, selecting candidates with fit scores of at least {Math.round(MIN_PROPOSAL_FIT * 100)}%.
            </li>
            <li>
              <strong className="text-primary">Phase B (Overloaded Donor Relief):</strong> For members exceeding maximum capacity (&gt;{Math.round(OVERLOADED_THRESHOLD * 100)}%), tasks are transferred to underutilized teammates. Tasks are moved only until the donor's workload is at or below 100%, and transfers will never overshoot to drop the donor below the underutilized threshold (&lt;{Math.round(UNDERUTILIZED_THRESHOLD * 100)}%).
            </li>
            <li>
              <strong className="text-primary">Dynamic Headroom Guardrails:</strong> Every proposal incrementally updates the receiver&apos;s projected workload so that incoming work never causes a receiver to exceed {Math.round(OVERLOADED_THRESHOLD * 100)}% capacity. All assignments require candidate fit scores &ge; {Math.round(MIN_PROPOSAL_FIT * 100)}%.
            </li>
          </ul>
        </div>
      </Card>

      {/* Tech Stack */}
      <Card className="p-lg">
        <CardHeader
          title="Technology Stack"
          subtitle="Modern web technologies delivering sub-millisecond client-side recomputation"
          icon="code"
        />
        <div className="mt-md grid grid-cols-2 md:grid-cols-4 gap-md text-xs font-label-md">
          <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant">
            <span className="text-secondary block">Frontend Library</span>
            <span className="font-bold text-primary text-sm mt-0.5 block">React 19</span>
          </div>
          <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant">
            <span className="text-secondary block">Build System</span>
            <span className="font-bold text-primary text-sm mt-0.5 block">Vite 8</span>
          </div>
          <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant">
            <span className="text-secondary block">Styling Architecture</span>
            <span className="font-bold text-primary text-sm mt-0.5 block">Tailwind CSS 4</span>
          </div>
          <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant">
            <span className="text-secondary block">Routing Engine</span>
            <span className="font-bold text-primary text-sm mt-0.5 block">React Router 7</span>
          </div>
        </div>
      </Card>

      {/* Honest Current Limitations */}
      <Card className="p-lg">
        <CardHeader
          title="Current System Scope & Limitations"
          subtitle="Transparent disclosure of architectural boundaries and current design tradeoffs"
          icon="info"
        />
        <div className="mt-md space-y-sm text-body-sm text-secondary leading-relaxed">
          <ul className="list-disc pl-lg space-y-xs">
            <li>
              <strong className="text-primary">Mock Data & Client State:</strong> The current environment seeds 10 team engineers and 18 backlog tasks in memory. Changes (task creation, assignment, unassignment) persist across navigation within the browser session, but reset on hard refresh since there is no remote SQL database attached.
            </li>
            <li>
              <strong className="text-primary">Rule-Based Deterministic Scoring:</strong> All calculations execute through pure, auditable TypeScript mathematical functions. Equilibrium does not rely on opaque deep learning models or generative LLM API calls for allocation math, ensuring 100% reproducibility and zero hallucinations.
            </li>
            <li>
              <strong className="text-primary">Single-Sprint Planning Window:</strong> Active task allocations represent the current sprint capacity. Future sprint roadmaps are currently represented as historical five-week load trends rather than multi-quarter Gantt projections.
            </li>
          </ul>
        </div>
      </Card>
    </main>
  );
}
