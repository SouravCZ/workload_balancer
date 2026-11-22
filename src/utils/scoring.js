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

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Calculates candidate fit score factoring in both skill proficiency depth and
 * remaining headroom after the task hours are allocated.
 */
export function calculateFitScore(member, task) {
  if (!member) {
    return { fitScore: 0, skillOverlap: 0, availabilityScore: 0 };
  }

  const reqSkills = task?.requiredSkills ?? [];
  let skillOverlapRaw = 0;
  for (const reqSkill of reqSkills) {
    const memberSkill = (member.skills ?? []).find((s) => s.skill === reqSkill);
    if (memberSkill) {
      skillOverlapRaw += memberSkill.proficiency ?? 0;
    }
  }

  const maxPossible = reqSkills.length * MAX_PROFICIENCY;
  // If task specifies no required skills, any candidate matches 100% of skills
  let skillOverlap = maxPossible > 0 ? skillOverlapRaw / maxPossible : (reqSkills.length === 0 ? 1 : 0);
  skillOverlap = clamp(skillOverlap, 0, 1);

  // Factor in task hours: availability represents headroom remaining AFTER assignment
  const taskHours = Number(task?.estimatedHours ?? task?.hours ?? 0);
  const currentAllocated = Number(member.currentAllocatedHours ?? 0);
  const capacity = Number(member.capacityHours ?? 0);

  const postAllocatedHours = currentAllocated + taskHours;
  let availabilityScore = capacity > 0 ? 1 - postAllocatedHours / capacity : 0;
  availabilityScore = clamp(availabilityScore, 0, 1);

  const fitScore = clamp(SKILL_WEIGHT * skillOverlap + AVAILABILITY_WEIGHT * availabilityScore, 0, 1);

  return { fitScore, skillOverlap, availabilityScore };
}

export function calculateWorkloadUtilization(member) {
  if (!member || !member.capacityHours || member.capacityHours <= 0) {
    return { utilization: 0, status: "underutilized" };
  }
  const utilization = (member.currentAllocatedHours ?? 0) / member.capacityHours;
  let status = "healthy";
  if (utilization > OVERLOADED_THRESHOLD) {
    status = "overloaded";
  } else if (utilization < UNDERUTILIZED_THRESHOLD) {
    status = "underutilized";
  }
  return { utilization, status };
}

export function calculateRiskScore(member) {
  if (!member) {
    return { score: 0, tier: "Low", streakWeeks: 0 };
  }
  const { utilization } = calculateWorkloadUtilization(member);
  const overage = Math.max(0, utilization - 1);
  const streakWeeks = (member.weeklyLoad ?? []).filter((load) => load > STREAK_LOAD_PCT).length;
  const rawScore = Math.round(overage * RISK_OVERAGE_MULTIPLIER + streakWeeks * RISK_STREAK_MULTIPLIER);
  const score = clamp(rawScore, 0, 100);
  const tier = score >= RISK_HIGH_TIER_SCORE ? "High" : score >= RISK_MEDIUM_TIER_SCORE ? "Medium" : "Low";
  return { score, tier, streakWeeks };
}

export function calculateBurnoutRisk(member) {
  if (!member) {
    return { overage: 0, riskTier: "Low", score: 0, streakWeeks: 0 };
  }
  const { utilization } = calculateWorkloadUtilization(member);
  const overage = Math.max(0, utilization - 1);
  const { score, tier, streakWeeks } = calculateRiskScore(member);
  return { overage, riskTier: tier, score, streakWeeks };
}

export function proficiencyOf(member, skill) {
  return (member?.skills ?? []).find((s) => s.skill === skill)?.proficiency ?? 0;
}

/** Members ranked as best candidates for a task, highest fit score first with deterministic tie-break. */
export function rankCandidates(task, members) {
  if (!members || members.length === 0) return [];
  return [...members]
    .map((member) => ({ member, ...calculateFitScore(member, task) }))
    .sort((a, b) => {
      if (Math.abs(b.fitScore - a.fitScore) > 1e-6) {
        return b.fitScore - a.fitScore;
      }
      if (Math.abs(b.skillOverlap - a.skillOverlap) > 1e-6) {
        return b.skillOverlap - a.skillOverlap;
      }
      if (Math.abs(b.availabilityScore - a.availabilityScore) > 1e-6) {
        return b.availabilityScore - a.availabilityScore;
      }
      const nameA = a.member?.name ?? a.member?.id ?? "";
      const nameB = b.member?.name ?? b.member?.id ?? "";
      return nameA.localeCompare(nameB);
    });
}

