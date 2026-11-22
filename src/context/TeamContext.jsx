import React, { createContext, useContext, useState, useEffect } from "react";
import { mockMembers as initialMembers, mockTasks as initialTasks } from "../services/mockData";

const STORAGE_KEY = "equilibrium_team_state_v1";

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const TeamContext = createContext();

export function TeamProvider({ children }) {
  const [members, setMembers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.members && parsed.tasks) {
          return parsed.members;
        }
      }
    } catch {
      // Ignore local storage error in SSR/test
    }
    return clone(initialMembers);
  });

  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.members && parsed.tasks) {
          return parsed.tasks;
        }
      }
    } catch {
      // Ignore local storage error in SSR/test
    }
    return clone(initialTasks);
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ members, tasks }));
    } catch {
      // Ignore
    }
  }, [members, tasks]);

  const addMember = (member) => setMembers((prev) => [...prev, member]);

  const updateMember = (updated) =>
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

  const addTask = (task) => setTasks((prev) => [...prev, task]);

  const updateTask = (updated) =>
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  /** Reassigns a task and moves its estimated hours between the two owners' load. */
  const assignTask = (taskId, memberId) => {
    let oldMemberId = null;
    let taskHours = 0;

    setTasks((prevTasks) => {
      const task = prevTasks.find((t) => t.id === taskId);
      if (!task) return prevTasks;
      oldMemberId = task.assignedMemberId;
      taskHours = Number(task.estimatedHours ?? task.hours ?? 0);

      return prevTasks.map((t) =>
        t.id === taskId ? { ...t, assignedMemberId: memberId, status: memberId ? "assigned" : "unassigned" } : t,
      );
    });

    if (memberId === oldMemberId) return;

    setMembers((prevMembers) => {
      return prevMembers.map((member) => {
        if (oldMemberId && member.id === oldMemberId) {
          return {
            ...member,
            currentAllocatedHours: Math.max(0, (member.currentAllocatedHours ?? 0) - taskHours),
          };
        }
        if (memberId && member.id === memberId) {
          return {
            ...member,
            currentAllocatedHours: (member.currentAllocatedHours ?? 0) + taskHours,
          };
        }
        return member;
      });
    });
  };

  const reassignTask = (taskId, memberId) => assignTask(taskId, memberId);

  const unassignTask = (taskId) => assignTask(taskId, null);

  const applyRebalanceProposal = (proposal) => {
    if (proposal?.task?.id && proposal?.to?.id) {
      assignTask(proposal.task.id, proposal.to.id);
    }
  };

  const applyAllProposals = (proposals = []) => {
    proposals.forEach((p) => {
      if (p?.task?.id && p?.to?.id) {
        assignTask(p.task.id, p.to.id);
      }
    });
  };

  const resetToDefaults = () => {
    const freshMembers = clone(initialMembers);
    const freshTasks = clone(initialTasks);
    setMembers(freshMembers);
    setTasks(freshTasks);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  return (
    <TeamContext.Provider
      value={{
        members,
        tasks,
        addMember,
        updateMember,
        addTask,
        updateTask,
        assignTask,
        reassignTask,
        unassignTask,
        applyRebalanceProposal,
        applyAllProposals,
        resetToDefaults,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeamContext() {
  return useContext(TeamContext);
}
