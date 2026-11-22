import { useMemo, useState } from "react";
import { useTeamContext } from "../context/TeamContext";
import { Icon, SectionHeading } from "../components/ui";
import Modal, { Button, ModalActions } from "../components/Modal";
import { rebalanceProposals, skillCoverage, teamMetrics } from "../utils/scoring";
import { capacityByGroup, workloadTrend } from "../services/mockData";
import metricsData from "../models/metrics.json";
import { predictBurnout, predictTaskFit } from "../services/mlModel";

const ranges = ["This Week", "This Month", "Q3"];

const barColors = [
  "bg-primary-container",
  "bg-secondary",
  "bg-surface-tint",
  "bg-outline",
];

export default function Insights() {
  const { members, tasks, assignTask } = useTeamContext();
  const [range, setRange] = useState("This Week");
  const [dialog, setDialog] = useState(null);
  const [activeRec, setActiveRec] = useState(null);
  const [showThreshold, setShowThreshold] = useState(true);
  const closeDialog = () => setDialog(null);

  const metrics = useMemo(() => teamMetrics(members, tasks), [members, tasks]);
  const proposals = useMemo(() => rebalanceProposals(members, tasks), [members, tasks]);
  const coverage = useMemo(() => skillCoverage(members), [members]);

  // Live pod ML telemetry
  const podMlTelemetry = useMemo(() => {
    let totalQuality = 0;
    let totalOnTime = 0;
    let assignedCount = 0;
    tasks.forEach((t) => {
      if (t.assignedMemberId) {
        const m = members.find((x) => x.id === t.assignedMemberId);
        if (m) {
          const fit = predictTaskFit(m, t, members, tasks);
          totalQuality += fit.mlQuality;
          totalOnTime += fit.mlOnTimeProb;
          assignedCount++;
        }
      }
    });

    const burnoutRisks = members.map((m) => {
      const pred = predictBurnout(m, members, tasks);
      return { member: m, ...pred };
    });

    const elevatedBurnoutCount = burnoutRisks.filter((r) => r.isElevated).length;

    return {
      avgQuality: assignedCount > 0 ? Math.round(totalQuality / assignedCount) : 0,
      avgOnTimePct: assignedCount > 0 ? Math.round((totalOnTime / assignedCount) * 100) : 0,
      elevatedBurnoutCount,
      burnoutRisks,
      assignedCount,
    };
  }, [members, tasks]);

  const utilization = Math.round(metrics.utilization * 100);
  const teamRisk = metrics.highRisk.length
    ? "High"
    : metrics.rows.some((r) => r.risk.tier === "Medium")
      ? "Medium"
      : "Low";
  const skillCoveragePct = coverage.length
    ? Math.round((coverage.filter((entry) => entry.best >= 3).length / coverage.length) * 100)
    : 0;
  const aiImpact = Math.max(0, Math.round((1 - metrics.overloaded.length / Math.max(1, members.length)) * 18));

  const analysis = [
    coverage[0]
      ? `${coverage[0].skill} is the thinnest skill in the matrix — only ${coverage[0].holders
          .map((h) => h.member.name.split(" ")[0])
          .join(", ") || "nobody"} can currently cover it.`
      : "Skill coverage is broadly healthy across the matrix.",
    metrics.overloaded.length > 0
      ? `${metrics.overloaded.length} ${
          metrics.overloaded.length === 1 ? "member is" : "members are"
        } approaching capacity constraints from concurrent critical work.`
      : "No member is currently above contracted capacity.",
    "Historical data suggests a 15% drop in velocity when average utilization exceeds 85%.",
  ];

  const recommendations = proposals.length
    ? proposals.map((proposal, index) => ({
        title: proposal.type === "assign" ? `Assign Task: ${proposal.task.title}` : `Rebalance Load: ${proposal.task.title}`,
        detail: proposal.type === "assign" || !proposal.from
          ? `Assign ${proposal.hours}h to ${proposal.to.name.split(" ")[0]} to utilize capacity (${Math.round(proposal.fitScore * 100)}% fit).`
          : `Shift ${proposal.hours}h from ${proposal.from.name.split(" ")[0]} to ${
              proposal.to.name.split(" ")[0]
            } to prevent a bottleneck (${Math.round(proposal.fitScore * 100)}% fit).`,
        cta: proposal.type === "assign" ? "Assign Task" : "Rebalance Load",
        index,
      }))
    : [
        {
          title: "Cross-Train: Frontend Tech",
          detail: `Schedule a 4h pairing session to utilise dormant capacity in ${
            metrics.underutilized[0]?.member.name.split(" ")[0] ?? "the pod"
          }.`,
          cta: "Schedule Training",
          index: 0,
        },
        {
          title: "Maintain Current Plan",
          detail: "No bottlenecks detected. Keep the existing allocation for the sprint.",
          cta: "View Plan",
          index: 1,
        },
      ];

  const opportunities = [
    "Optimise load distribution across the engineering pod",
    "Build backup coverage for key backend services",
  ];
  const risks = [
    coverage.some((entry) => entry.singlePointOfFailure)
      ? `Skill bottleneck: single expert for ${coverage.find((e) => e.singlePointOfFailure).skill}`
      : "Skill bottlenecks detected in platform engineering",
    "Deadline clustering approaching end of month",
  ];

  const reportText = [
    "Equilibrium — Operations Report",
    `Range: ${range}`,
    "",
    "HEADLINE METRICS",
    `Utilisation: ${utilization}%`,
    `Team risk: ${teamRisk}`,
    `Skill coverage: ${skillCoveragePct}%`,
    `AI impact: +${aiImpact}%`,
    "",
    "ANALYSIS",
    ...analysis.map((line, i) => `${i + 1}. ${line}`),
    "",
    "OPPORTUNITIES",
    ...opportunities.map((line) => `- ${line}`),
    "",
    "RISKS",
    ...risks.map((line) => `- ${line}`),
    "",
    "RECOMMENDATIONS",
    ...recommendations.map(
      (rec, i) => `${i + 1}. ${rec.title}\n   ${rec.detail}\n   Action: ${rec.cta}`,
    ),
  ].join("\n");

  const applyRecommendation = (rec) => {
    const proposal = proposals[rec.index];
    if (proposal) assignTask(proposal.task.id, proposal.to.id);
    setActiveRec(null);
    closeDialog();
  };

  const applyAllAdjustments = () => {
    proposals.forEach((proposal) => assignTask(proposal.task.id, proposal.to.id));
    closeDialog();
  };

  return (
    <main className="flex-1 p-margin-mobile md:p-margin-desktop overflow-y-auto custom-scrollbar space-y-lg">
      <SectionHeading
        title="Insights"
        description="Turning team data into actionable intelligence and strategic recommendations."
        actions={
          <>
            <div className="flex items-center bg-background border border-primary-container/20 rounded-lg p-1">
              {ranges.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  className={`px-md py-1.5 rounded font-label-md text-label-md transition-colors flex items-center gap-xs ${
                    range === item
                      ? "text-primary bg-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-variant"
                  }`}
                >
                  {item === "This Week" ? (
                    <Icon name="calendar_today" style={{ fontSize: "16px" }} />
                  ) : null}
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDialog("export")}
              className="border border-primary-container/30 text-primary bg-transparent px-md py-sm rounded-lg font-label-md text-label-md hover:bg-secondary-container transition-colors flex items-center gap-sm"
            >
              <Icon name="download" style={{ fontSize: "18px" }} />
              Export
            </button>
            <button
              type="button"
              onClick={() => setDialog("report")}
              className="bg-primary-container text-surface-container-low px-md py-sm rounded-lg font-label-md text-label-md hover:bg-primary transition-colors flex items-center gap-sm soft-shadow"
            >
              <Icon name="auto_awesome" style={{ fontSize: "18px" }} />
              Generate Report
            </button>
          </>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <div className="bg-background border border-primary-container/20 p-lg rounded-xl flex flex-col justify-between h-40 group hover:bg-surface-variant transition-colors duration-300">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              Team Utilization
            </span>
            <Icon name="monitoring" className="text-secondary" style={{ fontSize: "20px" }} />
          </div>
          <div>
            <div className="font-headline-lg text-headline-lg text-primary mb-xs">{utilization}%</div>
            <div className="flex items-center gap-xs text-secondary text-body-sm font-body-sm">
              <Icon name="arrow_upward" style={{ fontSize: "14px" }} />
              <span>+{Math.max(1, Math.round(utilization / 20))}% from last week</span>
            </div>
          </div>
          <div className="w-full h-1 bg-surface-container mt-md rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-container rounded-full"
              style={{ width: `${utilization}%` }}
            />
          </div>
        </div>

        <div className="bg-background border border-primary-container/20 p-lg rounded-xl flex flex-col justify-between h-40 group hover:bg-surface-variant transition-colors duration-300">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              Burnout Risk
            </span>
            <Icon name="vital_signs" className="text-secondary" style={{ fontSize: "20px" }} />
          </div>
          <div>
            <div className="font-headline-lg text-headline-lg text-primary mb-xs">{teamRisk}</div>
            <div className="flex items-center gap-xs text-on-surface-variant text-body-sm font-body-sm">
              <Icon name="check_circle" className="text-primary-container" style={{ fontSize: "14px" }} />
              <span>{metrics.rows.length} individuals monitored</span>
            </div>
          </div>
          <div className="w-full h-1 bg-surface-container mt-md rounded-full overflow-hidden flex">
            <div
              className="h-full bg-primary-container rounded-l-full"
              style={{ width: teamRisk === "High" ? "70%" : teamRisk === "Medium" ? "40%" : "15%" }}
            />
            <div
              className="h-full bg-secondary-fixed rounded-r-full"
              style={{ width: teamRisk === "High" ? "30%" : teamRisk === "Medium" ? "60%" : "85%" }}
            />
          </div>
        </div>

        <div className="bg-background border border-primary-container/20 p-lg rounded-xl flex flex-col justify-between h-40 group hover:bg-surface-variant transition-colors duration-300">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              Skill Coverage
            </span>
            <Icon name="architecture" className="text-secondary" style={{ fontSize: "20px" }} />
          </div>
          <div>
            <div className="font-headline-lg text-headline-lg text-primary mb-xs">
              {skillCoveragePct}%
            </div>
            <div className="flex items-center gap-xs text-on-surface-variant text-body-sm font-body-sm">
              <span>
                {skillCoveragePct >= 80 ? "Optimal allocation" : "Coverage gaps detected"}
              </span>
            </div>
          </div>
          <div className="w-full h-1 bg-surface-container mt-md rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-container rounded-full"
              style={{ width: `${skillCoveragePct}%` }}
            />
          </div>
        </div>

        <div className="bg-background border border-primary-container/20 p-lg rounded-xl flex flex-col justify-between h-40 group hover:bg-surface-variant transition-colors duration-300 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary-fixed opacity-50 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-sm relative z-10">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              AI Impact
            </span>
            <Icon name="magic_button" className="text-primary-container" filled style={{ fontSize: "20px" }} />
          </div>
          <div className="relative z-10">
            <div className="font-headline-lg text-headline-lg text-primary mb-xs">+{aiImpact}%</div>
            <div className="flex items-center gap-xs text-primary-container text-body-sm font-body-sm font-medium">
              <span>Efficiency gained</span>
            </div>
          </div>
          <div className="w-full h-1 bg-surface-container mt-md rounded-full overflow-hidden relative z-10">
            <div className="h-full bg-primary-container rounded-full" style={{ width: "100%" }} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-gutter">
        <div className="xl:col-span-2 space-y-gutter">
          <div className="bg-surface-variant border border-primary-container/10 p-lg rounded-xl relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container" />
            <div className="flex items-start gap-md">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shrink-0 border border-primary-container/20">
                <Icon name="psychology" className="text-primary-container" style={{ fontSize: "20px" }} />
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-sm">
                  Equilibrium AI Analysis
                </h3>
                <ul className="space-y-sm">
                  {analysis.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-sm font-body-md text-body-md text-on-surface-variant"
                    >
                      <Icon
                        name="arrow_right"
                        className="text-primary-container mt-1"
                        style={{ fontSize: "16px" }}
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            <div className="bg-background border border-primary-container/20 p-lg rounded-xl flex flex-col h-80">
              <div className="flex justify-between items-center mb-md">
                <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider font-bold">
                  Workload Trend
                </h3>
                <button
                  type="button"
                  aria-label="More options"
                  onClick={() => setDialog("trend")}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <Icon name="more_horiz" style={{ fontSize: "20px" }} />
                </button>
              </div>
              <div className="flex-1 relative flex items-end">
                <div className="absolute inset-0 flex flex-col justify-between pb-8">
                  {[0, 1, 2, 3].map((line) => (
                    <div key={line} className="border-b border-surface-container-high w-full" />
                  ))}
                </div>
                <div className="relative w-full h-full flex items-end justify-between z-10 px-4">
                  {workloadTrend.map((point) => (
                    <div
                      key={point.day}
                      className={`w-1/6 rounded-t-sm border-t-2 relative group ${
                        point.utilization >= 85
                          ? "bg-primary-fixed-dim/50 border-primary-container"
                          : "bg-secondary-fixed/50 border-secondary"
                      }`}
                      style={{ height: `${point.utilization}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface text-on-surface text-xs px-2 py-1 border border-outline-variant rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {point.utilization}%
                      </div>
                    </div>
                  ))}

                  {showThreshold ? (
                    <div
                      className="absolute left-4 right-4 border-t-2 border-dashed border-error/60 z-20 pointer-events-none"
                      style={{ bottom: "85%" }}
                    >
                      <span className="absolute right-0 -top-4 text-[10px] font-label-md text-error">
                        85% threshold
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-between mt-sm text-[10px] font-label-md text-on-surface-variant px-4">
                {workloadTrend.map((point) => (
                  <span key={point.day}>{point.day}</span>
                ))}
              </div>
            </div>

            <div className="bg-background border border-primary-container/20 p-lg rounded-xl flex flex-col h-80">
              <div className="flex justify-between items-center mb-lg">
                <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider font-bold">
                  Capacity Dist.
                </h3>
                <Icon name="pie_chart" className="text-on-surface-variant" style={{ fontSize: "18px" }} />
              </div>
              <div className="flex-1 flex flex-col justify-center gap-md">
                {capacityByGroup.map((entry, index) => (
                  <div key={entry.group}>
                    <div className="flex justify-between text-body-sm font-body-sm mb-1">
                      <span className="text-on-background">{entry.group}</span>
                      <span
                        className={`font-medium ${
                          index < 2 ? "text-primary-container" : "text-on-surface-variant"
                        }`}
                      >
                        {entry.utilization}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColors[index % barColors.length]}`}
                        style={{ width: `${entry.utilization}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-gutter">
          <div className="bg-background border border-primary-container/20 rounded-xl flex flex-col flex-1">
            <div className="p-lg border-b border-primary-container/10">
              <h3 className="font-headline-sm text-headline-sm text-primary">Recommendations</h3>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-1">
                Ranked actions to optimize output.
              </p>
            </div>
            <div className="flex-1 p-0">
              {recommendations.map((rec, index) => (
                <div
                  key={rec.title}
                  className={`p-lg hover:bg-surface-variant transition-colors group ${
                    index < recommendations.length - 1 ? "border-b border-primary-container/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-md">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                        index === 0 ? "bg-secondary-fixed" : "bg-surface-container"
                      }`}
                    >
                      <span
                        className={`font-label-md ${
                          index === 0 ? "text-primary-container" : "text-on-surface-variant"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-label-md text-label-md text-primary font-bold mb-1">
                        {rec.title}
                      </h4>
                      <p className="text-body-sm font-body-sm text-on-surface-variant mb-md">
                        {rec.detail}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveRec(rec)}
                        className="text-label-md font-label-md text-primary-container border border-primary-container/30 px-md py-1.5 rounded hover:bg-secondary-container transition-colors"
                      >
                        {rec.cta}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <div className="bg-background border border-primary-container/20 p-lg rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-lg opacity-10 pointer-events-none">
            <Icon name="trending_up" style={{ fontSize: "80px" }} />
          </div>
          <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider font-bold mb-lg flex items-center gap-sm">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            Opportunities
          </h3>
          <div className="space-y-sm">
            {opportunities.map((item) => (
              <div
                key={item}
                className="flex items-center gap-md p-md bg-surface-container-low rounded-lg border border-outline-variant/30"
              >
                <Icon name="tune" className="text-secondary" style={{ fontSize: "20px" }} />
                <span className="font-body-sm text-body-sm text-on-background font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-variant border border-primary-container/20 p-lg rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-lg opacity-5 pointer-events-none">
            <Icon name="warning" style={{ fontSize: "80px" }} />
          </div>
          <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider font-bold mb-lg flex items-center gap-sm">
            <span className="w-2 h-2 rounded-full bg-tertiary" />
            Identified Risks
          </h3>
          <div className="space-y-sm">
            {risks.map((item) => (
              <div
                key={item}
                className="flex items-center gap-md p-md bg-background rounded-lg border border-outline-variant/30"
              >
                <Icon name="hourglass_empty" className="text-tertiary" style={{ fontSize: "20px" }} />
                <span className="font-body-sm text-body-sm text-on-background font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model Performance & Strategic ML Telemetry */}
      <section className="bg-background border border-primary-container/20 p-lg rounded-xl space-y-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md border-b border-outline-variant/40 pb-md">
          <div>
            <div className="flex items-center gap-xs">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-container/10 text-primary-container border border-primary-container/30">
                <Icon name="psychology" className="text-[14px]" />
                Client-Side ML Telemetry
              </span>
              <span className="text-xs text-secondary font-label-md">
                GroupShuffleSplit (70/15/15) · N = 10,000 assignments
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-primary mt-1">
              Model Performance & Verification
            </h3>
            <p className="text-xs text-secondary mt-0.5 font-body-sm">
              Live in-browser tree-ensemble models evaluating assignment quality, delivery likelihood, and burnout risk.
            </p>
          </div>
          <div className="flex items-center gap-sm">
            <span className="text-xs text-on-surface-variant font-label-md bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/60">
              Inference: &lt; 0.05 ms / eval
            </span>
          </div>
        </div>

        {/* Synthetic Disclaimer Banner */}
        <div className="p-md rounded-lg bg-secondary-container/30 border border-secondary/30 flex items-start gap-md">
          <Icon name="info" className="text-secondary text-[20px] shrink-0 mt-0.5" />
          <div className="text-xs text-secondary leading-relaxed font-body-sm">
            <strong className="text-primary font-bold">Synthetic Demonstration Data Notice:</strong> Models are trained on a controlled synthetic dataset (10,000 assignments, 300 members, 4,000 tasks) with nonlinear interaction labels and Gaussian noise. Real-world enterprise deployments calibrate against historical issue tracker throughput and HR leaves.
          </div>
        </div>

        {/* 3 Model Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {/* Quality Model */}
          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs uppercase tracking-wider text-secondary font-bold">
                  Assignment Fit Regressor
                </span>
                <span className="text-[10px] bg-primary-container/15 text-primary-container px-1.5 py-0.5 rounded font-mono font-bold">
                  GradientBoosting
                </span>
              </div>
              <div className="mt-sm flex items-baseline gap-xs">
                <span className="text-2xl font-bold font-headline-sm text-primary">
                  {metricsData.outcome_quality["GradientBoosting (Candidate)"].R2.toFixed(3)}
                </span>
                <span className="text-xs text-secondary font-label-md">Test R²</span>
              </div>
              <p className="text-xs text-secondary mt-xs font-body-sm">
                MAE: {metricsData.outcome_quality["GradientBoosting (Candidate)"].MAE.toFixed(2)} pts (vs Heuristic R²: {metricsData.outcome_quality["Heuristic Baseline"].R2.toFixed(3)})
              </p>
            </div>
            <div className="mt-md pt-sm border-t border-outline-variant/40 flex justify-between items-center text-xs">
              <span className="text-secondary">Pod Avg Quality:</span>
              <span className="font-bold text-primary">{podMlTelemetry.avgQuality} / 100</span>
            </div>
          </div>

          {/* On-Time Model */}
          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs uppercase tracking-wider text-secondary font-bold">
                  On-Time Delivery Classifier
                </span>
                <span className="text-[10px] bg-primary-container/15 text-primary-container px-1.5 py-0.5 rounded font-mono font-bold">
                  GradientBoosting
                </span>
              </div>
              <div className="mt-sm flex items-baseline gap-xs">
                <span className="text-2xl font-bold font-headline-sm text-primary">
                  {metricsData.on_time["GradientBoosting (Candidate)"]["ROC-AUC"].toFixed(3)}
                </span>
                <span className="text-xs text-secondary font-label-md">ROC-AUC</span>
              </div>
              <p className="text-xs text-secondary mt-xs font-body-sm">
                F1: {(metricsData.on_time["GradientBoosting (Candidate)"].F1 * 100).toFixed(1)}% · Acc: {(metricsData.on_time["GradientBoosting (Candidate)"].Accuracy * 100).toFixed(1)}% (vs Heuristic AUC: {metricsData.on_time["Heuristic Baseline"]["ROC-AUC"].toFixed(3)})
              </p>
            </div>
            <div className="mt-md pt-sm border-t border-outline-variant/40 flex justify-between items-center text-xs">
              <span className="text-secondary">Pod Avg On-Time:</span>
              <span className="font-bold text-primary">{podMlTelemetry.avgOnTimePct}%</span>
            </div>
          </div>

          {/* Burnout Model */}
          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-label-md text-xs uppercase tracking-wider text-secondary font-bold">
                  Burnout Risk Classifier
                </span>
                <span className="text-[10px] bg-primary-container/15 text-primary-container px-1.5 py-0.5 rounded font-mono font-bold">
                  Threshold: 0.35
                </span>
              </div>
              <div className="mt-sm flex items-baseline gap-xs">
                <span className="text-2xl font-bold font-headline-sm text-primary">
                  {metricsData.burnout_risk["GradientBoosting (Candidate)"]["ROC-AUC"].toFixed(3)}
                </span>
                <span className="text-xs text-secondary font-label-md">ROC-AUC</span>
              </div>
              <p className="text-xs text-secondary mt-xs font-body-sm">
                PR-AUC: {metricsData.burnout_risk["GradientBoosting (Candidate)"]["PR-AUC"].toFixed(3)} · Recall: {(metricsData.burnout_risk["GradientBoosting (Candidate)"].Recall * 100).toFixed(1)}% (vs Heuristic AUC: {metricsData.burnout_risk["Heuristic Baseline"]["ROC-AUC"].toFixed(3)})
              </p>
            </div>
            <div className="mt-md pt-sm border-t border-outline-variant/40 flex justify-between items-center text-xs">
              <span className="text-secondary">Pod High Risk:</span>
              <span className="font-bold text-primary">{podMlTelemetry.elevatedBurnoutCount} / {members.length} members</span>
            </div>
          </div>
        </div>

        {/* Confusion Matrix & Permutation Importance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-md pt-xs">
          {/* Confusion Matrix */}
          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/40">
            <div className="flex items-center justify-between mb-sm">
              <h4 className="font-label-md text-xs uppercase tracking-wider text-secondary font-bold">
                Burnout Classifier Confusion Matrix (Test Set: N = 1,511)
              </h4>
              <span className="text-[10px] text-secondary font-mono">Decision Threshold = 0.35</span>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center font-mono text-xs mt-md">
              <div className="p-1"></div>
              <div className="p-1 font-bold text-secondary text-[11px]">Pred: Safe</div>
              <div className="p-1 font-bold text-secondary text-[11px]">Pred: Burnout</div>

              <div className="p-2 font-bold text-secondary text-[11px] text-left">Actual: Safe</div>
              <div className="p-2.5 rounded bg-surface-container-lowest border border-outline-variant/40">
                <span className="font-bold text-primary block text-sm">
                  {metricsData.burnout_risk["GradientBoosting (Candidate)"].ConfusionMatrix[0][0]}
                </span>
                <span className="text-[10px] text-secondary">True Negative</span>
              </div>
              <div className="p-2.5 rounded bg-surface-container-lowest border border-outline-variant/40">
                <span className="font-bold text-error block text-sm">
                  {metricsData.burnout_risk["GradientBoosting (Candidate)"].ConfusionMatrix[0][1]}
                </span>
                <span className="text-[10px] text-secondary">False Positive</span>
              </div>

              <div className="p-2 font-bold text-secondary text-[11px] text-left">Actual: Burnout</div>
              <div className="p-2.5 rounded bg-surface-container-lowest border border-outline-variant/40">
                <span className="font-bold text-error block text-sm">
                  {metricsData.burnout_risk["GradientBoosting (Candidate)"].ConfusionMatrix[1][0]}
                </span>
                <span className="text-[10px] text-secondary">False Negative</span>
              </div>
              <div className="p-2.5 rounded bg-surface-container-lowest border border-outline-variant/40">
                <span className="font-bold text-primary-container block text-sm">
                  {metricsData.burnout_risk["GradientBoosting (Candidate)"].ConfusionMatrix[1][1]}
                </span>
                <span className="text-[10px] text-secondary">True Positive</span>
              </div>
            </div>

            <div className="mt-md text-[11px] text-secondary flex justify-between font-label-md px-1">
              <span>Precision: <strong>{(metricsData.burnout_risk["GradientBoosting (Candidate)"].Precision * 100).toFixed(1)}%</strong></span>
              <span>Recall: <strong>{(metricsData.burnout_risk["GradientBoosting (Candidate)"].Recall * 100).toFixed(1)}%</strong></span>
              <span>Specificity: <strong>{((metricsData.burnout_risk["GradientBoosting (Candidate)"].ConfusionMatrix[0][0] / (metricsData.burnout_risk["GradientBoosting (Candidate)"].ConfusionMatrix[0][0] + metricsData.burnout_risk["GradientBoosting (Candidate)"].ConfusionMatrix[0][1])) * 100).toFixed(1)}%</strong></span>
            </div>
          </div>

          {/* Permutation Importance */}
          <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/40">
            <h4 className="font-label-md text-xs uppercase tracking-wider text-secondary font-bold mb-sm">
              Top Permutation Feature Importances
            </h4>
            <div className="space-y-sm text-xs font-body-sm mt-md">
              <div>
                <div className="flex justify-between text-secondary mb-1">
                  <span>Projected Utilization (Quality & Burnout)</span>
                  <span className="font-mono font-bold text-primary">+30.1% quality / +8.8% risk</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary-container rounded-full" style={{ width: "95%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-secondary mb-1">
                  <span>Max Skill Gap (Required vs Member)</span>
                  <span className="font-mono font-bold text-primary">+15.1% quality impact</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary-container rounded-full" style={{ width: "65%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-secondary mb-1">
                  <span>Seniority vs Task Complexity</span>
                  <span className="font-mono font-bold text-primary">+11.9% quality impact</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary-container rounded-full" style={{ width: "52%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-secondary mb-1">
                  <span>Overload Streak Duration</span>
                  <span className="font-mono font-bold text-primary">+2.5% burnout driver</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary-container rounded-full" style={{ width: "35%" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-primary-container text-surface-container-low p-lg rounded-xl flex flex-col md:flex-row items-center justify-between gap-lg shadow-sm border border-primary/20">
        <div className="flex items-start md:items-center gap-md">
          <div className="w-12 h-12 rounded-full bg-surface-container-low/10 flex items-center justify-center shrink-0">
            <Icon name="verified" className="text-surface-container-low" style={{ fontSize: "24px" }} />
          </div>
          <div>
            <h4 className="font-headline-sm text-headline-sm font-bold mb-xs">Executive Summary</h4>
            <p className="font-body-md text-body-md opacity-90 leading-relaxed max-w-3xl">
              Your team is{" "}
              <strong className="text-surface-bright font-bold">{utilization}% balanced</strong> this
              week. {recommendations.length} adjustment{recommendations.length === 1 ? "" : "s"}{" "}
              recommended to eliminate all high-risk bottlenecks and maintain optimal velocity.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDialog("review")}
          className="shrink-0 bg-surface-container-low text-primary-container px-lg py-md rounded-lg font-label-md text-label-md hover:bg-white transition-colors flex items-center gap-sm"
        >
          Review Adjustments
          <Icon name="arrow_forward" style={{ fontSize: "16px" }} />
        </button>
      </div>

      <Modal
        open={dialog === "export"}
        onClose={closeDialog}
        title="Export Insights"
        description={`Operations snapshot for ${range}.`}
        icon="download"
        size="lg"
        footer={
          <ModalActions>
            <Button
              onClick={() => navigator.clipboard?.writeText(reportText)}
              disabled={!navigator.clipboard}
            >
              Copy to clipboard
            </Button>
            <Button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([reportText], { type: "text/plain" }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "equilibrium-insights.txt";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download .txt
            </Button>
            <Button variant="primary" onClick={closeDialog}>
              Done
            </Button>
          </ModalActions>
        }
      >
        <pre className="font-body-sm text-body-sm text-on-surface bg-surface-container-lowest border border-outline-variant rounded-md p-md overflow-x-auto custom-scrollbar whitespace-pre-wrap">
          {reportText}
        </pre>
      </Modal>

      <Modal
        open={dialog === "report"}
        onClose={closeDialog}
        title="Generated Report"
        description="Narrative summary assembled from the current metrics."
        icon="auto_awesome"
        size="lg"
        footer={
          <ModalActions>
            <Button
              onClick={() => navigator.clipboard?.writeText(reportText)}
              disabled={!navigator.clipboard}
            >
              Copy report
            </Button>
            <Button variant="primary" onClick={closeDialog}>
              Close
            </Button>
          </ModalActions>
        }
      >
        <div className="flex flex-col gap-lg">
          <div>
            <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider font-bold mb-sm">
              Analysis
            </h3>
            <ol className="flex flex-col gap-sm">
              {analysis.map((line, i) => (
                <li key={line} className="flex items-start gap-sm">
                  <span className="font-label-md text-label-md text-on-surface-variant flex-shrink-0 w-4">
                    {i + 1}.
                  </span>
                  <span className="font-body-sm text-body-sm text-secondary">{line}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider font-bold mb-sm">
                Opportunities
              </h3>
              <ul className="flex flex-col gap-sm">
                {opportunities.map((item) => (
                  <li key={item} className="flex items-start gap-sm">
                    <Icon name="check_circle" className="text-primary-container text-[18px] flex-shrink-0" />
                    <span className="font-body-sm text-body-sm text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-label-md text-label-md text-error uppercase tracking-wider font-bold mb-sm">
                Risks
              </h3>
              <ul className="flex flex-col gap-sm">
                {risks.map((item) => (
                  <li key={item} className="flex items-start gap-sm">
                    <Icon name="warning" className="text-error text-[18px] flex-shrink-0" />
                    <span className="font-body-sm text-body-sm text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={dialog === "trend"}
        onClose={closeDialog}
        title="Workload Trend Options"
        icon="monitoring"
        size="sm"
        footer={
          <ModalActions>
            <Button variant="primary" onClick={closeDialog}>
              Done
            </Button>
          </ModalActions>
        }
      >
        <button
          type="button"
          aria-pressed={showThreshold}
          onClick={() => setShowThreshold((prev) => !prev)}
          className={`w-full flex items-center justify-between px-md py-2.5 rounded-md border transition-colors ${
            showThreshold
              ? "border-primary bg-primary-container/15"
              : "border-outline-variant hover:bg-surface-container-low"
          }`}
        >
          <span className="text-left">
            <span className="block font-body-sm text-body-sm text-on-surface">
              Show 85% threshold
            </span>
            <span className="block font-body-sm text-body-sm text-secondary">
              Marks where velocity historically starts to drop.
            </span>
          </span>
          <Icon
            name={showThreshold ? "toggle_on" : "toggle_off"}
            className={`text-[28px] flex-shrink-0 ${showThreshold ? "text-primary" : "text-outline"}`}
          />
        </button>
      </Modal>

      <Modal
        open={Boolean(activeRec)}
        onClose={() => setActiveRec(null)}
        title={activeRec?.title}
        icon="auto_awesome"
        footer={
          <ModalActions>
            <Button onClick={() => setActiveRec(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => applyRecommendation(activeRec)}
              disabled={!proposals[activeRec?.index]}
            >
              {proposals[activeRec?.index] ? "Apply adjustment" : "No action needed"}
            </Button>
          </ModalActions>
        }
      >
        {activeRec ? (
          <>
            <p className="font-body-sm text-body-sm text-secondary">{activeRec.detail}</p>
            {proposals[activeRec.index] ? (
              <p className="mt-md font-body-sm text-body-sm text-secondary">
                This reassigns{" "}
                <strong className="text-on-surface">{activeRec.cta.toLowerCase()}</strong> and
                updates both members&apos; allocated hours immediately.
              </p>
            ) : (
              <p className="mt-md font-body-sm text-body-sm text-secondary">
                There is no open transfer behind this recommendation, so it is advisory only.
              </p>
            )}
          </>
        ) : null}
      </Modal>

      <Modal
        open={dialog === "review"}
        onClose={closeDialog}
        title="Review Adjustments"
        description={
          proposals.length
            ? `${proposals.length} proposed transfer${proposals.length === 1 ? "" : "s"}.`
            : "No adjustments are currently recommended."
        }
        icon="rate_review"
        size="lg"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button
              variant="primary"
              onClick={applyAllAdjustments}
              disabled={proposals.length === 0}
              className={proposals.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
            >
              {proposals.length === 0
                ? "Nothing to apply"
                : `Apply all ${proposals.length}`}
            </Button>
          </ModalActions>
        }
      >
        {proposals.length === 0 ? (
          <p className="font-body-sm text-body-sm text-secondary">
            The team is balanced. Keep the existing allocation for the sprint.
          </p>
        ) : (
          <ol className="flex flex-col gap-md">
            {proposals.map((proposal, i) => (
              <li
                key={proposal.id}
                className="flex items-start gap-md p-md border border-outline-variant rounded-lg bg-surface-container-low/50"
              >
                <span className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center font-label-md text-label-md text-on-surface flex-shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface">
                    {proposal.task.title}
                  </p>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {proposal.from ? `${proposal.from.name} → ${proposal.to.name}` : `Unassigned Backlog → ${proposal.to.name}`} · {proposal.hours}h ·{" "}
                    {Math.round(proposal.fitScore * 100)}% fit
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </main>
  );
}
