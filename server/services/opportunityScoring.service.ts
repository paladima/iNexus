/**
 * Opportunity Scoring Engine (v9 Pillar 2)
 *
 * Transforms iNexus from a CRM into a daily decision engine.
 * Each opportunity gets a composite score from:
 *   - goal_fit:               How well does this align with user's stated goals?
 *   - signal_recency:         How fresh is the signal?
 *   - relationship_strength:  How warm is the connection?
 *   - actionability:          Is there a clear next step?
 *
 * The engine ranks all open opportunities and surfaces "Top N Actions Today".
 */
import * as repo from "../repositories";

// ─── Scoring Weights ────────────────────────────────────────────
const WEIGHTS = {
  goalFit: 0.30,
  signalRecency: 0.25,
  relationshipStrength: 0.20,
  actionability: 0.25,
};

// ─── Individual Score Components ────────────────────────────────

/** Goal fit: how well the opportunity type/context matches user goals (0-1) */
function computeGoalFit(
  opp: Record<string, unknown>,
  goals: Record<string, unknown> | null
): number {
  if (!goals) return 0.5; // neutral if no goals set

  const oppType = (opp.opportunityType as string) ?? "";
  const oppTitle = (opp.title as string) ?? "";
  const oppSignal = (opp.signalSummary as string) ?? "";
  const combined = `${oppType} ${oppTitle} ${oppSignal}`.toLowerCase();

  const primaryGoal = ((goals as any).primaryGoal as string) ?? "";
  const industries = ((goals as any).industries as string[]) ?? [];
  const geographies = ((goals as any).geographies as string[]) ?? [];

  let score = 0.3; // baseline

  // Check goal keyword overlap
  if (primaryGoal) {
    const goalWords = primaryGoal.toLowerCase().split(/\s+/);
    const matches = goalWords.filter((w) => w.length > 3 && combined.includes(w));
    score += Math.min(matches.length * 0.15, 0.4);
  }

  // Check industry overlap
  for (const ind of industries) {
    if (combined.includes(ind.toLowerCase())) {
      score += 0.15;
      break;
    }
  }

  // Check geography overlap
  for (const geo of geographies) {
    if (combined.includes(geo.toLowerCase())) {
      score += 0.1;
      break;
    }
  }

  return Math.min(score, 1.0);
}

/** Signal recency: how fresh is the opportunity? (0-1) */
function computeSignalRecency(opp: Record<string, unknown>): number {
  const detectedAt = opp.detectedAt as Date | string | null;
  if (!detectedAt) return 0.5;

  const detected = new Date(detectedAt).getTime();
  const now = Date.now();
  const hoursAgo = (now - detected) / (1000 * 60 * 60);

  if (hoursAgo < 6) return 1.0;
  if (hoursAgo < 24) return 0.9;
  if (hoursAgo < 72) return 0.7;
  if (hoursAgo < 168) return 0.5; // 1 week
  if (hoursAgo < 720) return 0.3; // 1 month
  return 0.1;
}

/** Relationship strength: based on interactions and contact recency (0-1) */
function computeRelationshipStrength(
  personData: {
    lastInteractionAt?: Date | string | null;
    interactionCount?: number;
    status?: string | null;
  } | null
): number {
  if (!personData) return 0.2;

  let score = 0.2; // baseline for having a person record

  // Interaction count
  const count = personData.interactionCount ?? 0;
  if (count >= 10) score += 0.3;
  else if (count >= 5) score += 0.25;
  else if (count >= 2) score += 0.15;
  else if (count >= 1) score += 0.1;

  // Last contact recency
  if (personData.lastInteractionAt) {
    const lastContact = new Date(personData.lastInteractionAt).getTime();
    const daysAgo = (Date.now() - lastContact) / (1000 * 60 * 60 * 24);
    if (daysAgo < 7) score += 0.3;
    else if (daysAgo < 30) score += 0.2;
    else if (daysAgo < 90) score += 0.1;
  }

  // Status bonus
  if (personData.status === "contacted") score += 0.1;

  return Math.min(score, 1.0);
}

/** Actionability: does the opportunity have a clear next step? (0-1) */
function computeActionability(opp: Record<string, unknown>): number {
  let score = 0.3; // baseline

  if (opp.recommendedAction) score += 0.3;
  if (opp.whyItMatters) score += 0.2;
  if (opp.personId) score += 0.1; // linked to a specific person
  if (opp.score && Number(opp.score) > 0) score += 0.1; // has AI score

  return Math.min(score, 1.0);
}

// ─── Main Scoring Function ──────────────────────────────────────

export interface ScoredOpportunity {
  id: number;
  title: string;
  opportunityType: string;
  signalSummary: string;
  whyItMatters: string | null;
  recommendedAction: string | null;
  personId: number | null;
  personName: string | null;
  personTitle: string | null;
  personCompany: string | null;
  status: string | null;
  detectedAt: Date | string;
  /** Composite score 0-100 */
  compositeScore: number;
  /** Individual score breakdown */
  scoring: {
    goalFit: number;
    signalRecency: number;
    relationshipStrength: number;
    actionability: number;
  };
  /** Human-readable reason */
  scoreReason: string;
  /** Suggested next step */
  suggestedAction: string;
}

