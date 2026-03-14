/**
 * People Service (#10)
 * Business logic for people: summary, profile, save.
 * Uses callLLM from llm.service (no direct invokeLLM).
 */
import * as repo from "../repositories";
import { callLLM } from "./llm.service";
import { personSummarySchema } from "../llmHelpers";
import { isFuzzyNameMatch } from "../utils/fuzzyMatch";
import { matchPerson, type PersonCandidate } from "../utils/personMatcher";

export async function generatePersonSummary(userId: number, personId: number) {
  const person = await repo.getPersonById(userId, personId);
  if (!person) throw new Error("Person not found");

  const notes = await repo.getPersonNotes(userId, personId);
  const ints = await repo.getInteractions(userId, personId, 10);
  const goals = await repo.getUserGoals(userId);

  const { data } = await callLLM<Record<string, unknown>>({
    promptModule: "person_summary",
    params: {
      messages: [
        {
          role: "system",
          content: `Generate a concise networking summary for this person. Explain why they matter to the user's goals. Return JSON: { "summary": "...", "keyPoints": ["..."], "connectionStrength": "strong|moderate|new" }`,
        },
        {
          role: "user",
          content: `Person: ${JSON.stringify(person)}\nNotes: ${JSON.stringify(notes)}\nInteractions: ${JSON.stringify(ints)}\nUser goals: ${JSON.stringify(goals)}`,
        },
      ],
      response_format: { type: "json_object" as const },
    },
    schema: personSummarySchema,
    fallback: {
      summary: `${person.fullName} — ${person.title ?? "Professional"} at ${person.company ?? "Unknown"}`,
      keyTopics: [],
      relevanceScore: 0,
    },
    userId,
    entityType: "person",
    entityId: personId,
  });

  const parsed = data as { summary: string; keyTopics?: string[]; relevanceScore?: number };
  await repo.updatePerson(userId, personId, { aiSummary: parsed.summary });
  return parsed;
}

export async function getPersonProfile(userId: number, personId: number) {
  const person = await repo.getPersonById(userId, personId);
  if (!person) return null;

  const notes = await repo.getPersonNotes(userId, personId);
  const interactionsList = await repo.getInteractions(userId, personId, 20);

  // Enrichment: get related data
  const [tasks, opportunities, drafts, relationships] = await Promise.all([
    repo.getTasks(userId, { personId, limit: 5 }).catch(() => ({ items: [] })),
    repo.getOpportunities(userId, { personId, limit: 5 }).catch(() => []),
    repo.getDrafts(userId, { personId, limit: 5 }).catch(() => []),
    repo.getRelationshipsForPerson(userId, personId).catch(() => []),
  ]);

  // Compute enrichment metadata
  const lastInteraction = interactionsList.length > 0 ? interactionsList[0] : null;
  const openTaskCount = Array.isArray((tasks as any).items) ? (tasks as any).items.length : 0;
  const openOpportunityCount = Array.isArray(opportunities) ? opportunities.length : 0;
  const draftCount = Array.isArray(drafts) ? drafts.length : 0;
  const connectionCount = Array.isArray(relationships) ? relationships.length : 0;

  return {
    ...person,
    notes,
    interactions: interactionsList,
    enrichment: {
      lastContactAt: lastInteraction ? (lastInteraction as any).occurredAt ?? (lastInteraction as any).createdAt : null,
      openTaskCount,
      openOpportunityCount,
      draftCount,
      connectionCount,
      relationships: Array.isArray(relationships) ? relationships.slice(0, 5) : [],
    },
  };
}

export async function searchPeople(
  userId: number,
  query: string,
  limit: number = 10
) {
  return repo.getPeople(userId, { search: query, limit });
}

export async function savePerson(
  userId: number,
  data: {
    fullName: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    company?: string;
    location?: string;
    linkedinUrl?: string;
    websiteUrl?: string;
    email?: string;
    phone?: string;
    sourceType?: string;
    sourceUrl?: string;
    tags?: string[];
  }
) {
  // Dedup check: multi-layer matching via PersonMatcher (#9, #10)
  if (data.fullName) {
    const { items: existing } = await repo.getPeople(userId, { search: data.fullName, limit: 20 });
    const result = matchPerson(
      { fullName: data.fullName, company: data.company, linkedinUrl: data.linkedinUrl, websiteUrl: data.websiteUrl },
      existing as PersonCandidate[]
    );
    if (result.matched && result.existingId) {
      return { id: result.existingId, duplicate: true };
    }
  }

  const id = await repo.createPerson(userId, data);
  await repo.logActivity(userId, {
    activityType: "person_added",
    title: `Added ${data.fullName}`,
    entityType: "person",
    entityId: id ?? undefined,
  });
  return { id, duplicate: false };
}
