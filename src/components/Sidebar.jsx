import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "./ui";
import Modal, { Button, ModalActions } from "./Modal";
import { useTeamContext } from "../context/TeamContext";
import {
  calculateWorkloadUtilization,
  rankCandidates,
  rebalanceProposals,
} from "../utils/scoring";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: "dashboard" },
  { to: "/workload", label: "Team Workload", icon: "groups" },
  { to: "/tasks", label: "Tasks", icon: "assignment" },
  { to: "/skill-matrix", label: "Skill Matrix", icon: "psychology" },
  { to: "/burnout-risk", label: "Burnout Risk", icon: "psychiatry" },
  { to: "/insights", label: "Insights", icon: "insights" },
];

export default function Sidebar({ highRiskCount = 0 }) {
  const { members, tasks } = useTeamContext();
  const [openReasoning, setOpenReasoning] = useState(false);

  const reasoning = useMemo(() => {
    const transfers = rebalanceProposals(members, tasks);

    const openWork = tasks
      .filter((task) => !task.assignedMemberId)
      .map((task) => {
        const best = rankCandidates(task, members)[0];
        return best ? { task, member: best.member, fitScore: best.fitScore } : null;
      })
      .filter(Boolean);

    const overloaded = members
      .map((member) => ({ member, utilization: calculateWorkloadUtilization(member).utilization }))
      .filter((row) => row.utilization > 1)
      .sort((a, b) => b.utilization - a.utilization);

    return { transfers, openWork, overloaded };
  }, [members, tasks]);

  const recommendationCount =
    reasoning.transfers.length + reasoning.openWork.length + reasoning.overloaded.length;

  return (
    <nav className="bg-surface border-r border-outline-variant hidden md:flex h-screen w-64 flex-col p-md flex-shrink-0 z-20">
      <NavLink to="/dashboard" className="mb-xl flex items-center gap-sm px-sm">
        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold">
          E
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm text-primary leading-tight">Equilibrium</h1>
          <p className="font-label-md text-label-md text-on-surface-variant leading-tight">
            Team Operations
          </p>
        </div>
      </NavLink>

      <div className="flex-1 space-y-xs overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-md px-sm py-sm rounded-lg transition-colors duration-200 ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} filled={isActive} className="text-[20px]" />
                <span className="font-body-sm text-body-sm">{item.label}</span>
                {item.to === "/burnout-risk" && highRiskCount > 0 ? (
                  <span className="ml-auto rounded-full bg-error-container text-error px-1.5 py-0.5 font-label-md text-[10px]">
                    {highRiskCount}
                  </span>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="mt-auto pt-md border-t border-outline-variant">
        <NavLink
          to="/team-members"
          className={({ isActive }) =>
            `flex items-center gap-md px-sm py-sm rounded-lg transition-colors duration-200 ${
              isActive
                ? "bg-secondary-container text-on-secondary-container font-semibold"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`
          }
        >
          <Icon name="badge" className="text-[20px]" />
          <span className="font-body-sm text-body-sm">Team Members</span>
        </NavLink>
        <button
          type="button"
          onClick={() => setOpenReasoning(true)}
          className="mt-md w-full flex items-center justify-center gap-sm bg-primary-container text-on-primary py-2 px-md rounded-lg font-label-md text-label-md hover:bg-primary transition-colors"
        >
          <Icon name="auto_awesome" className="text-[18px]" filled />
          AI Reasoning
        </button>
      </div>

      <Modal
        open={openReasoning}
        onClose={() => setOpenReasoning(false)}
        title="AI Reasoning"
        description="Recommendations recomputed live from the current team data."
        icon="auto_awesome"
        size="lg"
        footer={
          <ModalActions>
            <Button variant="primary" onClick={() => setOpenReasoning(false)}>
              Close
            </Button>
          </ModalActions>
        }
      >
        {recommendationCount === 0 ? (
          <p className="font-body-sm text-body-sm text-secondary">
            No recommendations right now — the team is balanced and all work has an owner.
          </p>
        ) : (
          <div className="flex flex-col gap-xl">
            {reasoning.overloaded.length > 0 ? (
              <section>
                <h3 className="font-label-md text-label-md text-error mb-sm">
                  Over capacity
                </h3>
                <ul className="flex flex-col gap-sm">
                  {reasoning.overloaded.map(({ member, utilization }) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-md p-sm border border-outline-variant rounded-md"
                    >
                      <span className="font-body-sm text-body-sm text-on-surface truncate">
                        {member.name}
                      </span>
                      <span className="font-label-md text-label-md text-error flex-shrink-0">
                        {Math.round(utilization * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {reasoning.transfers.length > 0 ? (
              <section>
                <h3 className="font-label-md text-label-md text-primary mb-sm">
                  Suggested transfers
                </h3>
                <ul className="flex flex-col gap-sm">
                  {reasoning.transfers.map((proposal) => (
                    <li
                      key={proposal.id}
                      className="flex items-center justify-between gap-md p-sm border border-outline-variant rounded-md"
                    >
                      <span className="font-body-sm text-body-sm text-on-surface truncate">
                        {proposal.task.title}
                      </span>
                      <span className="font-label-md text-label-md text-secondary flex-shrink-0">
                        {proposal.from.name.split(" ")[0]} → {proposal.to.name.split(" ")[0]} ·{" "}
                        {Math.round(proposal.fitScore * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {reasoning.openWork.length > 0 ? (
              <section>
                <h3 className="font-label-md text-label-md text-secondary mb-sm">
                  Best owner per unassigned task
                </h3>
                <ul className="flex flex-col gap-sm">
                  {reasoning.openWork.map(({ task, member, fitScore }) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-md p-sm border border-outline-variant rounded-md"
                    >
                      <span className="font-body-sm text-body-sm text-on-surface truncate">
                        {task.title}
                      </span>
                      <span className="font-label-md text-label-md text-secondary flex-shrink-0">
                        {member.name.split(" ")[0]} · {Math.round(fitScore * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </Modal>
    </nav>
  );
}

