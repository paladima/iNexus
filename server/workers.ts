/**
 * Background workers for iNexus (v6).
 * #9: Uses service layer — no direct db/LLM calls.
 * Workers delegate to services/providers for all business logic.
 */
import * as repo from "./repositories";
import * as opportunitiesService from "./services/opportunities.service";
import * as dashboardService from "./services/dashboard.service";
import { startJobProcessor, stopJobProcessor } from "./services/job.service";

// ─── Retry helper ──────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 2): Promise<T | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`[${label}] Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries) {
        console.error(`[${label}] All ${maxRetries + 1} attempts failed.`);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  return null;
}

// ─── Opportunity Scan Worker ────────────────────────────────────
async function scanOpportunitiesForUser(userId: number) {
  const result = await opportunitiesService.detectOpportunitiesForUser(userId);
  if (result && (result as any).created > 0) {
    console.log(`[OpportunityScan] User ${userId}: created ${(result as any).created} opportunities`);
  }
}

// ─── Reconnect Detection Worker ─────────────────────────────────
async function detectReconnectsForUser(userId: number) {
  const staleContacts = await repo.getPeopleNeedingReconnect(userId, 90);
  if (staleContacts.length === 0) return;

  // Load existing reconnect opportunities to dedup
  const { items: existingOpps } = await repo.getOpportunities(userId, { status: "open", limit: 200 });
  const reconnectPersonIds = new Set(
    existingOpps.filter(o => o.opportunityType === "reconnect").map(o => o.personId)
  );

  let created = 0;
  for (const person of staleContacts) {
    if (reconnectPersonIds.has(person.id)) continue;

    await repo.createOpportunity(userId, {
      title: `Reconnect with ${person.fullName}`,
      opportunityType: "reconnect",
      signalSummary: `No interaction in over 90 days${person.lastInteractionAt ? ` (last: ${new Date(person.lastInteractionAt).toLocaleDateString()})` : " (never interacted)"}`,
      personId: person.id,
      whyItMatters: `Maintaining relationships requires regular touchpoints. ${person.fullName} may have new updates worth discussing.`,
      recommendedAction: `Send a brief check-in message or schedule a quick catch-up call.`,
      score: "0.65",
      metadataJson: { source: "reconnect_detection", daysSinceLastInteraction: person.lastInteractionAt ? Math.floor((Date.now() - new Date(person.lastInteractionAt).getTime()) / 86400000) : null },
    });
    created++;
  }

  console.log(`[ReconnectDetection] User ${userId}: flagged ${created} contacts for reconnect`);
}

// ─── Daily Brief Worker ─────────────────────────────────────────
async function generateDailyBriefForUser(userId: number) {
  const today = new Date().toISOString().split("T")[0];
  const existing = await repo.getDailyBrief(userId, today);
  if (existing) return;

  await dashboardService.generateBrief(userId);
  console.log(`[DailyBrief] Generated brief for user ${userId}`);
}

