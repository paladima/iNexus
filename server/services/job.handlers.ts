/**
 * Job Handlers — register all background job types with the job service.
 * Uses service layer and providers for all business logic.
 * Import once at server startup.
 */
import { registerJobHandler } from "./job.service";
import * as repo from "../repositories";
import * as oppService from "./opportunities.service";
import * as voiceService from "./voice.service";
import { getProviderWithFallback } from "../providers/registry";
import type {
  DailyBriefProvider,
  OpportunityProvider,
  VoiceParserProvider,
} from "../providers/types";
import { callLLM } from "./llm.service";
import { personSummarySchema } from "../llmHelpers";

/**
 * Call this once at server startup to register all handlers.
 */
export function registerAllHandlers() {
  console.log("[Jobs] All job handlers registered");
}

// ─── Generate Daily Brief (#11) ────────────────────────────────
registerJobHandler("generate_brief", async (_jobId, userId, _payload) => {
  const briefProvider = getProviderWithFallback("dailyBrief") as DailyBriefProvider | undefined;

  const goals = await repo.getUserGoals(userId);
  const opps = await repo.getOpportunities(userId, { status: "open", limit: 10 });
  const taskData = await repo.getTasks(userId, { status: "open", limit: 10 });
  const stale = await repo.getPeopleNeedingReconnect(userId, 90);
  const drafts = await repo.getDrafts(userId, { status: "pending_review", limit: 100 });

  const context = {
    goals: goals ?? {},
    opportunities: opps.items.slice(0, 5).map((o: any) => ({ title: o.title, type: o.opportunityType })),
    tasks: taskData.items.slice(0, 5).map((t: any) => ({ title: t.title, priority: t.priority })),
    pendingDrafts: Array.isArray(drafts) ? drafts.length : 0,
    staleContacts: stale.slice(0, 5).map((p) => ({ name: p.fullName, lastInteraction: p.lastInteractionAt })),
  };

  let brief: Record<string, unknown>;

  if (briefProvider) {
    brief = await briefProvider.generateBrief(context) as unknown as Record<string, unknown>;
  } else {
    // Fallback
    brief = {
      greeting: "Good morning!",
      summary: "Here's your daily brief.",
      items: [],
    };
  }

  const today = new Date().toISOString().split("T")[0];
  await repo.saveDailyBrief(userId, today, brief);
  return brief;
});

// ─── Generate Person Summary ────────────────────────────────────
registerJobHandler("generate_summary", async (_jobId, userId, payload) => {
  const personId = payload.personId as number;
  const person = await repo.getPersonById(userId, personId);
  if (!person) throw new Error("Person not found");

  const { data: summary } = await callLLM<Record<string, unknown>>({
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
    fallback: {
      summary: `${person.fullName} — ${person.title ?? "Professional"} at ${person.company ?? "Unknown"}`,
      keyTopics: [],
      relevanceScore: 0,
    },
    userId,
    entityType: "person",
    entityId: personId,
  });

  await repo.updatePerson(userId, personId, {
    aiSummary: (summary as any).summary,
  });
  return summary as Record<string, unknown>;
});

// ─── Scan Opportunities ─────────────────────────────────────────
registerJobHandler("scan_opportunities", async (_jobId, userId, _payload) => {
  const oppProvider = getProviderWithFallback("opportunity") as OpportunityProvider | undefined;
  const goals = await repo.getUserGoals(userId);
  const peopleData = await repo.getPeople(userId, { limit: 50 });

  const people = peopleData.items.map((p, i) => ({
    index: i,
    id: p.id,
    name: p.fullName,
    title: p.title,
    company: p.company,
  }));

  let opportunities: Array<Record<string, unknown>> = [];

  if (oppProvider) {
    const detected = await oppProvider.detectOpportunities(
      people as Array<Record<string, unknown>>,
      goals ?? undefined
    );
    opportunities = detected.map((o, i) => ({
      ...o,
      personIndex: i,
    }));
  }

  let created = 0;
  let duplicates = 0;
  for (const opp of opportunities) {
    const personIndex = opp.personIndex as number | undefined;
    const person =
      typeof personIndex === "number" ? peopleData.items[personIndex] : undefined;

    const result = await oppService.createOpportunityIfUnique(userId, {
      title: String(opp.title ?? ""),
      opportunityType: String(opp.opportunityType ?? "general"),
      signalSummary: String(opp.signalSummary ?? ""),
      personId: person?.id,
      whyItMatters: opp.whyItMatters as string | undefined,
      recommendedAction: opp.recommendedAction as string | undefined,
      score: String(opp.score ?? "0.5"),
    });

    if (result.duplicate) {
      duplicates++;
    } else {
      created++;
    }
  }
  return { created, duplicates };
});

// ─── Voice Transcribe ───────────────────────────────────────────
registerJobHandler("voice_transcribe", async (_jobId, _userId, payload) => {
  const audioUrl = payload.audioUrl as string;
  const language = payload.language as string | undefined;
  const result = await voiceService.transcribeAudioFile(audioUrl, language);
  return {
    transcript: (result as any).text ?? "",
    language: (result as any).language ?? "en",
  };
});

// ─── Voice Parse ────────────────────────────────────────────────
registerJobHandler("voice_parse", async (_jobId, userId, payload) => {
  const transcript = payload.transcript as string;
  const voiceProvider = getProviderWithFallback("voiceParser") as VoiceParserProvider | undefined;

  if (voiceProvider) {
    const parsed = await voiceProvider.parseTranscript(transcript);
    return parsed as unknown as Record<string, unknown>;
  }

  return { people: [], tasks: [], notes: [], reminders: [] };
});

// ─── Batch Outreach ─────────────────────────────────────────────
registerJobHandler("batch_outreach", async (_jobId, userId, payload) => {
  const listId = payload.listId as number | undefined;
  const personIds = payload.personIds as number[] | undefined;
  const tone = (payload.tone as string) ?? "professional";
  const context = payload.context as string | undefined;
  const goals = await repo.getUserGoals(userId);

  let people: Array<{ id: number; fullName: string; title: string | null; company: string | null }> = [];

  if (listId) {
    const listPeople = await repo.getListPeopleForBatch(userId, listId);
    people = listPeople.map((lp) => lp.person);
  } else if (personIds) {
    for (const pid of personIds) {
      const p = await repo.getPersonById(userId, pid);
      if (p) people.push(p);
    }
  }

  let created = 0;
  for (const person of people) {
    const { data: draft } = await callLLM<Record<string, unknown>>({
      promptModule: "batch_outreach",
      params: {
        messages: [
          {
            role: "system",
            content: `Generate a ${tone} networking message. ${context ? `Context: ${context}` : ""}. Return JSON: { subject, body }`,
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
      fallback: {
        subject: `Connecting with ${person.fullName}`,
        body: `Hi ${person.fullName}, I'd love to connect.`,
      },
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
