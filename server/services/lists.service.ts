/**
 * Lists Service (#1-2 v11)
 * Business logic wrapper for list operations.
 * Used by command.service for orchestration instead of direct repo calls.
 */
import * as repo from "../repositories";

export async function createList(userId: number, name: string, description?: string) {
  const id = await repo.createList(userId, name, description);
  await repo.logActivity(userId, {
    activityType: "list_created",
    title: `Created list "${name}"`,
    entityType: "list",
    entityId: id ?? undefined,
  });
  return id;
}

export async function getLists(userId: number) {
  return repo.getLists(userId);
}

export async function findListByName(userId: number, name: string) {
  const lists = await repo.getLists(userId);
  return lists.find((l: any) =>
    l.name?.toLowerCase().includes(name.toLowerCase())
  ) as any | null;
}
