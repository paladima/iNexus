import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./base";
import { lists, listPeople, people } from "../../drizzle/schema";

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

export async function addPersonToList(userId: number, listId: number, personId: number) {
  const db = await getDb();
  if (!db) return;
  const [list] = await db.select().from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId))).limit(1);
  if (!list) throw new Error("List not found or not owned by user");
  const [person] = await db.select().from(people)
    .where(and(eq(people.id, personId), eq(people.userId, userId))).limit(1);
  if (!person) throw new Error("Person not found or not owned by user");
  try {
    await db.insert(listPeople).values({ listId, personId });
  } catch { /* duplicate, ignore */ }
}

export async function removePersonFromList(userId: number, listId: number, personId: number) {
  const db = await getDb();
  if (!db) return;
  const [list] = await db.select().from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId))).limit(1);
  if (!list) throw new Error("List not found or not owned by user");
  await db.delete(listPeople).where(and(
    eq(listPeople.listId, listId), eq(listPeople.personId, personId)
  ));
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

export async function getListPeopleForBatch(userId: number, listId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ person: people })
    .from(listPeople)
    .innerJoin(people, eq(listPeople.personId, people.id))
    .where(and(eq(listPeople.listId, listId), eq(people.userId, userId)));
}
