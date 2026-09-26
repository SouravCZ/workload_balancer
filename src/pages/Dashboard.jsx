import { useMemo, useState } from "react";
import { useTeamContext } from "../context/TeamContext";
import { Avatar, Card, Chip, Icon, KpiCard, SectionHeading, UtilizationBar, riskTone } from "../components/ui";
import InsightsPanel from "../components/InsightsPanel";
import Modal, { Button, ModalActions } from "../components/Modal";
import { rebalanceProposals, teamMetrics, calculateFitScore, calculateBurnoutRisk } from "../utils/scoring";

const filters = ["All Roles", "Frontend", "Backend", "Data", "Platform"];

function matchesFilter(member, filter) {
  if (filter === "All Roles") return true;
  return member.role.toLowerCase().includes(filter.toLowerCase());
}

export default function Dashboard() {
  const { members, tasks, assignTask } = useTeamContext();
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [applied, setApplied] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const closeDialog = () => setDialog(null);

  const metrics = useMemo(() => teamMetrics(members, tasks), [members, tasks]);
  const proposals = useMemo(() => rebalanceProposals(members, tasks), [members, tasks]);

  const visibleRows = useMemo(
    () => metrics.rows.filter((row) => matchesFilter(row.member, roleFilter)),
    [metrics.rows, roleFilter],
  );

  const teamRisk = metrics.highRisk.length
    ? "High"
    : metrics.rows.some((r) => r.risk.tier === "Medium")
      ? "Medium"
      : "Low";
  const topRiskRow = [...metrics.rows].sort((a, b) => b.risk.score - a.risk.score)[0];

  const suggestions = proposals.slice(0, 3).map((p) => ({
    title: p.task.priority === "Critical" ? "Reassign Task" : "Rebalance Load",
    detail: `Move '${p.task.title}' from ${p.from.name.split(" ")[0]}`,
    icon: p.fitScore > 0.7 ? "call_split" : "arrow_forward",
  }));
  if (suggestions.length === 0) {
    suggestions.push({
      title: "Maintain Plan",
      detail: "No transfers needed this sprint",
      icon: "verified",
    });
  }

  const applyProposal = (proposal) => {
    assignTask(proposal.task.id, proposal.to.id);
    setApplied((prev) => [...prev, proposal.id]);
  };

  const summaryText = useMemo(() => {
    const lines = [
      "Equilibrium — Team Operations Summary",
      `Role filter: ${roleFilter}`,
      "",
      `Team size: ${metrics.totalMembers}`,
      `Tasks: ${metrics.totalTasks} (${metrics.unassigned.length} unassigned)`,
      `Capacity: ${metrics.totalAllocated}h of ${metrics.totalCapacity}h (${Math.round(
        metrics.utilization * 100,
      )}% utilised)`,
      `Overloaded: ${metrics.overloaded.length}`,
      `High burnout risk: ${metrics.highRisk.length}`,
      `Average fit score: ${Math.round(metrics.avgFit * 100)}%`,
      `Health score: ${metrics.healthScore}`,
      "",
      "Members:",
    ];

    metrics.rows.forEach((row) => {
      lines.push(
        `- ${row.member.name} (${row.member.role}): ${Math.round(
          row.utilization * 100,
        )}% utilised, risk ${row.risk.tier}, ${row.member.currentAllocatedHours}h/${
          row.member.capacityHours
        }h`,
      );
    });

    return lines.join("\n");
  }, [metrics, roleFilter]);

  const summaryCsv = useMemo(() => {
    const header = [
      "Name",
      "Role",
      "Allocated Hours",
      "Capacity Hours",
      "Utilisation %",
      "Risk Tier",
      "Risk Score",
    ];
    const rows = metrics.rows.map((row) => [
      row.member.name,
      row.member.role,
      row.member.currentAllocatedHours,
      row.member.capacityHours,
      Math.round(row.utilization * 100),
      row.risk.tier,
      row.risk.score,
    ]);
    return [header, ...rows]
      .map((cells) => cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }, [metrics]);

  const download = (content, filename, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      <main className="flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop min-w-0 custom-scrollbar">
        <SectionHeading
          title="Team Operations Overview"
          description="Real-time capacity and task distribution insights."
          className="mb-xl"
          actions={
            <>
              <div className="hidden md:flex items-center gap-sm mr-md">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setRoleFilter(filter)}
                    className={`px-sm py-xs rounded-full border font-label-md text-label-md transition-colors ${
                      roleFilter === filter
                        ? "border-primary bg-primary-container text-on-primary"
                        : "border-outline-variant text-secondary hover:bg-surface-container-high"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDialog("export")}
                className="border border-outline-variant text-on-surface px-md py-sm rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-colors flex items-center gap-sm"
              >
                <Icon name="download" className="text-[18px]" />
                Export Summary
              </button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-md mb-xl">
          <KpiCard
            label="Total Capacity"
            value={`${Math.round(metrics.utilization * 100)}%`}
            icon="battery_charging_full"
            tone="positive"
            delta={`${metrics.totalAllocated}h of ${metrics.totalCapacity}h`}
          />
          <KpiCard
            label="Members"
            value={metrics.totalMembers}
            icon="groups"
            delta={`${metrics.totalTasks} tracked tasks`}
          />
          <KpiCard
            label="Overloaded"
            value={metrics.overloaded.length}
            icon="warning"
            tone={metrics.overloaded.length ? "warning" : "neutral"}
            delta="Above capacity"
          />
          <KpiCard
            label="Underutilized"
            value={metrics.underutilized.length}
            icon="trending_down"
            tone="positive"
            delta="Available headroom"
          />
          <KpiCard
            label="Unassigned"
            value={metrics.unassigned.length}
            icon="assignment_late"
            tone={metrics.unassigned.length ? "warning" : "neutral"}
            delta="Needs an owner"
          />
          <KpiCard
            label="Avg Fit Score"
            value={`${Math.round(metrics.avgFit * 100)}%`}
            icon="verified"
            tone="positive"
            delta="Across assigned work"
          />
        </div>

        <Card className="p-lg mb-xl">
          <div className="flex items-center justify-between mb-lg">
            <h3 className="font-headline-sm text-headline-sm text-primary">Team Workload</h3>
            <Chip tone="outline">
              {visibleRows.length} of {metrics.totalMembers} shown
            </Chip>
          </div>
          <div className="space-y-lg">
            {visibleRows.map(({ member, utilization, status, risk }) => (
              <div key={member.id}>
                <div className="flex justify-between items-center font-label-md text-label-md mb-sm">
                  <span className="flex items-center gap-sm text-on-surface">
                    <Avatar member={member} size="xs" />
                    <span className="font-medium">{member.name}</span>
                    <span className="text-[11px] text-secondary font-normal">{member.shortRole}</span>
                    <Chip tone={riskTone(risk.tier)}>{risk.tier}</Chip>
                  </span>
                  <span className={status === "overloaded" ? "text-error" : "text-secondary"}>
                    {Math.round(utilization * 100)}%
                  </span>
                </div>
                <UtilizationBar utilization={utilization} />
              </div>
            ))}
            {visibleRows.length === 0 ? (
              <p className="font-body-sm text-body-sm text-secondary">No members match this filter.</p>
            ) : null}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-xl">
          <Card className="p-lg lg:col-span-2 overflow-hidden">
            <h3 className="font-headline-sm text-headline-sm text-primary mb-lg">Task Assignments</h3>
            <div className="overflow-x-auto -mx-lg px-lg">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="pb-sm font-label-md text-label-md text-secondary">Task</th>
                    <th className="pb-sm font-label-md text-label-md text-secondary">Fit</th>
                    <th className="pb-sm font-label-md text-label-md text-secondary">Risk</th>
                    <th className="pb-sm font-label-md text-label-md text-secondary">Assigned To</th>
                    <th className="pb-sm font-label-md text-label-md text-secondary">Priority</th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm">
                  {tasks.map((task) => {
                    const assignee = members.find((m) => m.id === task.assignedMemberId);
                    return (
                      <tr
                        key={task.id}
                        className="border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors"
                      >
                        <td className="py-md text-on-surface">{task.title}</td>
                        <td className="py-md">
                          {assignee ? (
                            <Chip tone="strong">
                              {Math.round(calculateFitScore(assignee, task).fitScore * 100)}%
                            </Chip>
                          ) : (
                            <Chip tone="outline">Unassigned</Chip>
                          )}
                        </td>
                        <td className="py-md">
                          {assignee ? (
                            <Chip tone={riskTone(calculateBurnoutRisk(assignee).riskTier)}>
                              {calculateBurnoutRisk(assignee).riskTier}
                            </Chip>
                          ) : (
                            <Chip tone="neutral">—</Chip>
                          )}
                        </td>
                        <td className="py-md">
                          {assignee ? (
                            <span className="flex items-center gap-sm">
                              <Avatar member={assignee} size="xs" />
                              <span className="text-on-surface">{assignee.name}</span>
                            </span>
                          ) : (
                            <span className="text-secondary">—</span>
                          )}
                        </td>
                        <td className="py-md">{task.priority}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-lg flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-primary mb-md flex items-center gap-sm">
              <Icon name="auto_awesome" className="text-primary-container" filled />
              AI Recommendations
            </h3>
            <div className="space-y-md flex-1">
              {proposals.length === 0 ? (
                <p className="font-body-sm text-body-sm text-secondary">
                  Allocation is balanced. No transfers recommended.
                </p>
              ) : null}
              {proposals.map((proposal) => {
                const isApplied = applied.includes(proposal.id);
                return (
                  <div
                    key={proposal.id}
                    className="border border-outline-variant rounded-lg p-md soft-shadow"
                  >
                    <div className="flex items-center gap-sm mb-sm">
                      <Avatar member={proposal.from} size="sm" />
                      <Icon name="arrow_forward" className="text-secondary text-[18px]" />
                      <Avatar member={proposal.to} size="sm" />
                      <span className="ml-auto font-label-md text-label-md text-primary">
                        {Math.round(proposal.fitScore * 100)}%
                      </span>
                    </div>
                    <p className="font-label-md text-label-md text-on-surface mb-xs">
                      {proposal.task.title}
                    </p>
                    <p className="font-body-sm text-body-sm text-secondary mb-md">
                      Move {proposal.hours}h from {proposal.from.name} to {proposal.to.name}.
                    </p>
                    <div className="flex gap-sm">
                      <button
                        type="button"
                        disabled={isApplied}
                        onClick={() => applyProposal(proposal)}
                        className="flex-1 bg-primary-container text-on-primary py-1.5 px-sm rounded font-label-md text-label-md hover:bg-primary transition-colors disabled:opacity-60"
                      >
                        {isApplied ? "Applied" : "Apply Rebalance"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewing(proposal)}
                        className="flex-1 border border-outline-variant text-on-surface py-1.5 px-sm rounded font-label-md text-label-md hover:bg-surface-container-low transition-colors"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>

      <InsightsPanel
        proposal={proposals[0]}
        riskRow={topRiskRow?.risk.tier === "Low" ? null : topRiskRow}
        suggestions={suggestions}
        teamRisk={teamRisk}
      />

      <Modal
        open={dialog === "export"}
        onClose={closeDialog}
        title="Export Summary"
        description="A snapshot of the current team metrics and member utilisation."
        icon="download"
        size="lg"
        footer={
          <ModalActions>
            <Button
              onClick={() => navigator.clipboard?.writeText(summaryText)}
              disabled={!navigator.clipboard}
            >
              Copy text
            </Button>
            <Button
              onClick={() => download(summaryCsv, "equilibrium-team.csv", "text/csv")}
            >
              Download CSV
            </Button>
            <Button variant="primary" onClick={closeDialog}>
              Done
            </Button>
          </ModalActions>
        }
      >
        <pre className="font-body-sm text-body-sm text-on-surface bg-surface-container-lowest border border-outline-variant rounded-md p-md overflow-x-auto custom-scrollbar whitespace-pre-wrap">
          {summaryText}
        </pre>
      </Modal>

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Review Transfer"
        description={reviewing?.task.title}
        icon="rate_review"
        footer={
          <ModalActions>
            <Button onClick={() => setReviewing(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={applied.includes(reviewing?.id)}
              onClick={() => {
                applyProposal(reviewing);
                setReviewing(null);
              }}
            >
              {applied.includes(reviewing?.id) ? "Already applied" : "Apply transfer"}
            </Button>
          </ModalActions>
        }
      >
        {reviewing ? (
          <>
            <p className="font-body-sm text-body-sm text-secondary">
              Move {reviewing.hours}h of <strong className="text-on-surface">{reviewing.task.title}</strong>{" "}
              from {reviewing.from.name} to {reviewing.to.name} at{" "}
              {Math.round(reviewing.fitScore * 100)}% fit.
            </p>

            <div className="mt-lg flex flex-col gap-md">
              <div>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="font-label-md text-label-md text-on-surface">
                    {reviewing.from.name}
                  </span>
                  <span className="font-label-md text-label-md text-primary">
                    {Math.round(
                      (reviewing.from.currentAllocatedHours / reviewing.from.capacityHours) * 100,
                    )}
                    % → {Math.round(
                      ((reviewing.from.currentAllocatedHours - reviewing.hours) /
                        reviewing.from.capacityHours) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          ((reviewing.from.currentAllocatedHours - reviewing.hours) /
                            reviewing.from.capacityHours) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="font-label-md text-label-md text-on-surface">
                    {reviewing.to.name}
                  </span>
                  <span className="font-label-md text-label-md text-primary">
                    {Math.round(
                      (reviewing.to.currentAllocatedHours / reviewing.to.capacityHours) * 100,
                    )}
                    % → {Math.round(
                      ((reviewing.to.currentAllocatedHours + reviewing.hours) /
                        reviewing.to.capacityHours) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          ((reviewing.to.currentAllocatedHours + reviewing.hours) /
                            reviewing.to.capacityHours) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
