/**
 * Discovery Service (#2)
 * Business logic extracted from discover.router.ts
 * Handles: intent decomposition, search, scoring, dedup, bulk operations
 */
import { invokeLLM } from "../_core/llm";
import * as repo from "../repositories";
import { enqueueJob } from "./job.service";
import { getProvider } from "../providers/registry";
import {
  parseLLMContent,
  parseLLMWithSchema,
  intentDecompositionSchema,
} from "../llmHelpers";

// ─── Scoring weights ─────────────────────────────────────────
const SCORING_WEIGHTS = {
  roleMatch: 0.25,
  industryMatch: 0.20,
  geoMatch: 0.15,
  seniorityMatch: 0.15,
  goalAlignment: 0.15,
  signalStrength: 0.10,
};

// ─── Intent Decomposition ────────────────────────────────────
export async function decomposeSearchIntent(
  query: string,
  goals: Record<string, unknown> | null
) {
  // Try provider first
  const discoveryProvider = getProvider("discovery");
  if (discoveryProvider) {
    try {
      const result = await discoveryProvider.decomposeIntent(query, goals ?? undefined);
      return {
        intent: { ...result.intent, queryVariants: result.queryVariants },
        queryVariants: result.queryVariants,
      };
    } catch {
      // Fall through to direct LLM
    }
  }

  const intentResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a search intent parser for a networking tool. Decompose the user's search query into structured intent. Return JSON: { "topic": "...", "role": "...", "geo": "...", "industry": "...", "speaker": true/false, "negatives": ["..."], "queryVariants": ["variant1", "variant2", "variant3"] }. queryVariants should be 2-3 alternative phrasings of the same search to broaden recall.`,
      },
      {
        role: "user",
        content: `Query: "${query}"\nUser goals: ${JSON.stringify(goals)}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const intent = parseLLMWithSchema(
    intentResponse,
    intentDecompositionSchema,
    "discover.intentDecomposition",
    { topic: "", role: "", geo: "", industry: "", speaker: false, negatives: [], queryVariants: [query] }
  );

  return {
    intent,
    queryVariants: intent.queryVariants.length > 0 ? intent.queryVariants : [query],
  };
}

// ─── Search + Rank ───────────────────────────────────────────
export async function searchAndRank(
  intent: Record<string, unknown>,
  queryVariants: string[],
  negatives: string[],
  filters: Record<string, unknown>,
  goals: Record<string, unknown> | null
) {
  const searchResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a networking discovery engine with role-aware ranking. Generate 8-12 relevant people profiles based on the search intent. For each person, provide scoring on 6 axes (0-1 each):\n- roleMatch: how well their title/role matches the query\n- industryMatch: alignment with target industry\n- geoMatch: geographic relevance\n- seniorityMatch: appropriate seniority level\n- goalAlignment: relevance to user's networking goals\n- signalStrength: strength of the networking signal\n\nReturn JSON: { "results": [{ "fullName": "...", "title": "...", "company": "...", "location": "...", "sourceType": "web", "linkedinUrl": "", "scoring": { "roleMatch": 0.9, "industryMatch": 0.8, "geoMatch": 0.7, "seniorityMatch": 0.85, "goalAlignment": 0.9, "signalStrength": 0.75 }, "matchReasons": ["reason1", "reason2"], "whyRelevant": "..." }] }. Exclude anyone matching these negatives: ${JSON.stringify(negatives)}`,
      },
      {
        role: "user",
        content: `Intent: ${JSON.stringify(intent)}\nQuery variants: ${JSON.stringify(queryVariants)}\nFilters: ${JSON.stringify(filters)}\nUser goals: ${JSON.stringify(goals)}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const searchParsed = parseLLMContent<{ results: Array<Record<string, unknown>> }>(
    searchResponse,
    "discover.search",
    { results: [] }
  );

  return scoreAndDeduplicate(searchParsed.results ?? []);
}

// ─── Scoring + Dedup ─────────────────────────────────────────
export function scoreAndDeduplicate(results: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  // Score
  let scored = results.map((r) => {
    const scoring = (r.scoring ?? {}) as Record<string, number>;
    const totalScore = Object.entries(SCORING_WEIGHTS).reduce((sum, [key, weight]) => {
      return sum + (scoring[key] ?? 0) * weight;
    }, 0);
    return { ...r, relevanceScore: Math.round(totalScore * 100) / 100 };
  });

  // Deduplicate
  const seen = new Set<string>();
  scored = scored.filter((r: Record<string, unknown>) => {
    const name = (String(r.fullName ?? "")).toLowerCase();
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  // Sort by score
  scored.sort((a, b) => ((b.relevanceScore as number) ?? 0) - ((a.relevanceScore as number) ?? 0));

  return scored;
}

// ─── Full Search Pipeline ────────────────────────────────────
export async function executeSearch(
  userId: number,
  query: string,
  filters?: Record<string, unknown>
) {
  const goals = await repo.getUserGoals(userId);
  const { intent, queryVariants } = await decomposeSearchIntent(query, goals);
  const negatives = (intent as any).negatives ?? [];

  const queryId = await repo.createSearchQuery(userId, query, filters ?? {}, {
    parsedIntentsJson: intent,
    queryVariantsJson: queryVariants,
    negativeTermsJson: negatives,
  });

  const results = await searchAndRank(intent, queryVariants, negatives, filters ?? {}, goals);

  if (queryId) {
    await repo.saveSearchResults(
      queryId,
      results.map((r, i) => ({
        personSnapshotJson: r,
        rank: i + 1,
        scoringJson: (r.scoring ?? {}) as Record<string, unknown>,
        matchReasonsJson: (r.matchReasons ?? []) as string[],
      }))
    );
  }

  await repo.logActivity(userId, {
    activityType: "discovery_search",
    title: `Searched: "${query}"`,
    metadataJson: { resultCount: results.length, intent },
  });

  return { queryId, results: results as Array<Record<string, unknown>>, intent, queryVariants };
}

// ─── Bulk Save People ────────────────────────────────────────
export async function bulkSavePeople(
  userId: number,
  people: Array<{ fullName: string; title?: string; company?: string; location?: string; linkedinUrl?: string; sourceType?: string; relevanceScore?: string }>
) {
  const savedIds: number[] = [];
  for (const p of people) {
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
    title: `Bulk saved ${savedIds.length} people from discovery`,
    metadataJson: { count: savedIds.length },
  });
  return { savedIds, count: savedIds.length };
}

// ─── Bulk Add to List ────────────────────────────────────────
export async function bulkAddToList(userId: number, listId: number, personIds: number[]) {
  const list = await repo.getListById(userId, listId);
  if (!list) throw new Error("List not found");

  let added = 0;
  for (const personId of personIds) {
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
  });
  return { added };
}

// ─── Bulk Generate Drafts ────────────────────────────────────
export async function bulkGenerateDrafts(
  userId: number,
  personIds: number[],
  tone: string = "professional",
  context?: string
) {
  const jobId = await enqueueJob(userId, "batch_outreach", {
    personIds,
    tone,
    context,
  }, { priority: 1 });
  return { jobId, status: "queued", count: personIds.length };
}

// ─── Bulk Create Follow-up Tasks ─────────────────────────────
export async function bulkCreateTasks(
  userId: number,
  personIds: number[],
  taskPrefix: string = "Follow up with",
  priority: string = "medium",
  daysFromNow: number = 3
) {
  const createdIds: number[] = [];
  for (const personId of personIds) {
    const person = await repo.getPersonById(userId, personId);
    if (!person) continue;
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + daysFromNow);
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
