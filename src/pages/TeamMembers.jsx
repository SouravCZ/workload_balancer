import { useMemo, useState } from "react";
import { useTeamContext } from "../context/TeamContext";
import { Avatar, Card, Chip, Icon, KpiCard, SectionHeading, riskTone } from "../components/ui";
import Modal, { Button, Field, ModalActions, inputClass } from "../components/Modal";
import {
  calculateFitScore,
  calculateRiskScore,
  calculateWorkloadUtilization,
  rebalanceProposals,
  teamMetrics,
} from "../utils/scoring";
import { proficiencyLabels } from "../services/mockData";

const dayLabels = ["M", "T", "W", "T", "F"];

const presenceTone = {
  available: "bg-primary",
  busy: "bg-[#8C6A1D]",
  ooo: "bg-outline",
};

const presenceLabel = {
  available: "Available",
  busy: "Busy",
  ooo: "Out of office",
};

const avatarTones = ["primary", "secondary", "tertiary", "primary-container"];

const emptyMember = {
  name: "",
  role: "",
  capacityHours: 40,
  currentAllocatedHours: 0,
  presence: "available",
};


export default function TeamMembers() {
  const { members, tasks, addMember, updateMember, assignTask } = useTeamContext();
  const [selectedId, setSelectedId] = useState(members[0]?.id ?? null);
  const [view, setView] = useState("list");
  const [dialog, setDialog] = useState(null);
  const [draft, setDraft] = useState(emptyMember);
  const [message, setMessage] = useState("");
  const closeDialog = () => setDialog(null);

  const metrics = useMemo(() => teamMetrics(members, tasks), [members, tasks]);
  const selected = members.find((m) => m.id === selectedId) ?? members[0] ?? null;

  const avgSkillMatch = useMemo(() => {
    const assigned = tasks.filter((t) => t.assignedMemberId);
    if (assigned.length === 0) return 0;
    const total = assigned.reduce((sum, task) => {
      const owner = members.find((m) => m.id === task.assignedMemberId);
      return sum + (owner ? calculateFitScore(owner, task).fitScore : 0);
    }, 0);
    return total / assigned.length;
  }, [members, tasks]);

  const memberTasks = selected
    ? tasks.filter((t) => t.assignedMemberId === selected.id)
    : [];
  const transferable = memberTasks
    .map((task) => ({
      task,
      target: members
        .filter((m) => m.id !== selected.id)
        .map((m) => ({ member: m, fit: calculateFitScore(m, task).fitScore }))
        .sort((a, b) => b.fit - a.fit)[0],
    }))
    .filter((entry) => entry.target && entry.target.fit > 0.3);

  const selectedRisk = selected ? calculateRiskScore(selected) : null;
  const selectedUtil = selected ? calculateWorkloadUtilization(selected) : null;
  const topSkills = selected
    ? [...selected.skills].sort((a, b) => b.proficiency - a.proficiency).slice(0, 3)
    : [];

  const proposals = useMemo(() => rebalanceProposals(members, tasks), [members, tasks]);

  const submitMember = (event) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    addMember({
      id: `m${Date.now()}`,
      name,
      role: draft.role.trim() || "Engineer",
      shortRole: draft.role.trim() || "Engineer",
      initials: initials || "??",
      avatarTone: avatarTones[members.length % avatarTones.length],
      presence: draft.presence,
      capacityHours: Number(draft.capacityHours) || 40,
      currentAllocatedHours: Number(draft.currentAllocatedHours) || 0,
      weeklyLoad: [],
      skills: [],
    });
    setDraft(emptyMember);
    closeDialog();
  };

  const applyRebalance = () => {
    proposals.forEach((proposal) => assignTask(proposal.task.id, proposal.to.id));
    closeDialog();
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    setMessage("");
    closeDialog();
  };

  return (
    <main className="flex-1 p-margin-mobile md:p-margin-desktop overflow-y-auto custom-scrollbar">
      <SectionHeading
        title="Team Members"
        description="Capacity, risk and skill coverage for every engineer."
        className="mb-xl"
        actions={
          <button
            type="button"
            onClick={() => {
              setDraft(emptyMember);
              setDialog("add");
            }}
            className="bg-primary-container text-on-primary hover:bg-primary transition-colors px-md py-sm rounded-md font-label-md text-label-md flex items-center gap-sm soft-shadow"
          >
            <Icon name="person_add" className="text-[18px]" />
            Add Member
          </button>
        }
      />

      <div className="flex flex-col xl:flex-row gap-lg items-start">
        <div className="flex-1 w-full space-y-lg min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-md">
            <KpiCard label="Total Members" value={metrics.totalMembers} icon="groups" />
            <KpiCard
              label="Avg. Utilization"
              value={`${Math.round(metrics.utilization * 100)}%`}
              icon="monitoring"
              tone="positive"
            />
            <KpiCard
              label="Overloaded"
              value={metrics.overloaded.length}
              icon="warning"
              tone={metrics.overloaded.length ? "warning" : "neutral"}
            />
            <KpiCard
              label="Underutilized"
              value={metrics.underutilized.length}
              icon="trending_down"
              tone="positive"
            />
            <KpiCard
              label="High Risk"
              value={metrics.highRisk.length}
              icon="psychiatry"
              tone={metrics.highRisk.length ? "danger" : "neutral"}
            />
            <KpiCard
              label="Avg. Skill Match"
              value={`${Math.round(avgSkillMatch * 100)}%`}
              icon="verified"
              tone="positive"
            />
          </div>

          <Card className="overflow-hidden">
            <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-bright">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Team Directory</h2>
              <div className="flex gap-sm" role="group" aria-label="Directory view">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={`p-sm rounded-md transition-colors ${
                    view === "list"
                      ? "text-primary bg-surface-container"
                      : "text-secondary hover:text-primary hover:bg-surface-container-low"
                  }`}
                >
                  <Icon name="view_list" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={`p-sm rounded-md transition-colors ${
                    view === "grid"
                      ? "text-primary bg-surface-container"
                      : "text-secondary hover:text-primary hover:bg-surface-container-low"
                  }`}
                >
                  <Icon name="grid_view" />
                </button>
              </div>
            </div>

            <div
              className={view === "list" ? "overflow-x-auto custom-scrollbar" : "hidden"}
            >
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                      Member
                    </th>
                    <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium w-48">
                      Utilization
                    </th>
                    <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                      Top Skills
                    </th>
                    <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                      Risk
                    </th>
                    <th className="px-lg py-md font-label-md text-label-md text-secondary font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {members.map((member) => {
                    const { utilization } = calculateWorkloadUtilization(member);
                    const risk = calculateRiskScore(member);
                    const isActive = selected?.id === member.id;
                    return (
                      <tr
                        key={member.id}
                        onClick={() => setSelectedId(member.id)}
                        className={`cursor-pointer transition-colors ${
                          isActive
                            ? "bg-primary-container/5"
                            : "hover:bg-surface-container-lowest"
                        }`}
                      >
                        <td className="px-lg py-md">
                          <div className="flex items-center gap-md">
                            <Avatar member={member} size="md" />
                            <div>
                              <p className="font-label-md text-label-md text-on-surface font-semibold">
                                {member.name}
                              </p>
                              <p className="font-body-sm text-body-sm text-secondary">
                                {member.role}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-lg py-md">
                          <div className="flex items-center gap-sm mb-1">
                            <span
                              className={`font-label-md text-label-md ${
                                utilization > 1 ? "text-error" : "text-on-surface"
                              }`}
                            >
                              {Math.round(utilization * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                utilization > 1 ? "bg-error" : "bg-primary"
                              }`}
                              style={{ width: `${Math.min(100, utilization * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-lg py-md">
                          <div className="flex flex-wrap gap-1">
                            {[...member.skills]
                              .sort((a, b) => b.proficiency - a.proficiency)
                              .slice(0, 3)
                              .map((entry) => (
                                <span
                                  key={entry.skill}
                                  className="px-2 py-0.5 rounded text-[12px] font-medium bg-surface-container text-on-surface-variant"
                                >
                                  {entry.skill}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="px-lg py-md">
                          <Chip tone={riskTone(risk.tier)} icon={risk.tier === "Low" ? undefined : "warning"}>
                            {risk.tier}
                          </Chip>
                        </td>
                        <td className="px-lg py-md">
                          <span className="flex items-center gap-1.5 text-body-sm text-on-surface">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                presenceTone[member.presence] ?? presenceTone.available
                              }`}
                            />
                            {presenceLabel[member.presence] ?? "Available"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {view === "grid" ? (
              <div className="p-lg grid grid-cols-1 sm:grid-cols-2 gap-md bg-surface-container-low/40">
                {members.map((member) => {
                  const { utilization } = calculateWorkloadUtilization(member);
                  const risk = calculateRiskScore(member);
                  const isActive = selected?.id === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedId(member.id)}
                      className={`text-left p-md rounded-lg border transition-colors ${
                        isActive
                          ? "border-primary-container bg-primary-container/5"
                          : "border-outline-variant bg-surface-container-lowest hover:border-primary-container/40"
                      }`}
                    >
                      <div className="flex items-center gap-md mb-md">
                        <Avatar member={member} size="md" />
                        <div className="min-w-0">
                          <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                            {member.name}
                          </p>
                          <p className="font-body-sm text-body-sm text-secondary truncate">
                            {member.role}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="font-body-sm text-body-sm text-secondary">
                          {member.currentAllocatedHours}h / {member.capacityHours}h
                        </span>
                        <span
                          className={`font-label-md text-label-md ${
                            utilization > 1 ? "text-error" : "text-on-surface"
                          }`}
                        >
                          {Math.round(utilization * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mb-md">
                        <div
                          className={`h-full rounded-full ${
                            utilization > 1 ? "bg-error" : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(100, utilization * 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-sm">
                        <Chip tone={riskTone(risk.tier)}>{risk.tier}</Chip>
                        <span className="flex items-center gap-1.5 text-body-sm text-secondary">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              presenceTone[member.presence] ?? presenceTone.available
                            }`}
                          />
                          {presenceLabel[member.presence] ?? "Available"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </Card>
        </div>

        {selected ? (
          <Card className="w-full xl:w-96 shrink-0 p-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start justify-between mb-lg relative z-10">
              <div className="flex gap-md items-center">
                <Avatar member={selected} size="xl" className="border-2 border-surface" />
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    {selected.name}
                  </h3>
                  <p className="font-body-sm text-body-sm text-secondary">{selected.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDialog("more")}
                aria-label="More actions"
                className="text-outline hover:text-on-surface transition-colors"
              >
                <Icon name="more_vert" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-lg">
              {selectedRisk.tier !== "Low" ? (
                <div className="bg-error-container/10 border border-error-container/30 rounded-lg p-md flex gap-md">
                  <Icon name="psychiatry" className="text-error" />
                  <div>
                    <h4 className="font-label-md text-label-md text-error">
                      {selectedRisk.tier} Burnout Risk
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                      Sustained {Math.round(selectedUtil.utilization * 100)}% utilization with{" "}
                      {selectedRisk.streakWeeks} consecutive weeks above capacity and tight
                      deadlines on {memberTasks[0]?.title ?? "current work"}.
                    </p>
                  </div>
                </div>
              ) : null}

              <div>
                <h4 className="font-label-md text-label-md text-on-surface mb-md flex items-center justify-between">
                  Capacity Breakdown
                  <span className="text-secondary font-normal">This Week</span>
                </h4>
                <div className="flex items-end justify-between mb-sm">
                  <span className="font-body-sm text-body-sm text-secondary">
                    Assigned / Available
                  </span>
                  <span
                    className={`font-headline-sm text-headline-sm ${
                      selectedUtil.status === "overloaded" ? "text-error" : "text-on-surface"
                    }`}
                  >
                    {selected.currentAllocatedHours}h{" "}
                    <span className="text-secondary text-[16px] font-normal">
                      / {selected.capacityHours}h
                    </span>
                  </span>
                </div>
                <div className="flex items-end h-24 gap-sm mb-sm">
                  {selected.weeklyLoad.map((load, index) => (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center justify-end gap-1"
                    >
                      <div
                        className={`w-full rounded-t-sm ${load > 100 ? "bg-error" : "bg-primary"}`}
                        style={{ height: `${Math.min(130, (load / 130) * 100)}%` }}
                      />
                      <span className="text-[10px] text-secondary">{dayLabels[index]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-outline-variant" />

              <div>
                <h4 className="font-label-md text-label-md text-on-surface mb-md">Skill Matrix</h4>
                <div className="space-y-md">
                  {topSkills.map((entry) => (
                    <div key={entry.skill}>
                      <div className="flex justify-between font-body-sm text-body-sm mb-1">
                        <span className="text-on-surface">{entry.skill}</span>
                        <span className="text-primary font-medium">
                          {proficiencyLabels[entry.proficiency]}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(entry.proficiency / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-outline-variant" />

              <div>
                <h4 className="font-label-md text-label-md text-on-surface flex items-center gap-sm mb-md">
                  <Icon name="psychology" className="text-primary text-[18px]" />
                  AI Recommendations
                </h4>
                {transferable.length === 0 ? (
                  <p className="font-body-sm text-body-sm text-secondary">
                    No transfers recommended — {selected.name.split(" ")[0]} has the strongest skill
                    match for every assigned task.
                  </p>
                ) : (
                  <ul className="space-y-sm">
                    {transferable.map(({ task, target }) => (
                      <li
                        key={task.id}
                        className="bg-surface-container-low p-md rounded-lg border border-outline-variant text-body-sm font-body-sm text-on-surface-variant flex gap-sm items-start"
                      >
                        <Icon name="check_circle" className="text-primary text-[16px]" />
                        <span>
                          Suggest reassigning {task.estimatedHours}h of &lsquo;{task.title}&rsquo; to{" "}
                          <span className="text-primary font-medium">{target.member.name}</span> (
                          {Math.round(target.fit * 100)}% fit).
                        </span>
                      </li>
                    ))}
                    <li className="bg-surface-container-low p-md rounded-lg border border-outline-variant text-body-sm font-body-sm text-on-surface-variant flex gap-sm items-start">
                      <Icon name="lightbulb" className="text-primary text-[16px]" />
                      <span>
                        Best suited for {selected.shortRole} work requiring deep{" "}
                        {topSkills[0]?.skill} knowledge.
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            <div className="pt-md mt-md border-t border-outline-variant flex gap-md">
              <button
                type="button"
                onClick={() => setDialog("message")}
                className="flex-1 py-sm px-md border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors"
              >
                Message
              </button>
              <button
                type="button"
                onClick={() => setDialog("rebalance")}
                className="flex-1 py-sm px-md bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary/90 transition-colors"
              >
                Rebalance Load
              </button>
            </div>
          </Card>
        ) : null}
      </div>

      <Modal
        open={dialog === "add"}
        onClose={closeDialog}
        title="Add Team Member"
        description="Capacity and availability feed straight into the workload model."
        icon="person_add"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="primary" type="submit" form="add-member-form">
              Add member
            </Button>
          </ModalActions>
        }
      >
        <form id="add-member-form" onSubmit={submitMember} className="flex flex-col gap-lg">
          <Field label="Full name" id="member-name">
            <input
              id="member-name"
              data-autofocus
              className={inputClass}
              placeholder="Ada Lovelace"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>

          <Field label="Role" id="member-role">
            <input
              id="member-role"
              className={inputClass}
              placeholder="Platform Engineer"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-md">
            <Field label="Weekly capacity (h)" id="member-capacity">
              <input
                id="member-capacity"
                type="number"
                min="0"
                className={inputClass}
                value={draft.capacityHours}
                onChange={(e) => setDraft({ ...draft, capacityHours: e.target.value })}
              />
            </Field>
            <Field label="Already allocated (h)" id="member-allocated">
              <input
                id="member-allocated"
                type="number"
                min="0"
                className={inputClass}
                value={draft.currentAllocatedHours}
                onChange={(e) => setDraft({ ...draft, currentAllocatedHours: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Presence" id="member-presence">
            <select
              id="member-presence"
              className={inputClass}
              value={draft.presence}
              onChange={(e) => setDraft({ ...draft, presence: e.target.value })}
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="ooo">Out of office</option>
            </select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={dialog === "message"}
        onClose={closeDialog}
        title={selected ? `Message ${selected.name}` : "Message"}
        icon="chat"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="primary" type="submit" form="message-form">
              Send
            </Button>
          </ModalActions>
        }
      >
        <form id="message-form" onSubmit={sendMessage} className="flex flex-col gap-lg">
          <Field label="Message" id="message-body">
            <textarea
              id="message-body"
              data-autofocus
              rows={5}
              className={`${inputClass} resize-none`}
              placeholder={
                selected
                  ? `Hi ${selected.name.split(" ")[0]}, checking in on your current load...`
                  : "Write a message..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <p className="font-body-sm text-body-sm text-secondary">
            This demo has no backend, so nothing is delivered. The composer exists to show the
            intended flow.
          </p>
        </form>
      </Modal>

      <Modal
        open={dialog === "rebalance"}
        onClose={closeDialog}
        title="Rebalance Team Load"
        description="Move hours off overloaded teammates onto available capacity."
        icon="balance"
        size="lg"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button
              variant="primary"
              onClick={applyRebalance}
              disabled={proposals.length === 0}
              className={proposals.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
            >
              {proposals.length === 0
                ? "Nothing to move"
                : `Apply ${proposals.length} transfer${proposals.length === 1 ? "" : "s"}`}
            </Button>
          </ModalActions>
        }
      >
        {proposals.length === 0 ? (
          <p className="font-body-sm text-body-sm text-secondary">
            No transfers are recommended right now. Either nobody is above 90% utilisation, or no
            underutilised teammate clears the 45% fit threshold for the open work.
          </p>
        ) : (
          <ul className="flex flex-col gap-md">
            {proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="p-md border border-outline-variant rounded-lg bg-surface-container-low/50"
              >
                <div className="flex items-center justify-between gap-md mb-sm">
                  <span className="font-label-md text-label-md text-on-surface">
                    {proposal.task.title}
                  </span>
                  <span className="font-label-md text-label-md text-primary flex-shrink-0">
                    {proposal.hours}h
                  </span>
                </div>
                <div className="flex items-center gap-sm flex-wrap text-body-sm text-body-sm text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Icon name={proposal.from ? "arrow_upward" : "assignment"} className={`text-[14px] ${proposal.from ? "text-error" : "text-primary"}`} />
                    {proposal.from ? proposal.from.name : "Unassigned Backlog"}
                  </span>
                  <Icon name="arrow_forward" className="text-[14px]" />
                  <span className="flex items-center gap-1.5">
                    <Icon name="arrow_downward" className="text-[14px] text-primary" />
                    {proposal.to.name}
                  </span>
                  <span className="ml-auto font-label-md text-label-md text-primary">
                    {Math.round(proposal.fitScore * 100)}% fit
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={dialog === "more"}
        onClose={closeDialog}
        title={selected ? selected.name : "Member"}
        description={selected?.role}
        icon="more_horiz"
        size="sm"
        footer={
          <ModalActions>
            <Button onClick={closeDialog}>Close</Button>
          </ModalActions>
        }
      >
        <div className="flex flex-col gap-sm">
          {[
            {
              key: "ooo",
              icon: "flight_takeoff",
              label: "Mark out of office",
              run: () => selected && updateMember({ ...selected, presence: "ooo" }),
            },
            {
              key: "available",
              icon: "how_to_reg",
              label: "Mark available",
              run: () => selected && updateMember({ ...selected, presence: "available" }),
            },
            {
              key: "message",
              icon: "chat",
              label: "Send message",
              run: () => {
                setMessage("");
                setDialog("message");
              },
            },
            {
              key: "copy",
              icon: "content_copy",
              label: "Copy profile summary",
              run: () => {
                if (!selected || !navigator.clipboard) return;
                const util = calculateWorkloadUtilization(selected);
                navigator.clipboard.writeText(
                  `${selected.name} — ${selected.role}\n` +
                    `Utilisation: ${Math.round(util.utilization * 100)}% ` +
                    `(${selected.currentAllocatedHours}h of ${selected.capacityHours}h)\n` +
                    `Burnout risk: ${calculateRiskScore(selected).tier}`,
                );
              },
            },
          ].map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                action.run();
                closeDialog();
              }}
              className="flex items-center gap-md px-md py-2.5 rounded-md hover:bg-surface-container transition-colors text-on-surface text-left"
            >
              <Icon name={action.icon} className="text-[20px] text-secondary" />
              <span className="font-body-sm text-body-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </main>
  );
}
