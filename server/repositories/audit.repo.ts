import { eq, desc, sql } from "drizzle-orm";
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
