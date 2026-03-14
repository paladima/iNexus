/**
 * People Service (#2)
 * Business logic extracted from people.router.ts
 */
import { invokeLLM } from "../_core/llm";
import * as repo from "../repositories";
import { parseLLMWithSchema, personSummarySchema } from "../llmHelpers";

export async function generatePersonSummary(userId: number, personId: number) {
  const person = await repo.getPersonById(userId, personId);
  if (!person) throw new Error("Person not found");

  const notes = await repo.getPersonNotes(userId, personId);
  const ints = await repo.getInteractions(userId, personId, 10);
  const goals = await repo.getUserGoals(userId);

  const response = await invokeLLM({
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
    response_format: { type: "json_object" },
  });

  const parsed = parseLLMWithSchema(
    response,
    personSummarySchema,
    "people.generateSummary",
    { summary: "", keyTopics: [], relevanceScore: 0 }
  );

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
  const id = await repo.createPerson(userId, data);
  await repo.logActivity(userId, {
    activityType: "person_added",
    title: `Added ${data.fullName}`,
    entityType: "person",
    entityId: id ?? undefined,
  });
  return { id };
}
