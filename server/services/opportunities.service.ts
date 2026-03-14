/**
 * Opportunities Service (#10, #16, #17)
 * Provider-first: uses OpportunityProvider and DraftProvider via getProviderWithFallback.
 * No direct invokeLLM calls — all AI goes through providers.
 */
import * as repo from "../repositories";
import { getProviderWithFallback } from "../providers/registry";
import type { DraftProvider, OpportunityProvider } from "../providers/types";

// ─── Opportunity Deduplication (#17) ─────────────────────────
export function computeOpportunityFingerprint(
  type: string,
  personId: number | null | undefined,
  signal: string
): string {
  const normalizedSignal = signal.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
  return `${type}:${personId ?? "none"}:${normalizedSignal}`;
}

export async function createOpportunityIfUnique(
  userId: number,
  data: {
    title: string;
    opportunityType: string;
    signalSummary: string;
    personId?: number;
    whyItMatters?: string;
    recommendedAction?: string;
    score?: string;
  }
) {
  // Check for duplicates
  const existingResult = await repo.getOpportunities(userId, {
    personId: data.personId,
    status: "open",
    limit: 50,
  });
  const existing = (existingResult as any).items ?? existingResult;

  const fingerprint = computeOpportunityFingerprint(
    data.opportunityType,
    data.personId,
    data.signalSummary
  );

  const isDuplicate = (existing as any[]).some((opp: any) => {
    const existingFp = computeOpportunityFingerprint(
      opp.opportunityType,
      opp.personId,
      opp.signalSummary ?? ""
    );
    return existingFp === fingerprint;
  });

  if (isDuplicate) {
    return { id: null, duplicate: true };
  }

  const id = await repo.createOpportunity(userId, data);
  await repo.logActivity(userId, {
    activityType: "opportunity_created",
    title: `New opportunity: ${data.title}`,
    entityType: "opportunity",
    entityId: id ?? undefined,
  });
  return { id, duplicate: false };
}

// ─── Generate Draft from Opportunity (provider-first) ───────
export async function generateDraftFromOpportunity(
  userId: number,
  opportunityId: number,
  tone: string = "professional"
) {
  const opp = await repo.getOpportunityById(userId, opportunityId);
  if (!opp) throw new Error("Opportunity not found");

  let person = null;
  if (opp.personId) person = await repo.getPersonById(userId, opp.personId);
  const goals = await repo.getUserGoals(userId);

  const draftProvider = getProviderWithFallback("draft") as DraftProvider | undefined;
  if (!draftProvider) throw new Error("DraftProvider not registered");

  const result = await draftProvider.generateDraft({
    personName: person?.fullName ?? "Unknown",
    personTitle: person?.title ?? undefined,
    personCompany: person?.company ?? undefined,
    context: `Opportunity: ${opp.title}. Signal: ${opp.signalSummary}`,
    userGoals: goals ?? undefined,
    tone,
    draftType: "opportunity_outreach",
  });

  const draftId = await repo.createDraft(userId, {
    personId: opp.personId ?? undefined,
    draftType: "opportunity_outreach",
    tone,
    subject: result.subject,
    body: result.body,
    metadataJson: { opportunityId },
  });

  await repo.logActivity(userId, {
    activityType: "draft_from_opportunity",
    title: `Generated draft from opportunity: ${opp.title}`,
    entityType: "draft",
    entityId: draftId ?? undefined,
  });

  return { id: draftId, ...result };
}

// ─── Create Task from Opportunity ────────────────────────────
export async function createTaskFromOpportunity(
  userId: number,
  opportunityId: number,
  title?: string,
  dueAt?: string,
  priority: string = "medium"
) {
  const opp = await repo.getOpportunityById(userId, opportunityId);
  if (!opp) throw new Error("Opportunity not found");

  const taskId = await repo.createTask(userId, {
    title: title ?? opp.recommendedAction ?? `Follow up on: ${opp.title}`,
    description: opp.signalSummary,
    personId: opp.personId ?? undefined,
    opportunityId,
    dueAt: dueAt ? new Date(dueAt) : undefined,
    priority,
    source: "opportunity",
  });

  await repo.logActivity(userId, {
    activityType: "task_from_opportunity",
    title: `Created task from opportunity: ${opp.title}`,
    entityType: "task",
    entityId: taskId ?? undefined,
  });

  return { id: taskId };
}

// ─── Generate Intro from Opportunity (provider-first) ───────
export async function generateIntroFromOpportunity(
  userId: number,
  opportunityId: number,
  _tone: string = "warm"
) {
  const opp = await repo.getOpportunityById(userId, opportunityId);
  if (!opp) throw new Error("Opportunity not found");

  const meta = opp.metadataJson as Record<string, unknown> | null;
  const personAId = meta?.personAId as number | undefined;
  const personBId = meta?.personBId as number | undefined;
  let personA = null,
    personB = null;
  if (personAId) personA = await repo.getPersonById(userId, personAId);
  if (personBId) personB = await repo.getPersonById(userId, personBId);

  const draftProvider = getProviderWithFallback("draft") as DraftProvider | undefined;
  if (!draftProvider) throw new Error("DraftProvider not registered");

  const result = await draftProvider.generateIntroDraft(
    personA?.fullName ?? "Person A",
    personB?.fullName ?? "Person B",
    opp.signalSummary ?? "Mutual interest"
  );

  const draftId = await repo.createDraft(userId, {
    draftType: "intro_message",
    tone: _tone,
    subject: result.subject,
    body: result.body,
    metadataJson: { opportunityId, personAId, personBId },
  });

  await repo.logActivity(userId, {
    activityType: "intro_draft_generated",
    title: `Generated intro between ${personA?.fullName ?? "?"} and ${personB?.fullName ?? "?"}`,
    entityType: "draft",
    entityId: draftId ?? undefined,
  });

  return { id: draftId, ...result };
}

// ─── Enhanced Opportunity Detection (#16) ────────────────────
export async function detectOpportunitiesForUser(userId: number) {
  const provider = getProviderWithFallback("opportunity") as OpportunityProvider | undefined;
  if (!provider) return [];

  const { items: people } = await repo.getPeople(userId, { limit: 50 });
  const goals = await repo.getUserGoals(userId);

  const signals = await provider.detectOpportunities(
    people.map((p: any) => ({
      id: p.id,
      fullName: p.fullName,
      title: p.title,
      company: p.company,
      location: p.location,
      lastContactAt: p.lastContactAt,
    })),
    goals ?? undefined
  );

  const created: number[] = [];
  for (const signal of signals) {
    const personId = signal.personId ?? (people[0] as any)?.id;
    const result = await createOpportunityIfUnique(userId, {
      title: signal.title,
      opportunityType: signal.opportunityType,
      signalSummary: signal.signalSummary,
      personId,
      whyItMatters: signal.whyItMatters,
      recommendedAction: signal.recommendedAction,
      score: signal.score?.toString(),
    });
    if (result.id && !result.duplicate) created.push(result.id);
  }

  return created;
}
