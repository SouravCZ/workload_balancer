import { describe, it, expect } from "vitest";
import {
  calculateFitScore,
  calculateWorkloadUtilization,
  calculateBurnoutRisk,
  calculateRiskScore,
  rankCandidates,
  skillCoverage,
  teamMetrics,
  rebalanceProposals,
  SKILL_WEIGHT,
  AVAILABILITY_WEIGHT,
  OVERLOADED_THRESHOLD,
  UNDERUTILIZED_THRESHOLD,
  MIN_PROPOSAL_FIT,
  STREAK_LOAD_PCT,
  RISK_HIGH_TIER_SCORE,
  RISK_MEDIUM_TIER_SCORE,
} from "./scoring";
import { mockMembers, mockTasks } from "../services/mockData";

describe("scoring.js - Constants & Configuration", () => {
  it("weights sum to 1.0", () => {
    expect(SKILL_WEIGHT + AVAILABILITY_WEIGHT).toBeCloseTo(1.0, 5);
  });

  it("thresholds are within valid ranges", () => {
    expect(UNDERUTILIZED_THRESHOLD).toBe(0.5);
    expect(OVERLOADED_THRESHOLD).toBe(1.0);
    expect(MIN_PROPOSAL_FIT).toBe(0.45);
    expect(STREAK_LOAD_PCT).toBe(100);
    expect(RISK_MEDIUM_TIER_SCORE).toBe(30);
    expect(RISK_HIGH_TIER_SCORE).toBe(60);
  });
});

describe("calculateFitScore", () => {
  const baseMember = {
    id: "m1",
    name: "Alex",
    capacityHours: 40,
    currentAllocatedHours: 20,
    skills: [
      { skill: "Node.js", proficiency: 5 },
      { skill: "React", proficiency: 3 },
    ],
  };

  it("computes standard fit score accurately", () => {
    const task = { requiredSkills: ["Node.js"], estimatedHours: 10 };
    // skillOverlap: 5 / (1 * 5) = 1.0
    // postAllocated: 20 + 10 = 30; headroom: 1 - 30/40 = 0.25
    // fit = 0.6 * 1.0 + 0.4 * 0.25 = 0.6 + 0.1 = 0.70
    const res = calculateFitScore(baseMember, task);
    expect(res.skillOverlap).toBe(1.0);
    expect(res.availabilityScore).toBe(0.25);
    expect(res.fitScore).toBeCloseTo(0.7, 4);
  });

  it("factors in task size: member with 3 free hours cannot rank well for a 20h task", () => {
    const almostFullMember = {
      ...baseMember,
      currentAllocatedHours: 37, // 3h headroom
    };
    const bigTask = { requiredSkills: ["Node.js"], estimatedHours: 20 };
    const res = calculateFitScore(almostFullMember, bigTask);
    // postAllocated = 37 + 20 = 57h (> 40h capacity) -> availabilityScore clamped to 0
    expect(res.availabilityScore).toBe(0);
    expect(res.fitScore).toBeCloseTo(0.6 * 1.0, 4);
  });

  it("clamps negative headroom to 0 when member is already overloaded", () => {
    const overloadedMember = {
      ...baseMember,
      currentAllocatedHours: 50, // 125% utilization
    };
    const task = { requiredSkills: ["Node.js"], estimatedHours: 5 };
    const res = calculateFitScore(overloadedMember, task);
    expect(res.availabilityScore).toBe(0);
    expect(res.fitScore).toBeGreaterThanOrEqual(0);
    expect(res.fitScore).toBeLessThanOrEqual(1);
  });

  it("handles tasks with no required skills gracefully (100% skill match)", () => {
    const noSkillTask = { requiredSkills: [], estimatedHours: 10 };
    const res = calculateFitScore(baseMember, noSkillTask);
    expect(res.skillOverlap).toBe(1.0);
    expect(res.availabilityScore).toBe(0.25);
    expect(res.fitScore).toBeCloseTo(0.6 * 1.0 + 0.4 * 0.25, 4);
  });

  it("handles member with no skills", () => {
    const unskilledMember = { ...baseMember, skills: [] };
    const task = { requiredSkills: ["Node.js"], estimatedHours: 10 };
    const res = calculateFitScore(unskilledMember, task);
    expect(res.skillOverlap).toBe(0);
    expect(res.availabilityScore).toBe(0.25);
    expect(res.fitScore).toBeCloseTo(0.4 * 0.25, 4);
  });

  it("handles zero or missing capacity without NaN or division by zero", () => {
    const zeroCapMember = { ...baseMember, capacityHours: 0 };
    const task = { requiredSkills: ["Node.js"], estimatedHours: 10 };
    const res = calculateFitScore(zeroCapMember, task);
    expect(res.availabilityScore).toBe(0);
    expect(isNaN(res.fitScore)).toBe(false);
  });

  it("handles null or undefined inputs gracefully", () => {
    expect(calculateFitScore(null, null)).toEqual({
      fitScore: 0,
      skillOverlap: 0,
      availabilityScore: 0,
    });
  });
});