// ─── Suggested Intro Detection ──────────────────────────────────
async function detectSuggestedIntrosForUser(userId: number) {
  const { items: allPeople } = await repo.getPeople(userId, { limit: 100 });
  if (allPeople.length < 2) return;

  // Load all open intro opportunities ONCE
  const { items: existingOpps } = await repo.getOpportunities(userId, { status: "open", limit: 200 });
  const existingIntroKeys = new Set(
    existingOpps
      .filter(o => o.opportunityType === "intro" && o.metadataJson)
      .map(o => {
        const m = o.metadataJson as Record<string, unknown>;
        return `${m.personAId}:${m.personBId}`;
      })
  );

  const peopleWithTags = allPeople.filter(p => p.tags && (p.tags as string[]).length > 0);
  const introSuggestions: Array<{ personA: typeof allPeople[0]; personB: typeof allPeople[0]; reason: string }> = [];

  for (let i = 0; i < peopleWithTags.length && introSuggestions.length < 5; i++) {
    for (let j = i + 1; j < peopleWithTags.length && introSuggestions.length < 5; j++) {
      const a = peopleWithTags[i];
      const b = peopleWithTags[j];
      const tagsA = (a.tags as string[]) || [];
      const tagsB = (b.tags as string[]) || [];
      const sharedTags = tagsA.filter(t => tagsB.includes(t));
      const sameLocation = a.location && b.location && a.location === b.location;

      if (sharedTags.length > 0 || sameLocation) {
        const key1 = `${a.id}:${b.id}`;
        const key2 = `${b.id}:${a.id}`;
        if (existingIntroKeys.has(key1) || existingIntroKeys.has(key2)) continue;

        const reason = sharedTags.length > 0
          ? `Shared interests: ${sharedTags.join(", ")}`
          : `Same location: ${a.location}`;
        introSuggestions.push({ personA: a, personB: b, reason });
        existingIntroKeys.add(key1);
      }
    }
  }

  for (const suggestion of introSuggestions) {
    await repo.createOpportunity(userId, {
      title: `Introduce ${suggestion.personA.fullName} and ${suggestion.personB.fullName}`,
      opportunityType: "intro",
      signalSummary: suggestion.reason,
      whyItMatters: `Both contacts could benefit from connecting. ${suggestion.reason}.`,
      recommendedAction: `Draft an introduction message connecting them.`,
      score: "0.60",
      metadataJson: {
        source: "intro_detection",
        personAId: suggestion.personA.id,
        personBId: suggestion.personB.id,
      },
    });

    await repo.createRelationship(userId, {
      personAId: suggestion.personA.id,
      personBId: suggestion.personB.id,
      relationshipType: "suggested_intro",
      confidence: "0.40",
      source: "auto_detected",
    });
  }

  if (introSuggestions.length > 0) {
    console.log(`[IntroDetection] User ${userId}: suggested ${introSuggestions.length} intros`);
  }
}

// ─── Separate Job Runners ─────────────────────────────────────
export async function runDailyBriefJob() {
  console.log("[Workers:DailyBrief] Starting...");
  const users = await repo.getAllUsersWithBriefEnabled();
  for (const user of users) {
    await withRetry(() => generateDailyBriefForUser(user.id), `DailyBrief:${user.id}`);
  }
  console.log("[Workers:DailyBrief] Complete.");
}

export async function runOpportunityScanJob() {
  console.log("[Workers:OpportunityScan] Starting...");
  const users = await repo.getAllUsersWithBriefEnabled();
  for (const user of users) {
    await withRetry(() => scanOpportunitiesForUser(user.id), `OpportunityScan:${user.id}`);
  }
  console.log("[Workers:OpportunityScan] Complete.");
}

export async function runReconnectDetectionJob() {
  console.log("[Workers:ReconnectDetection] Starting...");
  const users = await repo.getAllUsersWithBriefEnabled();
  for (const user of users) {
    await withRetry(() => detectReconnectsForUser(user.id), `ReconnectDetection:${user.id}`);
  }
  console.log("[Workers:ReconnectDetection] Complete.");
}

export async function runIntroDetectionJob() {
  console.log("[Workers:IntroDetection] Starting...");
  const users = await repo.getAllUsersWithBriefEnabled();
  for (const user of users) {
    await withRetry(() => detectSuggestedIntrosForUser(user.id), `IntroDetection:${user.id}`);
  }
  console.log("[Workers:IntroDetection] Complete.");
}

// ─── Worker Orchestrator ────────────────────────────────────────
async function runAllWorkers() {
  console.log("[Workers] Starting background worker cycle...");
  try {
    await runDailyBriefJob();
    await runOpportunityScanJob();
    await runReconnectDetectionJob();
    await runIntroDetectionJob();
    console.log("[Workers] Cycle complete.");
  } catch (error) {
    console.error("[Workers] Error in worker cycle:", error);
  }
}

// ─── Timer-based scheduling ─────────────────────────────────────
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
let workerInterval: ReturnType<typeof setInterval> | null = null;

export function startWorkers() {
  console.log("[Workers] Scheduling background workers (every 12 hours)");
  // Start job processor for DB-based job queue
  startJobProcessor();
  // Run periodic workers after a short delay
  setTimeout(() => runAllWorkers(), 30_000);
  workerInterval = setInterval(() => runAllWorkers(), TWELVE_HOURS);
}

export function stopWorkers() {
  stopJobProcessor();
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

// Export for manual trigger via tRPC
export { runAllWorkers, generateDailyBriefForUser, scanOpportunitiesForUser, detectReconnectsForUser, detectSuggestedIntrosForUser };
