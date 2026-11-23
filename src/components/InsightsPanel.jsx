import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Chip, Icon, riskTone } from "./ui";
import Modal, { Button, ModalActions } from "./Modal";

function ReasonRow({ children }) {
  return (
    <li className="flex items-start gap-sm">
      <Icon name="check_circle" className="text-primary-container text-[18px]" />
      <span className="font-body-sm text-body-sm text-secondary">{children}</span>
    </li>
  );
}

export default function InsightsPanel({ proposal, riskRow, suggestions, teamRisk }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);

  return (
    <aside className="w-80 bg-surface-container-low border-l border-outline-variant p-lg overflow-y-auto flex-shrink-0 custom-scrollbar hidden xl:block">
      <h3 className="font-headline-sm text-headline-sm text-primary flex items-center gap-sm mb-lg">
        <Icon name="auto_awesome" className="text-primary-container" filled />
        AI Insights
      </h3>

      <Card className="p-md mb-lg">
        <h4 className="font-label-md text-label-md text-on-surface font-semibold mb-sm">
          Why this assignment?
        </h4>
        {proposal ? (
          <>
            <p className="font-body-sm text-body-sm text-secondary mb-md">
              <strong className="text-on-surface">{proposal.to.name}</strong> is the strongest
              candidate for <strong className="text-on-surface">{proposal.task.title}</strong>.
            </p>
            <ul className="space-y-sm font-body-sm text-body-sm text-secondary">
              <ReasonRow>
                {Math.round(proposal.fitScore * 100)}% fit on{" "}
                {proposal.task.requiredSkills.join(", ")}
              </ReasonRow>
              <ReasonRow>
                Capacity headroom of{" "}
                {proposal.to.capacityHours - proposal.to.currentAllocatedHours}h this sprint
              </ReasonRow>
              <ReasonRow>
                {proposal.type === "assign" || !proposal.from
                  ? `Directly allocates unassigned ${proposal.hours}h backlog work`
                  : `Reduces donor load by ${proposal.hours}h`}
              </ReasonRow>
            </ul>
          </>
        ) : (
          <p className="font-body-sm text-body-sm text-secondary">
            No rebalance proposed. Current allocation is already within healthy capacity bands.
          </p>
        )}
      </Card>

      <Card className="p-md mb-lg">
        <h4 className="font-label-md text-label-md text-on-surface font-semibold mb-sm flex items-center gap-sm">
          <Icon name="psychiatry" className="text-error" />
          Team Burnout Risk
        </h4>
        <div className="flex items-center justify-between mb-md">
          <span className="font-headline-md text-headline-md text-on-surface">{teamRisk}</span>
          <Icon
            name={teamRisk === "Low" ? "trending_down" : "trending_up"}
            className={teamRisk === "High" ? "text-error" : "text-risk-amber-ink"}
          />
        </div>
        <div className="w-full h-2 bg-secondary-container rounded-full overflow-hidden mb-md">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, teamRisk === "Low" ? 22 : teamRisk === "Medium" ? 55 : 82)}%`,
              backgroundColor: teamRisk === "High" ? "#ba1a1a" : teamRisk === "Medium" ? "#8C6A1D" : "#4c6359",
            }}
          />
        </div>
        {riskRow ? (
          <p className="font-body-sm text-body-sm text-secondary">
            <strong className="text-on-surface">{riskRow.member.name}</strong> is trending toward
            burnout after {riskRow.risk.streakWeeks} consecutive weeks over capacity.
          </p>
        ) : (
          <p className="font-body-sm text-body-sm text-secondary">
            No member is currently above contracted capacity.
          </p>
        )}
      </Card>

      <Card className="p-md">
        <h4 className="font-label-md text-label-md text-on-surface font-semibold mb-sm flex items-center gap-sm">
          <Icon name="lightbulb" className="text-primary-container" />
          Smart Suggestions
        </h4>
        <div className="space-y-sm">
          {suggestions.map((item, idx) => (
            <button
              key={`${item.title}-${item.detail || idx}`}
              type="button"
              onClick={() => setSelected(item)}
              className="w-full text-left px-sm py-sm rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors flex justify-between items-center group"
            >
              <div>
                <span className="block font-label-md text-label-md text-on-surface">
                  {item.title}
                </span>
                <span className="block font-body-sm text-body-sm text-secondary text-[12px]">
                  {item.detail}
                </span>
              </div>
              <Icon
                name={item.icon}
                className="text-secondary group-hover:text-primary-container"
              />
            </button>
          ))}
        </div>
        {riskRow ? (
          <div className="mt-md pt-md border-t border-outline-variant flex items-center justify-between">
            <Chip tone={riskTone(riskRow.risk.tier)} icon="warning">
              {riskRow.risk.tier} risk
            </Chip>
            <span className="font-label-md text-label-md text-secondary">
              {riskRow.member.name}
            </span>
          </div>
        ) : null}
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Recommendation"}
        icon={selected?.icon}
        footer={
          <ModalActions>
            <Button onClick={() => setSelected(null)}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                setSelected(null);
                navigate("/tasks");
              }}
            >
              Open in Tasks
            </Button>
          </ModalActions>
        }
      >
        {selected ? (
          <>
            <p className="font-body-sm text-body-sm text-secondary">{selected.detail}</p>

            <ul className="mt-lg space-y-sm font-body-sm text-body-sm text-secondary">
              {proposal ? (
                <ReasonRow>
                  {proposal.to.name} scores {Math.round(proposal.fitScore * 100)}% fit on{" "}
                  {proposal.task.requiredSkills.join(", ")}
                </ReasonRow>
              ) : null}
              {proposal ? (
                <ReasonRow>
                  {proposal.from ? (
                    <>
                      Moving {proposal.hours}h from {proposal.from.name} leaves them{" "}
                      {Math.round((proposal.from.currentAllocatedHours / proposal.from.capacityHours) * 100)}%
                      utilised.
                    </>
                  ) : (
                    <>Assigns {proposal.hours}h of open backlog work to active sprint.</>
                  )}
                </ReasonRow>
              ) : null}
              {riskRow ? (
                <ReasonRow>
                  {riskRow.member.name} has been over capacity for{" "}
                  {riskRow.risk.streakWeeks} consecutive weeks.
                </ReasonRow>
              ) : (
                <ReasonRow>No member is currently above contracted capacity.</ReasonRow>
              )}
              <ReasonRow>Current team risk level is {teamRisk}.</ReasonRow>
            </ul>
          </>
        ) : null}
      </Modal>
    </aside>
  );
}
