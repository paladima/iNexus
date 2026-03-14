import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./base";
import { interactions, people } from "../../drizzle/schema";

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
