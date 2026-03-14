import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./base";
import { opportunities } from "../../drizzle/schema";

export async function createOpportunity(userId: number, data: {
  title: string; opportunityType: string; signalSummary: string;
  personId?: number; whyItMatters?: string; recommendedAction?: string;
  score?: string; metadataJson?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(opportunities).values({ userId, ...data });
  return result[0].insertId;
}

export async function getOpportunities(userId: number, opts?: {
  status?: string; personId?: number; limit?: number; offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [eq(opportunities.userId, userId)];
  if (opts?.status) conditions.push(eq(opportunities.status, opts.status));
  if (opts?.personId) conditions.push(eq(opportunities.personId, opts.personId));

  const where = and(...conditions);
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const items = await db.select().from(opportunities).where(where)
    .orderBy(desc(opportunities.detectedAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(opportunities).where(where);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function updateOpportunity(userId: number, oppId: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(opportunities).set(data).where(and(eq(opportunities.id, oppId), eq(opportunities.userId, userId)));
}

export async function getOpportunityById(userId: number, oppId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(opportunities)
    .where(and(eq(opportunities.id, oppId), eq(opportunities.userId, userId))).limit(1);
  return result[0] ?? null;
}
