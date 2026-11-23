import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import RealDataBenchmarksSection from "./RealDataBenchmarksSection";

describe("RealDataBenchmarksSection UI Rendering", () => {
  it("renders 'not yet run' state when metrics are missing or marked not_run", () => {
    const htmlEmpty = renderToString(<RealDataBenchmarksSection metrics={{ status: "not_run" }} />);
    expect(htmlEmpty).toContain("Real-Data Reference Benchmarks");
    expect(htmlEmpty).toContain("Real-data benchmarks: not yet run");
    expect(htmlEmpty).toContain(
      "Separate public benchmarks. They do not validate the synthetic Equilibrium models; feature schemas differ."
    );
    expect(htmlEmpty).toContain("python ml/real/train_burnout_real.py");
    expect(htmlEmpty).toContain("python ml/real/train_duration_real.py");

    const htmlNull = renderToString(<RealDataBenchmarksSection metrics={null} />);
    expect(htmlNull).toContain("Real-data benchmarks: not yet run");
  });

  it("renders benchmark results and methodology disclaimer when real metrics are populated", () => {
    const mockPopulatedMetrics = {
      status: "completed",
      burnout_real: {
        status: "completed",
        dataset: {
          name: "Are Your Employees Burning Out? (HackerEarth)",
          source: "https://www.kaggle.com/datasets/parasvarshney/employee-burnout-dataset",
          total_rows: 22750,
          test_rows: 3718,
          high_burnout_threshold: 0.6,
          test_positive_rate: 0.245,
        },
        operational_model_main: {
          regression: {
            "Dummy (Mean)": { R2: -0.001, MAE: 0.165 },
            "Linear (Ridge)": { R2: 0.542, MAE: 0.108 },
            HistGradientBoosting: { R2: 0.551, MAE: 0.105 },
            gap_gbdt_vs_linear_r2: 0.009,
          },
          classification: {
            "Dummy (Majority)": { "ROC-AUC": 0.5, "PR-AUC": 0.245 },
            "Logistic Regression": { "ROC-AUC": 0.865, "PR-AUC": 0.695 },
            HistGradientBoosting: { "ROC-AUC": 0.871, "PR-AUC": 0.702 },
            gap_gbdt_vs_logistic_auc: 0.006,
          },
        },
        ablation_with_mental_fatigue: {
          regression_r2: 0.895,
          r2_lift_over_operational_only: 0.344,
          classification_roc_auc: 0.978,
        },
      },
      jira_duration_real: {
        status: "completed",
        dataset: {
          name: "Apache's Jira Issues (tedlozzo)",
          source: "https://www.kaggle.com/datasets/tedlozzo/apaches-jira-issues",
          test_samples: 4000,
          tertiles_hours: {
            short_under: 24.0,
            medium_under: 168.0,
          },
        },
        models: {
          "Dummy (Majority)": { accuracy: 0.333, macro_f1: 0.167 },
          "Logistic Regression": { accuracy: 0.521, macro_f1: 0.518 },
          HistGradientBoosting: { accuracy: 0.556, macro_f1: 0.552 },
        },
      },
    };

    const htmlPopulated = renderToString(<RealDataBenchmarksSection metrics={mockPopulatedMetrics} />);
    expect(htmlPopulated).toContain("Real-Data Reference Benchmarks");
    expect(htmlPopulated).toContain(
      "Separate public benchmarks. They do not validate the synthetic Equilibrium models; feature schemas differ."
    );
    expect(htmlPopulated).not.toContain("Real-data benchmarks: not yet run");
    expect(htmlPopulated).toContain("Dataset A: Employee Burnout Benchmark");
    expect(htmlPopulated).toContain("Dataset B: Jira Resolution Duration Classification");
    expect(htmlPopulated).toContain("HistGradientBoosting");
    expect(htmlPopulated).toContain("Subjective Mental Fatigue Score Ablation");
  });
});
