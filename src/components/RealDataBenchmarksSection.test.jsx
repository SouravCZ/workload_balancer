import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import RealDataBenchmarksSection from "./RealDataBenchmarksSection";

describe("RealDataBenchmarksSection UI Rendering", () => {
  it("renders 'not yet run' state when no benchmark results are present", () => {
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
          test_rows: 4326,
          high_burnout_threshold: 0.6,
          test_positive_rate: 0.238,
        },
        operational_model_main: {
          regression: {
            "Dummy (Mean)": { R2: -0.0001, MAE: 0.159 },
            "Linear (Ridge)": { R2: 0.713, MAE: 0.085 },
            HistGradientBoosting: { R2: 0.743, MAE: 0.081 },
            gap_gbdt_vs_linear_r2: 0.03,
          },
          classification: {
            "Dummy (Majority)": { "ROC-AUC": 0.5, "PR-AUC": 0.238, Accuracy: 0.7617, F1: 0 },
            "Logistic Regression": {
              "ROC-AUC": 0.913,
              "PR-AUC": 0.786,
              Accuracy: 0.825,
              Precision: 0.598,
              Recall: 0.808,
              F1: 0.688,
            },
            HistGradientBoosting: {
              "ROC-AUC": 0.92,
              "PR-AUC": 0.8,
              Accuracy: 0.8669,
              Precision: 0.7636,
              Recall: 0.6392,
              F1: 0.6959,
            },
            gap_gbdt_vs_logistic_auc: 0.0066,
          },
        },
        ablation_with_mental_fatigue: {
          regression_r2: 0.91,
          r2_lift_over_operational_only: 0.167,
          classification_roc_auc: 0.969,
          classification_accuracy: 0.9103,
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
    expect(htmlPopulated).toMatch(/Acc = (<!-- -->)?86\.7(<!-- -->)?%/);
    expect(htmlPopulated).toMatch(/Precision = (<!-- -->)?0\.764/);
    expect(htmlPopulated).toContain("Subjective Mental Fatigue Score Ablation");
  });
});
