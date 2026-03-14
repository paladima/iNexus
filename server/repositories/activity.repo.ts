import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "./base";
import { activityLog } from "../../drizzle/schema";

export async function logActivity(userId: number, data: {
  activityType: string; title: string; description?: string;
  entityType?: string; entityId?: number; metadataJson?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values({ userId, ...data });
}

export async function getActivityLog(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const where = eq(activityLog.userId, userId);
  const items = await db.select().from(activityLog).where(where)
    .orderBy(desc(activityLog.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(activityLog).where(where);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}
