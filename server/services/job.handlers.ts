/**
 * Job Handlers — register all background job types with the job service.
 * Import this once at server startup.
 */

import { registerJobHandler } from "./job.service";
import { callLLM } from "./llm.service";
import { dailyBriefSchema, personSummarySchema, opportunityDetectionSchema, voiceIntentSchema } from "../llmHelpers";
import * as repo from "../repositories";

/**
 * Call this once at server startup to register all handlers.
 * The handlers are defined as side effects, so just importing this module registers them.
 * This function exists as an explicit entry point.
 */
export function registerAllHandlers() {
  console.log("[Jobs] All job handlers registered");
}

// ─── Generate Daily Brief ───────────────────────────────────────
registerJobHandler("generate_brief", async (_jobId, userId, _payload) => {
  const goals = await repo.getUserGoals(userId);
  const opps = await repo.getOpportunities(userId, { status: "open", limit: 10 });
  const taskData = await repo.getTasks(userId, { status: "open", limit: 10 });
  const stale = await repo.getPeopleNeedingReconnect(userId, 90);

  const { data: brief } = await callLLM({
    promptModule: "daily_brief",
    params: {
      messages: [
        {
          role: "system",
          content: `You are a daily brief generator for a networking app. Return JSON: { greeting, summary, items: [{ title, description, priority, type }], reconnectSuggestions: [{ personName, reason }] }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            goals: goals ?? {},
            opportunities: opps.items.slice(0, 5),
            tasks: taskData.items.slice(0, 5),
            staleContacts: stale.slice(0, 5).map(p => ({ name: p.fullName, lastInteraction: p.lastInteractionAt })),
          }),
        },
      ],
      response_format: { type: "json_object" as const },
    },
    schema: dailyBriefSchema,
    fallback: {
      greeting: "Good morning!",
      summary: "Here's your daily brief.",
      items: [],
    },
    userId,
  });

  const today = new Date().toISOString().split("T")[0];
  await repo.saveDailyBrief(userId, today, brief as Record<string, unknown>);
  return brief as Record<string, unknown>;
});

// ─── Generate Person Summary ────────────────────────────────────
registerJobHandler("generate_summary", async (_jobId, userId, payload) => {
  const personId = payload.personId as number;
  const person = await repo.getPersonById(userId, personId);
  if (!person) throw new Error("Person not found");

  const { data: summary } = await callLLM({
    promptModule: "person_summary",
    params: {
      messages: [
        {
          role: "system",
          content: `Generate a networking summary for this person. Return JSON: { summary: string, keyTopics: string[], networkingAngle: string }`,
        },
        { role: "user", content: JSON.stringify(person) },
      ],
      response_format: { type: "json_object" as const },
    },
    schema: personSummarySchema,
    fallback: { summary: `${person.fullName} — ${person.title ?? "Professional"} at ${person.company ?? "Unknown"}`, keyTopics: [], relevanceScore: 0 },
    userId,
    entityType: "person",
    entityId: personId,
  });

  await repo.updatePerson(userId, personId, { aiSummary: (summary as any).summary });
  return summary as Record<string, unknown>;
});

// ─── Scan Opportunities ─────────────────────────────────────────
registerJobHandler("scan_opportunities", async (_jobId, userId, _payload) => {
  const goals = await repo.getUserGoals(userId);
  const peopleData = await repo.getPeople(userId, { limit: 50 });

  const { data: opportunities } = await callLLM({
    promptModule: "opportunity_scan",
    params: {
      messages: [
        {
          role: "system",
          content: `Detect networking opportunities from the user's contacts. Return JSON: { opportunities: [{ title, opportunityType, signalSummary, whyItMatters, recommendedAction, score, personIndex }] }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            goals: goals ?? {},
            people: peopleData.items.map((p, i) => ({ index: i, name: p.fullName, title: p.title, company: p.company })),
          }),
        },
      ],
      response_format: { type: "json_object" as const },
    },
    schema: opportunityDetectionSchema,
    fallback: { opportunities: [] },
    userId,
  });

  let created = 0;
  for (const opp of (opportunities as any).opportunities ?? []) {
    const personIndex = opp.personIndex;
    const person = typeof personIndex === "number" ? peopleData.items[personIndex] : undefined;
    await repo.createOpportunity(userId, {
      title: opp.title,
      opportunityType: opp.opportunityType ?? "general",
      signalSummary: opp.signalSummary ?? "",
      personId: person?.id,
      whyItMatters: opp.whyItMatters,
      recommendedAction: opp.recommendedAction,
      score: String(opp.score ?? "0.5"),
    });
    created++;
  }
  return { created };
});

// ─── Voice Transcribe ───────────────────────────────────────────
registerJobHandler("voice_transcribe", async (_jobId, userId, payload) => {
  const { transcribeAudio } = await import("../_core/voiceTranscription");
  const audioUrl = payload.audioUrl as string;
  const language = payload.language as string | undefined;

  const result = await transcribeAudio({ audioUrl, language });
  if ("error" in result) throw new Error((result as any).error ?? "Transcription failed");
  return { transcript: (result as any).text ?? "", language: (result as any).language ?? "en" };
});

// ─── Voice Parse ────────────────────────────────────────────────
registerJobHandler("voice_parse", async (_jobId, userId, payload) => {
  const transcript = payload.transcript as string;

  const { data: parsed } = await callLLM({
    promptModule: "voice_parse",
    params: {
      messages: [
        {
          role: "system",
          content: `Parse this voice transcript into structured data. Return JSON: { people: [{ name, role, company, action }], tasks: [{ title, priority, dueDate }], notes: [{ personName, content }], reminders: [{ title, datetime }] }`,
        },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" as const },
    },
    schema: voiceIntentSchema,
    fallback: { people: [], tasks: [], notes: [], reminders: [] },
    userId,
  });

  return parsed as Record<string, unknown>;
});

// ─── Batch Outreach ─────────────────────────────────────────────
registerJobHandler("batch_outreach", async (_jobId, userId, payload) => {
  const listId = payload.listId as number;
  const tone = (payload.tone as string) ?? "professional";
  const goals = await repo.getUserGoals(userId);
  const listPeople = await repo.getListPeopleForBatch(userId, listId);

  let created = 0;
  for (const { person } of listPeople) {
    const { data: draft } = await callLLM({
      promptModule: "batch_outreach",
      params: {
        messages: [
          {
            role: "system",
            content: `Generate a ${tone} networking message. Return JSON: { subject, body }`,
          },
          {
            role: "user",
            content: JSON.stringify({
              person: { name: person.fullName, title: person.title, company: person.company },
              goals: goals ?? {},
            }),
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { subject: `Connecting with ${person.fullName}`, body: `Hi ${person.fullName}, I'd love to connect.` },
      userId,
      entityType: "person",
      entityId: person.id,
    });

    await repo.createDraft(userId, {
      personId: person.id,
      listId,
      draftType: "outreach",
      tone,
      subject: (draft as any).subject ?? "",
      body: (draft as any).body ?? "",
      status: "pending_review",
    });
    created++;
  }

  return { created };
});