export function skillCoverage(members) {
  const safeMembers = members ?? [];
  const skills = [...new Set(safeMembers.flatMap((m) => (m.skills ?? []).map((s) => s.skill)))];
  return skills
    .map((skill) => {
      const holders = safeMembers
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
    .sort((a, b) => a.best - b.best || a.skill.localeCompare(b.skill));
}

export function teamMetrics(members = [], tasks = []) {
  const safeMembers = members ?? [];
  const safeTasks = tasks ?? [];

  const totalCapacity = safeMembers.reduce((sum, m) => sum + (m.capacityHours ?? 0), 0);
  const totalAllocated = safeMembers.reduce((sum, m) => sum + (m.currentAllocatedHours ?? 0), 0);
  const utilization = totalCapacity > 0 ? totalAllocated / totalCapacity : 0;

  const rows = safeMembers.map((member) => ({
    member,
    ...calculateWorkloadUtilization(member),
    risk: calculateRiskScore(member),
  }));

  const overloaded = rows.filter((r) => r.status === "overloaded");
  const underutilized = rows.filter((r) => r.status === "underutilized");
  const highRisk = rows.filter((r) => r.risk.tier === "High");
  const unassigned = safeTasks.filter((t) => !t.assignedMemberId);

  const fitScores = safeTasks
    .filter((t) => t.assignedMemberId)
    .map((task) => {
      const member = safeMembers.find((m) => m.id === task.assignedMemberId);
      return member ? calculateFitScore(member, task).fitScore : null;
    })
    .filter((value) => value !== null);

  const avgFit = fitScores.length
    ? fitScores.reduce((a, b) => a + b, 0) / fitScores.length
    : 0;

  return {
    totalMembers: safeMembers.length,
    totalTasks: safeTasks.length,
    totalCapacity,
    totalAllocated,
    utilization,
    overloaded,
    underutilized,
    highRisk,
    unassigned,
    avgFit,
    healthScore: clamp(Math.round((1 - overloaded.length / Math.max(1, safeMembers.length)) * 100), 0, 100),
    rows,
  };
}

/** Transfer and assignment proposals that balance team workload. */
export function rebalanceProposals(members = [], tasks = []) {
  const proposals = [];
  proposals.rejectionReasons = [];

  if (!members || members.length === 0 || !tasks || tasks.length === 0) {
    proposals.rejectionReasons.push("Empty members or tasks input");
    return proposals;
  }

  // Track projected hours dynamically
  const memberLoads = new Map(
    members.map((m) => [
      m.id,
      {
        member: m,
        projectedHours: m.currentAllocatedHours ?? 0,
        capacity: m.capacityHours && m.capacityHours > 0 ? m.capacityHours : 40,
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
    if (receivers.length === 0) {
      proposals.rejectionReasons.push(`No underutilized receiver (<${UNDERUTILIZED_THRESHOLD * 100}%) available for unassigned task ${task.id}`);
      break;
    }

    const ranked = rankCandidates(task, receivers);
    const best = ranked[0];
    if (!best || best.fitScore < MIN_PROPOSAL_FIT) {
      proposals.rejectionReasons.push(`Best candidate fit (${best?.fitScore?.toFixed(2) ?? 0}) below MIN_PROPOSAL_FIT for task ${task.id}`);
      continue;
    }

    const recLoad = memberLoads.get(best.member.id);
    const taskHours = Number(task.estimatedHours ?? task.hours ?? 0);
    if ((recLoad.projectedHours + taskHours) / recLoad.capacity > OVERLOADED_THRESHOLD) {
      proposals.rejectionReasons.push(`Assigning task ${task.id} (${taskHours}h) would overload receiver ${best.member.name}`);
      continue;
    }

    recLoad.projectedHours += taskHours;
    assignCount++;
    proposals.push({
      id: `p-${task.id}`,
      type: "assign",
      task,
      from: null,
      to: best.member,
      fitScore: best.fitScore,
      hours: taskHours,
    });
  }

  // b) For each overloaded donor, move tasks only until donor <= 100%
  const overloadedDonors = members
    .filter((m) => getUtil(m.id) > OVERLOADED_THRESHOLD)
    .sort((a, b) => getUtil(b.id) - getUtil(a.id));

  for (const donor of overloadedDonors) {
    const dLoad = memberLoads.get(donor.id);
    const donorTasks = tasks.filter((t) => t.assignedMemberId === donor.id);

    for (const task of donorTasks) {
      if (getUtil(donor.id) <= OVERLOADED_THRESHOLD) break;

      const taskHours = Number(task.estimatedHours ?? task.hours ?? 0);
      const projectedAfterRemoval = (dLoad.projectedHours - taskHours) / dLoad.capacity;
      if (projectedAfterRemoval < UNDERUTILIZED_THRESHOLD) {
        proposals.rejectionReasons.push(`Removing task ${task.id} (${taskHours}h) would push donor ${donor.name} below underutilized threshold`);
        continue;
      }

      const receivers = members.filter((m) => m.id !== donor.id && getUtil(m.id) < UNDERUTILIZED_THRESHOLD);
      if (receivers.length === 0) {
        proposals.rejectionReasons.push(`No available receivers (<${UNDERUTILIZED_THRESHOLD * 100}%) for transfer from ${donor.name}`);
        break;
      }

      const ranked = rankCandidates(task, receivers);
      const best = ranked[0];
      if (!best || best.fitScore < MIN_PROPOSAL_FIT) {
        proposals.rejectionReasons.push(`Best candidate fit below MIN_PROPOSAL_FIT for task ${task.id} from ${donor.name}`);
        continue;
      }

      const recLoad = memberLoads.get(best.member.id);
      if ((recLoad.projectedHours + taskHours) / recLoad.capacity > OVERLOADED_THRESHOLD) {
        proposals.rejectionReasons.push(`Transfer of ${task.id} would overload receiver ${best.member.name}`);
        continue;
      }

      dLoad.projectedHours -= taskHours;
      recLoad.projectedHours += taskHours;

      proposals.push({
        id: `p-${task.id}`,
        type: "transfer",
        task,
        from: donor,
        to: best.member,
        fitScore: best.fitScore,
        hours: taskHours,
      });
    }
  }

  return proposals;
}
