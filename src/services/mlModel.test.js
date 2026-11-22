import { describe, it, expect } from "vitest";
import qualityModel from "../models/model_quality.json";
import ontimeModel from "../models/model_ontime.json";
import burnoutModel from "../models/model_burnout.json";
import parityCases from "../models/parity_test_cases.json";
import { predictEnsemble } from "./mlModel";

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
      const thresh = burnoutModel.optimal_threshold ?? 0.35;
      expect(res.isPositive).toBe(testCase.py_pred_burnout >= thresh);
    });
  });
});
