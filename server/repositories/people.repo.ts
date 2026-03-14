import { eq, and, desc, asc, sql, like, or, lte, isNull, inArray } from "drizzle-orm";
import { getDb } from "./base";
import { people, personNotes, relationships } from "../../drizzle/schema";

// ─── People ──────────────────────────────────────────────────────
export async function createPerson(userId: number, data: {
  fullName: string; firstName?: string; lastName?: string; title?: string;
  company?: string; location?: string; linkedinUrl?: string; websiteUrl?: string;
  email?: string; phone?: string; sourceType?: string; sourceUrl?: string;
  tags?: string[]; status?: string; relevanceScore?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(people).values({ userId, ...data });
  return result[0].insertId;
}

export async function getPeople(userId: number, opts?: {
  search?: string; status?: string; tag?: string; limit?: number; offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [eq(people.userId, userId)];
  if (opts?.search) conditions.push(like(people.fullName, `%${opts.search}%`));
  if (opts?.status) conditions.push(eq(people.status, opts.status));
  if (opts?.tag) conditions.push(sql`JSON_CONTAINS(${people.tags}, JSON_QUOTE(${opts.tag}))`);

  const where = and(...conditions);
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const items = await db.select().from(people).where(where)
    .orderBy(desc(people.updatedAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(people).where(where);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function getPersonById(userId: number, personId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(people)
    .where(and(eq(people.id, personId), eq(people.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function updatePerson(userId: number, personId: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(people).set(data).where(and(eq(people.id, personId), eq(people.userId, userId)));
}

export async function deletePerson(userId: number, personId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(people).where(and(eq(people.id, personId), eq(people.userId, userId)));
}

// ─── Person Notes ────────────────────────────────────────────────
export async function addPersonNote(userId: number, personId: number, content: string, noteType = "manual", createdBy = "user") {
  const db = await getDb();
  if (!db) return;
  await db.insert(personNotes).values({ userId, personId, content, noteType, createdBy });
}

export async function getPersonNotes(userId: number, personId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(personNotes)
    .where(and(eq(personNotes.personId, personId), eq(personNotes.userId, userId)))
    .orderBy(desc(personNotes.createdAt));
}

// ─── Reconnect Detection ────────────────────────────────────────
export async function getPeopleNeedingReconnect(userId: number, daysSinceLastInteraction = 90) {
  const db = await getDb();
  if (!db) return [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastInteraction);

  return db.select().from(people)
    .where(and(
      eq(people.userId, userId),
      or(lte(people.lastInteractionAt, cutoffDate), isNull(people.lastInteractionAt))
    ))
    .orderBy(asc(people.lastInteractionAt))
    .limit(20);
}

// ─── Relationships (Graph) ──────────────────────────────────────
export async function createRelationship(userId: number, data: {
  personAId: number; personBId: number; relationshipType: string;
  confidence?: string; source?: string; metadataJson?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return null;
  const [personA] = await db.select().from(people)
    .where(and(eq(people.id, data.personAId), eq(people.userId, userId))).limit(1);
  if (!personA) throw new Error("Person A not found or not owned by user");
  const [personB] = await db.select().from(people)
    .where(and(eq(people.id, data.personBId), eq(people.userId, userId))).limit(1);
  if (!personB) throw new Error("Person B not found or not owned by user");
  const result = await db.insert(relationships).values({ userId, ...data });
  return result[0].insertId;
}

export async function getRelationshipsForPerson(userId: number, personId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(relationships)
    .where(and(
      eq(relationships.userId, userId),
      or(eq(relationships.personAId, personId), eq(relationships.personBId, personId))
    ))
    .orderBy(desc(relationships.confidence));
}

export async function findWarmPaths(userId: number, targetPersonId: number) {
  const db = await getDb();
  if (!db) return [];
  const targetRels = await db.select().from(relationships)
    .where(and(
      eq(relationships.userId, userId),
      or(eq(relationships.personAId, targetPersonId), eq(relationships.personBId, targetPersonId))
    ));

  const connectorIds = targetRels.map(r =>
    r.personAId === targetPersonId ? r.personBId : r.personAId
  );
  if (connectorIds.length === 0) return [];

  const connectors = await db.select().from(people)
    .where(and(eq(people.userId, userId), inArray(people.id, connectorIds)));

  return connectors.map(c => {
    const rel = targetRels.find(r => r.personAId === c.id || r.personBId === c.id);
    return {
      connector: c,
      relationshipType: rel?.relationshipType ?? "unknown",
      confidence: rel?.confidence ?? "0.50",
    };
  });
}
