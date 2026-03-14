import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./base";
import { drafts } from "../../drizzle/schema";

export async function createDraft(userId: number, data: {
  personId?: number; listId?: number; draftType: string; tone?: string;
  subject?: string; body: string; status?: string; metadataJson?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(drafts).values({ userId, ...data });
  return result[0].insertId;
}

export async function getDrafts(userId: number, opts?: {
  status?: string; personId?: number; limit?: number; offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [eq(drafts.userId, userId)];
  if (opts?.status) conditions.push(eq(drafts.status, opts.status));
  if (opts?.personId) conditions.push(eq(drafts.personId, opts.personId));

  const where = and(...conditions);
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const items = await db.select().from(drafts).where(where)
    .orderBy(desc(drafts.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(drafts).where(where);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function updateDraft(userId: number, draftId: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(drafts).set(data).where(and(eq(drafts.id, draftId), eq(drafts.userId, userId)));
}

export async function deleteDraft(userId: number, draftId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(drafts).where(and(eq(drafts.id, draftId), eq(drafts.userId, userId)));
}
