import { useState, useEffect } from "react";
import { Card, Chip, Icon } from "./ui";
import { calculateFitScore } from "../utils/scoring";
import { scoreCandidateML } from "../services/mlModel";

export default function MlVsHeuristicPanel({ members = [], tasks = [] }) {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function computeComparisons() {
      setLoading(true);
      const results = [];

      for (const task of tasks.slice(0, 10)) {
        for (const member of members) {
          const heur = calculateFitScore(member, task);
          const ml = await scoreCandidateML(member, task, tasks);

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
                reason = "Nonlinear multi-variable fatigue and deadline pressure adjustments.";
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
        // Sort by largest divergence
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

  return (
    <Card className="p-lg space-y-md border border-outline-variant">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-sm pb-md border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-sm">
            <Icon name="compare_arrows" className="text-primary text-[22px]" />
            <h3 className="font-headline-sm text-headline-sm text-primary">
              ML vs. Heuristic Divergence Radar
            </h3>
          </div>
          <p className="font-body-sm text-xs text-secondary mt-1">
            Real-time audit comparing deterministic heuristic scores against trained nonlinear ML models.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-secondary-container text-on-secondary-container font-semibold">
            {comparisons.length} Divergence Cases (|&Delta;| &ge; 15%)
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-xl text-center text-xs text-secondary font-mono flex items-center justify-center gap-2">
          <Icon name="sync" className="animate-spin text-[16px]" />
          <span>Computing cross-model divergence matrix...</span>
        </div>
      ) : comparisons.length === 0 ? (
        <p className="py-md text-center text-xs text-secondary">
          No major divergences detected. The heuristic and ML models are closely aligned on current allocations.
        </p>
      ) : (
        <div className="space-y-sm max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
          {comparisons.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="p-md rounded-xl bg-surface-container-low border border-outline-variant/60 flex flex-col md:flex-row md:items-center justify-between gap-md"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-label-md text-xs font-bold text-on-surface">
                    {item.task.title}
                  </span>
                  <span className="text-[10px] text-secondary">({item.task.estimatedHours}h)</span>
                  <span className="text-secondary text-[11px]">&rarr;</span>
                  <span className="font-label-md text-xs font-semibold text-primary">
                    {item.member.name}
                  </span>
                </div>
                <p className="text-xs text-secondary font-body-sm leading-relaxed">
                  <strong className="text-primary font-medium">Why they disagree: </strong>
                  {item.reason}
                </p>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 self-end md:self-center">
                <div className="text-right">
                  <div className="text-[10px] text-secondary uppercase tracking-wider">Heuristic</div>
                  <div className="font-mono text-sm font-bold text-secondary">
                    {item.heuristicScore}%
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-primary uppercase tracking-wider">ML Quality</div>
                  <div className="font-mono text-sm font-bold text-primary">
                    {item.mlScore}%
                  </div>
                </div>

                <div className="pl-2 border-l border-outline-variant text-right">
                  <div className="text-[10px] text-outline uppercase tracking-wider">Divergence</div>
                  <Chip
                    tone={item.mlScore > item.heuristicScore ? "positive" : "warning"}
                    className="font-mono text-xs font-bold"
                  >
                    {item.mlScore > item.heuristicScore ? "+" : "-"}
                    {item.diff}%
                  </Chip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