describe("calculateWorkloadUtilization", () => {
  it("classifies exactly at threshold boundaries", () => {
    const memberAt50 = { capacityHours: 40, currentAllocatedHours: 20 };
    expect(calculateWorkloadUtilization(memberAt50).status).toBe("healthy");

    const memberBelow50 = { capacityHours: 40, currentAllocatedHours: 19.9 };
    expect(calculateWorkloadUtilization(memberBelow50).status).toBe("underutilized");

    const memberAt100 = { capacityHours: 40, currentAllocatedHours: 40 };
    expect(calculateWorkloadUtilization(memberAt100).status).toBe("healthy");

    const memberAbove100 = { capacityHours: 40, currentAllocatedHours: 40.1 };
    expect(calculateWorkloadUtilization(memberAbove100).status).toBe("overloaded");
  });

  it("handles 0 capacity without NaN", () => {
    const res = calculateWorkloadUtilization({ capacityHours: 0, currentAllocatedHours: 10 });
    expect(res.utilization).toBe(0);
    expect(res.status).toBe("underutilized");
  });
});

describe("calculateBurnoutRisk and calculateRiskScore agreement", () => {
  it("agree on score, tier, and streakWeeks for all mockMembers", () => {
    mockMembers.forEach((member) => {
      const risk = calculateRiskScore(member);
      const burnout = calculateBurnoutRisk(member);
      expect(burnout.score).toBe(risk.score);
      expect(burnout.riskTier).toBe(risk.tier);
      expect(burnout.streakWeeks).toBe(risk.streakWeeks);
      expect(burnout.score).toBeGreaterThanOrEqual(0);
      expect(burnout.score).toBeLessThanOrEqual(100);
    });
  });

  it("produces correct tiers based on score cutoffs", () => {
    // 0 overload, 0 streak -> score 0 -> Low
    const lowMember = { capacityHours: 40, currentAllocatedHours: 30, weeklyLoad: [70, 75] };
    expect(calculateRiskScore(lowMember).tier).toBe("Low");

    // Moderate overload -> Medium
    const medMember = { capacityHours: 40, currentAllocatedHours: 46, weeklyLoad: [105, 110] };
    const medRisk = calculateRiskScore(medMember);
    expect(medRisk.score).toBeGreaterThanOrEqual(30);
    expect(medRisk.tier).toBe("Medium");

    // Heavy overload + streak -> High
    const highMember = { capacityHours: 40, currentAllocatedHours: 54, weeklyLoad: [110, 115, 120, 125] };
    const highRisk = calculateRiskScore(highMember);
    expect(highRisk.score).toBeGreaterThanOrEqual(60);
    expect(highRisk.tier).toBe("High");
  });
});

describe("rankCandidates", () => {
  const task = { requiredSkills: ["React"], estimatedHours: 8 };
  const members = [
    { id: "m2", name: "Bob", capacityHours: 40, currentAllocatedHours: 35, skills: [{ skill: "React", proficiency: 3 }] },
    { id: "m1", name: "Alice", capacityHours: 40, currentAllocatedHours: 10, skills: [{ skill: "React", proficiency: 5 }] },
    { id: "m3", name: "Charlie", capacityHours: 40, currentAllocatedHours: 10, skills: [{ skill: "React", proficiency: 5 }] },
  ];

  it("ranks best candidate first", () => {
    const ranked = rankCandidates(task, members);
    expect(ranked[0].member.name).toBe("Alice"); // Alice and Charlie tie on fit, tie-break by name
    expect(ranked[1].member.name).toBe("Charlie");
    expect(ranked[2].member.name).toBe("Bob");
  });

  it("provides deterministic tie-break", () => {
    const ranked1 = rankCandidates(task, members);
    const ranked2 = rankCandidates(task, [...members].reverse());
    expect(ranked1.map((r) => r.member.id)).toEqual(ranked2.map((r) => r.member.id));
  });

  it("handles empty members array", () => {
    expect(rankCandidates(task, [])).toEqual([]);
  });
});

describe("skillCoverage", () => {
  it("calculates coverage across all skills accurately", () => {
    const coverage = skillCoverage(mockMembers);
    expect(coverage.length).toBeGreaterThan(0);
    coverage.forEach((item) => {
      expect(item.skill).toBeDefined();
      expect(item.best).toBeGreaterThanOrEqual(0);
      expect(item.best).toBeLessThanOrEqual(5);
      if (item.singlePointOfFailure) {
        expect(item.expertCount).toBe(1);
        expect(item.best).toBeGreaterThanOrEqual(4);
      }
    });
  });

  it("handles empty members gracefully", () => {
    expect(skillCoverage([])).toEqual([]);
    expect(skillCoverage(null)).toEqual([]);
  });
});

