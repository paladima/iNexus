/**
 * Discovery Service (#1-3, #10-13)
 * Full multi-query pipeline through DiscoveryProvider:
 *   1. normalizeQuery  — RU→EN, typo fix, skill/geo extraction
 *   2. decomposeIntent — structured intent from normalized query
 *   3. expandQueries   — 8-15 diverse query variants
 *   4. multi-search    — search each variant, aggregate results
 *   5. rerank          — LLM-based final relevance pass
 *   6. dedupe          — person-level deduplication
 *   7. fallback        — broad mode if results are too few
 *
 * No direct invokeLLM calls. All AI through DiscoveryProvider.
 */
import * as repo from "../repositories";
import { enqueueJob } from "./job.service";
import { getProviderWithFallback } from "../providers/registry";
import type { DiscoveryProvider, DiscoveryResult, DiscoveryIntent } from "../providers/types";

const MIN_RESULTS_THRESHOLD = 3;
const MAX_QUERY_VARIANTS = 12;

// ─── Helper: get provider or throw ─────────────────────────────
function requireDiscoveryProvider(): DiscoveryProvider {
  const provider = getProviderWithFallback("discovery");
  if (!provider) throw new Error("DiscoveryProvider not registered");
  return provider;
}

// ─── Full Multi-Query Search Pipeline (#1-3) ────────────────────
export async function executeSearch(
  userId: number,
  query: string,
  filters?: Record<string, unknown>
) {
  const provider = requireDiscoveryProvider();
  const goals = await repo.getUserGoals(userId);

  // Step 1: Normalize query (RU→EN, typo fix, metadata extraction) (#2)
  const normalization = await provider.normalizeQuery(query);
  const normalizedQuery = normalization.normalized;

  // Step 2: Decompose intent from normalized query (#1)
  const { intent, queryVariants: baseVariants } = await provider.decomposeIntent(
    normalizedQuery,
    goals ?? undefined
  );

  // Enrich intent with normalization metadata
  intent.originalLanguage = normalization.originalLanguage;
  intent.normalizedQuery = normalizedQuery;
  if (normalization.extractedSkills) {
    intent.skills = normalization.extractedSkills;
  }
  if (normalization.extractedGeo && !intent.geo) {
    intent.geo = normalization.extractedGeo;
  }
  if (normalization.extractedRole && !intent.role) {
    intent.role = normalization.extractedRole;
  }

  // Step 3: Expand to 8-15 query variants (#3)
  const expandedVariants = await provider.expandQueries(intent, baseVariants);
  const queryVariants = expandedVariants.slice(0, MAX_QUERY_VARIANTS);

  // Step 4: Persist search query
  const queryId = await repo.createSearchQuery(userId, query, filters ?? {}, {
    parsedIntentsJson: intent as unknown as Record<string, unknown>,
    queryVariantsJson: queryVariants,
    negativeTermsJson: intent.negatives ?? [],
  });

  // Step 5: Multi-query search — search each variant and aggregate (#3)
  let allResults: DiscoveryResult[] = [];

  // Execute searches in batches of 3 to balance speed and quality
  const batchSize = 3;
  for (let i = 0; i < queryVariants.length; i += batchSize) {
    const batch = queryVariants.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((variant) =>
        provider.search(variant, intent, queryVariants, filters, goals ?? undefined)
      )
    );
    for (const results of batchResults) {
      allResults.push(...results);
    }
  }

  // Step 6: Dedupe across all query variants (#3)
  allResults = provider.dedupe(allResults);

  // Step 7: Rerank top candidates (#1)
  if (allResults.length > 5) {
    allResults = await provider.rerank(allResults, intent, goals ?? undefined);
  }

  // Step 8: Fallback broad mode — if too few results, try broader query (#1)
  if (allResults.length < MIN_RESULTS_THRESHOLD) {
    const broadQuery = intent.topic || normalizedQuery;
    const broadResults = await provider.search(
      broadQuery,
      { topic: broadQuery }, // minimal intent for broad search
      [broadQuery],
      filters,
      goals ?? undefined
    );
    const broadDeduped = provider.dedupe([...allResults, ...broadResults]);
    allResults = broadDeduped;
  }

  // Step 9: Persist results
  if (queryId) {
    await repo.saveSearchResults(
      queryId,
      allResults.map((r: DiscoveryResult, i: number) => ({
        personSnapshotJson: r as Record<string, unknown>,
        rank: i + 1,
        scoringJson: (r.scoring ?? {}) as Record<string, unknown>,
        matchReasonsJson: (r.matchReasons ?? []) as string[],
      }))
    );
  }

  // Step 10: Activity log
  await repo.logActivity(userId, {
    activityType: "discovery_search",
    title: `Searched: "${query}"${normalization.originalLanguage !== "en" ? ` (${normalization.originalLanguage}→EN: "${normalizedQuery}")` : ""}`,
    metadataJson: {
      resultCount: allResults.length,
      queryVariantCount: queryVariants.length,
      originalLanguage: normalization.originalLanguage,
      normalizedQuery,
      intent: intent as unknown as Record<string, unknown>,
    },
  });

  return {
    queryId,
    results: allResults as Array<Record<string, unknown>>,
    intent: intent as unknown as Record<string, unknown>,
    queryVariants,
    normalization: {
      original: query,
      normalized: normalizedQuery,
      language: normalization.originalLanguage,
    },
  };
}

