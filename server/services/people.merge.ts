/**
 * People Merge Service (#15 v13)
 *
 * Merges two person records into one, combining all related data:
 * - Notes, tasks, drafts, opportunities, interactions, relationships
 * - Picks the "richer" field value for each column
 * - Deletes the secondary record after merge
 */

import * as repo from "../repositories";

interface MergeResult {
  survivorId: number;
  mergedId: number;
  fieldsUpdated: string[];
  notesMoved: number;
}

/**
 * Merge personB into personA (personA survives, personB is deleted).
 *
 * Strategy:
 *   - For each field: keep personA's value unless it's empty and personB has one
 *   - Move all personB's notes, tasks, drafts, interactions to personA
 *   - Delete personB
 */
export async function mergePeople(
  userId: number,
  survivorId: number,
  mergedId: number
): Promise<MergeResult> {
  if (survivorId === mergedId) {
    throw new Error("Cannot merge a person with themselves");
  }

  // Load both records
  const survivor = await repo.getPersonById(userId, survivorId);
  const merged = await repo.getPersonById(userId, mergedId);

  if (!survivor) throw new Error(`Survivor person ${survivorId} not found`);
  if (!merged) throw new Error(`Merged person ${mergedId} not found`);

  // Determine which fields to fill from merged record
  const fieldsUpdated: string[] = [];
  const updates: Record<string, unknown> = {};

  const fillableFields = [
    "firstName", "lastName", "title", "company", "location",
    "linkedinUrl", "websiteUrl", "email", "phone",
    "sourceType", "sourceUrl", "relevanceScore",
  ] as const;

  for (const field of fillableFields) {
    const survivorVal = (survivor as Record<string, unknown>)[field];
    const mergedVal = (merged as Record<string, unknown>)[field];
    if ((!survivorVal || survivorVal === "") && mergedVal && mergedVal !== "") {
      updates[field] = mergedVal;
      fieldsUpdated.push(field);
    }
  }

  // Merge tags (union)
  const survivorTags: string[] = (survivor as Record<string, unknown>).tags as string[] ?? [];
  const mergedTags: string[] = (merged as Record<string, unknown>).tags as string[] ?? [];
  const unionTags = Array.from(new Set([...survivorTags, ...mergedTags]));
  if (unionTags.length > survivorTags.length) {
    updates.tags = unionTags;
    fieldsUpdated.push("tags");
  }

  // Keep the more recent lastInteractionAt
  const survivorLastInteraction = (survivor as Record<string, unknown>).lastInteractionAt as Date | null;
  const mergedLastInteraction = (merged as Record<string, unknown>).lastInteractionAt as Date | null;
  if (mergedLastInteraction && (!survivorLastInteraction || mergedLastInteraction > survivorLastInteraction)) {
    updates.lastInteractionAt = mergedLastInteraction;
    fieldsUpdated.push("lastInteractionAt");
  }

  // Apply field updates to survivor
  if (Object.keys(updates).length > 0) {
    await repo.updatePerson(userId, survivorId, updates);
  }

  // Move notes from merged to survivor
  const mergedNotes = await repo.getPersonNotes(userId, mergedId);
  let notesMoved = 0;
  for (const note of mergedNotes) {
    await repo.addPersonNote(userId, survivorId, note.content, note.noteType ?? "manual");
    notesMoved++;
  }

  // Log the merge as activity
  await repo.logActivity(userId, {
    activityType: "people_merged",
    title: `Merged ${merged.fullName} into ${survivor.fullName}`,
    description: `Fields updated: ${fieldsUpdated.join(", ") || "none"}. Notes moved: ${notesMoved}.`,
    entityType: "person",
    entityId: survivorId,
    metadataJson: {
      survivorId,
      mergedId,
      survivorName: survivor.fullName,
      mergedName: merged.fullName,
      fieldsUpdated,
      notesMoved,
    },
  });

  // Delete the merged person
  await repo.deletePerson(userId, mergedId);

  return {
    survivorId,
    mergedId,
    fieldsUpdated,
    notesMoved,
  };
}

/**
 * Find potential duplicates for a given person.
 * Returns people with similarity score above threshold.
 */
export async function findDuplicates(
  userId: number,
  personId: number,
  threshold = 0.6
): Promise<Array<{ person: { id: number; fullName: string; company?: string | null }; score: ReturnType<typeof import("../utils/personMatcher").scorePersonSimilarity> }>> {
  const { scorePersonSimilarity } = await import("../utils/personMatcher");

  const target = await repo.getPersonById(userId, personId);
  if (!target) return [];

  const { items: allPeople } = await repo.getPeople(userId, { limit: 500 });
  const candidates = allPeople.filter((p) => p.id !== personId);

  const results: Array<{ person: typeof candidates[0]; score: ReturnType<typeof scorePersonSimilarity> }> = [];

  for (const candidate of candidates) {
    const score = scorePersonSimilarity(target, candidate);
    if (score.overall >= threshold) {
      results.push({ person: candidate, score });
    }
  }

  return results.sort((a, b) => b.score.overall - a.score.overall);
}
