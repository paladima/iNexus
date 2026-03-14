import { eq, and, desc } from "drizzle-orm";
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

export async function getVoiceCaptureById(userId: number, captureId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(voiceCaptures)
    .where(and(eq(voiceCaptures.id, captureId), eq(voiceCaptures.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function updateVoiceCapture(userId: number, captureId: number, data: {
  status?: string; parsedJson?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(voiceCaptures).set(data)
    .where(and(eq(voiceCaptures.id, captureId), eq(voiceCaptures.userId, userId)));
}
