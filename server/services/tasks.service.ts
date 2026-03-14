/**
 * Tasks Service (#1-2 v11)
 * Business logic wrapper for task operations.
 * Used by command.service for orchestration instead of direct repo calls.
 */
import * as repo from "../repositories";

export async function createTask(
  userId: number,
  data: {
    title: string;
    description?: string;
    personId?: number;
    opportunityId?: number;
    priority?: string;
    dueDate?: string;
    dueAt?: Date;
  }
) {
  const id = await repo.createTask(userId, data);
  await repo.logActivity(userId, {
    activityType: "task_created",
    title: `Created task: ${data.title}`,
    entityType: "task",
    entityId: id ?? undefined,
  });
  return id;
}

export async function getTasks(
  userId: number,
  opts: { view?: "today" | "upcoming" | "completed"; personId?: number; limit?: number; offset?: number } = {}
) {
  return repo.getTasks(userId, opts);
}
