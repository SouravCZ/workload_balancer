import { useState, useEffect } from "react";
import { Card, Chip, Icon } from "./ui";
import { calculateFitScore } from "../utils/scoring";
import { scoreCandidateML, hasModelLoadFailed } from "../services/mlModel";

export default function MlVsHeuristicPanel({ members = [], tasks = [] }) {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function computeComparisons() {
      setLoading(true);
      const results = [];
      let failureObserved = hasModelLoadFailed();

      for (const task of tasks.slice(0, 10)) {
        for (const member of members) {
          const heur = calculateFitScore(member, task);
          const ml = await scoreCandidateML(member, task, tasks);

          if (ml.loadFailed || !ml.isMl) {
            failureObserved = true;
          }

          const diff = Math.abs(ml.mlFitScore - heur.fitScore);
          // Highlight cases with meaningful divergence (> 0.15)
          if (diff >= 0.15) {
            let reason = "";
            const postUtil = (member.currentAllocatedHours + task.estimatedHours) / member.capacityHours;

            if (ml.mlFitScore < heur.fitScore) {
              if (postUtil > 1.05) {
                reason = `ML penalized cognitive fatigue from severe projected overload (${Math.round(postUtil * 100)}%), which the heuristic only partially dampens.`;
              } else if (ml.features?.skill_gap_max >= 2) {
                reason = `ML detected a critical skill deficit (gap = ${ml.features.skill_gap_max} levels) despite high availability.`;
              } else if (ml.features?.concurrent_task_count >= 4) {
                reason = `ML penalized high context switching friction (${ml.features.concurrent_task_count} concurrent tasks in flight).`;
              } else {
                reason = "Multi-variable fatigue and deadline pressure adjustments.";
              }
            } else {
              if (heur.availabilityScore === 0 && postUtil <= 1.05) {
                reason = "Heuristic clamped availability to zero, while ML recognizes strong domain synergy with manageable buffer.";
              } else {
                reason = "ML rewards high skill coverage ratio and seniority over raw remaining hours.";
              }
            }

            results.push({
              id: `${task.id}-${member.id}`,
              task,
              member,
              heuristicScore: Math.round(heur.fitScore * 100),
              mlScore: Math.round(ml.mlFitScore * 100),
              diff: Math.round(diff * 100),
              onTimeProbability: Math.round(ml.onTimeProbability * 100),
              reason,
            });
          }
        }
      }

      if (isMounted) {
        setLoadError(failureObserved);
        results.sort((a, b) => b.diff - a.diff);
        setComparisons(results);
        setLoading(false);
      }
    }

    computeComparisons();

    return () => {
      isMounted = false;
    };
  }, [members, tasks]);

  if (loadError) {
    return (
      <div role="alert" className="p-md rounded-xl bg-error-container/20 border border-error-container text-error text-xs flex items-center gap-sm">
        <Icon name="warning" className="text-[18px] flex-shrink-0" />
        <div>
          <span className="font-bold block">ML Model Unavailable — Heuristic Fallback Active</span>
          <span className="text-secondary block">
            The machine learning model bundle could not be loaded. Operating exclusively on deterministic mathematical formulas.
          </span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-md text-xs text-secondary font-label-md flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
        <span>Evaluating ML vs Heuristic divergence...</span>
      </div>
    );
  }

  if (comparisons.length === 0) {
    return (
      <Card className="p-md bg-surface-container-low border border-outline-variant/40">
        <div className="flex items-center gap-sm text-xs text-secondary">
          <Icon name="check_circle" className="text-primary text-[18px]" />
          <span>
            <strong>High Model Alignment:</strong> ML and heuristic scores agree within 15% across all current candidate evaluations.
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-lg space-y-md border border-primary-container/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm border-b border-outline-variant/40 pb-sm">
        <div className="flex items-center gap-xs">
          <Icon name="insights" className="text-primary-container text-[20px]" />
          <h3 className="font-headline-sm text-sm font-bold text-primary">
            ML vs Heuristic Divergence Audit (|&Delta;| &ge; 15%)
          </h3>
        </div>
        <span className="text-[11px] text-secondary font-label-md">
          {comparisons.length} flagged assignment{comparisons.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-sm divide-y divide-outline-variant/30">
        {comparisons.map((c) => (
          <div key={c.id} className="pt-sm first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-sm">
                <span className="font-semibold text-xs text-primary">{c.task.title}</span>
                <span className="text-secondary text-xs">&rarr;</span>
                <span className="font-medium text-xs text-on-surface">{c.member.name}</span>
              </div>
              <p className="text-[11px] text-secondary leading-snug">{c.reason}</p>
            </div>

            <div className="flex items-center gap-md text-xs font-mono shrink-0">
              <div className="text-center">
                <span className="text-[10px] text-secondary block font-sans uppercase">Heuristic</span>
                <span className="font-bold text-primary">{c.heuristicScore}%</span>
              </div>
              <div className="text-secondary">&rarr;</div>
              <div className="text-center">
                <span className="text-[10px] text-secondary block font-sans uppercase">ML Fit</span>
                <span className={`font-bold ${c.mlScore > c.heuristicScore ? "text-primary" : "text-error"}`}>
                  {c.mlScore}%
                </span>
              </div>
              <Chip tone={c.diff >= 25 ? "high" : "medium"}>
                &Delta; {c.diff}%
              </Chip>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
