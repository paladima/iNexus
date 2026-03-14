import { eq, and, desc, asc, sql, like, inArray, isNull, or, lte, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, userGoals, people, personNotes, interactions,
  lists, listPeople, tasks, opportunities, drafts, searchQueries,
  searchResults, voiceCaptures, dailyBriefs, activityLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserSettings(userId: number, settings: {
  timezone?: string; language?: string; dailyBriefEnabled?: number;
  reminderMode?: string; onboardingCompleted?: number; name?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(settings).where(eq(users.id, userId));
}

// ─── User Goals ──────────────────────────────────────────────────
export async function upsertUserGoals(userId: number, data: {
  primaryGoal?: string; industries?: string[]; geographies?: string[];
  preferences?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(userGoals).set(data).where(eq(userGoals.userId, userId));
  } else {
    await db.insert(userGoals).values({ userId, ...data });
  }
}

export async function getUserGoals(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  return result[0] ?? null;
}

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

export async function getPersonNotes(personId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(personNotes).where(eq(personNotes.personId, personId)).orderBy(desc(personNotes.createdAt));
}

// ─── Interactions ────────────────────────────────────────────────
export async function addInteraction(userId: number, data: {
  personId: number; interactionType: string; channel?: string;
  content?: string; metadataJson?: Record<string, unknown>; occurredAt: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(interactions).values({ userId, ...data });
  await db.update(people).set({ lastInteractionAt: data.occurredAt })
    .where(and(eq(people.id, data.personId), eq(people.userId, userId)));
}

export async function getInteractions(userId: number, personId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(interactions.userId, userId)];
  if (personId) conditions.push(eq(interactions.personId, personId));
  return db.select().from(interactions).where(and(...conditions))
    .orderBy(desc(interactions.occurredAt)).limit(limit);
}

// ─── Lists ───────────────────────────────────────────────────────
export async function createList(userId: number, name: string, description?: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(lists).values({ userId, name, description });
  return result[0].insertId;
}

export async function getLists(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const allLists = await db.select().from(lists).where(eq(lists.userId, userId)).orderBy(desc(lists.updatedAt));
  const counts = await db.select({
    listId: listPeople.listId,
    count: sql<number>`count(*)`,
  }).from(listPeople).groupBy(listPeople.listId);
  const countMap = new Map(counts.map(c => [c.listId, Number(c.count)]));
  return allLists.map(l => ({ ...l, personCount: countMap.get(l.id) ?? 0 }));
}

export async function getListById(userId: number, listId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function updateList(userId: number, listId: number, data: { name?: string; description?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(lists).set(data).where(and(eq(lists.id, listId), eq(lists.userId, userId)));
}

export async function deleteList(userId: number, listId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(listPeople).where(eq(listPeople.listId, listId));
  await db.delete(lists).where(and(eq(lists.id, listId), eq(lists.userId, userId)));
}

export async function addPersonToList(listId: number, personId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(listPeople).values({ listId, personId });
  } catch { /* duplicate, ignore */ }
}

export async function removePersonFromList(listId: number, personId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(listPeople).where(and(eq(listPeople.listId, listId), eq(listPeople.personId, personId)));
}

export async function getListPeople(userId: number, listId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ person: people, addedAt: listPeople.addedAt })
    .from(listPeople)
    .innerJoin(people, eq(listPeople.personId, people.id))
    .where(and(eq(listPeople.listId, listId), eq(people.userId, userId)))
    .orderBy(desc(listPeople.addedAt));
}

// ─── Tasks ───────────────────────────────────────────────────────
export async function createTask(userId: number, data: {
  title: string; description?: string; personId?: number; listId?: number;
  dueAt?: Date; priority?: string; source?: string;
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

// ─── Opportunities ───────────────────────────────────────────────
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

// ─── Drafts ──────────────────────────────────────────────────────
export async function createDraft(userId: number, data: {
  personId?: number; listId?: number; draftType: string; tone?: string;
  subject?: string; body: string; status?: string;
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

// ─── Search Queries ──────────────────────────────────────────────
export async function createSearchQuery(userId: number, queryText: string, filtersJson?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(searchQueries).values({ userId, queryText, filtersJson });
  return result[0].insertId;
}

export async function saveSearchResults(searchQueryId: number, results: Array<{ personSnapshotJson: Record<string, unknown>; rank: number }>) {
  const db = await getDb();
  if (!db) return;
  if (results.length === 0) return;
  await db.insert(searchResults).values(results.map(r => ({ searchQueryId, ...r })));
  await db.update(searchQueries).set({ resultCount: results.length }).where(eq(searchQueries.id, searchQueryId));
}

// ─── Voice Captures ──────────────────────────────────────────────
export async function createVoiceCapture(userId: number, data: {
  audioUrl?: string; transcript: string; parsedJson?: Record<string, unknown>; status?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(voiceCaptures).values({ userId, ...data });
  return result[0].insertId;
}

export async function getVoiceCaptures(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(voiceCaptures).where(eq(voiceCaptures.userId, userId))
    .orderBy(desc(voiceCaptures.createdAt)).limit(limit);
}

// ─── Daily Briefs ────────────────────────────────────────────────
export async function getDailyBrief(userId: number, date: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(dailyBriefs)
    .where(and(eq(dailyBriefs.userId, userId), sql`${dailyBriefs.briefDate} = ${date}`)).limit(1);
  return result[0] ?? null;
}

export async function saveDailyBrief(userId: number, date: string, briefJson: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(dailyBriefs).values({ userId, briefDate: new Date(date), briefJson });
  } catch {
    await db.update(dailyBriefs).set({ briefJson })
      .where(and(eq(dailyBriefs.userId, userId), sql`${dailyBriefs.briefDate} = ${date}`));
  }
}

// ─── Activity Log ────────────────────────────────────────────────
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

// ─── Dashboard Stats ─────────────────────────────────────────────
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
