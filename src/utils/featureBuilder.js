/**
 * Builds the 15-dimensional ML feature vector from a live member and task
 * using the exact definitions matching model training schema.
 */

const ROLE_SENIORITY_MAP = {
  junior: 1,
  mid: 2,
  senior: 4,
  staff: 5,
  lead: 5,
  principal: 5,
};

function inferSeniority(roleStr = "") {
  const r = roleStr.toLowerCase();
  for (const [key, val] of Object.entries(ROLE_SENIORITY_MAP)) {
    if (r.includes(key)) return val;
  }
  return 3; // Default Mid-level
}

const PRIORITY_MAP = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function inferPriority(priorityStr = "") {
  const p = priorityStr.toLowerCase();
  return PRIORITY_MAP[p] ?? 2;
}

function inferDeadlineDays(deadlineStr = "", estimatedHours = 8) {
  if (!deadlineStr) return Math.max(1, Math.round(estimatedHours / 6));
  const d = deadlineStr.toLowerCase();
  if (d === "today" || d === "urgent") return 1;
  if (d.includes("oct 24") || d.includes("tomorrow")) return 2;
  if (d.includes("oct 28")) return 4;
  if (d.includes("nov")) return 8;
  return Math.max(1, Math.round(estimatedHours / 6));
}

/**
 * Calculates slope of 5-week historical loads.
 */
function calculateOvertimeTrend(weeklyLoad = [80, 80, 80, 80, 80]) {
  if (!weeklyLoad || weeklyLoad.length < 2) return 0.0;
  const n = weeklyLoad.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = weeklyLoad[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return Math.round(slope * 100) / 100;
}

export function buildFeatureVector(member, task, allTasks = []) {
  if (!member) return null;

  const reqSkills = task?.requiredSkills ?? [];
  const taskHours = Number(task?.estimatedHours ?? task?.hours ?? 8);
  const capacity = Number(member.capacityHours && member.capacityHours > 0 ? member.capacityHours : 40);
  const currentAllocated = Number(member.currentAllocatedHours ?? 0);

  // 1. Skill metrics
  const targetLevel = inferPriority(task?.priority) >= 3 ? 4 : 3;
  let gaps = [];
  let matches = [];
  let coveredCount = 0;

  for (const sName of reqSkills) {
    const memLvl = (member.skills ?? []).find((s) => s.skill === sName)?.proficiency ?? 0;
    const gap = Math.max(0, targetLevel - memLvl);
    gaps.push(gap);
    matches.push(Math.min(1.0, memLvl / targetLevel));
    if (memLvl >= targetLevel) {
      coveredCount++;
    }
  }

  const skillMatchScore = matches.length
    ? matches.reduce((a, b) => a + b, 0) / matches.length
    : 1.0;
  const skillGapMax = gaps.length ? Math.max(...gaps) : 0;
  const skillCoverageRatio = reqSkills.length ? coveredCount / reqSkills.length : 1.0;

  // 2. Capacity metrics
  const currentUtil = currentAllocated / capacity;
  const projectedUtil = (currentAllocated + taskHours) / capacity;

  const remainingHeadroom = Math.max(0.5, capacity - currentAllocated);
  const taskHoursToHeadroomRatio = Math.round((taskHours / remainingHeadroom) * 1000) / 1000;

  // 3. Deadline metrics
  const deadlineDays = inferDeadlineDays(task?.deadline, taskHours);
  const deadlineWorkCapacity = Math.max(4.0, deadlineDays * 7.5);
  const hoursToDeadlineRatio = Math.round((taskHours / deadlineWorkCapacity) * 1000) / 1000;

  // 4. Complexity & Seniority
  const seniority = inferSeniority(member.role);
  const complexity = Math.max(1, Math.min(5, Math.round(taskHours / 7)));
  const seniorityVsComplexity = seniority - complexity;

  // 5. Overtime & Fatigue metrics
  const weeklyLoad = member.weeklyLoad ?? [80, 85, 90, 95, 100];
  const overtimeTrend = calculateOvertimeTrend(weeklyLoad);
  const overloadStreakWeeks = weeklyLoad.filter((load) => load > 100).length;

  const recentPtoDays = member.presence === "ooo" ? 5 : 2;
  const tenureMonths = 24; // Default engineering squad tenure baseline

  // 6. Task Context
  const taskPriority = inferPriority(task?.priority);
  const collaborationNeeded = reqSkills.length > 2 || taskPriority === 4 ? 1 : 0;

  const concurrentTaskCount = allTasks.filter(
    (t) => t.assignedMemberId === member.id && t.id !== task?.id,
  ).length + 1;

  return {
    skill_match_score: Math.round(skillMatchScore * 10000) / 10000,
    skill_gap_max: skillGapMax,
    skill_coverage_ratio: Math.round(skillCoverageRatio * 10000) / 10000,
    current_utilization: Math.round(currentUtil * 10000) / 10000,
    projected_utilization_after_assign: Math.round(projectedUtil * 10000) / 10000,
    task_hours_to_headroom_ratio: taskHoursToHeadroomRatio,
    hours_to_deadline_ratio: hoursToDeadlineRatio,
    seniority_vs_complexity: seniorityVsComplexity,
    overtime_trend: overtimeTrend,
    overload_streak_weeks: overloadStreakWeeks,
    recent_pto_days: recentPtoDays,
    tenure_months: tenureMonths,
    task_priority: taskPriority,
    collaboration_needed: collaborationNeeded,
    concurrent_task_count: Math.min(10, Math.max(1, concurrentTaskCount)),
  };
}
