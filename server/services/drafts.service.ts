/**
 * Drafts Service (#2)
 * Business logic extracted from drafts.router.ts
 */
import * as repo from "../repositories";
import { getProvider } from "../providers/registry";
import { callLLM } from "./llm.service";

export async function generateOutreachDraft(
  userId: number,
  personId: number,
  tone: string = "professional",
  context?: string,
  channel: string = "email"
) {
  const person = await repo.getPersonById(userId, personId);
  if (!person) throw new Error("Person not found");

  const goals = await repo.getUserGoals(userId);

  // Try provider first
  const draftProvider = getProvider("draft");
  if (draftProvider) {
    try {
      const result = await draftProvider.generateDraft({
        personName: person.fullName,
        personTitle: person.title ?? undefined,
        personCompany: person.company ?? undefined,
        context: context ?? "General networking",
        userGoals: goals ?? undefined,
        tone,
        draftType: channel,
      });
      const id = await repo.createDraft(userId, {
        personId,
        draftType: channel,
        subject: result.subject,
        body: result.body,
        tone: result.tone ?? tone,
        metadataJson: { generatedBy: "ai", provider: "registry", context },
      });
      await repo.logActivity(userId, {
        activityType: "draft_generated",
        title: `Generated draft for ${person.fullName}`,
        entityType: "draft",
        entityId: id ?? undefined,
      });
      return { id, ...result };
    } catch {
      // Fall through to direct LLM
    }
  }

  const { data } = await callLLM({
    promptModule: "outreach_draft",
    params: {
      messages: [
        {
          role: "system",
          content: `You are a professional networking message writer. Generate a personalized outreach message. Return JSON: { "subject": "...", "body": "...", "tone": "${tone}", "channel": "${channel}" }`,
        },
        {
          role: "user",
          content: `Person: ${person.fullName}, ${person.title ?? ""} at ${person.company ?? ""}. Location: ${person.location ?? "unknown"}. Summary: ${person.aiSummary ?? "N/A"}. Tags: ${JSON.stringify(person.tags ?? [])}.\nUser goals: ${JSON.stringify(goals)}\nContext: ${context ?? "General networking"}`,
        },
      ],
      response_format: { type: "json_object" },
    },
    fallback: {
      subject: "Let's connect",
      body: `Hi ${person.fullName}, I'd love to connect and learn more about your work.`,
      tone,
      channel,
    },
    userId,
    entityType: "person",
    entityId: personId,
  });

  const draft = data as Record<string, string>;
  const id = await repo.createDraft(userId, {
    personId,
    draftType: draft.channel ?? channel,
    subject: draft.subject,
    body: draft.body,
    tone: draft.tone ?? tone,
    metadataJson: { generatedBy: "ai", context },
  });

  await repo.logActivity(userId, {
    activityType: "draft_generated",
    title: `Generated draft for ${person.fullName}`,
    entityType: "draft",
    entityId: id ?? undefined,
  });

  return { id, ...draft };
}

export async function generateIntroDraft(
  userId: number,
  personAId: number,
  personBId: number,
  reason: string,
  tone: string = "warm"
) {
  const [personA, personB] = await Promise.all([
    repo.getPersonById(userId, personAId),
    repo.getPersonById(userId, personBId),
  ]);
  if (!personA || !personB) throw new Error("One or both people not found");

  // Try provider first
  const draftProvider = getProvider("draft");
  if (draftProvider) {
    try {
      const result = await draftProvider.generateIntroDraft(
        personA.fullName,
        personB.fullName,
        reason
      );
      return result;
    } catch {
      // Fall through
    }
  }

  const { data } = await callLLM({
    promptModule: "intro_draft",
    params: {
      messages: [
        {
          role: "system",
          content: `You are a professional networking assistant. Write a warm introduction message connecting two people. Return JSON: { "subject": "...", "body": "..." }`,
        },
        {
          role: "user",
          content: `Person A: ${personA.fullName}, ${personA.title ?? ""} at ${personA.company ?? ""}.\nPerson B: ${personB.fullName}, ${personB.title ?? ""} at ${personB.company ?? ""}.\nContext: ${reason}`,
        },
      ],
      response_format: { type: "json_object" },
    },
    fallback: {
      subject: "Introduction",
      body: `I'd like to introduce ${personA.fullName} and ${personB.fullName}.`,
    },
    userId,
    entityType: "relationship",
  });

  return data as { subject?: string; body: string };
}
