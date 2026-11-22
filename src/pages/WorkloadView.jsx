import { useMemo, useState, useEffect } from "react";
import { useTeamContext } from "../context/TeamContext";
import {
  Avatar,
  Card,
  Chip,
  Icon,
  KpiCard,
  SectionHeading,
  UtilizationBar,
  riskTone,
} from "../components/ui";
import { calculateFitScore, rebalanceProposals, teamMetrics } from "../utils/scoring";
import { scoreCandidateML } from "../services/mlModel";
import Modal, { Button, ModalActions } from "../components/Modal";
import { workloadTrend } from "../services/mockData";

const sortOptions = ["Highest load", "Lowest load", "Name", "Risk"];

export default function WorkloadView() {
  const { members, tasks, assignTask } = useTeamContext();
  const [sortBy, setSortBy] = useState("Highest load");
  const [dialog, setDialog] = useState(null);
  const [mlProposalScores, setMlProposalScores] = useState({});
  const closeDialog = () => setDialog(null);

  const metrics = useMemo(() => teamMetrics(members, tasks), [members, tasks]);
  const proposals = useMemo(() => rebalanceProposals(members, tasks), [members, tasks]);

  useEffect(() => {
    let isMounted = true;
    async function loadProposalMl() {
      const scores = {};
      for (const p of proposals) {
        if (p.to && p.task) {
          scores[p.id] = await scoreCandidateML(p.to, p.task, tasks);
        }
      }
      if (isMounted) setMlProposalScores(scores);
    }
    loadProposalMl();
    return () => {
      isMounted = false;
    };
  }, [proposals, tasks]);

  const applyAll = () => {
    proposals.forEach((proposal) => assignTask(proposal.task.id, proposal.to.id));
    closeDialog();
  };

  const rows = useMemo(() => {
    const sorted = [...metrics.rows];
    if (sortBy === "Highest load") sorted.sort((a, b) => b.utilization - a.utilization);
    if (sortBy === "Lowest load") sorted.sort((a, b) => a.utilization - b.utilization);
    if (sortBy === "Risk") sorted.sort((a, b) => b.risk.score - a.risk.score);
    if (sortBy === "Name") sorted.sort((a, b) => a.member.name.localeCompare(b.member.name));
    return sorted;
  }, [metrics.rows, sortBy]);

  const overloadedTasks = useMemo(
    () =>
      metrics.overloaded.flatMap(({ member }) =>
        tasks
          .filter((t) => t.assignedMemberId === member.id)
          .map((task) => ({ task, member })),
      ),
    [metrics.overloaded, tasks],
  );

  return (
    <main tabIndex={0} aria-label="Team Workload" className="flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop custom-scrollbar outline-none">
      <SectionHeading
        title="Team Workload"
        description="Live capacity utilisation per member with transferable task suggestions."
        className="mb-xl"
        actions={
          <>
            <label className="flex items-center gap-sm font-label-md text-label-md text-secondary">
              Sort
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="bg-surface-container-lowest border border-outline-variant rounded-md px-sm py-1.5 text-on-surface font-body-sm focus:outline-none focus:border-primary"
              >
                {sortOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setDialog("autobalance")}
              className="bg-primary-container text-on-primary px-md py-sm rounded-md font-label-md text-label-md hover:bg-primary transition-colors flex items-center gap-sm"
            >
              <Icon name="auto_awesome" className="text-[18px]" filled />
              Auto-Balance
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-xl">
        <KpiCard
          label="Team Utilisation"
          value={`${Math.round(metrics.utilization * 100)}%`}
          icon="monitoring"
          tone="positive"
        />
        <KpiCard label="Healthy Band" value={metrics.rows.length - metrics.overloaded.length - metrics.underutilized.length} icon="check_circle" />
        <KpiCard
          label="Over Capacity"
          value={metrics.overloaded.length}
          icon="warning"
          tone={metrics.overloaded.length ? "warning" : "neutral"}
        />
        <KpiCard
          label="Available Hours"
          value={`${metrics.totalCapacity - metrics.totalAllocated}h`}
          icon="hourglass_empty"
          tone="positive"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-lg mb-xl">
        <Card className="p-lg xl:col-span-2">
          <h3 className="font-headline-sm text-headline-sm text-primary mb-lg">
            Utilisation by Member
          </h3>
          <div className="space-y-lg">
            {rows.map(({ member, utilization, status, risk }) => (
              <div key={member.id} className="grid grid-cols-12 gap-md items-center">
                <div className="col-span-12 sm:col-span-4 flex items-center gap-sm">
                  <Avatar member={member} size="sm" />
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md text-on-surface truncate">
                      {member.name}
                    </p>
                    <p className="font-body-sm text-body-sm text-secondary truncate">
                      {member.shortRole}
                    </p>
                  </div>
                </div>
                <div className="col-span-8 sm:col-span-5">
                  <UtilizationBar utilization={utilization} />
                </div>
                <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-sm">
                  <span
                    className={`font-label-md text-label-md ${
                      status === "overloaded" ? "text-error" : "text-secondary"
                    }`}
                  >
                    {Math.round(utilization * 100)}%
                  </span>
                  <Chip tone={riskTone(risk.tier)}>{risk.tier}</Chip>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-lg">
          <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider font-bold mb-lg">
            Weekly Trend
          </h3>
          <div className="flex-1 flex flex-col justify-end h-56">
            <div className="relative flex-1 flex items-end justify-between gap-sm pb-md border-b border-outline-variant">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3].map((line) => (
                  <div key={line} className="border-b border-outline-variant/30 w-full" />
                ))}
              </div>
              {workloadTrend.map((point) => (
                <div key={point.day} className="relative flex-1 flex flex-col items-center gap-xs group">
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface text-on-surface text-[11px] px-1.5 py-0.5 border border-outline-variant rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {point.utilization}%
                  </span>
                  <div
                    className="w-full bg-primary-fixed-dim/50 rounded-t-sm border-t-2 border-secondary"
                    style={{ height: `${point.secondary}%` }}
                  />
                  <div
                    className="w-full bg-primary-container/50 rounded-t-sm border-t-2 border-primary-container -mt-1"
                    style={{ height: `${point.utilization}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-sm text-[10px] font-label-md text-on-surface-variant">
              {workloadTrend.map((point) => (
                <span key={point.day}>{point.day}</span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-lg">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-md">
          Transfer Candidates
        </h3>
        <p className="font-body-sm text-body-sm text-secondary mb-lg">
          Tasks held by over-capacity members, paired with the best available teammate.
        </p>
        {overloadedTasks.length === 0 ? (
          <p className="font-body-sm text-body-sm text-secondary">
            Nobody is above capacity — no transfers required.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
            {overloadedTasks.map(({ task, member }) => {
              const best = members
                .filter((m) => m.id !== member.id)
                .map((m) => ({ member: m, fit: calculateFitScore(m, task).fitScore }))
                .sort((a, b) => b.fit - a.fit)[0];
              return (
                <div
                  key={task.id}
                  className="border border-outline-variant rounded-lg p-md flex flex-col gap-sm"
                >
                  <div className="flex items-center gap-sm">
                    <Avatar member={member} size="sm" />
                    <Icon name="arrow_forward" className="text-secondary text-[18px]" />
                    {best ? <Avatar member={best.member} size="sm" /> : null}
                    <span className="ml-auto font-label-md text-label-md text-primary">
                      {best ? `${Math.round(best.fit * 100)}%` : "—"}
                    </span>
                  </div>
                  <p className="font-label-md text-label-md text-on-surface">{task.title}</p>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {task.estimatedHours}h · currently with {member.name}
                    {best ? ` · best fit ${best.member.name}` : ""}
                  </p>
                  <Chip tone="outline">{task.priority}</Chip>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={dialog === "autobalance"}
        onClose={closeDialog}
        title="Auto-Balance Workload"
        description="Review the transfers before applying them."
        icon="auto_awesome"
        size="lg"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button
              variant="primary"
              onClick={applyAll}
              disabled={proposals.length === 0}
              className={proposals.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
            >
              {proposals.length === 0
                ? "Nothing to rebalance"
                : `Apply ${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`}
            </Button>
          </ModalActions>
        }
      >
        {proposals.length === 0 ? (
          <p className="font-body-sm text-body-sm text-secondary">
            Nothing to rebalance. Reassignments are proposed when backlog tasks match underutilized members or when overloaded members (&gt;100% capacity) can transfer hours to available teammates.
          </p>
        ) : (
          <ul className="flex flex-col gap-md">
            {proposals.map((proposal) => {
              const ml = mlProposalScores[proposal.id];
              const recCap = proposal.to.capacityHours || 40;
              const recBefore = Math.round(((proposal.to.currentAllocatedHours ?? 0) / recCap) * 100);
              const recAfter = Math.round((((proposal.to.currentAllocatedHours ?? 0) + proposal.hours) / recCap) * 100);

              let donorBefore = null;
              let donorAfter = null;
              if (proposal.from) {
                const donCap = proposal.from.capacityHours || 40;
                donorBefore = Math.round(((proposal.from.currentAllocatedHours ?? 0) / donCap) * 100);
                donorAfter = Math.round((((proposal.from.currentAllocatedHours ?? 0) - proposal.hours) / donCap) * 100);
              }

              return (
                <li
                  key={proposal.id}
                  className="p-md border border-outline-variant rounded-lg bg-surface-container-low/50 space-y-sm"
                >
                  <div className="flex items-center justify-between gap-md">
                    <div className="flex items-center gap-xs">
                      <span className="font-label-md text-label-md text-on-surface">
                        {proposal.task.title}
                      </span>
                      <Chip tone={proposal.type === "assign" ? "primary" : "neutral"} className="text-[10px] py-0 px-1.5">
                        {proposal.type === "assign" ? "Assign" : "Transfer"}
                      </Chip>
                    </div>
                    <span className="font-label-md text-label-md text-primary flex-shrink-0">
                      {proposal.hours}h
                    </span>
                  </div>

                  <div className="flex items-center gap-sm flex-wrap text-body-sm text-secondary">
                    <span>{proposal.from ? proposal.from.name : "Unassigned Backlog"}</span>
                    <Icon name="arrow_forward" className="text-[14px]" />
                    <span className="font-medium text-on-surface">{proposal.to.name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="font-mono text-xs text-secondary">
                        Heur: {Math.round(proposal.fitScore * 100)}%
                      </span>
                      {ml ? (
                        <span className="font-mono text-xs font-bold text-primary">
                          ML Quality: {ml.qualityScore}% ({Math.round(ml.onTimeProbability * 100)}% on-time)
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Predicted Before / After Impact */}
                  <div className="pt-xs border-t border-outline-variant/60 flex items-center gap-3 text-[11px] font-mono flex-wrap">
                    <span className="text-secondary">Predicted Impact:</span>
                    {proposal.from && (
                      <span className="text-secondary">
                        Donor: <span className="text-error font-bold">{donorBefore}%</span> &rarr;{" "}
                        <span className="text-primary font-bold">{donorAfter}%</span>
                      </span>
                    )}
                    <span className="text-secondary">
                      Receiver: <span className="text-secondary font-bold">{recBefore}%</span> &rarr;{" "}
                      <span className="text-emerald-700 font-bold">{recAfter}% (Healthy)</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </main>
  );
}
