/**
 * Unlinked Notes Repository (#13 v11)
 * Handles notes from voice or other sources that couldn't be linked to a person.
 */
import { eq, and, desc } from "drizzle-orm";
import { unlinkedNotes } from "../../drizzle/schema";
import { getDb } from "./base";

export async function createUnlinkedNote(
  userId: number,
  data: {
    content: string;
    source?: string;
    personNameHint?: string;
    captureId?: number;
  }
) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(unlinkedNotes).values({
    userId,
    content: data.content,
    source: data.source ?? "voice",
    personNameHint: data.personNameHint ?? null,
    captureId: data.captureId ?? null,
    status: "unlinked",
  });
  return result.insertId;
}

export async function getUnlinkedNotes(
  userId: number,
  opts: { status?: string; limit?: number; offset?: number } = {}
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(unlinkedNotes.userId, userId)];
  if (opts.status) conditions.push(eq(unlinkedNotes.status, opts.status));

  return db
    .select()
    .from(unlinkedNotes)
    .where(and(...conditions))
    .orderBy(desc(unlinkedNotes.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function linkNoteToPersonId(
  userId: number,
  noteId: number,
  personId: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(unlinkedNotes)
    .set({
      linkedPersonId: personId,
      linkedAt: new Date(),
      status: "linked",
    })
    .where(and(eq(unlinkedNotes.id, noteId), eq(unlinkedNotes.userId, userId)));
}

export async function deleteUnlinkedNote(userId: number, noteId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(unlinkedNotes)
    .where(and(eq(unlinkedNotes.id, noteId), eq(unlinkedNotes.userId, userId)));
}
