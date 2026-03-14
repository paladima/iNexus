/**
 * Unified Action Layer (v9 Pillar 1)
 *
 * Any entity in the system (discovery result, person, opportunity, voice parse,
 * list item, command bar result) can trigger the same set of actions:
 *   - Save person
 *   - Add to list
 *   - Generate draft
 *   - Create task
 *   - Mark contacted
 *   - Ask for intro (→ Warm Path Engine)
 *   - Archive / ignore
 *
 * Entity adapters normalize different source shapes into a common ActionContext.
 */
import * as repo from "../repositories";
import { enqueueJob } from "./job.service";
import { getProviderWithFallback } from "../providers/registry";
import type { DraftProvider } from "../providers/types";

// ─── Action Context (common shape for all entities) ─────────────
export interface ActionContext {
  /** Source entity type */
  sourceType: "discovery" | "person" | "opportunity" | "voice" | "list_item" | "command";
  /** Person data (may be partial for discovery results) */
  person: {
    id?: number;
    fullName: string;
    title?: string;
    company?: string;
    location?: string;
    linkedinUrl?: string;
    websiteUrl?: string;
    email?: string;
  };
  /** Optional opportunity context */
  opportunity?: {
    id: number;
    title: string;
    signalSummary: string;
    whyItMatters?: string;
    recommendedAction?: string;
  };
  /** Extra context string for draft generation */
  contextHint?: string;
}

// ─── Entity Adapters ────────────────────────────────────────────

/** Adapt a discovery search result into ActionContext */
export function fromDiscoveryResult(result: Record<string, unknown>): ActionContext {
  return {
    sourceType: "discovery",
    person: {
      fullName: (result.fullName as string) ?? (result.name as string) ?? "Unknown",
      title: result.title as string | undefined,
      company: result.company as string | undefined,
      location: result.location as string | undefined,
      linkedinUrl: result.linkedinUrl as string | undefined,
      websiteUrl: result.websiteUrl as string | undefined,
    },
    contextHint: result.matchReasons
      ? `Match reasons: ${(result.matchReasons as string[]).join(", ")}`
      : undefined,
  };
}

/** Adapt a saved person into ActionContext */
export function fromPerson(person: {
  id: number; fullName: string; title?: string | null;
  company?: string | null; location?: string | null;
  linkedinUrl?: string | null; websiteUrl?: string | null;
  email?: string | null;
}): ActionContext {
  return {
    sourceType: "person",
    person: {
      id: person.id,
      fullName: person.fullName,
      title: person.title ?? undefined,
      company: person.company ?? undefined,
      location: person.location ?? undefined,
      linkedinUrl: person.linkedinUrl ?? undefined,
      websiteUrl: person.websiteUrl ?? undefined,
      email: person.email ?? undefined,
    },
  };
}

/** Adapt an opportunity into ActionContext */
export function fromOpportunity(opp: {
  id: number; title: string; signalSummary: string;
  whyItMatters?: string | null; recommendedAction?: string | null;
  personId?: number | null;
}, person?: { id: number; fullName: string; title?: string | null; company?: string | null } | null): ActionContext {
  return {
    sourceType: "opportunity",
    person: person ? {
      id: person.id,
      fullName: person.fullName,
      title: person.title ?? undefined,
      company: person.company ?? undefined,
    } : {
      fullName: "Unknown",
    },
    opportunity: {
      id: opp.id,
      title: opp.title,
      signalSummary: opp.signalSummary,
      whyItMatters: opp.whyItMatters ?? undefined,
      recommendedAction: opp.recommendedAction ?? undefined,
    },
    contextHint: `Opportunity: ${opp.title}. ${opp.signalSummary}`,
  };
}

/** Adapt a voice-parsed person into ActionContext */
export function fromVoiceParse(parsed: {
  name: string; role?: string; company?: string; action?: string;
}): ActionContext {
  return {
    sourceType: "voice",
    person: {
      fullName: parsed.name,
      title: parsed.role,
      company: parsed.company,
    },
    contextHint: parsed.action ? `Voice note action: ${parsed.action}` : undefined,
  };
}

// ─── Unified Actions ────────────────────────────────────────────

/** Save person from any entity context */
export async function savePersonFromEntity(userId: number, ctx: ActionContext) {
  if (ctx.person.id) {
    return { id: ctx.person.id, duplicate: true, alreadySaved: true };
  }

  const names = ctx.person.fullName.split(" ");
  const id = await repo.createPerson(userId, {
    fullName: ctx.person.fullName,
    firstName: names[0],
    lastName: names.slice(1).join(" "),
    title: ctx.person.title,
    company: ctx.person.company,
    location: ctx.person.location,
    linkedinUrl: ctx.person.linkedinUrl,
    websiteUrl: ctx.person.websiteUrl,
    email: ctx.person.email,
    sourceType: ctx.sourceType,
    status: "saved",
  });

  await repo.logActivity(userId, {
    activityType: "person_saved_via_action",
    title: `Saved ${ctx.person.fullName} (from ${ctx.sourceType})`,
    entityType: "person",
    entityId: id ?? undefined,
  });

  return { id, duplicate: false, alreadySaved: false };
}

