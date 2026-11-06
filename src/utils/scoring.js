export const MAX_PROFICIENCY = 5;
export const SKILL_WEIGHT = 0.6;
export const AVAILABILITY_WEIGHT = 0.4;

export const OVERLOADED_THRESHOLD = 1.0;
export const UNDERUTILIZED_THRESHOLD = 0.5;

export const BURNOUT_HIGH_OVERAGE = 0.3;

export const RISK_OVERAGE_MULTIPLIER = 180;
export const RISK_STREAK_MULTIPLIER = 12;
export const RISK_HIGH_TIER_SCORE = 60;
export const RISK_MEDIUM_TIER_SCORE = 30;

export const MIN_PROPOSAL_FIT = 0.45;
export const STREAK_LOAD_PCT = 100;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function calculateFitScore(member, task) {
  let skillOverlapRaw = 0;
  for (const reqSkill of task.requiredSkills ?? []) {
    const memberSkill = (member.skills ?? []).find((s) => s.skill === reqSkill);
    if (memberSkill) {
      skillOverlapRaw += memberSkill.proficiency;
    }
  }
  const maxPossible = (task.requiredSkills?.length ?? 0) * MAX_PROFICIENCY;
  let skillOverlap = maxPossible > 0 ? skillOverlapRaw / maxPossible : 0;
  skillOverlap = clamp(skillOverlap, 0, 1);

  let availabilityScore = member.capacityHours > 0 ? 1 - member.currentAllocatedHours / member.capacityHours : 0;
  availabilityScore = clamp(availabilityScore, 0, 1);

  const fitScore = SKILL_WEIGHT * skillOverlap + AVAILABILITY_WEIGHT * availabilityScore;

  return { fitScore, skillOverlap, availabilityScore };
}

export function calculateWorkloadUtilization(member) {
  const utilization = member.capacityHours > 0 ? member.currentAllocatedHours / member.capacityHours : 0;
  let status = "healthy";
  if (utilization > OVERLOADED_THRESHOLD) {
    status = "overloaded";
  } else if (utilization < UNDERUTILIZED_THRESHOLD) {
    status = "underutilized";
  }
  return { utilization, status };
}

export function calculateBurnoutRisk(member) {
  const { utilization } = calculateWorkloadUtilization(member);
  const overage = Math.max(0, utilization - 1);
  const { score, tier, streakWeeks } = calculateRiskScore(member);
  return { overage, riskTier: tier, score, streakWeeks };
}

/** 0-100 burnout score blending capacity overage with consecutive over-capacity weeks. */
export function calculateRiskScore(member) {
  const { utilization } = calculateWorkloadUtilization(member);
  const overage = Math.max(0, utilization - 1);
  const streakWeeks = (member.weeklyLoad ?? []).filter((load) => load > STREAK_LOAD_PCT).length;
  const score = clamp(Math.round(overage * RISK_OVERAGE_MULTIPLIER + streakWeeks * RISK_STREAK_MULTIPLIER), 0, 100);
  const tier = score >= RISK_HIGH_TIER_SCORE ? "High" : score >= RISK_MEDIUM_TIER_SCORE ? "Medium" : "Low";
  return { score, tier, streakWeeks };
}

export function proficiencyOf(member, skill) {
  return (member.skills ?? []).find((s) => s.skill === skill)?.proficiency ?? 0;
}

/** Members ranked as best candidates for a task, highest fit score first. */
export function rankCandidates(task, members) {
  return members
    .map((member) => ({ member, ...calculateFitScore(member, task) }))
    .sort((a, b) => b.fitScore - a.fitScore);
}

export function skillCoverage(members) {
  const skills = [...new Set(members.flatMap((m) => (m.skills ?? []).map((s) => s.skill)))];
  return skills
    .map((skill) => {
      const holders = members
        .map((m) => ({ member: m, proficiency: proficiencyOf(m, skill) }))
        .filter((entry) => entry.proficiency > 0)
        .sort((a, b) => b.proficiency - a.proficiency);
      const best = holders[0]?.proficiency ?? 0;
      return {
        skill,
        holders,
        best,
        expertCount: holders.filter((h) => h.proficiency >= 4).length,
        singlePointOfFailure: best >= 4 && holders.filter((h) => h.proficiency >= 4).length === 1,
        untapped: best >= 4 && holders.length > 1,
      };
    })
    .sort((a, b) => a.best - b.best);
}