/** Score a single opportunity */
export function scoreOpportunity(
  opp: Record<string, unknown>,
  goals: Record<string, unknown> | null,
  personData: { lastInteractionAt?: Date | string | null; interactionCount?: number; status?: string | null } | null
): { compositeScore: number; scoring: ScoredOpportunity["scoring"]; scoreReason: string; suggestedAction: string } {
  const goalFit = computeGoalFit(opp, goals);
  const signalRecency = computeSignalRecency(opp);
  const relationshipStrength = computeRelationshipStrength(personData);
  const actionability = computeActionability(opp);

  const compositeScore = Math.round(
    (goalFit * WEIGHTS.goalFit +
      signalRecency * WEIGHTS.signalRecency +
      relationshipStrength * WEIGHTS.relationshipStrength +
      actionability * WEIGHTS.actionability) * 100
  );

  // Generate human-readable reason
  const topFactor = [
    { name: "goal alignment", value: goalFit },
    { name: "fresh signal", value: signalRecency },
    { name: "warm relationship", value: relationshipStrength },
    { name: "clear next step", value: actionability },
  ].sort((a, b) => b.value - a.value)[0];

  const scoreReason = `Score ${compositeScore}/100 — strongest factor: ${topFactor.name} (${Math.round(topFactor.value * 100)}%)`;

  // Generate suggested action
  let suggestedAction = (opp.recommendedAction as string) ?? "Review and decide on next step";
  if (!opp.recommendedAction) {
    if (relationshipStrength > 0.6) {
      suggestedAction = "Reach out — you have a warm connection";
    } else if (goalFit > 0.7) {
      suggestedAction = "High goal fit — prioritize this opportunity";
    } else if (signalRecency > 0.8) {
      suggestedAction = "Act quickly — this signal is very fresh";
    }
  }

  return {
    compositeScore,
    scoring: { goalFit, signalRecency, relationshipStrength, actionability },
    scoreReason,
    suggestedAction,
  };
}

/** Rank all open opportunities for a user — returns top N scored opportunities */
export async function rankOpportunitiesForUser(
  userId: number,
  limit: number = 20
): Promise<ScoredOpportunity[]> {
  const goals = await repo.getUserGoals(userId);
  const { items: opps } = await repo.getOpportunities(userId, { status: "open", limit: 100 });

  // Batch-load people data for scoring
  const personIds = Array.from(new Set(opps.filter((o: any) => o.personId).map((o: any) => o.personId as number)));
  const { items: allPeople } = await repo.getPeople(userId, { limit: 1000 });
  const peopleMap = new Map(allPeople.map((p: any) => [p.id, p]));

  // Batch-load interaction counts
  const interactions = await repo.getInteractions(userId, undefined, 1000);
  const interactionCounts = new Map<number, number>();
  for (const int of interactions) {
    const pid = (int as any).personId;
    interactionCounts.set(pid, (interactionCounts.get(pid) ?? 0) + 1);
  }

  const scored: ScoredOpportunity[] = opps.map((opp: any) => {
    const person = opp.personId ? peopleMap.get(opp.personId) : null;
    const personData = person ? {
      lastInteractionAt: person.lastInteractionAt,
      interactionCount: interactionCounts.get(person.id) ?? 0,
      status: person.status,
    } : null;

    const { compositeScore, scoring, scoreReason, suggestedAction } = scoreOpportunity(
      opp as Record<string, unknown>,
      goals as Record<string, unknown> | null,
      personData
    );

    return {
      id: opp.id,
      title: opp.title,
      opportunityType: opp.opportunityType,
      signalSummary: opp.signalSummary,
      whyItMatters: opp.whyItMatters,
      recommendedAction: opp.recommendedAction,
      personId: opp.personId,
      personName: person?.fullName ?? null,
      personTitle: person?.title ?? null,
      personCompany: person?.company ?? null,
      status: opp.status,
      detectedAt: opp.detectedAt,
      compositeScore,
      scoring,
      scoreReason,
      suggestedAction,
    };
  });

  // Sort by composite score descending
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  return scored.slice(0, limit);
}

// ─── Opportunity Radar (v14) ────────────────────────────────────

export interface OpportunityRadarCategory {
  type: string;
  label: string;
  count: number;
  avgScore: number;
  topItems: Array<{ id: number; title: string; personName: string | null; compositeScore: number }>;
}

export interface OpportunityRadar {
  totalOpen: number;
  categories: OpportunityRadarCategory[];
  /** Reconnect signals: people not contacted in 30+ days */
  reconnectCount: number;
  /** Intro opportunities: people with warm paths but no direct relationship */
  introCount: number;
  /** Collaboration potential: same-company or shared-tag opportunities */
  collaborationCount: number;
}

