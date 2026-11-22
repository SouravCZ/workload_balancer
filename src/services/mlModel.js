import { buildFeatureVector } from "../utils/featureBuilder";
import { calculateFitScore, calculateRiskScore } from "../utils/scoring";

// Static references for dynamic loading
let modelsPromise = null;
let modelsCache = null;
let loadFailed = false;

/**
 * Lazy loads the JSON model bundle via dynamic import()
 */
export async function loadModels() {
  if (modelsCache) return modelsCache;
  if (loadFailed) return null;

  if (!modelsPromise) {
    modelsPromise = Promise.all([
      import("../models/model_quality.json"),
      import("../models/model_ontime.json"),
      import("../models/model_burnout.json"),
      import("../models/metrics.json"),
      import("../models/feature_schema.json"),
    ])
      .then(([qualityMod, ontimeMod, burnoutMod, metricsMod, schemaMod]) => {
        modelsCache = {
          quality: qualityMod.default ?? qualityMod,
          ontime: ontimeMod.default ?? ontimeMod,
          burnout: burnoutMod.default ?? burnoutMod,
          metrics: metricsMod.default ?? metricsMod,
          schema: schemaMod.default ?? schemaMod,
          loaded: true,
        };
        loadFailed = false;
        return modelsCache;
      })
      .catch((err) => {
        loadFailed = true;
        console.warn("ML model bundle loading fallback to heuristic:", err);
        return null;
      });
  }
  return modelsPromise;
}

export function hasModelLoadFailed() {
  return loadFailed;
}

export function areModelsLoaded() {
  return modelsCache !== null && modelsCache.loaded === true;
}

export function getCachedModels() {
  return modelsCache;
}

/**
 * For testing: simulates model load failures and resets internal state
 */
export function _resetModelsForTesting({ fail = false, mockBundle = null } = {}) {
  modelsPromise = null;
  modelsCache = mockBundle;
  loadFailed = fail;
}

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

/**
 * Asynchronous task fit predictor with dynamic model bundle loading and graceful heuristic fallback
 */
export async function scoreCandidateML(member, task, allTasks = []) {
  const models = await loadModels();
  const tasksList = Array.isArray(allTasks) ? allTasks : [];
  const features = buildFeatureVector(member, task, tasksList);

  if (!models || !features) {
    const heuristic = calculateFitScore(member, task);
    return {
      isMl: false,
      loadFailed: loadFailed || !models,
      mlQuality: Math.round(heuristic.fitScore * 100),
      qualityScore: Math.round(heuristic.fitScore * 100),
      mlFitScore: heuristic.fitScore,
      mlOnTimeProb: 0.80,
      onTimeProbability: 0.80,
      isLikelyOnTime: true,
      features: null,
      disclaimer: "Heuristic fallback active (ML model bundle unavailable)",
    };
  }

  const qualityRes = predictEnsemble(models.quality, features);
  const ontimeRes = predictEnsemble(models.ontime, features);

  const rawQuality = qualityRes?.prediction ?? 70.0;
  const clampedQuality = Math.max(0, Math.min(100, Math.round(rawQuality)));
  const mlFitScore = clampedQuality / 100;
  const mlOnTimeProb = ontimeRes?.probability ?? 0.80;

  return {
    isMl: true,
    loadFailed: false,
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
 * Asynchronous member burnout predictor with dynamic model bundle loading and graceful heuristic fallback
 */
export async function predictMemberBurnoutML(member, allTasks = []) {
  const models = await loadModels();
  const tasksList = Array.isArray(allTasks) ? allTasks : [];
  const dummyTask = { estimatedHours: 0, requiredSkills: [], priority: "Medium" };
  const features = buildFeatureVector(member, dummyTask, tasksList);

  if (!models || !features) {
    const heuristic = calculateRiskScore(member);
    return {
      isMl: false,
      loadFailed: loadFailed || !models,
      burnoutProbability: heuristic.score / 100,
      riskTier: heuristic.tier,
      isHighRisk: heuristic.tier === "High",
      isElevated: heuristic.tier === "High" || heuristic.tier === "Medium",
      threshold: 0.33,
      topFactors: [`Streak: ${heuristic.streakWeeks} weeks over capacity`],
      features: null,
      disclaimer: "Heuristic fallback active (ML model bundle unavailable)",
    };
  }

  const boRes = predictEnsemble(models.burnout, features);
  const prob = boRes?.probability ?? 0.15;
  const threshold = boRes?.threshold ?? models.burnout.optimal_threshold ?? 0.33;
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
    isMl: true,
    loadFailed: false,
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
 * Synchronous task fit predictor using cached models or heuristic fallback
 */
export function predictTaskFit(member, task, allMembers = [], allTasks = []) {
  const tasksList = Array.isArray(allTasks) && allTasks.length > 0 
    ? allTasks 
    : (Array.isArray(allMembers) ? allMembers : []);
  const features = buildFeatureVector(member, task, tasksList);

  if (!modelsCache || !features) {
    // Trigger lazy background load if not loaded yet
    if (!modelsCache && !loadFailed && !modelsPromise) {
      loadModels();
    }
    const heuristic = calculateFitScore(member, task);
    return {
      isMl: false,
      loadFailed,
      mlQuality: Math.round(heuristic.fitScore * 100),
      qualityScore: Math.round(heuristic.fitScore * 100),
      mlFitScore: heuristic.fitScore,
      mlOnTimeProb: 0.80,
      onTimeProbability: 0.80,
      isLikelyOnTime: true,
      features: null,
      disclaimer: "Heuristic fallback active (ML models loading or unavailable)",
    };
  }

  const qualityRes = predictEnsemble(modelsCache.quality, features);
  const ontimeRes = predictEnsemble(modelsCache.ontime, features);

  const rawQuality = qualityRes?.prediction ?? 70.0;
  const clampedQuality = Math.max(0, Math.min(100, Math.round(rawQuality)));
  const mlFitScore = clampedQuality / 100;
  const mlOnTimeProb = ontimeRes?.probability ?? 0.80;

  return {
    isMl: true,
    loadFailed: false,
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
 * Synchronous burnout predictor using cached models or heuristic fallback
 */
export function predictBurnout(member, allMembers = [], allTasks = []) {
  const tasksList = Array.isArray(allTasks) && allTasks.length > 0 
    ? allTasks 
    : (Array.isArray(allMembers) ? allMembers : []);
  const dummyTask = { estimatedHours: 0, requiredSkills: [], priority: "Medium" };
  const features = buildFeatureVector(member, dummyTask, tasksList);

  if (!modelsCache || !features) {
    if (!modelsCache && !loadFailed && !modelsPromise) {
      loadModels();
    }
    const heuristic = calculateRiskScore(member);
    return {
      isMl: false,
      loadFailed,
      burnoutProbability: heuristic.score / 100,
      riskTier: heuristic.tier,
      isHighRisk: heuristic.tier === "High",
      isElevated: heuristic.tier === "High" || heuristic.tier === "Medium",
      threshold: 0.33,
      topFactors: [`Streak: ${heuristic.streakWeeks} weeks over capacity`],
      features: null,
      disclaimer: "Heuristic fallback active (ML models loading or unavailable)",
    };
  }

  const boRes = predictEnsemble(modelsCache.burnout, features);
  const prob = boRes?.probability ?? 0.15;
  const threshold = boRes?.threshold ?? modelsCache.burnout.optimal_threshold ?? 0.33;
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
    isMl: true,
    loadFailed: false,
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

export async function getMLMetrics() {
  const models = await loadModels();
  return models?.metrics ?? null;
}
