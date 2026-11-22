import { buildFeatureVector } from "../utils/featureBuilder";
import { calculateFitScore, calculateRiskScore } from "../utils/scoring";

import modelQuality from "../models/model_quality.json";
import modelOntime from "../models/model_ontime.json";
import modelBurnout from "../models/model_burnout.json";
import featureSchema from "../models/feature_schema.json";
import metricsData from "../models/metrics.json";

export { modelQuality, modelOntime, modelBurnout, featureSchema, metricsData };

/**
 * Traverses a single serialized decision tree
 */
export function predictTree(tree, x) {
  let node = 0;
  while (tree.children_left[node] !== -1) {
    const fIdx = tree.feature[node];
    const threshold = tree.threshold[node];
    if (x[fIdx] <= threshold) {
      node = tree.children_left[node];
    } else {
      node = tree.children_right[node];
    }
  }
  return tree.value[node];
}

/**
 * Evaluates a serialized GradientBoosting ensemble
 */
export function predictEnsemble(model, rawFeatureDict) {
  if (!model || !rawFeatureDict) return null;

  const means = model.scaler_means || model.scaler_mean;
  const scales = model.scaler_scales || model.scaler_scale;
  const medians = model.imputer_medians;
  const initVal = model.init_val ?? model.init_prediction ?? 0;
  const trees = model.trees || model.estimators || [];

  // 1. Impute and standardize feature vector
  const x = model.feature_names.map((name, i) => {
    let val = rawFeatureDict[name];
    if (val === undefined || val === null || isNaN(val)) {
      val = medians[i];
    }
    // Scale: (val - mean) / scale
    return (val - means[i]) / scales[i];
  });

  // 2. Compute tree ensemble raw decision score
  let rawScore = initVal;
  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    rawScore += model.learning_rate * predictTree(tree, x);
  }

  // 3. Format output based on model type
  if (model.is_classifier || model.model_type === "classifier") {
    // Sigmoid probability
    const prob = 1 / (1 + Math.exp(-rawScore));
    const threshold = model.optimal_threshold ?? 0.5;
    return {
      rawScore,
      probability: prob,
      isPositive: prob >= threshold,
      threshold,
    };
  }

  return {
    prediction: rawScore,
  };
}

/** Synchronously checks if models are loaded */
export function areModelsLoaded() {
  return true;
}

/**
 * Synchronous task fit predictor
 */
export function predictTaskFit(member, task, allMembers = [], allTasks = []) {
  const tasksList = Array.isArray(allTasks) && allTasks.length > 0 
    ? allTasks 
    : (Array.isArray(allMembers) ? allMembers : []);
  const features = buildFeatureVector(member, task, tasksList);

  if (!features) {
    const heuristic = calculateFitScore(member, task);
    return {
      isMl: false,
      mlQuality: Math.round(heuristic.fitScore * 100),
      qualityScore: Math.round(heuristic.fitScore * 100),
      mlFitScore: heuristic.fitScore,
      mlOnTimeProb: 0.85,
      onTimeProbability: 0.85,
      isLikelyOnTime: true,
      features: null,
      disclaimer: "Running heuristic fallback",
    };
  }

  const qualityRes = predictEnsemble(modelQuality, features);
  const ontimeRes = predictEnsemble(modelOntime, features);

  const rawQuality = qualityRes?.prediction ?? 70.0;
  const clampedQuality = Math.max(0, Math.min(100, Math.round(rawQuality)));
  const mlFitScore = clampedQuality / 100;
  const mlOnTimeProb = ontimeRes?.probability ?? 0.80;

  return {
    isMl: true,
    mlQuality: clampedQuality,
    qualityScore: clampedQuality,
    mlFitScore,
    mlOnTimeProb,
    onTimeProbability: mlOnTimeProb,
    isLikelyOnTime: ontimeRes?.isPositive ?? true,
    features,
    disclaimer: "Trained on synthetic telemetry demonstration data",
  };
}

/**
 * Synchronous burnout predictor
 */
export function predictBurnout(member, allMembers = [], allTasks = []) {
  const tasksList = Array.isArray(allTasks) && allTasks.length > 0 
    ? allTasks 
    : (Array.isArray(allMembers) ? allMembers : []);
  const dummyTask = { estimatedHours: 0, requiredSkills: [], priority: "Medium" };
  const features = buildFeatureVector(member, dummyTask, tasksList);

  if (!features) {
    const heuristic = calculateRiskScore(member);
    return {
      isMl: false,
      burnoutProbability: heuristic.score / 100,
      riskTier: heuristic.tier,
      isHighRisk: heuristic.tier === "High",
      isElevated: heuristic.tier === "High" || heuristic.tier === "Medium",
      threshold: 0.35,
      topFactors: [`Streak: ${heuristic.streakWeeks} weeks over capacity`],
      features: null,
      disclaimer: "Running heuristic fallback",
    };
  }

  const boRes = predictEnsemble(modelBurnout, features);
  const prob = boRes?.probability ?? 0.15;
  const threshold = boRes?.threshold ?? modelBurnout.optimal_threshold ?? 0.35;
  const isElevated = prob >= threshold;
  const isHighRisk = prob >= 0.65;

  let riskTier = "Low";
  if (prob >= threshold) {
    riskTier = isHighRisk ? "High" : "Medium";
  } else if (prob >= 0.20) {
    riskTier = "Medium";
  }

  const topFactors = [];
  if (features.overload_streak_weeks >= 2) {
    topFactors.push(`${features.overload_streak_weeks}-week overtime streak (>100%)`);
  }
  if (features.current_utilization > 1.0) {
    topFactors.push(`Current allocation at ${Math.round(features.current_utilization * 100)}% capacity`);
  }
  if (features.recent_pto_days < 2) {
    topFactors.push("Low recent recovery buffer (<2 PTO days)");
  }
  if (features.overtime_trend > 0) {
    topFactors.push("Upward trajectory in weekly overtime");
  }
  if (topFactors.length === 0) {
    topFactors.push("Normal capacity distribution without sustained fatigue markers");
  }

  return {
    burnoutProbability: prob,
    isElevated,
    isHighRisk,
    riskTier,
    threshold,
    topFactors,
    features,
    disclaimer: "Trained on synthetic telemetry demonstration data",
  };
}

/**
 * Async wrapper for candidate task assignment scoring
 */
export async function scoreCandidateML(member, task, allTasks = []) {
  return predictTaskFit(member, task, [], allTasks);
}

/**
 * Async wrapper for member burnout prediction
 */
export async function predictMemberBurnoutML(member, allTasks = []) {
  return predictBurnout(member, [], allTasks);
}

export async function getMLMetrics() {
  return metricsData;
}
