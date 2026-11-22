import { useMemo, useState } from "react";
import { useTeamContext } from "../context/TeamContext";
import {
  Avatar,
  Card,
  CardHeader,
  Chip,
  Icon,
  KpiCard,
  SectionHeading,
  UtilizationBar,
} from "../components/ui";
import {
  calculateBurnoutRisk,
  calculateFitScore,
  calculateWorkloadUtilization,
  rankCandidates,
  skillCoverage,
  teamMetrics,
} from "../utils/scoring";
import { predictBurnout, predictTaskFit } from "../services/mlModel";

const roleFilterOptions = ["All Roles", "Backend", "Frontend", "Platform", "Data", "DevOps"];
const priorityFilterOptions = ["All Priorities", "Critical", "High", "Medium", "Low"];

export default function Reports() {
  const { members, tasks } = useTeamContext();
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [priorityFilter, setPriorityFilter] = useState("All Priorities");

  // Metrics from scoring engine
  const metrics = useMemo(() => teamMetrics(members, tasks), [members, tasks]);
  const coverage = useMemo(() => skillCoverage(members), [members]);

  // Filter members by role
  const filteredMembers = useMemo(() => {
    if (roleFilter === "All Roles") return members;
    return members.filter((m) => m.role.toLowerCase().includes(roleFilter.toLowerCase()));
  }, [members, roleFilter]);

  // Filter tasks by priority and assignee role
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchPriority = priorityFilter === "All Priorities" || task.priority === priorityFilter;
      if (!matchPriority) return false;
      if (roleFilter === "All Roles") return true;
      if (!task.assignedMemberId) return true;
      const assignee = members.find((m) => m.id === task.assignedMemberId);
      return assignee ? assignee.role.toLowerCase().includes(roleFilter.toLowerCase()) : true;
    });
  }, [tasks, members, priorityFilter, roleFilter]);

  // Burnout tier lists
  const burnoutBreakdown = useMemo(() => {
    const high = [];
    const medium = [];
    const low = [];

    filteredMembers.forEach((member) => {
      const { utilization } = calculateWorkloadUtilization(member);
      const risk = calculateBurnoutRisk(member);
      const row = { member, utilization, ...risk };
      if (risk.riskTier === "High") high.push(row);
      else if (risk.riskTier === "Medium") medium.push(row);
      else low.push(row);
    });

    return { high, medium, low };
  }, [filteredMembers]);

  // Task status & priority distribution
  const taskDistribution = useMemo(() => {
    const byStatus = { assigned: 0, unassigned: 0 };
    const byPriority = { Critical: 0, High: 0, Medium: 0, Low: 0 };

    filteredTasks.forEach((t) => {
      if (t.assignedMemberId) byStatus.assigned++;
      else byStatus.unassigned++;
      if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
    });

    return { byStatus, byPriority };
  }, [filteredTasks]);

  // Assignment quality table rows with alternative candidate ranking
  const assignmentRows = useMemo(() => {
    return filteredTasks.map((task) => {
      const assignee = members.find((m) => m.id === task.assignedMemberId);
      const currentFit = assignee ? calculateFitScore(assignee, task) : null;
      const currentMlFit = assignee ? predictTaskFit(assignee, task, members, tasks) : null;

      // Rank all members as candidates
      const ranked = rankCandidates(task, members);
      const topCandidate = ranked[0] ?? null;
      const topCandidateMlFit = topCandidate ? predictTaskFit(topCandidate.member, task, members, tasks) : null;
      const isTopFit = assignee && topCandidate ? assignee.id === topCandidate.member.id : false;

      return {
        task,
        assignee,
        currentFitScore: currentFit ? Math.round(currentFit.fitScore * 100) : null,
        currentMlQuality: currentMlFit ? currentMlFit.mlQuality : null,
        currentMlOnTimeProb: currentMlFit ? Math.round(currentMlFit.mlOnTimeProb * 100) : null,
        topCandidate: topCandidate
          ? {
              member: topCandidate.member,
              fitScore: Math.round(topCandidate.fitScore * 100),
              mlQuality: topCandidateMlFit ? topCandidateMlFit.mlQuality : null,
              mlOnTimeProb: topCandidateMlFit ? Math.round(topCandidateMlFit.mlOnTimeProb * 100) : null,
            }
          : null,
        isTopFit,
      };
    });
  }, [filteredTasks, members, tasks]);

  const mlReportStats = useMemo(() => {
    const assigned = assignmentRows.filter((r) => r.assignee);
    const avgMlQuality = assigned.length > 0
      ? Math.round(assigned.reduce((acc, r) => acc + (r.currentMlQuality ?? 0), 0) / assigned.length)
      : 0;
    const avgOnTime = assigned.length > 0
      ? Math.round(assigned.reduce((acc, r) => acc + (r.currentMlOnTimeProb ?? 0), 0) / assigned.length)
      : 0;
    const elevatedBurnoutMembers = filteredMembers.filter((m) => predictBurnout(m, members, tasks).isElevated).length;

    return {
      avgMlQuality,
      avgOnTime,
      elevatedBurnoutMembers,
      assignedCount: assigned.length,
    };
  }, [assignmentRows, filteredMembers, members, tasks]);

  // Client-side CSV export
  const exportCsv = () => {
    const headers = [
      "Task ID",
      "Title",
      "Priority",
      "Estimated Hours",
      "Status",
      "Assignee",
      "Assignee Fit Score",
      "Assignee ML Quality (0-100)",
      "Assignee ML On-Time %",
      "Top Candidate",
      "Top Candidate Fit Score",
      "Top Candidate ML Quality",
      "Top Candidate ML On-Time %",
      "Optimal Alignment",
    ];

    const rows = assignmentRows.map((r) => [
      `"${r.task.id}"`,
      `"${r.task.title.replace(/"/g, '""')}"`,
      `"${r.task.priority}"`,
      r.task.estimatedHours,
      `"${r.task.assignedMemberId ? "Assigned" : "Unassigned"}"`,
      `"${r.assignee ? r.assignee.name : "None"}"`,
      r.currentFitScore !== null ? `${r.currentFitScore}%` : "N/A",
      r.currentMlQuality !== null ? r.currentMlQuality : "N/A",
      r.currentMlOnTimeProb !== null ? `${r.currentMlOnTimeProb}%` : "N/A",
      `"${r.topCandidate ? r.topCandidate.member.name : "None"}"`,
      r.topCandidate ? `${r.topCandidate.fitScore}%` : "N/A",
      r.topCandidate && r.topCandidate.mlQuality !== null ? r.topCandidate.mlQuality : "N/A",
      r.topCandidate && r.topCandidate.mlOnTimeProb !== null ? `${r.topCandidate.mlOnTimeProb}%` : "N/A",
      r.task.assignedMemberId ? (r.isTopFit ? "Optimal" : "Suboptimal") : "Unassigned",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `equilibrium-ops-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main tabIndex={0} aria-label="Executive Reports" className="flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop custom-scrollbar space-y-xl outline-none">
      {/* Scoped print styles hiding navigation & toolbars */}
      <style>{`
        @media print {
          nav, aside, header, .no-print, button, select {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            background: #ffffff !important;
          }
          .card-border {
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Header and Actions */}
      <SectionHeading
        title="Executive Operations Report"
        description="Consolidated capacity telemetry, burnout exposure, and assignment quality metrics."
        actions={
          <div className="flex flex-wrap items-center gap-sm no-print">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant hover:bg-surface-container text-body-sm font-label-md text-primary transition-colors shadow-sm"
              title="Download assignment table as CSV"
            >
              <Icon name="download" className="text-[18px]" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-on-primary hover:bg-primary text-body-sm font-label-md transition-colors shadow-sm"
              title="Print or save as PDF"
            >
              <Icon name="print" className="text-[18px]" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-md p-md rounded-card bg-surface border border-outline-variant/60 no-print">
        <div className="flex items-center gap-sm">
          <Icon name="filter_list" className="text-secondary text-[20px]" />
          <span className="font-label-md text-label-md text-secondary uppercase tracking-wider text-xs">
            Filters:
          </span>
        </div>

        <div className="flex items-center gap-xs">
          <label htmlFor="role-filter" className="font-body-sm text-xs text-secondary">
            Role:
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-body-sm text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary-container"
          >
            {roleFilterOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-xs">
          <label htmlFor="priority-filter" className="font-body-sm text-xs text-secondary">
            Priority:
          </label>
          <select
            id="priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-body-sm text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary-container"
          >
            {priorityFilterOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {(roleFilter !== "All Roles" || priorityFilter !== "All Priorities") && (
          <button
            type="button"
            onClick={() => {
              setRoleFilter("All Roles");
              setPriorityFilter("All Priorities");
            }}
            className="text-xs font-label-md text-error hover:underline ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* 1. 6-Card KPI Row */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Operations Key Performance Indicators
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-md">
          <KpiCard
            label="Total Capacity"
            value={`${metrics.totalCapacity}h`}
            icon="battery_charging_full"
            tone="neutral"
            delta={`${metrics.totalMembers} engineers`}
          />
          <KpiCard
            label="Current Utilization"
            value={`${Math.round(metrics.utilization * 100)}%`}
            icon="trending_up"
            tone={metrics.utilization > 1 ? "danger" : metrics.utilization >= 0.85 ? "warning" : "positive"}
            delta={`${metrics.totalAllocated}h allocated`}
          />
          <KpiCard
            label="Overloaded Members"
            value={metrics.overloaded.length}
            icon="warning"
            tone={metrics.overloaded.length > 0 ? "danger" : "positive"}
            delta={metrics.overloaded.length > 0 ? "Requires rebalance" : "Healthy distribution"}
          />
          <KpiCard
            label="High Risk Alerts"
            value={metrics.highRisk.length}
            icon="error"
            tone={metrics.highRisk.length > 0 ? "danger" : "neutral"}
            delta={metrics.highRisk.length > 0 ? "Sustained overload" : "No critical streaks"}
          />
          <KpiCard
            label="Unassigned Tasks"
            value={metrics.unassigned.length}
            icon="assignment_late"
            tone={metrics.unassigned.length > 0 ? "warning" : "positive"}
            delta={`${metrics.totalTasks} total tasks`}
          />
          <KpiCard
            label="Avg Fit Score"
            value={`${Math.round(metrics.avgFit * 100)}%`}
            icon="verified"
            tone={metrics.avgFit >= 0.8 ? "positive" : "neutral"}
            delta="Skill & availability match"
          />
        </div>
      </section>

      {/* 1b. ML Model Telemetry & Audit Banner */}
      <Card className="p-lg bg-surface border-primary-container/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md pb-sm border-b border-outline-variant/40">
          <div>
            <div className="flex items-center gap-xs">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-container/10 text-primary-container border border-primary-container/30">
                <Icon name="psychology" className="text-[14px]" />
                ML Telemetry Breakdown
              </span>
              <span className="text-xs text-secondary font-label-md">
                In-browser Gradient Boosting · Latency median 0.010ms (p95 0.028ms)
              </span>
            </div>
            <h3 className="font-headline-sm text-sm font-bold text-primary mt-1">
              Predictive Assignment & Risk Intelligence
            </h3>
          </div>
          <div className="text-[11px] text-secondary font-body-sm italic">
            Synthetic demo telemetry (10k samples, GroupShuffleSplit 70/15/15)
          </div>
        </div>

        <div className="mt-md grid grid-cols-1 md:grid-cols-3 gap-md">
          <div className="p-md rounded-lg bg-surface-container-low border border-outline-variant/40">
            <span className="text-xs text-secondary uppercase font-bold tracking-wider font-label-md">
              Avg ML Predicted Quality
            </span>
            <div className="mt-1 flex items-baseline gap-xs">
              <span className="text-xl font-bold font-headline-sm text-primary">
                {mlReportStats.avgMlQuality}
              </span>
              <span className="text-xs text-secondary">/ 100</span>
            </div>
            <p className="text-[11px] text-secondary mt-1 font-body-sm">
              Across {mlReportStats.assignedCount} assigned sprint tasks (test R² = 0.798)
            </p>
          </div>

          <div className="p-md rounded-lg bg-surface-container-low border border-outline-variant/40">
            <span className="text-xs text-secondary uppercase font-bold tracking-wider font-label-md">
              Predicted On-Time Likelihood
            </span>
            <div className="mt-1 flex items-baseline gap-xs">
              <span className="text-xl font-bold font-headline-sm text-primary">
                {mlReportStats.avgOnTime}%
              </span>
            </div>
            <p className="text-[11px] text-secondary mt-1 font-body-sm">
              Evaluated against complexity and schedule headroom (ROC-AUC = 0.845)
            </p>
          </div>

          <div className="p-md rounded-lg bg-surface-container-low border border-outline-variant/40">
            <span className="text-xs text-secondary uppercase font-bold tracking-wider font-label-md">
              ML Elevated Burnout Risk
            </span>
            <div className="mt-1 flex items-baseline gap-xs">
              <span className="text-xl font-bold font-headline-sm text-primary">
                {mlReportStats.elevatedBurnoutMembers}
              </span>
              <span className="text-xs text-secondary">/ {filteredMembers.length} engineers</span>
            </div>
            <p className="text-[11px] text-secondary mt-1 font-body-sm">
              Model threshold P &ge; 0.33 (ROC-AUC = 0.898, Recall = 66.5%)
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Workload Distribution Per Member */}
      <Card className="p-lg">
        <CardHeader
          title="Workload Distribution Per Member"
          subtitle={`Showing capacity utilization for ${filteredMembers.length} team members`}
          icon="groups"
        />

        <div className="mt-md divide-y divide-outline-variant/50">
          {filteredMembers.length === 0 ? (
            <div className="py-xl text-center text-secondary font-body-sm">
              No team members match the selected filter.
            </div>
          ) : (
            filteredMembers.map((member) => {
              const { utilization, status } = calculateWorkloadUtilization(member);
              const pct = Math.round(utilization * 100);
              const tone = status === "overloaded" ? "danger" : status === "underutilized" ? "warning" : "healthy";

              return (
                <div key={member.id} className="py-md flex flex-col md:flex-row md:items-center justify-between gap-md">
                  <div className="flex items-center gap-md min-w-[220px]">
                    <Avatar member={member} size="sm" />
                    <div>
                      <span className="font-headline-sm text-sm font-semibold text-primary block leading-tight">
                        {member.name}
                      </span>
                      <span className="font-body-sm text-xs text-secondary block mt-0.5">{member.role}</span>
                    </div>
                  </div>

                  <div className="flex-1 max-w-md space-y-1">
                    <div className="flex justify-between items-center text-xs font-label-md">
                      <span className="text-secondary">
                        {member.currentAllocatedHours}h / {member.capacityHours}h capacity
                      </span>
                      <span
                        className={`font-bold ${
                          tone === "danger"
                            ? "text-error"
                            : tone === "warning"
                            ? "text-[#8C6A1D]"
                            : "text-primary-container"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <UtilizationBar utilization={utilization} />
                  </div>

                  <div className="flex items-center gap-sm">
                    <Chip
                      tone={status === "overloaded" ? "high" : status === "underutilized" ? "medium" : "low"}
                    >
                      {status.toUpperCase()}
                    </Chip>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* 3 & 4. Burnout Tier Breakdown & Task Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Burnout Tier Breakdown */}
        <Card className="p-lg">
          <CardHeader
            title="Burnout Tier Breakdown"
            subtitle="Calculated from sustained capacity overage and consecutive peak weeks"
            icon="psychiatry"
          />

          <div className="mt-md space-y-md">
            {/* High Risk Tier */}
            <div className="p-md rounded-xl bg-error-container/20 border border-error-container">
              <div className="flex items-center justify-between mb-sm">
                <div className="flex items-center gap-sm">
                  <Icon name="error" className="text-error text-[20px]" />
                  <span className="font-headline-sm text-sm font-bold text-error">High Risk Tier</span>
                </div>
                <span className="font-label-md text-xs font-bold text-error">
                  {burnoutBreakdown.high.length} Members
                </span>
              </div>
              {burnoutBreakdown.high.length === 0 ? (
                <p className="text-xs text-secondary font-body-sm">No members currently in the high-risk bracket.</p>
              ) : (
                <ul className="divide-y divide-error-container/40 text-xs">
                  {burnoutBreakdown.high.map(({ member, overage }) => (
                    <li key={member.id} className="py-1.5 flex items-center justify-between">
                      <span className="font-semibold text-primary">{member.name}</span>
                      <span className="text-error font-label-md">
                        +{Math.round(overage * 100)}% over capacity ({member.currentAllocatedHours}h/
                        {member.capacityHours}h)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Medium Risk Tier */}
            <div className="p-md rounded-xl bg-[#FAF0D7] border border-[#E8D49E]">
              <div className="flex items-center justify-between mb-sm">
                <div className="flex items-center gap-sm">
                  <Icon name="warning" className="text-[#8C6A1D] text-[20px]" />
                  <span className="font-headline-sm text-sm font-bold text-[#8C6A1D]">Medium Risk Tier</span>
                </div>
                <span className="font-label-md text-xs font-bold text-[#8C6A1D]">
                  {burnoutBreakdown.medium.length} Members
                </span>
              </div>
              {burnoutBreakdown.medium.length === 0 ? (
                <p className="text-xs text-secondary font-body-sm">No members in the medium risk tier.</p>
              ) : (
                <ul className="divide-y divide-[#E8D49E]/50 text-xs">
                  {burnoutBreakdown.medium.map(({ member, overage }) => (
                    <li key={member.id} className="py-1.5 flex items-center justify-between">
                      <span className="font-semibold text-primary">{member.name}</span>
                      <span className="text-[#8C6A1D] font-label-md">
                        +{Math.round(overage * 100)}% overage
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Low Risk Tier */}
            <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant">
              <div className="flex items-center justify-between mb-sm">
                <div className="flex items-center gap-sm">
                  <Icon name="check_circle" className="text-primary-container text-[20px]" />
                  <span className="font-headline-sm text-sm font-bold text-primary">Low Risk Tier</span>
                </div>
                <span className="font-label-md text-xs font-bold text-primary">
                  {burnoutBreakdown.low.length} Members
                </span>
              </div>
              <p className="text-xs text-secondary font-body-sm">
                {burnoutBreakdown.low.length} engineers have balanced workloads with zero sustained overage.
              </p>
            </div>
          </div>
        </Card>

        {/* Task Breakdown By Status and Priority */}
        <Card className="p-lg">
          <CardHeader
            title="Task Distribution & Priority"
            subtitle={`Aggregates across ${filteredTasks.length} tasks`}
            icon="assignment"
          />

          <div className="mt-md space-y-lg">
            {/* Status breakdown */}
            <div>
              <h4 className="font-label-md text-xs font-bold uppercase tracking-wider text-secondary mb-sm">
                Assignment Status
              </h4>
              <div className="grid grid-cols-2 gap-md">
                <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-between">
                  <div>
                    <span className="text-xs text-secondary block font-body-sm">Assigned Tasks</span>
                    <span className="font-headline-md text-xl font-bold text-primary block mt-0.5">
                      {taskDistribution.byStatus.assigned}
                    </span>
                  </div>
                  <Icon name="assignment_turned_in" className="text-primary text-[24px]" />
                </div>
                <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-between">
                  <div>
                    <span className="text-xs text-secondary block font-body-sm">Unassigned Backlog</span>
                    <span className="font-headline-md text-xl font-bold text-error block mt-0.5">
                      {taskDistribution.byStatus.unassigned}
                    </span>
                  </div>
                  <Icon name="assignment_late" className="text-error text-[24px]" />
                </div>
              </div>
            </div>

            {/* Priority breakdown */}
            <div>
              <h4 className="font-label-md text-xs font-bold uppercase tracking-wider text-secondary mb-sm">
                Priority Breakdown
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
                <div className="p-sm rounded-lg bg-error-container/20 border border-error-container text-center">
                  <span className="font-label-md text-[11px] text-error uppercase block">Critical</span>
                  <span className="font-headline-sm text-lg font-bold text-error block mt-1">
                    {taskDistribution.byPriority.Critical}
                  </span>
                </div>
                <div className="p-sm rounded-lg bg-[#FAF0D7] border border-[#E8D49E] text-center">
                  <span className="font-label-md text-[11px] text-[#8C6A1D] uppercase block">High</span>
                  <span className="font-headline-sm text-lg font-bold text-[#8C6A1D] block mt-1">
                    {taskDistribution.byPriority.High}
                  </span>
                </div>
                <div className="p-sm rounded-lg bg-surface-container border border-outline-variant text-center">
                  <span className="font-label-md text-[11px] text-secondary uppercase block">Medium</span>
                  <span className="font-headline-sm text-lg font-bold text-primary block mt-1">
                    {taskDistribution.byPriority.Medium}
                  </span>
                </div>
                <div className="p-sm rounded-lg bg-surface-container border border-outline-variant text-center">
                  <span className="font-label-md text-[11px] text-secondary uppercase block">Low</span>
                  <span className="font-headline-sm text-lg font-bold text-primary block mt-1">
                    {taskDistribution.byPriority.Low}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 5. Assignment Quality Table */}
      <Card className="p-lg">
        <CardHeader
          title="Assignment Quality & Fit Audit"
          subtitle="Compares current assignees with algorithmic top candidate matches to identify misalignments"
          icon="verified"
        />

        <div tabIndex={0} role="region" aria-label="Task Allocations Table" className="mt-md overflow-x-auto outline-none">
          <table className="w-full text-left border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant font-label-md text-xs text-secondary uppercase tracking-wider">
                <th className="pb-sm pr-md">Task</th>
                <th className="pb-sm px-md">Priority</th>
                <th className="pb-sm px-md">Hours</th>
                <th className="pb-sm px-md">Current Assignee</th>
                <th className="pb-sm px-md">Fit Score</th>
                <th className="pb-sm px-md">Top Candidate Match</th>
                <th className="pb-sm pl-md">Quality Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {assignmentRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-lg text-center text-secondary">
                    No tasks found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                assignmentRows.map(({ task, assignee, currentFitScore, currentMlQuality, currentMlOnTimeProb, topCandidate, isTopFit }) => (
                  <tr key={task.id} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="py-md pr-md">
                      <span className="font-semibold text-primary block leading-tight">{task.title}</span>
                      <span className="text-xs text-secondary block mt-0.5">
                        {task.requiredSkills.join(", ")}
                      </span>
                    </td>
                    <td className="py-md px-md">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-label-md ${
                          task.priority === "Critical"
                            ? "bg-error text-on-error"
                            : task.priority === "High"
                            ? "bg-error-container text-error"
                            : "bg-surface-container text-secondary"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-md px-md font-label-md text-secondary">{task.estimatedHours}h</td>
                    <td className="py-md px-md">
                      {assignee ? (
                        <div className="flex items-center gap-xs">
                          <Avatar member={assignee} size="xs" />
                          <span className="font-medium text-primary text-xs">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-error font-medium italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-md px-md">
                      {currentFitScore !== null ? (
                        <div>
                          <span className="font-label-md font-bold text-primary">{currentFitScore}%</span>
                          {currentMlQuality !== null && (
                            <span className="text-[10px] text-secondary block font-mono leading-tight">
                              ML: {currentMlQuality}/100 · {currentMlOnTimeProb}% on-time
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-secondary font-label-md">N/A</span>
                      )}
                    </td>
                    <td className="py-md px-md">
                      {topCandidate ? (
                        <div className="flex items-center gap-xs">
                          <Avatar member={topCandidate.member} size="xs" />
                          <div>
                            <span className="font-medium text-primary text-xs block leading-tight">
                              {topCandidate.member.name}
                            </span>
                            <span className="font-label-md text-[10px] text-secondary block">
                              {topCandidate.fitScore}% Match {topCandidate.mlQuality !== null ? `· ML: ${topCandidate.mlQuality}/100` : ""}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-secondary">None</span>
                      )}
                    </td>
                    <td className="py-md pl-md">
                      {!assignee ? (
                        <Chip tone="medium" icon="help">
                          Needs Owner
                        </Chip>
                      ) : isTopFit ? (
                        <Chip tone="low" icon="check">
                          Top Match
                        </Chip>
                      ) : (
                        <Chip tone="high" icon="shuffle">
                          Suboptimal Fit
                        </Chip>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 6. Skill Coverage Gaps */}
      <Card className="p-lg">
        <CardHeader
          title="Skill Coverage & Single Points of Failure"
          subtitle="Identifies competencies at risk with fewer than 2 expert holders"
          icon="troubleshoot"
        />

        <div className="mt-md grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-md">
          {coverage.map((item) => (
            <div
              key={item.skill}
              className={`p-md rounded-xl border flex flex-col justify-between ${
                item.singlePointOfFailure
                  ? "bg-error-container/20 border-error-container"
                  : "bg-surface-container-lowest border-outline-variant"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-sm mb-xs">
                  <h4 className="font-headline-sm text-sm font-bold text-primary">{item.skill}</h4>
                  {item.singlePointOfFailure ? (
                    <span className="text-[10px] font-label-md bg-error text-on-error px-1.5 py-0.5 rounded uppercase font-bold">
                      Bus Factor 1
                    </span>
                  ) : (
                    <span className="text-[10px] font-label-md bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded">
                      Covered
                    </span>
                  )}
                </div>
                <p className="text-xs text-secondary font-body-sm">
                  {item.expertCount} expert{item.expertCount === 1 ? "" : "s"} (Proficiency &ge; 4)
                </p>
              </div>

              <div className="mt-md pt-sm border-t border-outline-variant/60 flex items-center justify-between text-xs font-label-md">
                <span className="text-secondary">Top Proficiency:</span>
                <span className="font-bold text-primary">{item.best} / 5</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
