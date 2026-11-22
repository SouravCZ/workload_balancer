import { useMemo, useState, useEffect } from "react";
import { useTeamContext } from "../context/TeamContext";
import { Avatar, Card, Chip, Icon, KpiCard, riskTone } from "../components/ui";
import Modal, { Button, ModalActions } from "../components/Modal";
import { calculateFitScore, calculateRiskScore, teamMetrics, UNDERUTILIZED_THRESHOLD, STREAK_LOAD_PCT, MIN_PROPOSAL_FIT } from "../utils/scoring";
import { predictMemberBurnoutML } from "../services/mlModel";

const gaugeColor = {
  High: "#ba1a1a",
  Medium: "#8C6A1D",
  Low: "#4c6359",
};

export default function BurnoutRisk() {
  const { members, tasks } = useTeamContext();
  const [showReport, setShowReport] = useState(false);
  const [selectedId, setSelectedId] = useState(
    members.find((m) => calculateRiskScore(m).tier === "High")?.id ?? members[0]?.id ?? null,
  );

  const metrics = useMemo(() => teamMetrics(members, tasks), [members, tasks]);
  const ranked = useMemo(
    () => [...metrics.rows].sort((a, b) => b.risk.score - a.risk.score),
    [metrics.rows],
  );

  const [mlBurnoutMap, setMlBurnoutMap] = useState({});

  useEffect(() => {
    let isMounted = true;
    async function loadBurnout() {
      const map = {};
      for (const m of members) {
        map[m.id] = await predictMemberBurnoutML(m, tasks);
      }
      if (isMounted) setMlBurnoutMap(map);
    }
    loadBurnout();
    return () => {
      isMounted = false;
    };
  }, [members, tasks]);

  const selectedRow = ranked.find((row) => row.member.id === selectedId) ?? ranked[0] ?? null;
  const member = selectedRow?.member ?? null;
  const risk = selectedRow?.risk ?? null;

  const highRisk = metrics.rows.filter((r) => r.risk.tier === "High");
  const mediumRisk = metrics.rows.filter((r) => r.risk.tier === "Medium");
  const atRiskCapacity = metrics.rows.filter((r) => r.status === "overloaded");
  const recovering = metrics.rows.filter((r) => r.utilization < UNDERUTILIZED_THRESHOLD);
  const teamAvg = Math.round(
    metrics.rows.reduce((sum, r) => sum + r.risk.score, 0) / Math.max(1, metrics.rows.length),
  );
  const interventions = highRisk.length * 2 + mediumRisk.length;

  const movableTasks = member
    ? tasks
        .filter((t) => t.assignedMemberId === member.id)
        .map((task) => ({
          task,
          target: members
            .filter((m) => m.id !== member.id)
            .map((m) => ({ member: m, fit: calculateFitScore(m, task).fitScore }))
            .sort((a, b) => b.fit - a.fit)[0],
        }))
        .filter((entry) => entry.target && entry.target.fit >= MIN_PROPOSAL_FIT)
    : [];

  const overCapacityStreak = risk?.streakWeeks ?? (member
    ? member.weeklyLoad.filter((load) => load > STREAK_LOAD_PCT).length
    : 0);
  const dueThisWeek = member
    ? tasks.filter(
        (t) => t.assignedMemberId === member.id && (t.deadline === "Today" || t.deadline === "Oct 24"),
      ).length
    : 0;

  const reportText =
    member && risk
      ? [
          "Equilibrium — Burnout Risk Report",
          "",
          `Member: ${member.name} (${member.role})`,
          `Risk tier: ${risk.tier} (score ${risk.score})`,
          `Over-capacity streak: ${overCapacityStreak} weeks`,
          "",
          "CAPACITY",
          `Allocated: ${member.currentAllocatedHours}h of ${member.capacityHours}h (${Math.round(
            selectedRow.utilization * 100,
          )}%)`,
          `Tasks due this week: ${dueThisWeek}`,
          "",
          "WEEKLY LOAD",
          ...member.weeklyLoad.map((load, i) => `  Week ${i + 1}: ${load}%`),
          "",
          "RECOMMENDED TRANSFERS",
          ...(movableTasks.length
            ? movableTasks.map(
                (entry) =>
                  `  ${entry.task.title} (${entry.task.estimatedHours}h) -> ${entry.target.member.name} (${Math.round(
                    entry.target.fit * 100,
                  )}% fit)`,
              )
            : ["  None — no task clears the 35% fit threshold elsewhere."]),
        ].join("\n")
      : "";

  return (
    <main className="flex-1 p-margin-mobile md:p-margin-desktop overflow-y-auto custom-scrollbar">
      <div className="mb-xl">
        <h2 className="font-headline-lg text-headline-lg text-primary md:text-display-lg">
          Burnout Risk
        </h2>
        <p className="font-body-md text-body-md text-secondary mt-xs">
          Predictive workload signals across the team, ranked by severity.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md mb-xl">
        <KpiCard
          label="High Risk"
          value={highRisk.length}
          icon="crisis_alert"
          tone={highRisk.length ? "danger" : "neutral"}
        />
        <KpiCard
          label="Medium Risk"
          value={mediumRisk.length}
          icon="warning"
          tone={mediumRisk.length ? "warning" : "neutral"}
        />
        <KpiCard
          label="Over Capacity"
          value={atRiskCapacity.length}
          icon="battery_alert"
          tone={atRiskCapacity.length ? "warning" : "neutral"}
        />
        <KpiCard
          label="Recovery Time"
          value={`${recovering.length * 2}d`}
          icon="self_improvement"
          tone="positive"
        />
        <KpiCard
          label="Team Avg. Score"
          value={teamAvg}
          icon="monitoring"
          tone={teamAvg >= 50 ? "warning" : "positive"}
        />
        <KpiCard
          label="Interventions"
          value={interventions}
          icon="medical_services"
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-xl">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-body-md font-semibold text-primary">Team Comparison</h3>
            <Chip tone="outline">Ranked by severity</Chip>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                    Member
                  </th>
                  <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                    Risk Score
                  </th>
                  <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                    Utilization
                  </th>
                  <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                    Heuristic Tier
                  </th>
                  <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                    ML Burnout Risk
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {ranked.map((row) => {
                  const isActive = row.member.id === member?.id;
                  const ml = mlBurnoutMap[row.member.id];
                  return (
                    <tr
                      key={row.member.id}
                      onClick={() => setSelectedId(row.member.id)}
                      className={`cursor-pointer transition-colors ${
                        isActive
                          ? "bg-error-container/10"
                          : "hover:bg-surface-container-lowest"
                      }`}
                    >
                      <td className="px-lg py-md">
                        <div className="flex items-center gap-md">
                          <Avatar member={row.member} size="sm" />
                          <div>
                            <p className="font-label-md text-label-md text-on-surface font-semibold">
                              {row.member.name}
                            </p>
                            <p className="font-body-sm text-body-sm text-secondary">
                              {row.member.shortRole}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-lg py-md">
                        <div className="flex items-center gap-sm">
                          <span className="font-label-md text-label-md text-on-surface w-8">
                            {row.risk.score}
                          </span>
                          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden max-w-[140px]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.risk.score}%`,
                                backgroundColor: gaugeColor[row.risk.tier],
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-lg py-md">
                        <span
                          className={`font-label-md text-label-md ${
                            row.status === "overloaded" ? "text-error" : "text-on-surface"
                          }`}
                        >
                          {Math.round(row.utilization * 100)}%
                        </span>
                      </td>
                      <td className="px-lg py-md">
                        <Chip tone={riskTone(row.risk.tier)} icon={row.risk.tier === "Low" ? undefined : "warning"}>
                          {row.risk.tier}
                        </Chip>
                      </td>
                      <td className="px-lg py-md">
                        {ml ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-primary">
                              {Math.round(ml.burnoutProbability * 100)}%
                            </span>
                            <Chip tone={riskTone(ml.riskTier)} className="text-[10px] py-0 px-1.5">
                              {ml.riskTier}
                            </Chip>
                          </div>
                        ) : (
                          <span className="text-secondary text-xs">...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {member && risk ? (
          <Card className="p-lg">
            <h3 className="font-body-md font-semibold text-primary">{member.name}</h3>
            <p className="font-body-sm text-body-sm text-secondary mb-md">{member.role}</p>

            <div className="flex flex-col items-center justify-center py-md mb-md border-b border-outline-variant">
              <div className="relative w-24 h-24 mb-sm">
                <div className="absolute inset-0 rounded-full border-4 border-outline-variant" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-transparent"
                  style={{
                    borderTopColor: gaugeColor[risk.tier],
                    borderRightColor: gaugeColor[risk.tier],
                    borderBottomColor: gaugeColor[risk.tier],
                    transform: `rotate(${Math.min(270, (risk.score / 100) * 270 - 45)}deg)`,
                  }}
                />
                <div className="absolute inset-2 bg-surface-container-lowest rounded-full flex flex-col items-center justify-center">
                  <span
                    className="font-headline-lg text-headline-lg leading-none"
                    style={{ color: gaugeColor[risk.tier] }}
                  >
                    {risk.score}
                  </span>
                </div>
              </div>
              <span
                className="font-label-md text-label-md font-semibold tracking-wider uppercase"
                style={{ color: gaugeColor[risk.tier] }}
              >
                {risk.tier} Risk
              </span>
            </div>

            <div className="mb-md">
              <h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">
                Key Risk Drivers
              </h4>
              <ul className="space-y-sm">
                {overCapacityStreak > 0 ? (
                  <li className="flex items-start gap-sm">
                    <Icon name="crisis_alert" className="text-error" style={{ fontSize: "16px" }} />
                    <div>
                      <span className="font-body-sm text-on-surface block">Workload Spikes</span>
                      <span className="font-label-md text-label-md text-on-surface-variant block">
                        {overCapacityStreak} consecutive weeks &gt; 100% cap.
                      </span>
                    </div>
                  </li>
                ) : null}
                {dueThisWeek > 0 ? (
                  <li className="flex items-start gap-sm">
                    <Icon name="date_range" className="risk-amber" style={{ fontSize: "16px" }} />
                    <div>
                      <span className="font-body-sm text-on-surface block">Deadline Density</span>
                      <span className="font-label-md text-label-md text-on-surface-variant block">
                        {dueThisWeek} deliverables due this week.
                      </span>
                    </div>
                  </li>
                ) : null}
                {member.presence === "ooo" ? (
                  <li className="flex items-start gap-sm">
                    <Icon name="beach_access" className="text-primary-container" style={{ fontSize: "16px" }} />
                    <div>
                      <span className="font-body-sm text-on-surface block">On Leave</span>
                      <span className="font-label-md text-label-md text-on-surface-variant block">
                        Currently out of office — plan handover.
                      </span>
                    </div>
                  </li>
                ) : (
                  <li className="flex items-start gap-sm">
                    <Icon
                      name="battery_1_bar"
                      className={risk.tier === "High" ? "risk-amber" : "text-primary-container"}
                      style={{ fontSize: "16px" }}
                    />
                    <div>
                      <span className="font-body-sm text-on-surface block">Low Recovery Time</span>
                      <span className="font-label-md text-label-md text-on-surface-variant block">
                        No scheduled recovery blocks this sprint.
                      </span>
                    </div>
                  </li>
                )}
              </ul>
            </div>

            {/* ML Model Burnout Radar Block */}
            {mlBurnoutMap[member.id] ? (
              <div className="mb-md p-md rounded-xl bg-surface-container-low border border-outline-variant space-y-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon name="psychology" className="text-primary text-[18px]" />
                    <span className="font-label-md text-xs font-bold text-primary">
                      ML Fatigue Radar
                    </span>
                  </div>
                  <Chip tone={riskTone(mlBurnoutMap[member.id].riskTier)} className="text-[10px] font-bold">
                    {Math.round(mlBurnoutMap[member.id].burnoutProbability * 100)}% ({mlBurnoutMap[member.id].riskTier})
                  </Chip>
                </div>
                <div>
                  <span className="text-[11px] font-label-md text-secondary block mb-1">
                    Top Contributing Factors:
                  </span>
                  <ul className="space-y-1 text-xs text-on-surface">
                    {mlBurnoutMap[member.id].topFactors.map((factor, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-secondary">
                        <span className="text-primary text-[14px] leading-tight">&bull;</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-[10px] text-outline italic">
                  Model: GradientBoosting (trained on synthetic telemetry)
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="w-full bg-primary-container text-on-primary font-body-sm font-medium py-sm px-md rounded-lg hover:opacity-90 transition-opacity"
            >
              View Detailed Report
            </button>
          </Card>
        ) : null}
      </div>

      <Card className="p-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-secondary-container/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="flex items-center gap-sm mb-md relative z-10">
          <Icon name="smart_toy" className="text-secondary" filled />
          <h3 className="font-headline-sm text-headline-sm text-primary">AI Recommended Actions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md relative z-10">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-col justify-between hover:bg-surface-container-highest transition-colors cursor-pointer group">
            <div>
              <h4 className="font-body-md font-medium text-on-surface mb-xs">Reassign Tasks</h4>
              <p className="font-body-sm text-body-sm text-secondary">
                {movableTasks.length === 0
                  ? `${member?.name.split(" ")[0] ?? "This member"} holds no transferable work right now.`
                  : `Move ${movableTasks.map((entry) => `'${entry.task.title}'`).join(", ")} off ${
                      member.name.split(" ")[0]
                    }'s plate this sprint.`}
              </p>
            </div>
            <div className="mt-md flex items-center gap-sm text-primary-container font-label-md text-label-md">
              Review plan
              <Icon name="arrow_forward" className="text-[18px] group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-col justify-between hover:bg-surface-container-highest transition-colors cursor-pointer group">
            <div>
              <h4 className="font-body-md font-medium text-on-surface mb-xs">Schedule Recovery</h4>
              <p className="font-body-sm text-body-sm text-secondary">
                Block focus-free recovery time for{" "}
                {highRisk.length > 0
                  ? highRisk.map((r) => r.member.name.split(" ")[0]).join(", ")
                  : "at-risk members"}
                {" "}and cap their intake for the remainder of the sprint.
              </p>
            </div>
            <div className="mt-md flex items-center gap-sm text-primary-container font-label-md text-label-md">
              Open planner
              <Icon name="arrow_forward" className="text-[18px] group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </Card>

      <Modal
        open={showReport}
        onClose={() => setShowReport(false)}
        title="Detailed Risk Report"
        description={member ? `${member.name} — ${risk?.tier} risk` : undefined}
        icon="monitoring"
        size="lg"
        footer={
          <ModalActions>
            <Button
              onClick={() => navigator.clipboard?.writeText(reportText)}
              disabled={!navigator.clipboard}
            >
              Copy report
            </Button>
            <Button variant="primary" onClick={() => setShowReport(false)}>
              Close
            </Button>
          </ModalActions>
        }
      >
        {member && risk ? (
          <>
            <div className="grid grid-cols-3 gap-md mb-lg">
              {[
                { label: "Risk score", value: risk.score, tone: riskTone(risk.tier) },
                {
                  label: "Utilisation",
                  value: `${Math.round(selectedRow.utilization * 100)}%`,
                  tone: selectedRow.utilization > 1 ? "danger" : "positive",
                },
                {
                  label: "Streak",
                  value: `${overCapacityStreak}w`,
                  tone: overCapacityStreak > 0 ? "warning" : "positive",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-md border border-outline-variant rounded-lg flex flex-col gap-sm"
                >
                  <span className="font-label-md text-label-md text-secondary">{stat.label}</span>
                  <span
                    className={`font-headline-sm text-headline-sm ${
                      stat.tone === "danger"
                        ? "text-error"
                        : stat.tone === "warning"
                          ? "text-[#8C6A1D]"
                          : "text-primary"
                    }`}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>

            {movableTasks.length > 0 ? (
              <div className="mb-lg">
                <h3 className="font-label-md text-label-md text-on-surface mb-sm">
                  Suggested transfers
                </h3>
                <ul className="flex flex-col gap-sm">
                  {movableTasks.map((entry) => (
                    <li
                      key={entry.task.id}
                      className="flex items-center justify-between gap-md p-sm border border-outline-variant rounded-md"
                    >
                      <span className="font-body-sm text-body-sm text-on-surface truncate">
                        {entry.task.title}
                      </span>
                      <span className="font-label-md text-label-md text-secondary flex-shrink-0">
                        → {entry.target.member.name.split(" ")[0]} ·{" "}
                        {Math.round(entry.target.fit * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <pre className="font-body-sm text-body-sm text-on-surface bg-surface-container-lowest border border-outline-variant rounded-md p-md overflow-x-auto custom-scrollbar whitespace-pre-wrap">
              {reportText}
            </pre>
          </>
        ) : (
          <p className="font-body-sm text-body-sm text-secondary">Select a member first.</p>
        )}
      </Modal>
    </main>
  );
}