// ─── Bulk Save People (with enhanced dedup) (#10) ───────────────
export async function bulkSavePeople(
  userId: number,
  people: Array<{
    fullName: string;
    title?: string;
    company?: string;
    location?: string;
    linkedinUrl?: string;
    websiteUrl?: string;
    sourceType?: string;
    relevanceScore?: string;
  }>
) {
  const savedIds: number[] = [];
  const skipped: string[] = [];
  const matched: string[] = [];

  // Batch read: get all existing people once
  const { items: existingPeople } = await repo.getPeople(userId, { limit: 1000 });

  // Build lookup indexes for dedup (#10)
  const nameCompanyIndex = new Map<string, number>();
  const linkedinIndex = new Map<string, number>();
  const websiteIndex = new Map<string, number>();

  for (const ep of existingPeople) {
    const nameKey = `${(ep.fullName ?? "").toLowerCase().trim()}|${(ep.company ?? "").toLowerCase().trim()}`;
    nameCompanyIndex.set(nameKey, ep.id);

    if (ep.linkedinUrl) {
      linkedinIndex.set(ep.linkedinUrl.toLowerCase().replace(/\/$/, ""), ep.id);
    }
    if (ep.websiteUrl) {
      websiteIndex.set(ep.websiteUrl.toLowerCase().replace(/\/$/, ""), ep.id);
    }
  }

  for (const p of people) {
    // Enhanced dedup: check linkedinUrl first, then websiteUrl, then name+company (#10)
    let existingId: number | undefined;

    if (p.linkedinUrl) {
      existingId = linkedinIndex.get(p.linkedinUrl.toLowerCase().replace(/\/$/, ""));
    }
    if (!existingId && p.websiteUrl) {
      existingId = websiteIndex.get(p.websiteUrl.toLowerCase().replace(/\/$/, ""));
    }
    if (!existingId) {
      const nameKey = `${p.fullName.toLowerCase().trim()}|${(p.company ?? "").toLowerCase().trim()}`;
      existingId = nameCompanyIndex.get(nameKey);
    }

    if (existingId) {
      matched.push(p.fullName);
      continue;
    }

    // Also check name-only for very similar names
    const nameOnly = p.fullName.toLowerCase().trim();
    const nameOnlyDup = existingPeople.some(
      (e) => e.fullName.toLowerCase().trim() === nameOnly &&
        (!p.company || (e.company ?? "").toLowerCase().trim() === (p.company ?? "").toLowerCase().trim())
    );
    if (nameOnlyDup) {
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
    if (id) {
      savedIds.push(id);
      // Update indexes for subsequent dedup within the same batch
      const nameKey = `${p.fullName.toLowerCase().trim()}|${(p.company ?? "").toLowerCase().trim()}`;
      nameCompanyIndex.set(nameKey, id);
      if (p.linkedinUrl) linkedinIndex.set(p.linkedinUrl.toLowerCase().replace(/\/$/, ""), id);
      if (p.websiteUrl) websiteIndex.set(p.websiteUrl.toLowerCase().replace(/\/$/, ""), id);
    }
  }

  await repo.logActivity(userId, {
    activityType: "bulk_save_from_discovery",
    title: `Bulk saved ${savedIds.length} people (${skipped.length + matched.length} skipped)`,
    metadataJson: {
      created: savedIds.length,
      skipped_duplicate: skipped.length,
      matched_existing: matched.length,
    },
  });

  return {
    savedIds,
    count: savedIds.length,
    skipped: skipped.length,
    matched: matched.length,
    skippedNames: skipped,
    matchedNames: matched,
  };
}

// ─── Bulk Add to List (with batch optimization) (#11, #15) ──────
export async function bulkAddToList(userId: number, listId: number, personIds: number[]) {
  const list = await repo.getListById(userId, listId);
  if (!list) throw new Error("List not found or not owned by user");

  // Batch ownership check: get all people at once
  const { items: userPeople } = await repo.getPeople(userId, { limit: 1000 });
  const ownedIds = new Set(userPeople.map((p) => p.id));

  let added = 0;
  const failed: number[] = [];

  for (const personId of personIds) {
    if (!ownedIds.has(personId)) {
      failed.push(personId);
      continue;
    }
    try {
      await repo.addPersonToList(userId, listId, personId);
      added++;
    } catch {
      // Skip duplicates (already in list)
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

// ─── Bulk Generate Drafts (via job queue) (#11) ─────────────────
export async function bulkGenerateDrafts(
  userId: number,
  personIds: number[],
  tone: string = "professional",
  context?: string
) {
  // Batch ownership check
  const { items: userPeople } = await repo.getPeople(userId, { limit: 1000 });
  const ownedIds = new Set(userPeople.map((p) => p.id));
  const validIds = personIds.filter((id) => ownedIds.has(id));

  const jobId = await enqueueJob(userId, "batch_outreach", {
    personIds: validIds,
    tone,
    context,
  }, {
    priority: 1,
    dedupeKey: `batch_outreach:${userId}:${validIds.sort().join(",")}`,
  });

  return { jobId, status: "queued", count: validIds.length };
}

// ─── Bulk Create Follow-up Tasks (#11, #13) ─────────────────────
export async function bulkCreateTasks(
  userId: number,
  personIds: number[],
  taskPrefix: string = "Follow up with",
  priority: string = "medium",
  daysFromNow: number = 3
) {
  // Batch ownership check
  const { items: userPeople } = await repo.getPeople(userId, { limit: 1000 });
  const ownedMap = new Map(userPeople.map((p) => [p.id, p]));

  const createdIds: number[] = [];
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + daysFromNow);

  for (const personId of personIds) {
    const person = ownedMap.get(personId);
    if (!person) continue;
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
