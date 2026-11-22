import { describe, it, expect, beforeEach, afterEach } from "vitest";
import qualityModel from "../models/model_quality.json";
import ontimeModel from "../models/model_ontime.json";
import burnoutModel from "../models/model_burnout.json";
import parityCases from "../models/parity_test_cases.json";
import {
  predictEnsemble,
  scoreCandidateML,
  predictMemberBurnoutML,
  hasModelLoadFailed,
  _resetModelsForTesting,
} from "./mlModel";

describe("ML In-Browser Parity Test (200 random test-set rows)", () => {
  it("has exactly 200 held-out test rows", () => {
    expect(parityCases.length).toBe(200);
  });

  it("regression predictions match Python output within 1e-4 tolerance", () => {
    let maxDiff = 0;
    parityCases.forEach((testCase) => {
      const res = predictEnsemble(qualityModel, testCase.features);
      const diff = Math.abs(res.prediction - testCase.py_pred_quality);
      if (diff > maxDiff) maxDiff = diff;
      expect(diff).toBeLessThan(1e-4);
    });
    expect(maxDiff).toBeLessThan(1e-4);
  });

  it("on-time classifier probabilities match Python output within 1e-4 tolerance", () => {
    parityCases.forEach((testCase) => {
      const res = predictEnsemble(ontimeModel, testCase.features);
      const diff = Math.abs(res.probability - testCase.py_pred_ontime);
      expect(diff).toBeLessThan(1e-4);
      expect(res.isPositive).toBe(testCase.py_pred_ontime >= 0.5);
    });
  });

  it("burnout classifier probabilities match Python output within 1e-4 tolerance", () => {
    parityCases.forEach((testCase) => {
      const res = predictEnsemble(burnoutModel, testCase.features);
      const diff = Math.abs(res.probability - testCase.py_pred_burnout);
      expect(diff).toBeLessThan(1e-4);
      const thresh = burnoutModel.optimal_threshold ?? 0.33;
      expect(res.isPositive).toBe(testCase.py_pred_burnout >= thresh);
    });
  });
});

describe("ML Load Failure Simulation & Heuristic Fallback", () => {
  const dummyMember = {
    id: "m_test",
    name: "Test Engineer",
    capacityHours: 40,
    currentAllocatedHours: 25,
    seniority: 3,
    skills: [
      { skill: "React", level: 4 },
      { skill: "Node.js", level: 3 },
    ],
    weeklyLoadHistory: [70, 75, 80, 70, 65],
  };

  const dummyTask = {
    id: "t_test",
    title: "Test Task",
    estimatedHours: 10,
    requiredSkills: ["React"],
    priority: "High",
  };

  afterEach(() => {
    _resetModelsForTesting({ fail: false });
  });

  it("falls back to deterministic heuristic when models fail to load", async () => {
    // Inject simulated model load failure
    _resetModelsForTesting({ fail: true });
    expect(hasModelLoadFailed()).toBe(true);

    const fitResult = await scoreCandidateML(dummyMember, dummyTask, [dummyTask]);
    expect(fitResult.isMl).toBe(false);
    expect(fitResult.loadFailed).toBe(true);
    expect(fitResult.disclaimer).toContain("Heuristic fallback active");
    expect(fitResult.mlFitScore).toBeGreaterThan(0);
    expect(fitResult.mlFitScore).toBeLessThanOrEqual(1.0);

    const burnoutResult = await predictMemberBurnoutML(dummyMember, [dummyTask]);
    expect(burnoutResult.isMl).toBe(false);
    expect(burnoutResult.loadFailed).toBe(true);
    expect(burnoutResult.disclaimer).toContain("Heuristic fallback active");
    expect(burnoutResult.riskTier).toBeDefined();
  });

  it("recovers normal ML inference when failure is resolved", async () => {
    _resetModelsForTesting({ fail: false });
    const fitResult = await scoreCandidateML(dummyMember, dummyTask, [dummyTask]);
    expect(fitResult.isMl).toBe(true);
    expect(fitResult.loadFailed).toBe(false);
    expect(fitResult.mlQuality).toBeGreaterThan(0);
  });
});