export function teamMetrics(members, tasks) {
  const totalCapacity = members.reduce((sum, m) => sum + m.capacityHours, 0);
  const totalAllocated = members.reduce((sum, m) => sum + m.currentAllocatedHours, 0);
  const utilization = totalCapacity > 0 ? totalAllocated / totalCapacity : 0;

  const rows = members.map((member) => ({
    member,
    ...calculateWorkloadUtilization(member),
    risk: calculateRiskScore(member),
  }));

  const overloaded = rows.filter((r) => r.status === "overloaded");
  const underutilized = rows.filter((r) => r.status === "underutilized");
  const highRisk = rows.filter((r) => r.risk.tier === "High");
  const unassigned = tasks.filter((t) => !t.assignedMemberId);

  const fitScores = tasks
    .filter((t) => t.assignedMemberId)
    .map((task) => {
      const member = members.find((m) => m.id === task.assignedMemberId);
      return member ? calculateFitScore(member, task).fitScore : null;
    })
    .filter((value) => value !== null);

  const avgFit = fitScores.length
    ? fitScores.reduce((a, b) => a + b, 0) / fitScores.length
    : 0;

  return {
    totalMembers: members.length,
    totalTasks: tasks.length,
    totalCapacity,
    totalAllocated,
    utilization,
    overloaded,
    underutilized,
    highRisk,
    unassigned,
    avgFit,
    healthScore: clamp(Math.round((1 - overloaded.length / Math.max(1, members.length)) * 100), 0, 100),
    rows,
  };
}

/** Transfer and assignment proposals that balance team workload. */
export function rebalanceProposals(members, tasks) {
  const proposals = [];
  if (!members || members.length === 0 || !tasks || tasks.length === 0) {
    return proposals;
  }

  // Track projected hours dynamically
  const memberLoads = new Map(
    members.map((m) => [
      m.id,
      {
        member: m,
        projectedHours: m.currentAllocatedHours,
        capacity: m.capacityHours,
      },
    ]),
  );

  const getUtil = (id) => {
    const rec = memberLoads.get(id);
    return rec && rec.capacity > 0 ? rec.projectedHours / rec.capacity : 0;
  };

  // a) First assign unassigned tasks to the best-fit receivers as "assign" proposals, up to 3.
  const unassignedTasks = tasks.filter((t) => !t.assignedMemberId);
  let assignCount = 0;

  for (const task of unassignedTasks) {
    if (assignCount >= 3) break;
    const receivers = members.filter((m) => getUtil(m.id) < UNDERUTILIZED_THRESHOLD);
    if (receivers.length === 0) break;

    const ranked = rankCandidates(task, receivers);
    const best = ranked[0];
    if (!best || best.fitScore < MIN_PROPOSAL_FIT) continue;

    const recLoad = memberLoads.get(best.member.id);
    if ((recLoad.projectedHours + task.estimatedHours) / recLoad.capacity > OVERLOADED_THRESHOLD) {
      continue;
    }

    recLoad.projectedHours += task.estimatedHours;
    assignCount++;
    proposals.push({
      id: `p-${task.id}`,
      type: "assign",
      task,
      from: null,
      to: best.member,
      fitScore: best.fitScore,
      hours: task.estimatedHours,
    });
  }

  // b) Then, for each overloaded donor, move tasks only until the donor is at or below 100%
  // (stop once the donor is at or below the threshold; never overshoot to below the underutilized threshold).
  const overloadedDonors = members
    .filter((m) => getUtil(m.id) > OVERLOADED_THRESHOLD)
    .sort((a, b) => getUtil(b.id) - getUtil(a.id));

  for (const donor of overloadedDonors) {
    const dLoad = memberLoads.get(donor.id);
    const donorTasks = tasks.filter((t) => t.assignedMemberId === donor.id);

    for (const task of donorTasks) {
      if (getUtil(donor.id) <= OVERLOADED_THRESHOLD) break;

      const projectedAfterRemoval = (dLoad.projectedHours - task.estimatedHours) / dLoad.capacity;
      if (projectedAfterRemoval < UNDERUTILIZED_THRESHOLD) continue;

      const receivers = members.filter((m) => getUtil(m.id) < UNDERUTILIZED_THRESHOLD);
      if (receivers.length === 0) break;

      const ranked = rankCandidates(task, receivers);
      const best = ranked[0];
      if (!best || best.fitScore < MIN_PROPOSAL_FIT) continue;

      const recLoad = memberLoads.get(best.member.id);
      if ((recLoad.projectedHours + task.estimatedHours) / recLoad.capacity > OVERLOADED_THRESHOLD) {
        continue;
      }

      dLoad.projectedHours -= task.estimatedHours;
      recLoad.projectedHours += task.estimatedHours;

      proposals.push({
        id: `p-${task.id}`,
        type: "transfer",
        task,
        from: donor,
        to: best.member,
        fitScore: best.fitScore,
        hours: task.estimatedHours,
      });
    }
  }

  return proposals;
}
