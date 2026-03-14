/**
 * Unlinked Notes Service (#13 v11)
 * Business logic for managing notes that couldn't be linked to a person.
 * Allows later manual linking by the user.
 */
import * as repo from "../repositories";

export async function saveUnlinkedNote(
  userId: number,
  data: {
    content: string;
    source?: string;
    personNameHint?: string;
    captureId?: number;
  }
) {
  const id = await repo.createUnlinkedNote(userId, data);
  await repo.logActivity(userId, {
    activityType: "unlinked_note_saved",
    title: `Saved unlinked note${data.personNameHint ? ` (hint: ${data.personNameHint})` : ""}`,
    metadataJson: { source: data.source, personNameHint: data.personNameHint },
  });
  return id;
}

export async function getUnlinkedNotes(
  userId: number,
  opts: { status?: string; limit?: number; offset?: number } = {}
) {
  return repo.getUnlinkedNotes(userId, opts);
}

export async function linkNoteToPerson(
  userId: number,
  noteId: number,
  personId: number
) {
  await repo.linkNoteToPersonId(userId, noteId, personId);

  // Also create a person note from the unlinked note content
  const notes = await repo.getUnlinkedNotes(userId, { status: "linked" });
  const note = notes.find((n: any) => n.id === noteId);
  if (note) {
    await repo.addPersonNote(userId, personId, (note as any).content, "voice", "system");
  }

  await repo.logActivity(userId, {
    activityType: "note_linked",
    title: `Linked note to person`,
    entityType: "person",
    entityId: personId,
  });
}

export async function deleteNote(userId: number, noteId: number) {
  return repo.deleteUnlinkedNote(userId, noteId);
}
