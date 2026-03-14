import { eq, desc } from "drizzle-orm";
import { getDb } from "./base";
import { voiceCaptures } from "../../drizzle/schema";

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
