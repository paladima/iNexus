/**
 * Discovery Service (#1-3, #13-16)
 * Full pipeline through DiscoveryProvider. No direct invokeLLM calls.
 * Handles: intent decomposition, search, scoring, dedup, bulk operations.
 */
import * as repo from "../repositories";
import { enqueueJob } from "./job.service";
import { getProviderWithFallback } from "../providers/registry";
import type { DiscoveryProvider, DiscoveryResult } from "../providers/types";

// ─── Helper: get provider or throw ─────────────────────────────
function requireDiscoveryProvider(): DiscoveryProvider {
  const provider = getProviderWithFallback("discovery");
  if (!provider) throw new Error("DiscoveryProvider not registered");
  return provider;
}

// ─── Full Search Pipeline ────────────────────────────────────
export async function executeSearch(
  userId: number,
  query: string,
  filters?: Record<string, unknown>
) {
  const provider = requireDiscoveryProvider();
  const goals = await repo.getUserGoals(userId);

  // Step 1: Decompose intent (fully through provider)
  const { intent, queryVariants } = await provider.decomposeIntent(query, goals ?? undefined);

  // Step 2: Persist search query
  const queryId = await repo.createSearchQuery(userId, query, filters ?? {}, {
    parsedIntentsJson: intent as unknown as Record<string, unknown>,
    queryVariantsJson: queryVariants,
    negativeTermsJson: intent.negatives ?? [],
  });

  // Step 3: Search + score + dedup (fully through provider)
  const results = await provider.search(query, intent, queryVariants, filters, goals ?? undefined);

  // Step 4: Persist results
  if (queryId) {
    await repo.saveSearchResults(
      queryId,
      results.map((r: DiscoveryResult, i: number) => ({
        personSnapshotJson: r as Record<string, unknown>,
        rank: i + 1,
        scoringJson: (r.scoring ?? {}) as Record<string, unknown>,
        matchReasonsJson: (r.matchReasons ?? []) as string[],
      }))
    );
  }

  // Step 5: Activity log
  await repo.logActivity(userId, {
    activityType: "discovery_search",
    title: `Searched: "${query}"`,
    metadataJson: { resultCount: results.length, intent: intent as unknown as Record<string, unknown> },
  });

  return {
    queryId,
    results: results as Array<Record<string, unknown>>,
    intent: intent as unknown as Record<string, unknown>,
    queryVariants,
  };
}

// ─── Bulk Save People (with dedup) (#14) ────────────────────────
export async function bulkSavePeople(
  userId: number,
  people: Array<{
    fullName: string;
    title?: string;
    company?: string;
    location?: string;
    linkedinUrl?: string;
    sourceType?: string;
    relevanceScore?: string;
  }>
) {
  const savedIds: number[] = [];
  const skipped: string[] = [];

  for (const p of people) {
    // Dedup: check if person already exists by (userId, fullName, company)
    const { items: existing } = await repo.getPeople(userId, {
      search: p.fullName,
      limit: 5,
    });
    const duplicate = existing.some(
      (e) =>
        e.fullName.toLowerCase() === p.fullName.toLowerCase() &&
        (!p.company || (e.company ?? "").toLowerCase() === (p.company ?? "").toLowerCase())
    );

    if (duplicate) {
      skipped.push(p.fullName);
      continue;
    }

    const names = p.fullName.split(" ");
    const id = await repo.createPerson(userId, {
      ...p,
      firstName: names[0],
      lastName: names.slice(1).join(" "),
      status: "saved",
    });
    if (id) savedIds.push(id);
  }

  await repo.logActivity(userId, {
    activityType: "bulk_save_from_discovery",
    title: `Bulk saved ${savedIds.length} people (${skipped.length} skipped as duplicates)`,
    metadataJson: { created: savedIds.length, skipped: skipped.length },
  });

  return { savedIds, count: savedIds.length, skipped: skipped.length, skippedNames: skipped };
}

// ─── Bulk Add to List (with ownership check) (#15) ──────────────
export async function bulkAddToList(userId: number, listId: number, personIds: number[]) {
  const list = await repo.getListById(userId, listId);
  if (!list) throw new Error("List not found or not owned by user");

  // Ownership check: verify all personIds belong to user
  let added = 0;
  const failed: number[] = [];
  for (const personId of personIds) {
    const person = await repo.getPersonById(userId, personId);
    if (!person) {
      failed.push(personId);
      continue;
    }
    try {
      await repo.addPersonToList(userId, listId, personId);
      added++;
    } catch {
      // Skip duplicates
    }
  }

  await repo.logActivity(userId, {
    activityType: "bulk_add_to_list",
    title: `Added ${added} people to list "${(list as any).name}"`,
    entityType: "list",
    entityId: listId,
    metadataJson: { added, failed: failed.length },
  });

  return { added, failed: failed.length };
}

// ─── Bulk Generate Drafts ────────────────────────────────────
export async function bulkGenerateDrafts(
  userId: number,
  personIds: number[],
  tone: string = "professional",
  context?: string
) {
  // Ownership check
  const validIds: number[] = [];
  for (const pid of personIds) {
    const person = await repo.getPersonById(userId, pid);
    if (person) validIds.push(pid);
  }

  const jobId = await enqueueJob(userId, "batch_outreach", {
    personIds: validIds,
    tone,
    context,
  }, { priority: 1 });

  return { jobId, status: "queued", count: validIds.length };
}

// ─── Bulk Create Follow-up Tasks (#13) ──────────────────────────
export async function bulkCreateTasks(
  userId: number,
  personIds: number[],
  taskPrefix: string = "Follow up with",
  priority: string = "medium",
  daysFromNow: number = 3
) {
  const createdIds: number[] = [];
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + daysFromNow);

  for (const personId of personIds) {
    const person = await repo.getPersonById(userId, personId);
    if (!person) continue; // ownership check implicit in getPersonById
    const id = await repo.createTask(userId, {
      title: `${taskPrefix} ${person.fullName}`,
      priority,
      dueAt,
      personId,
    });
    if (id) createdIds.push(id);
  }

  await repo.logActivity(userId, {
    activityType: "bulk_create_tasks",
    title: `Created ${createdIds.length} follow-up tasks`,
    metadataJson: { count: createdIds.length },
  });

  return { createdIds, count: createdIds.length };
}
