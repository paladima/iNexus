import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./base";
import { opportunities, drafts, tasks, people } from "../../drizzle/schema";

export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return { openOpportunities: 0, pendingDrafts: 0, openTasks: 0, totalPeople: 0, recentPeople: [] };

  const [oppCount] = await db.select({ count: sql<number>`count(*)` })
    .from(opportunities).where(and(eq(opportunities.userId, userId), eq(opportunities.status, "open")));
  const [draftCount] = await db.select({ count: sql<number>`count(*)` })
    .from(drafts).where(and(eq(drafts.userId, userId), eq(drafts.status, "pending_review")));
  const [taskCount] = await db.select({ count: sql<number>`count(*)` })
    .from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.status, "open")));
  const [peopleCount] = await db.select({ count: sql<number>`count(*)` })
    .from(people).where(eq(people.userId, userId));
  const recentPeople = await db.select().from(people)
    .where(eq(people.userId, userId)).orderBy(desc(people.createdAt)).limit(5);

  return {
    openOpportunities: Number(oppCount?.count ?? 0),
    pendingDrafts: Number(draftCount?.count ?? 0),
    openTasks: Number(taskCount?.count ?? 0),
    totalPeople: Number(peopleCount?.count ?? 0),
    recentPeople,
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
