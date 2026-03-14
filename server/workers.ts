/**
 * Background workers for iNexus.
 * #12: Refactored with rate limiting, retries, dedup, separate jobs.
 * #14: Fixed N+1 in intro detection.
 * #15: Opportunity dedup fingerprint.
 */
import { invokeLLM } from "./_core/llm";
import { parseLLMContent } from "./llmHelpers";
import * as db from "./db";

// ─── Rate Limiter ──────────────────────────────────────────────
const RATE_LIMIT_MS = 2000; // 2s between LLM calls
async function rateLimitedLLM(params: Parameters<typeof invokeLLM>[0]) {
  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
  return invokeLLM(params);
}

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

// ─── #15: Opportunity Dedup Fingerprint ────────────────────────
function opportunityFingerprint(userId: number, type: string, personId?: number, signal?: string): string {
  const normalizedSignal = (signal ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 100);
  return `${userId}:${type}:${personId ?? "none"}:${normalizedSignal}`;
}

// ─── Opportunity Scan Worker ────────────────────────────────────
async function scanOpportunitiesForUser(userId: number) {
  const goals = await db.getUserGoals(userId);
  const { items: recentPeople } = await db.getPeople(userId, { limit: 30 });
  if (recentPeople.length === 0) return;

  // #15: Load existing open opportunities to dedup
  const { items: existingOpps } = await db.getOpportunities(userId, { status: "open", limit: 200 });
  const existingFingerprints = new Set(
    existingOpps.map(o => opportunityFingerprint(userId, o.opportunityType, o.personId ?? undefined, o.signalSummary))
  );

  const peopleContext = recentPeople.map(p => ({
    id: p.id, name: p.fullName, title: p.title,
    company: p.company, location: p.location, tags: p.tags,
    lastInteractionAt: p.lastInteractionAt,
  }));

  const response = await rateLimitedLLM({
    messages: [
      {
        role: "system",
        content: `You are an opportunity detection engine for a networking assistant. Analyze the user's contacts and goals to detect actionable networking opportunities. Return JSON: { "opportunities": [{ "personId": number, "title": "...", "opportunityType": "reconnect|funding|job_change|conference|collaboration|intro", "signalSummary": "...", "whyItMatters": "...", "recommendedAction": "...", "score": 0.85 }] }. Return 0-5 opportunities. Only return high-quality, actionable ones.`
      },
      {
        role: "user",
        content: `User goals: ${JSON.stringify(goals)}\n\nContacts:\n${JSON.stringify(peopleContext)}`
      }
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseLLMContent<{ opportunities: Array<Record<string, unknown>> }>(response, "worker.opportunityScan", { opportunities: [] });
  const opps = parsed.opportunities ?? [];

  let created = 0;
  for (const opp of opps) {
    const fp = opportunityFingerprint(userId, String(opp.opportunityType ?? ""), opp.personId as number | undefined, String(opp.signalSummary ?? ""));
    if (existingFingerprints.has(fp)) continue; // #15: Skip duplicate

    await db.createOpportunity(userId, {
      title: String(opp.title ?? ""),
      opportunityType: String(opp.opportunityType ?? ""),
      signalSummary: String(opp.signalSummary ?? ""),
      personId: opp.personId as number | undefined,
      whyItMatters: String(opp.whyItMatters ?? ""),
      recommendedAction: String(opp.recommendedAction ?? ""),
      score: opp.score?.toString(),
      metadataJson: { source: "auto_scan", detectedBy: "opportunity_worker" },
    });
    existingFingerprints.add(fp);
    created++;
  }

  if (created > 0) {
    await db.logActivity(userId, {
      activityType: "opportunity_scan",
      title: `Auto-detected ${created} new opportunities`,
      metadataJson: { count: created },
    });
  }
  console.log(`[OpportunityScan] User ${userId}: found ${opps.length}, created ${created} (${opps.length - created} deduped)`);
}

// ─── Reconnect Detection Worker ─────────────────────────────────
async function detectReconnectsForUser(userId: number) {
  const staleContacts = await db.getPeopleNeedingReconnect(userId, 90);
  if (staleContacts.length === 0) return;

  // #14: Load all open reconnect opportunities once, not per person
  const { items: existingOpps } = await db.getOpportunities(userId, { status: "open", limit: 200 });
  const reconnectPersonIds = new Set(
    existingOpps.filter(o => o.opportunityType === "reconnect").map(o => o.personId)
  );

  let created = 0;
  for (const person of staleContacts) {
    if (reconnectPersonIds.has(person.id)) continue;

    await db.createOpportunity(userId, {
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
  const existing = await db.getDailyBrief(userId, today);
  if (existing) return; // Already generated today

  const goals = await db.getUserGoals(userId);
  const { items: openOpps } = await db.getOpportunities(userId, { status: "open", limit: 10 });
  const { items: openTasks } = await db.getTasks(userId, { view: "today", limit: 10 });
  const { items: pendingDrafts } = await db.getDrafts(userId, { status: "pending_review", limit: 5 });
  const staleContacts = await db.getPeopleNeedingReconnect(userId, 90);

  const response = await rateLimitedLLM({
    messages: [
      {
        role: "system",
        content: `You are a daily brief composer for a networking assistant. Create a concise, actionable daily brief. Return JSON: { "greeting": "...", "summary": "...", "topActions": [{ "action": "...", "priority": "high|medium|low", "relatedEntity": "..." }], "reconnectSuggestions": [{ "personName": "...", "reason": "..." }], "stats": { "openOpportunities": N, "tasksDueToday": N, "pendingDrafts": N } }`
      },
      {
        role: "user",
        content: `Goals: ${JSON.stringify(goals)}\nOpen opportunities: ${JSON.stringify(openOpps.slice(0, 5).map(o => ({ title: o.title, type: o.opportunityType })))}\nTasks due today: ${JSON.stringify(openTasks.slice(0, 5).map(t => ({ title: t.title, priority: t.priority })))}\nPending drafts: ${pendingDrafts.length}\nContacts needing reconnect: ${JSON.stringify(staleContacts.slice(0, 3).map(p => ({ name: p.fullName, lastInteraction: p.lastInteractionAt })))}`
      }
    ],
    response_format: { type: "json_object" },
  });

  const briefJson = parseLLMContent<Record<string, unknown>>(response, "worker.dailyBrief", {});
  await db.saveDailyBrief(userId, today, briefJson);
  console.log(`[DailyBrief] Generated brief for user ${userId}`);
}

// ─── Suggested Intro Detection ──────────────────────────────────
async function detectSuggestedIntrosForUser(userId: number) {
  const { items: allPeople } = await db.getPeople(userId, { limit: 100 });
  if (allPeople.length < 2) return;

  // #14: Load all open intro opportunities ONCE (fix N+1)
  const { items: existingOpps } = await db.getOpportunities(userId, { status: "open", limit: 200 });
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
        // Check dedup locally instead of querying DB each time
        const key1 = `${a.id}:${b.id}`;
        const key2 = `${b.id}:${a.id}`;
        if (existingIntroKeys.has(key1) || existingIntroKeys.has(key2)) continue;

        const reason = sharedTags.length > 0
          ? `Shared interests: ${sharedTags.join(", ")}`
          : `Same location: ${a.location}`;
        introSuggestions.push({ personA: a, personB: b, reason });
        existingIntroKeys.add(key1); // Prevent duplicates within this batch
      }
    }
  }

  for (const suggestion of introSuggestions) {
    await db.createOpportunity(userId, {
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

    await db.createRelationship(userId, {
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

// ─── #12: Separate Job Runners ─────────────────────────────────
export async function runDailyBriefJob() {
  console.log("[Workers:DailyBrief] Starting...");
  const users = await db.getAllUsersWithBriefEnabled();
  for (const user of users) {
    await withRetry(() => generateDailyBriefForUser(user.id), `DailyBrief:${user.id}`);
  }
  console.log("[Workers:DailyBrief] Complete.");
}

export async function runOpportunityScanJob() {
  console.log("[Workers:OpportunityScan] Starting...");
  const users = await db.getAllUsersWithBriefEnabled();
  for (const user of users) {
    await withRetry(() => scanOpportunitiesForUser(user.id), `OpportunityScan:${user.id}`);
  }
  console.log("[Workers:OpportunityScan] Complete.");
}

export async function runReconnectDetectionJob() {
  console.log("[Workers:ReconnectDetection] Starting...");
  const users = await db.getAllUsersWithBriefEnabled();
  for (const user of users) {
    await withRetry(() => detectReconnectsForUser(user.id), `ReconnectDetection:${user.id}`);
  }
  console.log("[Workers:ReconnectDetection] Complete.");
}

export async function runIntroDetectionJob() {
  console.log("[Workers:IntroDetection] Starting...");
  const users = await db.getAllUsersWithBriefEnabled();
  for (const user of users) {
    await withRetry(() => detectSuggestedIntrosForUser(user.id), `IntroDetection:${user.id}`);
  }
  console.log("[Workers:IntroDetection] Complete.");
}

// ─── Worker Orchestrator ────────────────────────────────────────
async function runAllWorkers() {
  console.log("[Workers] Starting background worker cycle...");
  try {
    // Run jobs sequentially to avoid overloading LLM API
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
  // Run once after a short delay to let the server start
  setTimeout(() => runAllWorkers(), 30_000);
  // Then every 12 hours
  workerInterval = setInterval(() => runAllWorkers(), TWELVE_HOURS);
}

export function stopWorkers() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

// Export for manual trigger via tRPC
export { runAllWorkers, generateDailyBriefForUser, scanOpportunitiesForUser, detectReconnectsForUser, detectSuggestedIntrosForUser };
