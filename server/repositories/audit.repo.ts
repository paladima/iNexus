import { eq, desc, sql, and, gte } from "drizzle-orm";
import { getDb } from "./base";
import { aiAuditLog } from "../../drizzle/schema";

export async function logAiAction(userId: number, data: {
  promptModule: string;
  entityType?: string;
  entityId?: number;
  success: boolean;
  usedFallback?: boolean;
  errorMessage?: string;
  durationMs?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiAuditLog).values({
    userId,
    promptModule: data.promptModule,
    entityType: data.entityType,
    entityId: data.entityId,
    success: data.success ? 1 : 0,
    usedFallback: data.usedFallback ? 1 : 0,
    errorMessage: data.errorMessage,
    durationMs: data.durationMs,
  });
}

export async function getAiAuditLog(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiAuditLog)
    .where(eq(aiAuditLog.userId, userId))
    .orderBy(desc(aiAuditLog.createdAt))
    .limit(limit);
}

/** Get audit entries for a specific entity */
export async function getAuditForEntity(userId: number, entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiAuditLog)
    .where(and(
      eq(aiAuditLog.userId, userId),
      eq(aiAuditLog.entityType, entityType),
      eq(aiAuditLog.entityId, entityId),
    ))
    .orderBy(desc(aiAuditLog.createdAt));
}

/** Get AI usage stats for a user */
export async function getAiUsageStats(userId: number, sinceDaysAgo = 30) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);

  const result = await db.select({
    totalCalls: sql<number>`count(*)`,
    successCount: sql<number>`sum(case when ${aiAuditLog.success} = 1 then 1 else 0 end)`,
    fallbackCount: sql<number>`sum(case when ${aiAuditLog.usedFallback} = 1 then 1 else 0 end)`,
    errorCount: sql<number>`sum(case when ${aiAuditLog.success} = 0 then 1 else 0 end)`,
    avgDurationMs: sql<number>`avg(${aiAuditLog.durationMs})`,
    totalDurationMs: sql<number>`sum(${aiAuditLog.durationMs})`,
  }).from(aiAuditLog)
    .where(and(eq(aiAuditLog.userId, userId), gte(aiAuditLog.createdAt, since)));

  return result[0] ?? null;
}

/** Get per-module breakdown */
export async function getAiUsageByModule(userId: number, sinceDaysAgo = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);

  return db.select({
    promptModule: aiAuditLog.promptModule,
    totalCalls: sql<number>`count(*)`,
    successRate: sql<number>`avg(${aiAuditLog.success})`,
    avgDurationMs: sql<number>`avg(${aiAuditLog.durationMs})`,
    fallbackRate: sql<number>`avg(${aiAuditLog.usedFallback})`,
  }).from(aiAuditLog)
    .where(and(eq(aiAuditLog.userId, userId), gte(aiAuditLog.createdAt, since)))
    .groupBy(aiAuditLog.promptModule)
    .orderBy(desc(sql`count(*)`));
}
