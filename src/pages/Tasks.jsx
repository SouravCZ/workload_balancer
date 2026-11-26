import { useMemo, useState, useEffect } from "react";
import { useTeamContext } from "../context/TeamContext";
import { Avatar, Card, Chip, Icon, KpiCard, SectionHeading } from "../components/ui";
import Modal, { Button, Field, ModalActions, inputClass } from "../components/Modal";
import {
  calculateBurnoutRisk,
  calculateFitScore,
  rankCandidates,
  teamMetrics,
} from "../utils/scoring";
import { scoreCandidateML } from "../services/mlModel";
import MlVsHeuristicPanel from "../components/MlVsHeuristicPanel";

const priorityTone = {
  Critical: "high",
  High: "medium",
  Medium: "neutral",
  Low: "neutral",
};

const priorityClass = {
  Critical: "bg-error text-on-error",
  High: "bg-error-container/30 text-error border border-error-container/50",
  Medium: "bg-surface-container text-on-surface-variant",
  Low: "bg-surface-container text-on-surface-variant",
};

const allPriorities = ["Critical", "High", "Medium", "Low"];

const priorityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const sortOptions = [
  { key: "deadline", label: "Deadline" },
  { key: "priority", label: "Priority" },
  { key: "hours", label: "Estimated hours" },
  { key: "title", label: "Title (A-Z)" },
];

const deadlineOptions = [
  "Today",
  "Tomorrow",
  "This Week",
  "Next Week",
  "Sprint Backlog",
];

const emptyDraft = {
  title: "",
  description: "",
  estimatedHours: 8,
  priority: "Medium",
  deadline: "This Week",
  assignedMemberId: "",
};


function fitOf(task, member) {
  return member ? calculateFitScore(member, task).fitScore : null;
}

