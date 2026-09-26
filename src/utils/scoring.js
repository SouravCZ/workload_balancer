const MAX_PROFICIENCY = 5;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function calculateFitScore(member, task) {
  let skillOverlapRaw = 0;
  for (const reqSkill of task.requiredSkills) {
    const memberSkill = member.skills.find((s) => s.skill === reqSkill);
    if (memberSkill) {
      skillOverlapRaw += memberSkill.proficiency;
    }
  }
  const maxPossible = task.requiredSkills.length * MAX_PROFICIENCY;
  let skillOverlap = maxPossible > 0 ? skillOverlapRaw / maxPossible : 0;
  skillOverlap = clamp(skillOverlap, 0, 1);

  let availabilityScore = 1 - member.currentAllocatedHours / member.capacityHours;
  availabilityScore = clamp(availabilityScore, 0, 1);

  const fitScore = 0.6 * skillOverlap + 0.4 * availabilityScore;

  return { fitScore, skillOverlap, availabilityScore };
}

export function calculateWorkloadUtilization(member) {
  const utilization = member.currentAllocatedHours / member.capacityHours;
  let status = "healthy";
  if (utilization > 1.0) {
    status = "overloaded";
  } else if (utilization < 0.5) {
    status = "underutilized";
  }
  return { utilization, status };
}

export function calculateBurnoutRisk(member) {
  const { utilization } = calculateWorkloadUtilization(member);
  const overage = Math.max(0, utilization - 1);
  let riskTier = "Low";
  if (overage > 0.3) {
    riskTier = "High";
  } else if (overage > 0) {
    riskTier = "Medium";
  }
  return { overage, riskTier };
}

/** 0-100 burnout score blending capacity overage with consecutive over-capacity weeks. */
export function calculateRiskScore(member) {
  const { utilization } = calculateWorkloadUtilization(member);
  const overage = Math.max(0, utilization - 1);
  const streakWeeks = (member.weeklyLoad ?? []).filter((load) => load > 100).length;
  const score = clamp(Math.round(overage * 180 + streakWeeks * 12), 0, 100);
  const tier = score >= 60 ? "High" : score >= 30 ? "Medium" : "Low";
  return { score, tier, streakWeeks };
}

export function proficiencyOf(member, skill) {
  return member.skills.find((s) => s.skill === skill)?.proficiency ?? 0;
}

/** Members ranked as best candidates for a task, highest fit score first. */
export function rankCandidates(task, members) {
  return members
    .map((member) => ({ member, ...calculateFitScore(member, task) }))
    .sort((a, b) => b.fitScore - a.fitScore);
}

export function skillCoverage(members) {
  const skills = [...new Set(members.flatMap((m) => m.skills.map((s) => s.skill)))];
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

/** Transfer proposals that move hours from overloaded members to underutilized ones. */
export function rebalanceProposals(members, tasks) {
  const donors = members
    .map((m) => ({ member: m, ...calculateWorkloadUtilization(m) }))
    .filter((d) => d.utilization > 0.9);
  const receivers = members
    .map((m) => ({ member: m, ...calculateWorkloadUtilization(m) }))
    .filter((r) => r.utilization < 0.6);

  const proposals = [];
  for (const task of tasks.filter((t) => t.assignedMemberId)) {
    if (donors.length === 0 || receivers.length === 0) break;
    const from = donors[0].member;
    const ranked = rankCandidates(
      task,
      receivers.map((r) => r.member),
    );
    const best = ranked[0];
    if (!best || best.fitScore < 0.45) continue;
    proposals.push({
      id: `p-${task.id}`,
      task,
      from,
      to: best.member,
      fitScore: best.fitScore,
      hours: task.estimatedHours,
    });
    if (proposals.length >= 3) break;
  }
  return proposals;
}