/** Get categorized opportunity radar for dashboard widget */
export async function getOpportunityRadar(userId: number): Promise<OpportunityRadar> {
  const scored = await rankOpportunitiesForUser(userId, 100);

  // Group by opportunityType
  const typeGroups = new Map<string, ScoredOpportunity[]>();
  for (const opp of scored) {
    const type = opp.opportunityType || "other";
    if (!typeGroups.has(type)) typeGroups.set(type, []);
    typeGroups.get(type)!.push(opp);
  }

  const TYPE_LABELS: Record<string, string> = {
    reconnect: "Reconnect",
    intro: "Introduction",
    collaboration: "Collaboration",
    job_change: "Job Change",
    funding: "Funding",
    event: "Event",
    content: "Content",
    referral: "Referral",
    other: "Other",
  };

  const categories: OpportunityRadarCategory[] = [];
  for (const [type, opps] of Array.from(typeGroups)) {
    const avgScore = Math.round(opps.reduce((sum, o) => sum + o.compositeScore, 0) / opps.length);
    categories.push({
      type,
      label: TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1),
      count: opps.length,
      avgScore,
      topItems: opps.slice(0, 3).map(o => ({
        id: o.id,
        title: o.title,
        personName: o.personName,
        compositeScore: o.compositeScore,
      })),
    });
  }

  categories.sort((a, b) => b.avgScore - a.avgScore);

  // Count reconnect signals
  const { items: allPeople } = await repo.getPeople(userId, { limit: 200 });
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let reconnectCount = 0;
  for (const p of allPeople as any[]) {
    if (p.lastInteractionAt && new Date(p.lastInteractionAt).getTime() < thirtyDaysAgo && p.status !== "archived") {
      reconnectCount++;
    }
  }

  // Count intro and collaboration from opportunity types
  const introCount = typeGroups.get("intro")?.length ?? 0;
  const collaborationCount = typeGroups.get("collaboration")?.length ?? 0;

  return {
    totalOpen: scored.length,
    categories,
    reconnectCount,
    introCount,
    collaborationCount,
  };
}

/** Get top N actions for today — the "morning briefing" */
export async function getTopActions(
  userId: number,
  count: number = 3
): Promise<Array<{
  rank: number;
  type: "opportunity" | "reconnect" | "task";
  title: string;
  whyItMatters: string;
  suggestedAction: string;
  score: number;
  entityId: number;
  entityType: string;
  personName: string | null;
}>> {
  const actions: Array<{
    rank: number;
    type: "opportunity" | "reconnect" | "task";
    title: string;
    whyItMatters: string;
    suggestedAction: string;
    score: number;
    entityId: number;
    entityType: string;
    personName: string | null;
  }> = [];

  // 1. Top scored opportunities
  const topOpps = await rankOpportunitiesForUser(userId, count);
  for (const opp of topOpps) {
    actions.push({
      rank: 0,
      type: "opportunity",
      title: opp.title,
      whyItMatters: opp.whyItMatters ?? opp.scoreReason,
      suggestedAction: opp.suggestedAction,
      score: opp.compositeScore,
      entityId: opp.id,
      entityType: "opportunity",
      personName: opp.personName,
    });
  }

  // 2. Overdue tasks
  const { items: tasks } = await repo.getTasks(userId, { status: "open", limit: 10 });
  const now = Date.now();
  for (const task of (tasks as any[])) {
    if (task.dueAt && new Date(task.dueAt).getTime() < now) {
      actions.push({
        rank: 0,
        type: "task",
        title: task.title,
        whyItMatters: "This task is overdue",
        suggestedAction: "Complete or reschedule this task",
        score: 85, // overdue tasks get high priority
        entityId: task.id,
        entityType: "task",
        personName: null,
      });
    }
  }

  // 3. Reconnect signals (people not contacted in 30+ days)
  const { items: allPeople } = await repo.getPeople(userId, { limit: 100 });
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const person of allPeople as any[]) {
    if (
      person.lastInteractionAt &&
      new Date(person.lastInteractionAt).getTime() < thirtyDaysAgo.getTime() &&
      person.status !== "archived"
    ) {
      const daysSince = Math.round((now - new Date(person.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24));
      actions.push({
        rank: 0,
        type: "reconnect",
        title: `Reconnect with ${person.fullName}`,
        whyItMatters: `Last contact was ${daysSince} days ago`,
        suggestedAction: `Send a quick check-in to ${person.fullName}`,
        score: Math.min(50 + daysSince, 80), // older = higher priority, cap at 80
        entityId: person.id,
        entityType: "person",
        personName: person.fullName,
      });
    }
  }

  // Sort by score, take top N
  actions.sort((a, b) => b.score - a.score);
  return actions.slice(0, count).map((a, i) => ({ ...a, rank: i + 1 }));
}