/** Create task from any entity context */
export async function createTaskFromEntity(
  userId: number,
  ctx: ActionContext,
  opts?: { title?: string; priority?: string; dueAt?: Date }
) {
  const title = opts?.title
    ?? (ctx.opportunity?.recommendedAction
      ? ctx.opportunity.recommendedAction
      : `Follow up with ${ctx.person.fullName}`);

  const taskId = await repo.createTask(userId, {
    title,
    description: ctx.contextHint ?? ctx.opportunity?.signalSummary,
    personId: ctx.person.id,
    opportunityId: ctx.opportunity?.id,
    priority: opts?.priority ?? "medium",
    dueAt: opts?.dueAt,
    source: ctx.sourceType,
  });

  await repo.logActivity(userId, {
    activityType: "task_from_entity",
    title: `Created task: ${title}`,
    entityType: "task",
    entityId: taskId ?? undefined,
    metadataJson: { sourceType: ctx.sourceType, personName: ctx.person.fullName },
  });

  return { id: taskId, title };
}

/** Generate draft from any entity context */
export async function generateDraftFromEntity(
  userId: number,
  ctx: ActionContext,
  opts?: { tone?: string; channel?: string }
) {
  const tone = opts?.tone ?? "professional";
  const channel = opts?.channel ?? "email";
  const goals = await repo.getUserGoals(userId);

  const provider = getProviderWithFallback("draft") as DraftProvider | undefined;
  if (!provider) throw new Error("DraftProvider not registered");

  const result = await provider.generateDraft({
    personName: ctx.person.fullName,
    personTitle: ctx.person.title,
    personCompany: ctx.person.company,
    context: ctx.contextHint ?? ctx.opportunity?.signalSummary ?? "General networking",
    userGoals: goals ?? undefined,
    tone,
    draftType: channel,
  });

  const draftId = await repo.createDraft(userId, {
    personId: ctx.person.id,
    draftType: channel,
    subject: result.subject,
    body: result.body,
    tone: result.tone ?? tone,
    metadataJson: {
      sourceType: ctx.sourceType,
      opportunityId: ctx.opportunity?.id,
      generatedBy: "action_layer",
    },
  });

  await repo.logActivity(userId, {
    activityType: "draft_from_entity",
    title: `Generated draft for ${ctx.person.fullName} (from ${ctx.sourceType})`,
    entityType: "draft",
    entityId: draftId ?? undefined,
  });

  return { id: draftId, ...result };
}

/** Mark person as contacted */
export async function markContacted(userId: number, personId: number, channel?: string) {
  const person = await repo.getPersonById(userId, personId);
  if (!person) throw new Error("Person not found");

  // Log interaction
  await repo.addInteraction(userId, {
    personId,
    interactionType: "outreach",
    channel: channel ?? "manual",
    content: "Marked as contacted",
    occurredAt: new Date(),
  });

  // Update last interaction timestamp
  await repo.updatePerson(userId, personId, {
    lastInteractionAt: new Date(),
    status: "contacted",
  });

  await repo.logActivity(userId, {
    activityType: "mark_contacted",
    title: `Marked ${person.fullName} as contacted`,
    entityType: "person",
    entityId: personId,
  });

  return { success: true };
}

/** Create intro request (bridges to Warm Path Engine) */
export async function createIntroRequest(
  userId: number,
  targetPersonId: number,
  connectorPersonId: number,
  reason?: string
) {
  const [target, connector] = await Promise.all([
    repo.getPersonById(userId, targetPersonId),
    repo.getPersonById(userId, connectorPersonId),
  ]);
  if (!target || !connector) throw new Error("One or both people not found");

  const provider = getProviderWithFallback("draft") as DraftProvider | undefined;
  if (!provider) throw new Error("DraftProvider not registered");

  const result = await provider.generateIntroDraft(
    connector.fullName,
    target.fullName,
    reason ?? "I'd love an introduction — we share common interests."
  );

  const draftId = await repo.createDraft(userId, {
    draftType: "intro_request",
    subject: result.subject,
    body: result.body,
    personId: connectorPersonId,
    metadataJson: {
      targetPersonId,
      connectorPersonId,
      targetName: target.fullName,
      connectorName: connector.fullName,
    },
  });

  await repo.logActivity(userId, {
    activityType: "intro_request_created",
    title: `Intro request: ${connector.fullName} → ${target.fullName}`,
    entityType: "draft",
    entityId: draftId ?? undefined,
  });

  return { id: draftId, ...result };
}

/** Mark opportunity as acted upon / archive */
export async function markOpportunityActed(
  userId: number,
  opportunityId: number,
  action: "acted" | "archived" | "ignored" = "acted"
) {
  const opp = await repo.getOpportunityById(userId, opportunityId);
  if (!opp) throw new Error("Opportunity not found");

  const status = action === "acted" ? "acted" : action === "archived" ? "archived" : "ignored";
  await repo.updateOpportunity(userId, opportunityId, { status });

  await repo.logActivity(userId, {
    activityType: `opportunity_${action}`,
    title: `${action === "acted" ? "Acted on" : action === "archived" ? "Archived" : "Ignored"}: ${opp.title}`,
    entityType: "opportunity",
    entityId: opportunityId,
  });

  return { success: true };
}

/** Get available actions for an entity context */
export function getAvailableActions(ctx: ActionContext): string[] {
  const actions: string[] = [];

  if (!ctx.person.id) {
    actions.push("save_person");
  }
  actions.push("add_to_list");
  actions.push("generate_draft");
  actions.push("create_task");

  if (ctx.person.id) {
    actions.push("mark_contacted");
    actions.push("ask_for_intro");
  }

  if (ctx.opportunity) {
    actions.push("mark_opportunity_acted");
    actions.push("archive_opportunity");
  }

  return actions;
}
