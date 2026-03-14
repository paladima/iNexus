import { eq, and, desc, asc, sql, lte } from "drizzle-orm";
import { getDb } from "./base";
import { tasks } from "../../drizzle/schema";

export async function createTask(userId: number, data: {
  title: string; description?: string; personId?: number; listId?: number;
  opportunityId?: number; dueAt?: Date; priority?: string; source?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(tasks).values({ userId, ...data });
  return result[0].insertId;
}

export async function getTasks(userId: number, opts?: {
  status?: string; personId?: number; view?: "today" | "upcoming" | "completed";
  limit?: number; offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [eq(tasks.userId, userId)];
  if (opts?.status) conditions.push(eq(tasks.status, opts.status));
  if (opts?.personId) conditions.push(eq(tasks.personId, opts.personId));
  if (opts?.view === "today") {
    conditions.push(eq(tasks.status, "open"));
    conditions.push(lte(tasks.dueAt, new Date(new Date().setHours(23, 59, 59, 999))));
  } else if (opts?.view === "upcoming") {
    conditions.push(eq(tasks.status, "open"));
  } else if (opts?.view === "completed") {
    conditions.push(eq(tasks.status, "completed"));
  }

  const where = and(...conditions);
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const items = await db.select().from(tasks).where(where)
    .orderBy(asc(tasks.dueAt), desc(tasks.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(where);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function updateTask(userId: number, taskId: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set(data).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

export async function deleteTask(userId: number, taskId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}
