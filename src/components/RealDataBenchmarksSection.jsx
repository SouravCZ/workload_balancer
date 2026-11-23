import defaultMetrics from "../models/real_metrics.json";
import { Card, CardHeader, Icon } from "./ui";

export default function RealDataBenchmarksSection({ metrics = defaultMetrics }) {
  const isNotRun =
    !metrics ||
    metrics.status === "not_run" ||
    (!metrics.burnout_real && !metrics.jira_duration_real);

  const burnout = metrics?.burnout_real;
  const jira = metrics?.jira_duration_real;

  return (
    <Card className="p-lg">
      <CardHeader
        title="Real-Data Reference Benchmarks"
        subtitle="Empirical performance benchmarks evaluated on public organizational datasets"
        icon="dataset"
      />

      {/* Explicit Methodology Disclaimer */}
      <div className="mt-md p-md rounded-xl bg-secondary-container/20 border border-secondary/30 text-xs text-secondary leading-relaxed">
        <strong className="text-primary font-bold block mb-1">
          Separate Public Benchmarks Notice:
        </strong>
        <span>
          Separate public benchmarks. They do not validate the synthetic Equilibrium models; feature
          schemas differ.
        </span>{" "}
        <span>
          These pipelines evaluate empirical predictability on external organizational schemas and
          are strictly partitioned offline. They are never wired into the live in-browser scoring
          engine.
        </span>
      </div>

      {isNotRun ? (
        <div className="mt-md p-lg rounded-xl bg-surface-container-low border border-dashed border-outline-variant text-center space-y-sm">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-container text-secondary">
            <Icon name="pending_actions" className="text-xl" />
          </div>
          <h4 className="font-headline-sm text-sm font-bold text-primary">
            Real-data benchmarks: not yet run
          </h4>
          <p className="text-xs text-secondary max-w-xl mx-auto leading-relaxed">
            Public benchmark datasets have not yet been evaluated in this environment. To run the
            offline empirical benchmarks on local machine datasets:
          </p>
          <div className="pt-xs max-w-lg mx-auto text-left space-y-2">
            <div className="p-sm rounded bg-surface-container font-mono text-[11px] text-primary">
              <code>python ml/real/train_burnout_real.py</code>
              <span className="block text-[10px] text-secondary font-sans mt-0.5">
                Evaluates HackerEarth Employee Burnout dataset (Paras Varshney)
              </span>
            </div>
            <div className="p-sm rounded bg-surface-container font-mono text-[11px] text-primary">
              <code>python ml/real/train_duration_real.py</code>
              <span className="block text-[10px] text-secondary font-sans mt-0.5">
                Evaluates Apache Jira Issue Resolution Duration dataset (Ted Lozzo)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-outline pt-xs">
            See <code>ml/real/README.md</code> and <code>ml/real/SOURCES.md</code> for acquisition
            instructions.
          </p>
        </div>
      ) : (
        <div className="mt-md space-y-lg">
          {burnout && burnout.status === "completed" && (
            <div className="space-y-sm">
              <div className="flex items-center justify-between">
                <h4 className="font-label-md text-xs uppercase tracking-wider text-primary font-bold">
                  Dataset A: Employee Burnout Benchmark (HackerEarth / Paras Varshney)
                </h4>
                <span className="text-[10px] font-mono bg-surface-container px-2 py-0.5 rounded text-secondary">
                  N = {burnout.dataset.test_rows} test ({burnout.dataset.total_rows} total)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {/* Regression */}
                <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant space-y-xs">
                  <span className="text-xs font-bold text-primary block">
                    Continuous Burn Rate (Regression)
                  </span>
                  <p className="text-[11px] text-secondary">
                    Operational features only (Mental Fatigue Score excluded).
                  </p>
                  <div className="pt-xs font-mono text-xs space-y-1">
                    <div className="text-secondary flex justify-between">
                      <span>Mean Baseline:</span>
                      <span>R² = {burnout.operational_model_main.regression["Dummy (Mean)"].R2.toFixed(3)} (MAE: {burnout.operational_model_main.regression["Dummy (Mean)"].MAE.toFixed(3)})</span>
                    </div>
                    <div className="text-secondary flex justify-between">
                      <span>Ridge Linear:</span>
                      <span>R² = {burnout.operational_model_main.regression["Linear (Ridge)"].R2.toFixed(3)} (MAE: {burnout.operational_model_main.regression["Linear (Ridge)"].MAE.toFixed(3)})</span>
                    </div>
                    <div className="text-primary font-bold flex justify-between">
                      <span>HistGradientBoosting:</span>
                      <span>R² = {burnout.operational_model_main.regression.HistGradientBoosting.R2.toFixed(3)} (MAE: {burnout.operational_model_main.regression.HistGradientBoosting.MAE.toFixed(3)})</span>
                    </div>
                  </div>
                  <div className="pt-xs text-[10px] text-secondary italic">
                    Gap vs Linear: {burnout.operational_model_main.regression.gap_gbdt_vs_linear_r2 >= 0 ? "+" : ""}{burnout.operational_model_main.regression.gap_gbdt_vs_linear_r2.toFixed(3)} R²
                  </div>
                </div>

                {/* Classification */}
                <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant space-y-xs">
                  <span className="text-xs font-bold text-primary block">
                    High Burnout Classification (Rate ≥ {burnout.dataset.high_burnout_threshold.toFixed(2)})
                  </span>
                  <p className="text-[11px] text-secondary">
                    Test prevalence: {(burnout.dataset.test_positive_rate * 100).toFixed(1)}%.
                  </p>
                  <div className="pt-xs font-mono text-xs space-y-1">
                    <div className="text-secondary flex justify-between">
                      <span>Majority Baseline:</span>
                      <span>AUC = {burnout.operational_model_main.classification["Dummy (Majority)"]["ROC-AUC"].toFixed(3)}</span>
                    </div>
                    <div className="text-secondary flex justify-between">
                      <span>Logistic Regression:</span>
                      <span>AUC = {burnout.operational_model_main.classification["Logistic Regression"]["ROC-AUC"].toFixed(3)}</span>
                    </div>
                    <div className="text-primary font-bold flex justify-between">
                      <span>HistGradientBoosting:</span>
                      <span>AUC = {burnout.operational_model_main.classification.HistGradientBoosting["ROC-AUC"].toFixed(3)}</span>
                    </div>
                  </div>
                  <div className="pt-xs text-[10px] text-secondary italic">
                    Gap vs Logistic: {burnout.operational_model_main.classification.gap_gbdt_vs_logistic_auc >= 0 ? "+" : ""}{burnout.operational_model_main.classification.gap_gbdt_vs_logistic_auc.toFixed(3)} AUC
                  </div>
                </div>
              </div>

              {/* Ablation Card */}
              {burnout.ablation_with_mental_fatigue && (
                <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/60 text-xs space-y-1">
                  <strong className="text-primary font-bold">
                    Subjective Mental Fatigue Score Ablation:
                  </strong>
                  <p className="text-secondary text-[11px]">
                    Adding self-reported mental fatigue yields R² ={" "}
                    {burnout.ablation_with_mental_fatigue.regression_r2.toFixed(3)} (+
                    {burnout.ablation_with_mental_fatigue.r2_lift_over_operational_only.toFixed(3)} lift) and ROC-AUC ={" "}
                    {burnout.ablation_with_mental_fatigue.classification_roc_auc.toFixed(3)}.
                    Equilibrium intentionally restricts live features to objective operational telemetry to protect team privacy.
                  </p>
                </div>
              )}
            </div>
          )}

          {jira && jira.status === "completed" && (
            <div className="space-y-sm pt-sm border-t border-outline-variant">
              <div className="flex items-center justify-between">
                <h4 className="font-label-md text-xs uppercase tracking-wider text-primary font-bold">
                  Dataset B: Jira Resolution Duration Classification (Apache / Ted Lozzo)
                </h4>
                <span className="text-[10px] font-mono bg-surface-container px-2 py-0.5 rounded text-secondary">
                  N = {jira.dataset.test_samples} test (Time-based split)
                </span>
              </div>

              <div className="p-md rounded-xl bg-surface-container-lowest border border-outline-variant space-y-xs">
                <span className="text-xs font-bold text-primary block">
                  3-Class Duration Tertiles (Short &le; {jira.dataset.tertiles_hours.short_under.toFixed(1)}h · Medium &le; {jira.dataset.tertiles_hours.medium_under.toFixed(1)}h · Long &gt; {jira.dataset.tertiles_hours.medium_under.toFixed(1)}h)
                </span>
                <div className="pt-xs grid grid-cols-1 md:grid-cols-3 gap-sm font-mono text-xs">
                  <div className="p-sm rounded bg-surface-container">
                    <span className="text-secondary text-[10px] block">Majority Baseline</span>
                    <span className="font-bold text-primary">Acc: {(jira.models["Dummy (Majority)"].accuracy * 100).toFixed(1)}%</span>
                    <span className="block text-[10px] text-secondary">F1: {jira.models["Dummy (Majority)"].macro_f1.toFixed(3)}</span>
                  </div>
                  <div className="p-sm rounded bg-surface-container">
                    <span className="text-secondary text-[10px] block">Logistic Regression</span>
                    <span className="font-bold text-primary">Acc: {(jira.models["Logistic Regression"].accuracy * 100).toFixed(1)}%</span>
                    <span className="block text-[10px] text-secondary">F1: {jira.models["Logistic Regression"].macro_f1.toFixed(3)}</span>
                  </div>
                  <div className="p-sm rounded bg-surface-container border border-primary/20">
                    <span className="text-secondary text-[10px] block">HistGradientBoosting</span>
                    <span className="font-bold text-primary">Acc: {(jira.models.HistGradientBoosting.accuracy * 100).toFixed(1)}%</span>
                    <span className="block text-[10px] text-secondary">F1: {jira.models.HistGradientBoosting.macro_f1.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
