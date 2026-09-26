import { useMemo, useState } from "react";
import { Icon } from "./ui";
import Modal, { Button, ModalActions } from "./Modal";
import { useTeamContext } from "../context/TeamContext";
import {
  calculateRiskScore,
  calculateWorkloadUtilization,
} from "../utils/scoring";

const shortcuts = [
  { keys: "Esc", action: "Close the open dialog" },
  { keys: "Tab", action: "Move focus between dialog controls" },
  { keys: "Enter", action: "Submit the focused form" },
  { keys: "Click outside", action: "Dismiss a dialog" },
];

export default function Topbar({
  title = "Team Ops Portal",
  placeholder = "Search team members, skills, tasks...",
  onSearch,
  searchValue = "",
  actions,
}) {
  const { members, tasks } = useTeamContext();
  const [dialog, setDialog] = useState(null);
  const closeDialog = () => setDialog(null);

  const notifications = useMemo(() => {
    const items = [];

    members.forEach((member) => {
      const risk = calculateRiskScore(member);
      if (risk.tier === "High") {
        items.push({
          id: `risk-${member.id}`,
          icon: "warning",
          tone: "error",
          title: `${member.name} is at high burnout risk`,
          detail: `${risk.label}`,
        });
      }
    });

    members.forEach((member) => {
      const { utilization } = calculateWorkloadUtilization(member);
      if (utilization > 1) {
        items.push({
          id: `load-${member.id}`,
          icon: "gauge",
          tone: "warning",
          title: `${member.name} is over capacity`,
          detail: `${Math.round(utilization * 100)}% utilised (${member.currentAllocatedHours}h of ${member.capacityHours}h)`,
        });
      }
    });

    const unassigned = tasks.filter((task) => !task.assignedMemberId).length;
    if (unassigned > 0) {
      items.push({
        id: "unassigned",
        icon: "assignment_ind",
        tone: "neutral",
        title: `${unassigned} task${unassigned === 1 ? "" : "s"} need an owner`,
        detail: "Open Tasks and use Auto-Assign to rank candidates.",
      });
    }

    const dueToday = tasks.filter((task) => task.deadline === "Today").length;
    if (dueToday > 0) {
      items.push({
        id: "due-today",
        icon: "schedule",
        tone: "neutral",
        title: `${dueToday} task${dueToday === 1 ? "" : "s"} due today`,
        detail: "Check the Tasks view for anything still unassigned.",
      });
    }

    return items;
  }, [members, tasks]);

  const toneClass = {
    error: "bg-error-container text-error",
    warning: "bg-[#F5E6C8] text-[#6B4E12]",
    neutral: "bg-surface-container-high text-secondary",
  };

  return (
    <header className="w-full h-20 border-b border-outline-variant flex justify-between items-center px-lg flex-shrink-0 bg-surface z-10">
      <h1 className="hidden md:block font-headline-sm text-headline-sm font-semibold text-primary">
        {title}
      </h1>

      <div className="flex-1 max-w-md mx-md">
        <div className="relative group">
          <Icon
            name="search"
            className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors"
            style={{ fontSize: "20px" }}
          />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full pl-xl pr-md py-sm bg-surface-container-lowest border border-outline-variant rounded-full text-body-sm text-on-background placeholder:text-on-surface-variant focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-md text-on-surface-variant">
        {actions}
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setDialog("notifications")}
          className="relative hover:text-primary transition-colors"
        >
          <Icon name="notifications" />
          {notifications.length > 0 ? (
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full" />
          ) : null}
        </button>
        <button
          type="button"
          aria-label="Help"
          onClick={() => setDialog("help")}
          className="hover:text-primary transition-colors"
        >
          <Icon name="help" />
        </button>
        <div
          className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-[11px]"
          title="Alex Carter"
        >
          AC
        </div>
      </div>

      <Modal
        open={dialog === "notifications"}
        onClose={closeDialog}
        title="Notifications"
        description={
          notifications.length
            ? `${notifications.length} item${notifications.length === 1 ? "" : "s"} need attention.`
            : "Nothing needs attention right now."
        }
        icon="notifications"
        size="md"
        footer={
          <ModalActions>
            <Button variant="primary" onClick={closeDialog}>
              Got it
            </Button>
          </ModalActions>
        }
      >
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-sm py-xl text-center">
            <Icon name="check_circle" className="text-[32px] text-primary" />
            <p className="font-body-sm text-body-sm text-secondary">
              Utilisation, burnout risk and assignment coverage are all healthy.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-md">
            {notifications.map((item) => (
              <li key={item.id} className="flex items-start gap-md">
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    toneClass[item.tone]
                  }`}
                >
                  <Icon name={item.icon} className="text-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface">{item.title}</p>
                  <p className="font-body-sm text-body-sm text-secondary">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={dialog === "help"}
        onClose={closeDialog}
        title="Help"
        description="Keyboard and interaction reference for Equilibrium."
        icon="help"
        size="md"
        footer={
          <ModalActions>
            <Button variant="primary" onClick={closeDialog}>
              Close
            </Button>
          </ModalActions>
        }
      >
        <dl className="flex flex-col gap-md">
          {shortcuts.map((item) => (
            <div key={item.keys} className="flex items-center justify-between gap-md">
              <dt className="font-body-sm text-body-sm text-secondary">{item.action}</dt>
              <dd className="font-label-md text-label-md text-on-surface bg-surface-container px-sm py-1 rounded flex-shrink-0">
                {item.keys}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-lg pt-md border-t border-outline-variant">
          <h3 className="font-label-md text-label-md text-on-surface mb-sm">How scoring works</h3>
          <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
            Fit scores compare a member's proficiency against each required skill, weighted by task
            estimated hours. Utilisation divides allocated hours by weekly capacity, and burnout risk
            combines utilisation with consecutive over-capacity weeks. All three recompute live from
            the data in the sidebar directory.
          </p>
        </div>
      </Modal>
    </header>
  );
}
