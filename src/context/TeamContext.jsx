import React, { createContext, useContext, useState } from "react";
import { mockMembers as initialMembers, mockTasks as initialTasks } from "../services/mockData";

const TeamContext = createContext();

export function TeamProvider({ children }) {
  const [members, setMembers] = useState(initialMembers);
  const [tasks, setTasks] = useState(initialTasks);

  const addMember = (member) => setMembers((prev) => [...prev, member]);

  const updateMember = (updated) =>
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

  const addTask = (task) => setTasks((prev) => [...prev, task]);

  const updateTask = (updated) =>
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  /** Reassigns a task and moves its estimated hours between the two owners' load. */
  const assignTask = (taskId, memberId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assignedMemberId: memberId, status: "assigned" } : t)),
    );

    setMembers((prev) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.assignedMemberId === memberId) return prev;

      return prev.map((member) => {
        if (member.id === task.assignedMemberId) {
          return {
            ...member,
            currentAllocatedHours: Math.max(
              0,
              member.currentAllocatedHours - task.estimatedHours,
            ),
          };
        }
        if (member.id === memberId) {
          return {
            ...member,
            currentAllocatedHours: member.currentAllocatedHours + task.estimatedHours,
          };
        }
        return member;
      });
    });
  };

  const unassignTask = (taskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, assignedMemberId: null, status: "unassigned" } : t,
      ),
    );

    setMembers((prev) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task?.assignedMemberId) return prev;

      return prev.map((member) =>
        member.id === task.assignedMemberId
          ? {
              ...member,
              currentAllocatedHours: Math.max(
                0,
                member.currentAllocatedHours - task.estimatedHours,
              ),
            }
          : member,
      );
    });
  };

  return (
    <TeamContext.Provider
      value={{ members, tasks, addMember, updateMember, addTask, updateTask, assignTask, unassignTask }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeamContext() {
  return useContext(TeamContext);
}
