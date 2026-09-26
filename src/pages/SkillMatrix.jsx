import { useMemo, useState } from "react";
import { useTeamContext } from "../context/TeamContext";
import { Avatar, Card, Icon, KpiCard } from "../components/ui";
import { proficiencyOf, skillCoverage } from "../utils/scoring";
import { proficiencyLabels, skillColumns } from "../services/mockData";

function cellTone(level) {
  if (level <= 1) return "heatmap-1 text-on-surface-variant font-medium";
  if (level === 2) return "heatmap-2 text-on-surface-variant font-medium";
  if (level === 3) return "heatmap-3 text-white font-medium";
  if (level === 4) return "heatmap-4 text-white font-medium";
  return "heatmap-5 font-bold";
}

export default function SkillMatrix() {
  const { members, tasks } = useTeamContext();
  const [selectedId, setSelectedId] = useState(members[0]?.id ?? null);

  const coverage = useMemo(() => skillCoverage(members), [members]);
  const allSkills = skillColumns.flatMap((group) => group.skills);
  const totalSkills = coverage.length;

  const avgProficiency = useMemo(() => {
    if (totalSkills === 0) return 0;
    const sum = coverage.reduce((acc, entry) => acc + entry.best, 0);
    return sum / totalSkills / 5;
  }, [coverage, totalSkills]);

  const topSkill = [...coverage].sort((a, b) => b.holders.length - a.holders.length)[0];
  const largestGap = [...coverage].sort((a, b) => a.best - b.best)[0];
  const singlePoints = coverage.filter((entry) => entry.singlePointOfFailure);
  const untapped = coverage.filter((entry) => entry.untapped);
  const multiSkillExperts = members.filter(
    (member) => member.skills.filter((s) => s.proficiency >= 4).length >= 2,
  ).length;

  const selected = members.find((m) => m.id === selectedId) ?? members[0] ?? null;
  const strengths = selected
    ? selected.skills.filter((s) => s.proficiency >= 4).map((s) => s.skill)
    : [];
  const development = selected
    ? selected.skills.filter((s) => s.proficiency <= 2).map((s) => s.skill)
    : [];
  const recommended = selected
    ? tasks
        .filter(
          (task) =>
            !task.assignedMemberId ||
            task.requiredSkills.some((skill) => proficiencyOf(selected, skill) >= 4),
        )
        .slice(0, 3)
    : [];

  return (
    <main className="flex-1 p-margin-mobile md:p-margin-desktop overflow-x-hidden max-w-[1600px] mx-auto w-full">
      <div className="mb-xl">
        <h2 className="font-headline-lg text-headline-lg text-on-background mb-sm">Skill Matrix</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          Assess team capabilities, identify coverage gaps, and optimize talent allocation across
          critical domain areas.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-md mb-xl">
        <KpiCard label="Total Skills" value={totalSkills} icon="psychology" />
        <KpiCard
          label="Top Skill"
          value={topSkill?.skill ?? "—"}
          icon="star"
          tone="positive"
        />
        <KpiCard
          label="Largest Gap"
          value={largestGap?.skill ?? "—"}
          icon="warning"
          tone={largestGap && largestGap.best <= 2 ? "warning" : "neutral"}
        />
        <KpiCard
          label="Avg Proficiency"
          value={`${Math.round(avgProficiency * 100)}%`}
          icon="insights"
        />
        <KpiCard
          label="Critical Shortages"
          value={singlePoints.length}
          icon="error"
          tone={singlePoints.length ? "danger" : "neutral"}
        />
        <KpiCard
          label="Multi-skill Experts"
          value={multiSkillExperts}
          icon="workspace_premium"
          tone="positive"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-lg items-start">
        <Card className="flex-grow overflow-hidden">
          <div className="p-lg border-b border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
            <h3 className="font-headline-sm text-headline-sm text-on-background">
              Team Proficiency Distribution
            </h3>
            <div className="flex gap-md items-center text-body-sm font-body-sm text-on-surface-variant flex-wrap">
              <span>Legend:</span>
              {[
                { level: 1, label: "1 (Novice)" },
                { level: 3, label: "3 (Intermediate)" },
                { level: 5, label: "5 (Expert)" },
              ].map((entry) => (
                <div key={entry.level} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded heatmap-${entry.level}`} />
                  {entry.label}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto p-lg custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-md font-label-md text-label-md text-on-surface-variant border-b border-outline-variant sticky left-0 bg-surface z-10 w-48">
                    Member
                  </th>
                  {skillColumns.map((group, index) => (
                    <th
                      key={group.group}
                      colSpan={group.skills.length}
                      className={`p-md font-label-md text-label-md text-on-surface-variant border-b border-outline-variant text-center ${
                        index % 2 === 0 ? "bg-surface" : ""
                      }`}
                    >
                      {group.group}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="p-md border-b border-outline-variant sticky left-0 bg-surface z-10" />
                  {allSkills.map((skill, index) => (
                    <th
                      key={skill}
                      className={`p-sm text-center text-xs text-on-surface-variant border-b border-outline-variant font-medium bg-surface ${
                        index === 3 || index === 5 ? "border-r" : ""
                      }`}
                    >
                      <div className="-rotate-45 whitespace-nowrap origin-bottom-left ml-4">{skill}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => setSelectedId(member.id)}
                    className={`cursor-pointer border-b border-outline-variant/50 transition-colors ${
                      selected?.id === member.id ? "bg-surface-container/40" : "hover:bg-surface-container-low"
                    }`}
                  >
                    <td className="p-md font-label-md text-label-md text-on-background sticky left-0 bg-surface z-10 flex items-center gap-sm">
                      <Avatar member={member} size="xs" />
                      <span className="truncate">{member.name}</span>
                    </td>
                    {allSkills.map((skill, index) => {
                      const level = proficiencyOf(member, skill);
                      const entry = coverage.find((c) => c.skill === skill);
                      const marker = entry?.singlePointOfFailure && level >= 4
                        ? "spof"
                        : entry?.untapped && level >= 4
                          ? "untapped"
                          : null;
                      return (
                        <td
                          key={skill}
                          className={`p-1 ${index === 3 || index === 5 ? "border-r border-outline-variant/50" : ""}`}
                        >
                          <div
                            className={`w-full h-8 rounded flex items-center justify-center text-sm relative ${cellTone(level)}`}
                            title={`${member.name} — ${skill}: ${proficiencyLabels[level]}`}
                          >
                            {level}
                            {marker === "spof" ? (
                              <span
                                className="absolute top-1 right-1 w-1.5 h-1.5 bg-error rounded-full"
                                title="Single Point of Failure"
                              />
                            ) : null}
                            {marker === "untapped" ? (
                              <span
                                className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary-fixed-dim rounded-full"
                                title="Untapped Talent"
                              />
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="w-full lg:w-80 flex flex-col gap-lg flex-shrink-0">
          {selected ? (
            <Card className="p-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-primary-container" />
              <div className="flex items-center gap-md mb-lg">
                <Avatar member={selected} size="lg" className="border border-outline-variant" />
                <div>
                  <h4 className="font-headline-sm text-headline-sm text-on-background">
                    {selected.name}
                  </h4>
                  <p className="font-label-md text-label-md text-on-surface-variant">
                    {selected.shortRole}
                  </p>
                </div>
              </div>
              <div className="space-y-md">
                <div>
                  <h5 className="font-label-md text-label-md text-on-surface-variant mb-sm flex items-center gap-1">
                    <Icon name="trending_up" className="text-sm" /> Strengths
                  </h5>
                  <div className="flex flex-wrap gap-sm">
                    {strengths.length === 0 ? (
                      <span className="font-body-sm text-body-sm text-secondary">
                        No expert-level skills yet.
                      </span>
                    ) : (
                      strengths.map((skill) => (
                        <span
                          key={skill}
                          className="bg-primary-fixed-dim/50 text-on-primary-fixed-variant text-xs px-2 py-1 rounded font-medium border border-primary-fixed-dim"
                        >
                          {skill}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <h5 className="font-label-md text-label-md text-on-surface-variant mb-sm flex items-center gap-1">
                    <Icon name="trending_down" className="text-sm" /> Development Areas
                  </h5>
                  <div className="flex flex-wrap gap-sm">
                    {development.length === 0 ? (
                      <span className="font-body-sm text-body-sm text-secondary">
                        No weak areas flagged.
                      </span>
                    ) : (
                      development.map((skill) => (
                        <span
                          key={skill}
                          className="bg-surface-container text-on-surface text-xs px-2 py-1 rounded border border-outline-variant"
                        >
                          {skill}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="pt-sm border-t border-outline-variant">
                  <h5 className="font-label-md text-label-md text-on-background mb-sm">
                    Recommended Tasks
                  </h5>
                  {recommended.length === 0 ? (
                    <p className="font-body-sm text-body-sm text-secondary">
                      No matching tasks in the current backlog.
                    </p>
                  ) : (
                    <ul className="text-sm space-y-sm">
                      {recommended.map((task) => (
                        <li key={task.id} className="flex items-start gap-sm text-on-surface-variant">
                          <Icon name="check_circle" className="text-primary-container text-base" />
                          {task.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="p-lg">
            <h4 className="font-headline-sm text-headline-sm text-on-background mb-md flex items-center gap-sm">
              <Icon name="lightbulb" className="text-primary-container" /> Skill Gap Insights
            </h4>
            <div className="space-y-md">
              {singlePoints.length === 0 && untapped.length === 0 ? (
                <p className="font-body-sm text-body-sm text-secondary">
                  No critical skill concentrations detected.
                </p>
              ) : null}
              {singlePoints.map((entry) => (
                <div key={entry.skill} className="p-md bg-error/10 border border-error/20 rounded-lg">
                  <h5 className="font-label-md text-label-md text-on-error-container mb-1">
                    Single Point of Failure
                  </h5>
                  <p className="text-sm text-on-surface-variant">
                    {entry.holders[0].member.name} is the only expert (Level {entry.best}) in{" "}
                    {entry.skill}. High risk if unavailable.
                  </p>
                </div>
              ))}
              {untapped.map((entry) => (
                <div
                  key={entry.skill}
                  className="p-md bg-primary-fixed-dim/20 border border-primary-fixed-dim/40 rounded-lg"
                >
                  <h5 className="font-label-md text-label-md text-primary mb-1">Untapped Talent</h5>
                  <p className="text-sm text-on-surface-variant">
                    {entry.holders[0].member.name} shows hidden strength in {entry.skill} (Level{" "}
                    {entry.best}) but is rarely assigned matching work.
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-lg">
            <h4 className="font-headline-sm text-headline-sm text-on-background mb-md">
              Actionable Recommendations
            </h4>
            <div className="space-y-md">
              {largestGap ? (
                <div className="flex items-center justify-between p-md border border-outline-variant rounded hover:border-primary-container transition-colors cursor-pointer group">
                  <span className="text-sm text-on-background font-medium">
                    Upskill {members.filter((m) => proficiencyOf(m, largestGap.skill) < 3)[0]?.name.split(" ")[0] ?? "the team"}{" "}
                    in {largestGap.skill}
                  </span>
                  <Icon
                    name="arrow_forward"
                    className="text-on-surface-variant group-hover:text-primary-container transition-colors"
                  />
                </div>
              ) : null}
              {topSkill ? (
                <div className="flex items-center justify-between p-md border border-outline-variant rounded hover:border-primary-container transition-colors cursor-pointer group">
                  <span className="text-sm text-on-background font-medium">
                    Reduce dependency on {topSkill.holders[0]?.member.name.split(" ")[0]} for{" "}
                    {topSkill.skill}
                  </span>
                  <Icon
                    name="arrow_forward"
                    className="text-on-surface-variant group-hover:text-primary-container transition-colors"
                  />
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
