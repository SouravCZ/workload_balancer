import { describe, it, expect } from "vitest";
import { mockMembers, mockTasks } from "../services/mockData";

describe("TeamContext Invariants & Data Integrity", () => {
  it("seed data has no duplicate member IDs or task IDs", () => {
    const memberIds = mockMembers.map((m) => m.id);
    const uniqueMemberIds = new Set(memberIds);
    expect(uniqueMemberIds.size).toBe(memberIds.length);

    const taskIds = mockTasks.map((t) => t.id);
    const uniqueTaskIds = new Set(taskIds);
    expect(uniqueTaskIds.size).toBe(taskIds.length);
  });

  it("every assigned task references a valid existing member ID", () => {
    const memberIdSet = new Set(mockMembers.map((m) => m.id));
    mockTasks.forEach((task) => {
      if (task.assignedMemberId) {
        expect(memberIdSet.has(task.assignedMemberId)).toBe(true);
      }
    });
  });

  it("initial member allocated hours matches sum of assigned task estimated hours", () => {
    mockMembers.forEach((member) => {
      const assignedHours = mockTasks
        .filter((t) => t.assignedMemberId === member.id)
        .reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
      expect(member.currentAllocatedHours).toBe(assignedHours);
    });
  });

  it("conserves total allocated hours across assign, reassign, and unassign operations", () => {
    let currentMembers = JSON.parse(JSON.stringify(mockMembers));
    let currentTasks = JSON.parse(JSON.stringify(mockTasks));

    const getMember = (id) => currentMembers.find((m) => m.id === id);
    const getTask = (id) => currentTasks.find((t) => t.id === id);

    const assign = (taskId, newMemberId) => {
      const task = getTask(taskId);
      const oldMemberId = task.assignedMemberId;
      const hours = task.estimatedHours;

      task.assignedMemberId = newMemberId;
      task.status = newMemberId ? "assigned" : "unassigned";

      if (oldMemberId) {
        const oldM = getMember(oldMemberId);
        oldM.currentAllocatedHours = Math.max(0, oldM.currentAllocatedHours - hours);
      }
      if (newMemberId) {
        const newM = getMember(newMemberId);
        newM.currentAllocatedHours = (newM.currentAllocatedHours ?? 0) + hours;
      }
    };

    // Reassign task t1 from m1 to m3
    const t1 = getTask("t1");
    const originalAssignedHours = currentTasks
      .filter((t) => t.assignedMemberId)
      .reduce((sum, t) => sum + t.estimatedHours, 0);

    assign("t1", "m3");
    const afterReassignHours = currentTasks
      .filter((t) => t.assignedMemberId)
      .reduce((sum, t) => sum + t.estimatedHours, 0);
    expect(afterReassignHours).toBe(originalAssignedHours);

    // Unassign task t1
    assign("t1", null);
    const afterUnassignHours = currentTasks
      .filter((t) => t.assignedMemberId)
      .reduce((sum, t) => sum + t.estimatedHours, 0);
    expect(afterUnassignHours).toBe(originalAssignedHours - t1.estimatedHours);

    // Assign unassigned task t1 to m4
    assign("t1", "m4");
    const afterReassignBack = currentTasks
      .filter((t) => t.assignedMemberId)
      .reduce((sum, t) => sum + t.estimatedHours, 0);
    expect(afterReassignBack).toBe(originalAssignedHours);

    // Every member's allocated hours matches actual task sum
    currentMembers.forEach((member) => {
      const expected = currentTasks
        .filter((t) => t.assignedMemberId === member.id)
        .reduce((sum, t) => sum + t.estimatedHours, 0);
      expect(member.currentAllocatedHours).toBe(expected);
    });
  });

  it("resetToDefaults restores the exact deep seed data", () => {
    let mutatedMembers = JSON.parse(JSON.stringify(mockMembers));
    mutatedMembers[0].name = "Mutated Name";

    const freshMembers = JSON.parse(JSON.stringify(mockMembers));
    expect(freshMembers[0].name).toBe("Sarah Jenkins");
    expect(freshMembers[0].currentAllocatedHours).toBe(48);
  });
});