describe("teamMetrics", () => {
  it("computes complete metrics on mock data without errors", () => {
    const metrics = teamMetrics(mockMembers, mockTasks);
    expect(metrics.totalMembers).toBe(10);
    expect(metrics.totalTasks).toBe(18);
    expect(metrics.totalCapacity).toBe(400);
    expect(metrics.utilization).toBeGreaterThan(0);
    expect(metrics.healthScore).toBeGreaterThanOrEqual(0);
    expect(metrics.healthScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(metrics.rows)).toBe(true);
  });

  it("handles null or undefined inputs without throwing", () => {
    expect(() => teamMetrics(null, null)).not.toThrow();
    const emptyMetrics = teamMetrics();
    expect(emptyMetrics.totalMembers).toBe(0);
    expect(emptyMetrics.totalTasks).toBe(0);
    expect(emptyMetrics.utilization).toBe(0);
  });
});

describe("rebalanceProposals invariants & property tests", () => {
  it("generates valid proposals on mock data", () => {
    const proposals = rebalanceProposals(mockMembers, mockTasks);
    expect(proposals.length).toBeGreaterThan(0);

    proposals.forEach((p) => {
      expect(["assign", "transfer"]).toContain(p.type);
      expect(p.hours).toBeGreaterThan(0);
      expect(p.fitScore).toBeGreaterThanOrEqual(MIN_PROPOSAL_FIT);
      expect(p.to).toBeDefined();
    });
  });

  it("strictly enforces: no receiver overloaded (>100%) and no donor underutilized (<50%)", () => {
    const proposals = rebalanceProposals(mockMembers, mockTasks);
    const memberSim = new Map(mockMembers.map((m) => [m.id, m.currentAllocatedHours]));

    proposals.forEach((p) => {
      if (p.type === "transfer") {
        const donorHours = memberSim.get(p.from.id);
        const newDonorHours = donorHours - p.hours;
        expect(newDonorHours / p.from.capacityHours).toBeGreaterThanOrEqual(UNDERUTILIZED_THRESHOLD - 1e-6);
        memberSim.set(p.from.id, newDonorHours);
      }

      const recHours = memberSim.get(p.to.id);
      const newRecHours = recHours + p.hours;
      expect(newRecHours / p.to.capacityHours).toBeLessThanOrEqual(OVERLOADED_THRESHOLD + 1e-6);
      memberSim.set(p.to.id, newRecHours);
    });
  });

  it("property-style test: randomized seeded teams always maintain invariants", () => {
    // Seeded pseudo-random generator (Linear Congruential Generator)
    let seed = 12345;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const roles = ["Backend", "Frontend", "Data", "DevOps"];
    const allSkills = ["Node.js", "React", "SQL", "Python", "Cloud Architecture"];

    for (let run = 0; run < 30; run++) {
      const numMembers = 5 + Math.floor(random() * 8);
      const numTasks = 10 + Math.floor(random() * 15);

      const testMembers = Array.from({ length: numMembers }, (_, i) => ({
        id: `rm_${i}`,
        name: `Member ${i}`,
        role: roles[Math.floor(random() * roles.length)],
        capacityHours: 40,
        currentAllocatedHours: Math.floor(random() * 55), // 0 to 55h
        weeklyLoad: [Math.floor(random() * 120), Math.floor(random() * 120)],
        skills: allSkills.map((s) => ({ skill: s, proficiency: 1 + Math.floor(random() * 5) })),
      }));

      const testTasks = Array.from({ length: numTasks }, (_, i) => ({
        id: `rt_${i}`,
        title: `Task ${i}`,
        estimatedHours: 4 + Math.floor(random() * 12),
        assignedMemberId: random() > 0.3 ? `rm_${Math.floor(random() * numMembers)}` : null,
        requiredSkills: [allSkills[Math.floor(random() * allSkills.length)]],
      }));

      const proposals = rebalanceProposals(testMembers, testTasks);
      expect(Array.isArray(proposals)).toBe(true);

      const sim = new Map(testMembers.map((m) => [m.id, m.currentAllocatedHours]));

      // Verify each proposal adheres to invariants
      for (const p of proposals) {
        if (p.type === "transfer") {
          const donorHours = sim.get(p.from.id);
          const afterHours = donorHours - p.hours;
          expect(afterHours / p.from.capacityHours).toBeGreaterThanOrEqual(UNDERUTILIZED_THRESHOLD - 1e-6);
          sim.set(p.from.id, afterHours);
        }
        const recHours = sim.get(p.to.id);
        const afterRecHours = recHours + p.hours;
        expect(afterRecHours / p.to.capacityHours).toBeLessThanOrEqual(OVERLOADED_THRESHOLD + 1e-6);
        sim.set(p.to.id, afterRecHours);
      }
    }
  });

  it("handles situation where no receivers exist gracefully (returns proposals with rejectionReasons)", () => {
    // All members are at 80% (neither overloaded nor underutilized)
    const fullMembers = mockMembers.map((m) => ({
      ...m,
      currentAllocatedHours: 32, // 80% utilization
    }));
    const proposals = rebalanceProposals(fullMembers, mockTasks);
    expect(proposals.length).toBe(0);
    expect(proposals.rejectionReasons.length).toBeGreaterThan(0);
  });
});