export default function Tasks() {
  const { members, tasks, addTask, updateTask, updateMember, assignTask } = useTeamContext();
  const [tab, setTab] = useState("all");
  const [selectedId, setSelectedId] = useState(tasks[0]?.id ?? null);
  const [dialog, setDialog] = useState(null);
  const [sortKey, setSortKey] = useState("deadline");
  const [priorities, setPriorities] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [splitDraft, setSplitDraft] = useState({ title: "", estimatedHours: 4 });
  const [delayDraft, setDelayDraft] = useState("This Week");
  const closeDialog = () => setDialog(null);

  const metrics = useMemo(() => teamMetrics(members, tasks), [members, tasks]);

  const visible = useMemo(() => {
    const base = tab === "unassigned" ? tasks.filter((t) => !t.assignedMemberId) : tasks;
    const filtered = priorities.length
      ? base.filter((t) => priorities.includes(t.priority))
      : base;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortKey === "priority") return priorityRank[a.priority] - priorityRank[b.priority];
      if (sortKey === "hours") return b.estimatedHours - a.estimatedHours;
      if (sortKey === "title") return a.title.localeCompare(b.title);
      const urgent = (t) => (t.deadline === "Today" ? 0 : 1);
      return urgent(a) - urgent(b) || a.deadline.localeCompare(b.deadline);
    });
    return sorted;
  }, [tab, tasks, sortKey, priorities]);

  const selected = tasks.find((t) => t.id === selectedId) ?? visible[0] ?? null;
  const selectedAssignee = members.find((m) => m.id === selected?.assignedMemberId) ?? null;

  const bestCandidate = useMemo(() => {
    if (!selected) return null;
    return rankCandidates(selected, members).find((c) => c.member.id !== selected.assignedMemberId) ?? null;
  }, [selected, members]);

  const [mlCandidateScores, setMlCandidateScores] = useState({});

  useEffect(() => {
    if (!selected) return;
    let isMounted = true;
    async function loadScores() {
      const top3 = rankCandidates(selected, members).slice(0, 5);
      const scores = {};
      for (const { member } of top3) {
        scores[member.id] = await scoreCandidateML(member, selected, tasks);
      }
      if (isMounted) setMlCandidateScores(scores);
    }
    loadScores();
    return () => {
      isMounted = false;
    };
  }, [selected, members, tasks]);

  const dueThisWeek = tasks.filter((t) => t.deadline === "Today" || t.deadline === "Oct 24").length;
  const atRisk = tasks.filter((t) => {
    const owner = members.find((m) => m.id === t.assignedMemberId);
    return owner && calculateBurnoutRisk(owner).riskTier !== "Low";
  }).length;

  const autoAssign = (memberId, taskId = selected?.id) => {
    if (!taskId) return;
    assignTask(taskId, memberId);
  };

  const submitTask = (event) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    const hours = Number(draft.estimatedHours) || 0;
    const assignee = members.find((m) => m.id === draft.assignedMemberId) ?? null;

    addTask({
      id: `t${Date.now()}`,
      title,
      description: draft.description.trim() || "No description provided.",
      estimatedHours: hours,
      deadline: draft.deadline,
      priority: draft.priority,
      requiredSkills: [],
      assignedMemberId: assignee?.id ?? null,
      status: assignee ? "assigned" : "unassigned",
    });

    if (assignee) {
      updateMember({
        ...assignee,
        currentAllocatedHours: assignee.currentAllocatedHours + hours,
      });
    }

    setDraft(emptyDraft);
    closeDialog();
  };

  const togglePriority = (priority) =>
    setPriorities((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority],
    );

  const splitTask = (event) => {
    event.preventDefault();
    if (!selected) return;
    const hours = Math.max(1, Math.min(Number(splitDraft.estimatedHours) || 1, selected.estimatedHours - 1));
    const newTitle = splitDraft.title.trim() || `${selected.title} (Part 2)`;

    addTask({
      ...selected,
      id: `t${Date.now()}`,
      title: newTitle,
      estimatedHours: hours,
      status: selected.assignedMemberId ? "assigned" : "unassigned",
    });
    updateTask({ ...selected, estimatedHours: selected.estimatedHours - hours });
    setSplitDraft({ title: "", estimatedHours: 4 });
    closeDialog();
  };

  const delayTask = () => {
    if (!selected) return;
    updateTask({ ...selected, deadline: delayDraft });
    closeDialog();
  };

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      <main tabIndex={0} aria-label="Task Management" className="flex-1 p-margin-mobile md:p-margin-desktop flex flex-col gap-lg min-w-0 overflow-y-auto custom-scrollbar outline-none">
        <SectionHeading
          title="Tasks"
          description="Manage workload and assign tasks intelligently."
          actions={
            <button
              type="button"
              onClick={() => {
                setDraft(emptyDraft);
                setDialog("create");
              }}
              className="bg-primary-container text-on-primary hover:bg-primary transition-colors px-md py-sm rounded-md font-label-md text-label-md flex items-center gap-sm soft-shadow"
            >
              <Icon name="add" className="text-[18px]" />
              Create Task
            </button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-md">
          <KpiCard label="Total Tasks" value={metrics.totalTasks} icon="assignment" />
          <KpiCard label="Unassigned" value={metrics.unassigned.length} icon="person_add" />
          <KpiCard
            label="High Priority"
            value={tasks.filter((t) => t.priority === "Critical" || t.priority === "High").length}
            icon="priority_high"
            tone="warning"
          />
          <KpiCard label="Due This Week" value={dueThisWeek} icon="calendar_today" />
          <KpiCard label="Tasks at Risk" value={atRisk} icon="warning" tone={atRisk ? "warning" : "neutral"} />
          <KpiCard
            label="Avg. Fit Score"
            value={`${Math.round(metrics.avgFit * 100)}%`}
            icon="verified"
            tone="positive"
          />
        </div>

        <Card className="flex-1 flex flex-col min-h-[500px] overflow-hidden">
          <div className="px-md py-md border-b border-outline-variant flex justify-between items-center bg-surface-bright">
            <div className="flex gap-sm">
              <button
                type="button"
                onClick={() => setTab("all")}
                className={`px-md py-1.5 text-label-md font-label-md rounded-md transition-colors ${
                  tab === "all"
                    ? "bg-surface-container text-on-surface"
                    : "text-secondary hover:bg-surface-container-low"
                }`}
              >
                All Tasks
              </button>
              <button
                type="button"
                onClick={() => setTab("unassigned")}
                className={`px-md py-1.5 text-label-md font-label-md rounded-md transition-colors ${
                  tab === "unassigned"
                    ? "bg-surface-container text-on-surface"
                    : "text-secondary hover:bg-surface-container-low"
                }`}
              >
                Needs Assignment
              </button>
            </div>
            <div className="flex gap-sm">
              <button
                type="button"
                aria-label="Filter"
                onClick={() => setDialog("filter")}
                className={`p-1.5 rounded transition-colors relative ${
                  priorities.length
                    ? "text-primary bg-primary-container/20"
                    : "text-secondary hover:text-primary"
                }`}
              >
                <Icon name="filter_list" className="text-[20px]" />
                {priorities.length ? (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-on-primary text-[10px] flex items-center justify-center font-label-md">
                    {priorities.length}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label="Sort"
                onClick={() => setDialog("sort")}
                className="p-1.5 text-secondary hover:text-primary rounded transition-colors"
              >
                <Icon name="sort" className="text-[20px]" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-md px-md py-md bg-surface-container-low text-label-md font-label-md text-secondary border-b border-outline-variant">
            <div className="col-span-6 md:col-span-4">Task Name</div>
            <div className="hidden md:block col-span-2">Assignee</div>
            <div className="hidden sm:block col-span-2">Deadline</div>
            <div className="col-span-3 sm:col-span-2">Priority</div>
            <div className="col-span-3 text-right">Fit / Risk</div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {visible.map((task) => {
              const owner = members.find((m) => m.id === task.assignedMemberId);
              const fit = fitOf(task, owner);
              const risk = owner ? calculateBurnoutRisk(owner).riskTier : null;
              const isSelected = selected?.id === task.id;
              return (
                <div
                  key={task.id}
                  tabIndex={0}
                  aria-label={`Select ${task.title}`}
                  onClick={() => setSelectedId(task.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(task.id);
                    }
                  }}
                  className={`w-full grid grid-cols-12 gap-md px-md py-md items-center border-b border-outline-variant text-left transition-colors cursor-pointer ${
                    isSelected ? "bg-surface-container/40" : "hover:bg-surface-container-low"
                  }`}
                >
                  <div className="col-span-6 md:col-span-4 flex flex-col min-w-0">
                    <span className="font-label-md text-label-md text-on-surface truncate">
                      {task.title}
                    </span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {task.requiredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="px-1.5 py-0.5 bg-surface-container text-secondary text-[11px] rounded"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="hidden md:flex col-span-2 items-center gap-sm">
                    {owner ? (
                      <>
                        <Avatar member={owner} size="xs" />
                        <span className="text-body-sm text-on-surface truncate">{owner.name}</span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-full border border-dashed border-outline-variant flex items-center justify-center bg-surface-container-lowest">
                          <Icon name="person_add" className="text-[14px] text-outline" />
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            const candidate = rankCandidates(task, members).find(
                              (entry) => entry.member.id !== task.assignedMemberId,
                            );
                            if (candidate) autoAssign(candidate.member.id, task.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.stopPropagation();
                              const candidate = rankCandidates(task, members).find(
                                (entry) => entry.member.id !== task.assignedMemberId,
                              );
                              if (candidate) autoAssign(candidate.member.id, task.id);
                            }
                          }}
                          className="text-body-sm text-primary font-medium cursor-pointer hover:underline"
                        >
                          Assign
                        </span>
                      </>
                    )}
                  </div>

                  <div
                    className={`hidden sm:block col-span-2 text-body-sm ${
                      task.deadline === "Today" ? "text-error" : "text-on-surface"
                    }`}
                  >
                    {task.deadline}
                  </div>

                  <div className="col-span-3 sm:col-span-2">
                    <span
                      className={`px-2 py-1 rounded-full text-[12px] font-medium ${
                        priorityClass[task.priority]
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  <div className="col-span-3 flex items-center justify-end gap-md">
                    <span
                      className={`text-body-sm font-medium ${
                        fit === null ? "text-outline" : "text-primary"
                      }`}
                    >
                      {fit === null ? "--" : `${Math.round(fit * 100)}%`}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        risk === "High"
                          ? "bg-error"
                          : risk === "Medium"
                            ? "bg-[#8C6A1D]"
                            : "bg-outline-variant"
                      }`}
                      title={risk ?? "Unassigned"}
                    />
                  </div>
                </div>
              );
            })}
            {visible.length === 0 ? (
              <p className="p-lg font-body-sm text-body-sm text-secondary">
                Every task already has an owner. Nothing needs assignment.
              </p>
            ) : null}
          </div>
        </Card>

        <MlVsHeuristicPanel members={members} tasks={tasks} />
      </main>

      <aside className="w-80 lg:w-96 bg-surface-container-lowest border-l border-outline-variant flex-col h-full shrink-0 hidden md:flex z-10 overflow-y-auto custom-scrollbar">
        {selected ? (
          <>
            <div className="p-lg border-b border-outline-variant flex justify-between items-start bg-surface-bright">
              <div>
                <div className="text-[12px] text-secondary font-medium tracking-wide mb-1 uppercase">
                  Task Detail
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{selected.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDialog("taskMore")}
                aria-label="More actions"
                className="text-secondary hover:text-on-surface transition-colors"
              >
                <Icon name="more_horiz" className="text-[20px]" />
              </button>
            </div>

            <div className="flex-1 p-lg space-y-xl">
              <div className="space-y-md">
                <p className="text-body-sm text-secondary leading-relaxed">{selected.description}</p>
                <div className="grid grid-cols-2 gap-y-md gap-x-sm text-body-sm">
                  <div>
                    <span className="text-outline block mb-1 text-[12px]">Est. Hours</span>
                    <span className="text-on-surface font-medium">{selected.estimatedHours} hrs</span>
                  </div>
                  <div>
                    <span className="text-outline block mb-1 text-[12px]">Deadline</span>
                    <span
                      className={`font-medium ${selected.deadline === "Today" ? "text-error" : "text-on-surface"}`}
                    >
                      {selected.deadline}
                    </span>
                  </div>
                </div>
                <div className="flex gap-sm">
                  <Chip tone={priorityTone[selected.priority]}>{selected.priority}</Chip>
                  <Chip tone="outline">{selected.status === "assigned" ? "Assigned" : "Needs owner"}</Chip>
                </div>
              </div>

              <div className="h-px bg-outline-variant w-full" />

              <div>
                <div className="flex items-center gap-sm mb-md">
                  <Icon name="auto_awesome" className="text-primary text-[20px]" filled />
                  <h4 className="font-label-md text-label-md text-on-surface">AI Assignment Logic</h4>
                </div>
                <div className="bg-surface border border-outline-variant rounded-lg p-md space-y-md">
                  {selectedAssignee || bestCandidate ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-md">
                          <Avatar member={selectedAssignee ?? bestCandidate.member} size="md" />
                          <div>
                            <div className="font-label-md text-label-md text-on-surface">
                              {(selectedAssignee ?? bestCandidate.member).name}
                            </div>
                            <div className="text-[12px] text-secondary">
                              {(selectedAssignee ?? bestCandidate.member).shortRole}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-headline-sm text-headline-sm text-primary">
                            {Math.round(
                              (selectedAssignee
                                ? fitOf(selected, selectedAssignee)
                                : bestCandidate.fitScore) * 100,
                            )}
                            %
                          </div>
                          <div className="text-[10px] text-outline uppercase tracking-wider">
                            Fit Score
                          </div>
                        </div>
                      </div>
                      <ul className="text-body-sm text-secondary space-y-sm">
                        <li className="flex gap-sm items-start">
                          <Icon name="check_circle" className="text-primary text-[16px]" />
                          <span>
                            Matches critical skills:{" "}
                            <span className="text-on-surface font-medium">
                              {selected.requiredSkills.join(", ")}
                            </span>
                          </span>
                        </li>
                        <li className="flex gap-sm items-start">
                          <Icon name="check_circle" className="text-primary text-[16px]" />
                          <span>
                            Available capacity:{" "}
                            {Math.max(
                              0,
                              (selectedAssignee ?? bestCandidate.member).capacityHours -
                                (selectedAssignee ?? bestCandidate.member).currentAllocatedHours,
                            )}{" "}
                            hrs this week
                          </span>
                        </li>
                      </ul>
                      <div className="mt-md pt-md border-t border-outline-variant">
                        <div className="flex justify-between text-[12px] mb-sm">
                          <span className="text-outline">Burnout Impact</span>
                          <span
                            className={`font-medium ${
                              riskOf(selectedAssignee ?? bestCandidate.member) === "Low"
                                ? "text-secondary"
                                : "text-error"
                            }`}
                          >
                            {riskOf(selectedAssignee ?? bestCandidate.member)} Risk
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex">
                          <div className="h-full bg-primary" style={{ width: "45%" }} />
                          <div className="h-full bg-primary/40" style={{ width: "15%" }} />
                        </div>
                        <div className="text-[11px] text-outline mt-1 text-right">
                          +{selected.estimatedHours}h load added
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-body-sm text-secondary">No candidate available.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-label-md text-label-md text-on-surface mb-md">Top Candidates</h4>
                <div className="space-y-sm">
                  {rankCandidates(selected, members)
                    .slice(0, 3)
                    .map(({ member, fitScore }) => {
                      const ml = mlCandidateScores[member.id];
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-sm p-sm rounded-lg border border-outline-variant"
                        >
                          <Avatar member={member} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="font-label-md text-label-md text-on-surface truncate">
                              {member.name}
                            </p>
                            <p className="font-body-sm text-body-sm text-secondary truncate">
                              {member.shortRole}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-right flex-shrink-0">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-secondary font-mono">
                                Heur: {Math.round(fitScore * 100)}%
                              </span>
                              <span className="text-xs font-bold text-primary font-mono">
                                ML: {ml ? `${Math.round(ml.mlFitScore * 100)}%` : "..."}
                              </span>
                            </div>
                            {ml?.onTimeProbability !== undefined ? (
                              <Chip
                                tone={ml.onTimeProbability >= 0.7 ? "positive" : "warning"}
                                className="text-[10px] py-0.5 px-1.5"
                                title={`Likelihood of on-time completion: ${Math.round(ml.onTimeProbability * 100)}%`}
                              >
                                {Math.round(ml.onTimeProbability * 100)}% on-time
                              </Chip>
                            ) : null}
                          </div>
                          {member.id !== selected.assignedMemberId ? (
                            <button
                              type="button"
                              onClick={() => autoAssign(member.id)}
                              className="p-1.5 rounded-md text-primary hover:bg-surface-container transition-colors ml-1"
                              aria-label={`Assign to ${member.name}`}
                            >
                              <Icon name="check" className="text-[18px]" />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="p-lg border-t border-outline-variant bg-surface-container-lowest space-y-md">
              <button
                type="button"
                onClick={() => bestCandidate && autoAssign(bestCandidate.member.id)}
                disabled={!bestCandidate || selected.assignedMemberId === bestCandidate.member.id}
                className="w-full bg-primary-container text-on-primary hover:bg-primary transition-colors py-2.5 rounded-md font-label-md text-label-md soft-shadow disabled:opacity-50"
              >
                {bestCandidate
                  ? `Auto-Assign to ${bestCandidate.member.name}`
                  : "No Alternative Candidate"}
              </button>
              <div className="flex gap-md">
                <button
                  type="button"
                  onClick={() => {
                    setSplitDraft({ title: "", estimatedHours: Math.ceil(selected.estimatedHours / 2) });
                    setDialog("split");
                  }}
                  className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container-low transition-colors py-2 rounded-md font-label-md text-label-md"
                >
                  Split Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDelayDraft(selected.deadline);
                    setDialog("delay");
                  }}
                  className="flex-1 bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container-low transition-colors py-2 rounded-md font-label-md text-label-md"
                >
                  Delay
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="p-lg font-body-sm text-body-sm text-secondary">Select a task to see details.</p>
        )}
      </aside>

      <Modal
        open={dialog === "create"}
        onClose={closeDialog}
        title="Create Task"
        description="Assigning on creation adds the hours straight to that member's load."
        icon="add_task"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="primary" type="submit" form="create-task-form">
              Create task
            </Button>
          </ModalActions>
        }
      >
        <form id="create-task-form" onSubmit={submitTask} className="flex flex-col gap-lg">
          <Field label="Task name" id="task-title">
            <input
              id="task-title"
              data-autofocus
              className={inputClass}
              placeholder="Migrate auth service to OIDC"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>

          <Field label="Description" id="task-description">
            <textarea
              id="task-description"
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="What needs doing?"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-md">
            <Field label="Estimated hours" id="task-hours">
              <input
                id="task-hours"
                type="number"
                min="0"
                className={inputClass}
                value={draft.estimatedHours}
                onChange={(e) => setDraft({ ...draft, estimatedHours: e.target.value })}
              />
            </Field>
            <Field label="Priority" id="task-priority">
              <select
                id="task-priority"
                className={inputClass}
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
              >
                {allPriorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-md">
            <Field label="Deadline" id="task-deadline">
              <select
                id="task-deadline"
                className={inputClass}
                value={draft.deadline}
                onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
              >
                {deadlineOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assignee" id="task-assignee">
              <select
                id="task-assignee"
                className={inputClass}
                value={draft.assignedMemberId}
                onChange={(e) => setDraft({ ...draft, assignedMemberId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        open={dialog === "filter"}
        onClose={closeDialog}
        title="Filter Tasks"
        description="Select one or more priorities."
        icon="filter_list"
        size="sm"
        footer={
          <ModalActions>
            <Button onClick={() => setPriorities([])}>Clear all</Button>
            <Button variant="primary" onClick={closeDialog}>
              Done
            </Button>
          </ModalActions>
        }
      >
        <div className="flex flex-col gap-sm">
          {allPriorities.map((priority) => {
            const active = priorities.includes(priority);
            return (
              <button
                key={priority}
                type="button"
                aria-pressed={active}
                onClick={() => togglePriority(priority)}
                className={`flex items-center justify-between px-md py-2.5 rounded-md border transition-colors ${
                  active
                    ? "border-primary bg-primary-container/15"
                    : "border-outline-variant hover:bg-surface-container-low"
                }`}
              >
                <span className="flex items-center gap-md">
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      active ? "bg-primary text-on-primary" : "border border-outline"
                    }`}
                  >
                    {active ? <Icon name="check" className="text-[14px]" /> : null}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface">{priority}</span>
                </span>
                <span className="font-label-md text-label-md text-secondary">
                  {tasks.filter((t) => t.priority === priority).length}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={dialog === "sort"}
        onClose={closeDialog}
        title="Sort Tasks"
        icon="sort"
        size="sm"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Close</Button>
          </ModalActions>
        }
      >
        <div className="flex flex-col gap-sm">
          {sortOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={sortKey === option.key}
              onClick={() => {
                setSortKey(option.key);
                closeDialog();
              }}
              className={`flex items-center gap-md px-md py-2.5 rounded-md border text-left transition-colors ${
                sortKey === option.key
                  ? "border-primary bg-primary-container/15"
                  : "border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <Icon
                name="radio_button_checked"
                className={`text-[20px] ${
                  sortKey === option.key ? "text-primary" : "text-outline"
                }`}
              />
              <span className="font-body-sm text-body-sm text-on-surface">{option.label}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={dialog === "split"}
        onClose={closeDialog}
        title="Split Task"
        description={selected ? selected.title : undefined}
        icon="call_split"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="primary" type="submit" form="split-form">
              Split
            </Button>
          </ModalActions>
        }
      >
        <form id="split-form" onSubmit={splitTask} className="flex flex-col gap-lg">
          <Field
            label="New task name"
            id="split-title"
            hint={selected ? `Original: ${selected.title}` : undefined}
          >
            <input
              id="split-title"
              data-autofocus
              className={inputClass}
              placeholder={`${selected?.title ?? "Task"} (Part 2)`}
              value={splitDraft.title}
              onChange={(e) => setSplitDraft({ ...splitDraft, title: e.target.value })}
            />
          </Field>

          <Field
            label="Hours to move to the new task"
            id="split-hours"
            hint={
              selected
                ? `${selected.estimatedHours}h total — the original keeps ${
                    selected.estimatedHours - (Number(splitDraft.estimatedHours) || 0) > 0
                      ? `${selected.estimatedHours - (Number(splitDraft.estimatedHours) || 0)}h`
                      : "0h"
                }.`
                : undefined
            }
          >
            <input
              id="split-hours"
              type="number"
              min="1"
              max={selected ? Math.max(1, selected.estimatedHours - 1) : undefined}
              className={inputClass}
              value={splitDraft.estimatedHours}
              onChange={(e) => setSplitDraft({ ...splitDraft, estimatedHours: e.target.value })}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={dialog === "delay"}
        onClose={closeDialog}
        title="Delay Task"
        description={selected ? `Currently due ${selected.deadline}.` : undefined}
        icon="schedule"
        size="sm"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="primary" onClick={delayTask}>
              Update deadline
            </Button>
          </ModalActions>
        }
      >
        <Field label="New deadline" id="delay-deadline">
          <select
            id="delay-deadline"
            data-autofocus
            className={inputClass}
            value={delayDraft}
            onChange={(e) => setDelayDraft(e.target.value)}
          >
            {deadlineOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      </Modal>

      <Modal
        open={dialog === "taskMore"}
        onClose={closeDialog}
        title="Task Actions"
        description={selected ? selected.title : undefined}
        icon="more_horiz"
        size="sm"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Close</Button>
          </ModalActions>
        }
      >
        {selected ? (
          <div className="flex flex-col gap-sm">
            {[
              {
                key: "done",
                icon: "task_alt",
                label:
                  selected.status === "done" ? "Reopen task" : "Mark as complete",
                run: () => updateTask({ ...selected, status: selected.status === "done" ? "in_progress" : "done" }),
              },
              {
                key: "duplicate",
                icon: "content_copy",
                label: "Duplicate task",
                run: () =>
                  addTask({
                    ...selected,
                    id: `t${Date.now()}`,
                    title: `${selected.title} (copy)`,
                    status: selected.assignedMemberId ? "assigned" : "unassigned",
                  }),
              },
              {
                key: "unassign",
                icon: "person_off",
                label: "Unassign",
                run: () => {
                  const owner = members.find((m) => m.id === selected.assignedMemberId);
                  if (owner) {
                    updateMember({
                      ...owner,
                      currentAllocatedHours: Math.max(
                        0,
                        owner.currentAllocatedHours - selected.estimatedHours,
                      ),
                    });
                  }
                  updateTask({ ...selected, assignedMemberId: null, status: "unassigned" });
                },
              },
              {
                key: "delay",
                icon: "schedule",
                label: "Delay task",
                run: () => {
                  setDelayDraft(selected.deadline);
                  setDialog("delay");
                },
              },
            ].map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  action.run();
                  if (action.key !== "delay") closeDialog();
                }}
                className="flex items-center gap-md px-md py-2.5 rounded-md hover:bg-surface-container transition-colors text-on-surface text-left"
              >
                <Icon name={action.icon} className="text-[20px] text-secondary" />
                <span className="font-body-sm text-body-sm">{action.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="font-body-sm text-body-sm text-secondary">Select a task first.</p>
        )}
      </Modal>
    </div>
  );
}

function riskOf(member) {
  return calculateBurnoutRisk(member).riskTier;
}
