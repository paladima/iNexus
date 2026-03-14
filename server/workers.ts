/**
 * Background workers for iNexus.
 * - Opportunity scan: every 12 hours
 * - Daily brief generation: every morning
 * - Reconnect detection: every 24 hours
 */
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

// ─── Opportunity Scan Worker ────────────────────────────────────
async function scanOpportunitiesForUser(userId: number) {
  try {
    const goals = await db.getUserGoals(userId);
    const { items: recentPeople } = await db.getPeople(userId, { limit: 30 });
    if (recentPeople.length === 0) return;

    const peopleContext = recentPeople.map(p => ({
      id: p.id,
      name: p.fullName,
      title: p.title,
      company: p.company,
      location: p.location,
      tags: p.tags,
      lastInteractionAt: p.lastInteractionAt,
    }));

    const response = await invokeLLM({
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

    const content = response.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : { opportunities: [] };
    const opps = parsed.opportunities ?? [];

    for (const opp of opps) {
      await db.createOpportunity(userId, {
        title: opp.title,
        opportunityType: opp.opportunityType,
        signalSummary: opp.signalSummary,
        personId: opp.personId,
        whyItMatters: opp.whyItMatters,
        recommendedAction: opp.recommendedAction,
        score: opp.score?.toString(),
        metadataJson: { source: "auto_scan", detectedBy: "opportunity_worker" },
      });
    }

    if (opps.length > 0) {
      await db.logActivity(userId, {
        activityType: "opportunity_scan",
        title: `Auto-detected ${opps.length} new opportunities`,
        metadataJson: { count: opps.length },
      });
    }

    console.log(`[OpportunityScan] User ${userId}: found ${opps.length} opportunities`);
  } catch (error) {
    console.error(`[OpportunityScan] Error for user ${userId}:`, error);
  }
}

// ─── Reconnect Detection Worker ─────────────────────────────────
async function detectReconnectsForUser(userId: number) {
  try {
    const staleContacts = await db.getPeopleNeedingReconnect(userId, 90);
    if (staleContacts.length === 0) return;

    for (const person of staleContacts) {
      // Check if there's already an open reconnect opportunity for this person
      const { items: existingOpps } = await db.getOpportunities(userId, {
        status: "open",
        personId: person.id,
      });
      const hasReconnect = existingOpps.some(o => o.opportunityType === "reconnect");
      if (hasReconnect) continue;

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
    }

    console.log(`[ReconnectDetection] User ${userId}: flagged ${staleContacts.length} contacts for reconnect`);
  } catch (error) {
    console.error(`[ReconnectDetection] Error for user ${userId}:`, error);
  }
}

// ─── Daily Brief Worker ─────────────────────────────────────────
async function generateDailyBriefForUser(userId: number) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const existing = await db.getDailyBrief(userId, today);
    if (existing) return; // Already generated today

    const goals = await db.getUserGoals(userId);
    const { items: openOpps } = await db.getOpportunities(userId, { status: "open", limit: 10 });
    const { items: openTasks } = await db.getTasks(userId, { view: "today", limit: 10 });
    const { items: pendingDrafts } = await db.getDrafts(userId, { status: "pending_review", limit: 5 });
    const staleContacts = await db.getPeopleNeedingReconnect(userId, 90);

    const response = await invokeLLM({
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

    const content = response.choices[0]?.message?.content;
    const briefJson = typeof content === "string" ? JSON.parse(content) : {};

    await db.saveDailyBrief(userId, today, briefJson);
    console.log(`[DailyBrief] Generated brief for user ${userId}`);
  } catch (error) {
    console.error(`[DailyBrief] Error for user ${userId}:`, error);
  }
}

// ─── Suggested Intro Detection ──────────────────────────────────
async function detectSuggestedIntrosForUser(userId: number) {
  try {
    const { items: allPeople } = await db.getPeople(userId, { limit: 100 });
    if (allPeople.length < 2) return;

    // Group people by shared tags, industry, or geography
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
        const sameIndustry = sharedTags.length > 0;

        if (sameIndustry || sameLocation) {
          // Check if intro opportunity already exists
          const { items: existingOpps } = await db.getOpportunities(userId, { status: "open" });
          const alreadySuggested = existingOpps.some(o =>
            o.opportunityType === "intro" &&
            o.metadataJson &&
            ((o.metadataJson as Record<string, unknown>).personAId === a.id || (o.metadataJson as Record<string, unknown>).personBId === b.id)
          );
          if (!alreadySuggested) {
            const reason = sharedTags.length > 0
              ? `Shared interests: ${sharedTags.join(", ")}`
              : `Same location: ${a.location}`;
            introSuggestions.push({ personA: a, personB: b, reason });
          }
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

      // Also create a relationship record
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
  } catch (error) {
    console.error(`[IntroDetection] Error for user ${userId}:`, error);
  }
}

// ─── Worker Orchestrator ────────────────────────────────────────
async function runAllWorkers() {
  console.log("[Workers] Starting background worker cycle...");
  try {
    const allUsers = await db.getAllUsersWithBriefEnabled();
    for (const user of allUsers) {
      await generateDailyBriefForUser(user.id);
      await scanOpportunitiesForUser(user.id);
      await detectReconnectsForUser(user.id);
      await detectSuggestedIntrosForUser(user.id);
    }
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
