/**
 * LLM-backed provider implementations.
 * These use the unified callLLM service for all AI operations.
 */

import { callLLM } from "../services/llm.service";
import * as repo from "../repositories";
import {
  dailyBriefSchema,
  opportunityDetectionSchema,
} from "../llmHelpers";
import type {
  DiscoveryProvider,
  DiscoveryIntent,
  DiscoveryResult,
  DraftProvider,
  DraftInput,
  DraftOutput,
  VoiceParserProvider,
  VoiceParseResult,
  OpportunityProvider,
  OpportunitySignal,
  RelationshipProvider,
  WarmPath,
  DailyBriefProvider,
  DailyBriefData,
} from "./types";

// ─── Scoring weights for discovery ──────────────────────────────
const SCORING_WEIGHTS: Record<string, number> = {
  roleMatch: 0.25,
  industryMatch: 0.20,
  geoMatch: 0.15,
  seniorityMatch: 0.15,
  goalAlignment: 0.15,
  signalStrength: 0.10,
};

function computeWeightedScore(scoring: Record<string, number>): number {
  let total = 0;
  for (const [key, weight] of Object.entries(SCORING_WEIGHTS)) {
    total += (scoring[key] ?? 0) * weight;
  }
  return Math.round(total * 100) / 100;
}

// ─── LLM Discovery Provider (full pipeline) ─────────────────────
export class LLMDiscoveryProvider implements DiscoveryProvider {

  /**
   * Step 1: Normalize raw query.
   * Handles: RU→EN translation, typo correction, role/skill/geo extraction.
   * Non-LinkedIn queries like "найди инструкторов по сварке во Флориде" become
   * structured English with extracted metadata.
   */
  async normalizeQuery(rawQuery: string): Promise<{
    normalized: string;
    originalLanguage: string;
    extractedRole?: string;
    extractedSkills?: string[];
    extractedGeo?: string;
  }> {
    const { data } = await callLLM<Record<string, unknown>>({
      promptModule: "query_normalization",
      params: {
        messages: [
          {
            role: "system",
            content: `You are a query normalization engine for a professional networking tool.
Your job:
1. Detect the language of the input query.
2. Translate to English if not already English.
3. Extract structured metadata: role, skills, geographic location.
4. Produce a clean, normalized English search query suitable for finding professionals.
5. Fix typos and expand abbreviations.

Return JSON:
{
  "normalized": "welding instructors in Florida",
  "originalLanguage": "ru",
  "extractedRole": "instructor",
  "extractedSkills": ["welding"],
  "extractedGeo": "Florida, USA"
}

If the query is already clean English, still return the structured extraction.`,
          },
          { role: "user", content: rawQuery },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: {
        normalized: rawQuery,
        originalLanguage: "en",
      },
    });

    return {
      normalized: String((data as any).normalized ?? rawQuery),
      originalLanguage: String((data as any).originalLanguage ?? "en"),
      extractedRole: (data as any).extractedRole ?? undefined,
      extractedSkills: Array.isArray((data as any).extractedSkills) ? (data as any).extractedSkills : undefined,
      extractedGeo: (data as any).extractedGeo ?? undefined,
    };
  }

  /**
   * Step 2: Decompose normalized query into structured intent.
   */
  async decomposeIntent(query: string, userGoals?: Record<string, unknown>) {
    const { data } = await callLLM<{ intent: DiscoveryIntent; queryVariants: string[] }>({
      promptModule: "intent_decomposition",
      params: {
        messages: [
          {
            role: "system",
            content: `Decompose this networking search query into structured intent.
Extract: topic, role, geo, industry, skills, speaker flag, negatives.
Also generate 3-5 initial query variants.

Return JSON:
{
  "intent": {
    "topic": "...",
    "role": "...",
    "geo": "...",
    "industry": "...",
    "skills": ["..."],
    "speaker": false,
    "negatives": []
  },
  "queryVariants": ["variant1", "variant2", "variant3"]
}`,
          },
          {
            role: "user",
            content: `Query: "${query}"\nUser goals: ${JSON.stringify(userGoals ?? {})}`,
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { intent: { topic: query }, queryVariants: [query] },
    });
    return data as { intent: DiscoveryIntent; queryVariants: string[] };
  }

  /**
   * Step 3: Expand intent into 8-15 diverse query variants.
   * This is the key to multi-query discovery — diverse angles produce richer results.
   */
  async expandQueries(intent: DiscoveryIntent, baseVariants: string[]): Promise<string[]> {
    const { data } = await callLLM<{ queries: string[] }>({
      promptModule: "query_expansion",
      params: {
        messages: [
          {
            role: "system",
            content: `You are a query expansion engine for professional networking discovery.
Given a structured search intent and some initial query variants, generate 8-15 diverse search queries.

Strategy:
- Vary the role angle (e.g., "CTO" → "VP Engineering", "Head of Technology", "Technical Co-founder")
- Vary the industry angle (e.g., "fintech" → "banking technology", "financial services innovation")
- Vary the geographic scope (e.g., "NYC" → "New York metro area", "Northeast US")
- Add skill-based variants (e.g., "AI researcher" → "machine learning engineer", "deep learning specialist")
- Add context variants (e.g., "speaker at AI conferences" → "keynote AI summit", "panelist machine learning")
- Include at least 2 broader/adjacent queries for fallback coverage

Return JSON: { "queries": ["query1", "query2", ..., "query12"] }
Return exactly 8-15 queries. No duplicates.`,
          },
          {
            role: "user",
            content: `Intent: ${JSON.stringify(intent)}\nBase variants: ${JSON.stringify(baseVariants)}`,
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { queries: baseVariants },
    });

    const expanded = Array.isArray((data as any).queries) ? (data as any).queries as string[] : baseVariants;
    // Ensure we have at least the base variants and cap at 15
    const all = Array.from(new Set([...baseVariants, ...expanded]));
    return all.slice(0, 15);
  }

  /**
   * Step 4: Search for people matching a single query variant.
   * Called once per query variant; results are aggregated by the service.
   */
  async search(
    query: string,
    intent: DiscoveryIntent,
    queryVariants: string[],
    filters?: Record<string, unknown>,
    userGoals?: Record<string, unknown>
  ): Promise<DiscoveryResult[]> {
    const negatives = intent.negatives ?? [];
    const { data } = await callLLM<{ results: DiscoveryResult[] }>({
      promptModule: "discovery_search",
      params: {
        messages: [
          {
            role: "system",
            content: `You are a networking discovery engine. Generate 5-8 relevant people profiles for this specific search query.
For each person provide scoring on 6 axes (0-1 each):
- roleMatch: how well their title/role matches the query
- industryMatch: alignment with target industry
- geoMatch: geographic relevance
- seniorityMatch: appropriate seniority level
- goalAlignment: relevance to user's networking goals
- signalStrength: strength of the networking signal

Return JSON: { "results": [{ "fullName": "...", "title": "...", "company": "...", "location": "...", "sourceType": "web", "linkedinUrl": "", "websiteUrl": "", "scoring": { "roleMatch": 0.9, "industryMatch": 0.8, "geoMatch": 0.7, "seniorityMatch": 0.85, "goalAlignment": 0.9, "signalStrength": 0.75 }, "matchReasons": ["reason1", "reason2"], "whyRelevant": "..." }] }
Exclude anyone matching these negatives: ${JSON.stringify(negatives)}
Generate realistic, diverse results. Vary companies, seniority levels, and backgrounds.`,
          },
          {
            role: "user",
            content: `Search query: "${query}"\nFull intent: ${JSON.stringify(intent)}\nFilters: ${JSON.stringify(filters ?? {})}\nUser goals: ${JSON.stringify(userGoals ?? {})}`,
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { results: [] },
    });

    const results = ((data as any).results ?? []) as DiscoveryResult[];
    // Tag each result with the source query
    return results.map((r) => ({
      ...r,
      sourceQuery: query,
      relevanceScore: computeWeightedScore((r.scoring ?? {}) as Record<string, number>),
    }));
  }

  /**
   * Step 5: Rerank aggregated results from all query variants.
   * Uses LLM to do a final relevance pass on the top candidates.
   */
  async rerank(
    results: DiscoveryResult[],
    intent: DiscoveryIntent,
    userGoals?: Record<string, unknown>
  ): Promise<DiscoveryResult[]> {
    if (results.length <= 5) return results;

    // Take top 30 candidates for reranking (already scored)
    const candidates = results.slice(0, 30);

    const { data } = await callLLM<{ rankings: Array<{ index: number; adjustedScore: number; reason: string }> }>({
      promptModule: "discovery_rerank",
      params: {
        messages: [
          {
            role: "system",
            content: `You are a reranking engine. Given a list of people candidates and the original search intent, rerank them by true relevance.
Consider:
- Direct role/title match to the intent
- Industry and geographic fit
- Seniority appropriateness
- Diversity of results (don't cluster same company/role)
- Networking value and signal strength

Return JSON: { "rankings": [{ "index": 0, "adjustedScore": 0.95, "reason": "..." }, ...] }
Include ALL candidates in the rankings. Adjust scores between 0 and 1.`,
          },
          {
            role: "user",
            content: `Intent: ${JSON.stringify(intent)}\nGoals: ${JSON.stringify(userGoals ?? {})}\nCandidates: ${JSON.stringify(candidates.map((c, i) => ({ index: i, name: c.fullName, title: c.title, company: c.company, location: c.location, score: c.relevanceScore, reasons: c.matchReasons })))}`,
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { rankings: candidates.map((_, i) => ({ index: i, adjustedScore: candidates[i].relevanceScore ?? 0, reason: "" })) },
    });

    const rankings = Array.isArray((data as any).rankings) ? (data as any).rankings : [];

    // Apply adjusted scores
    for (const rank of rankings) {
      const idx = rank.index;
      if (idx >= 0 && idx < candidates.length) {
        candidates[idx].relevanceScore = rank.adjustedScore;
        if (rank.reason) {
          candidates[idx].matchReasons = [
            ...(candidates[idx].matchReasons ?? []),
            rank.reason,
          ];
        }
      }
    }

    // Sort by adjusted score
    candidates.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
    return candidates;
  }

  /**
   * Step 6: Person-level deduplication.
   * Matches by normalized name + company + linkedinUrl.
   */
  dedupe(results: DiscoveryResult[]): DiscoveryResult[] {
    const seen = new Map<string, DiscoveryResult>();

    for (const r of results) {
      const name = (r.fullName ?? "").toLowerCase().trim();
      const company = (r.company ?? "").toLowerCase().trim();
      const linkedin = (r.linkedinUrl ?? "").toLowerCase().trim();

      // Primary key: linkedinUrl if available
      if (linkedin && linkedin.length > 5) {
        const normalizedLinkedin = linkedin.replace(/\/$/, "");
        if (seen.has(`li:${normalizedLinkedin}`)) {
          // Merge: keep higher score
          const existing = seen.get(`li:${normalizedLinkedin}`)!;
          if ((r.relevanceScore ?? 0) > (existing.relevanceScore ?? 0)) {
            seen.set(`li:${normalizedLinkedin}`, {
              ...r,
              matchReasons: Array.from(new Set([...(existing.matchReasons ?? []), ...(r.matchReasons ?? [])])),
            });
          }
          continue;
        }
        seen.set(`li:${normalizedLinkedin}`, r);
        continue;
      }

      // Secondary key: name + company
      const key = `${name}|${company}`;
      if (seen.has(key)) {
        const existing = seen.get(key)!;
        if ((r.relevanceScore ?? 0) > (existing.relevanceScore ?? 0)) {
          seen.set(key, {
            ...r,
            matchReasons: Array.from(new Set([...(existing.matchReasons ?? []), ...(r.matchReasons ?? [])])),
          });
        }
        continue;
      }

      // Tertiary: name-only match (fuzzy — same name different company = different person)
      // Only dedupe if name is exactly the same AND no company info
      if (!company && seen.has(`${name}|`)) {
        continue;
      }

      seen.set(key, r);
    }

    return Array.from(seen.values());
  }
}

// ─── LLM Draft Provider ──────────────────────────────────────────
export class LLMDraftProvider implements DraftProvider {
  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const { data } = await callLLM<DraftOutput>({
      promptModule: "outreach_draft",
      params: {
        messages: [
          {
            role: "system",
            content: `Generate a ${input.tone ?? "professional"} networking message. Return JSON: { "subject": "...", "body": "...", "tone": "..." }`,
          },
          {
            role: "user",
            content: `Person: ${input.personName}, ${input.personTitle ?? ""} at ${input.personCompany ?? ""}.\nContext: ${input.context ?? "General networking"}\nGoals: ${JSON.stringify(input.userGoals ?? {})}`,
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { subject: "Let's connect", body: `Hi ${input.personName}, I'd love to connect.`, tone: input.tone ?? "professional" },
    });
    return data as DraftOutput;
  }

  async generateIntroDraft(personA: string, personB: string, reason: string): Promise<DraftOutput> {
    const { data } = await callLLM<DraftOutput>({
      promptModule: "intro_draft",
      params: {
        messages: [
          {
            role: "system",
            content: `Write a warm introduction connecting two people. Return JSON: { "subject": "...", "body": "...", "tone": "warm" }`,
          },
          {
            role: "user",
            content: `Person A: ${personA}\nPerson B: ${personB}\nReason: ${reason}`,
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { subject: "Introduction", body: `I'd like to introduce ${personA} and ${personB}. ${reason}`, tone: "warm" },
    });
    return data as DraftOutput;
  }
}

// ─── LLM Voice Parser Provider ───────────────────────────────────
export class LLMVoiceParserProvider implements VoiceParserProvider {
  async parseTranscript(transcript: string): Promise<VoiceParseResult> {
    const { data } = await callLLM<VoiceParseResult>({
      promptModule: "voice_parse",
      params: {
        messages: [
          {
            role: "system",
            content: `Parse this voice transcript into structured data. Return JSON: { "people": [{ "name": "...", "role": "...", "company": "...", "action": "..." }], "tasks": [{ "title": "...", "priority": "medium", "dueDate": "..." }], "notes": [{ "personName": "...", "content": "..." }], "reminders": [{ "text": "...", "datetime": "..." }] }`,
          },
          { role: "user", content: transcript },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { people: [], tasks: [], notes: [], reminders: [] },
    });
    return data as VoiceParseResult;
  }
}

// ─── LLM Opportunity Provider ────────────────────────────────────
export class LLMOpportunityProvider implements OpportunityProvider {
  async detectOpportunities(
    people: Array<Record<string, unknown>>,
    userGoals?: Record<string, unknown>
  ): Promise<OpportunitySignal[]> {
    const { data } = await callLLM<{ opportunities: OpportunitySignal[] }>({
      promptModule: "opportunity_scan",
      params: {
        messages: [
          {
            role: "system",
            content: `Detect networking opportunities. Return JSON: { "opportunities": [{ "title": "...", "opportunityType": "...", "signalSummary": "...", "whyItMatters": "...", "recommendedAction": "...", "score": 0.8, "personIndex": 0 }] }`,
          },
          {
            role: "user",
            content: JSON.stringify({ goals: userGoals ?? {}, people: people.map((p, i) => ({ index: i, ...p })) }),
          },
        ],
        response_format: { type: "json_object" as const },
      },
      schema: opportunityDetectionSchema,
      fallback: { opportunities: [] },
    });
    return (data as any).opportunities ?? [];
  }
}

// ─── LLM Relationship Provider ───────────────────────────────────
export class LLMRelationshipProvider implements RelationshipProvider {
  async findWarmPaths(userId: number, targetPersonId: number): Promise<WarmPath[]> {
    const relationships = await repo.getRelationshipsForPerson(userId, targetPersonId);
    return relationships.map((r: any) => ({
      connector: { id: r.personBId ?? r.personAId, fullName: "Connected person", title: undefined, company: undefined },
      relationshipType: r.relationshipType,
      confidence: r.confidence ?? "medium",
    }));
  }

  async suggestIntros(people: Array<Record<string, unknown>>): Promise<Array<{ personAId: number; personBId: number; reason: string }>> {
    if (people.length < 2) return [];
    const { data } = await callLLM<{ suggestions: Array<{ personAIndex: number; personBIndex: number; reason: string }> }>({
      promptModule: "suggest_intros",
      params: {
        messages: [
          {
            role: "system",
            content: `Suggest introductions between people who could benefit from connecting. Return JSON: { "suggestions": [{ "personAIndex": 0, "personBIndex": 1, "reason": "..." }] }`,
          },
          {
            role: "user",
            content: JSON.stringify(people.map((p, i) => ({ index: i, ...p }))),
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { suggestions: [] },
    });
    return ((data as any).suggestions ?? []).map((s: any) => ({
      personAId: (people[s.personAIndex] as any)?.id ?? 0,
      personBId: (people[s.personBIndex] as any)?.id ?? 0,
      reason: s.reason,
    }));
  }
}

// ─── LLM Daily Brief Provider ────────────────────────────────────
export class LLMDailyBriefProvider implements DailyBriefProvider {
  async generateBrief(context: {
    goals?: Record<string, unknown>;
    opportunities: Array<Record<string, unknown>>;
    tasks: Array<Record<string, unknown>>;
    pendingDrafts: number;
    staleContacts: Array<Record<string, unknown>>;
  }): Promise<DailyBriefData> {
    const { data } = await callLLM<DailyBriefData>({
      promptModule: "daily_brief",
      params: {
        messages: [
          {
            role: "system",
            content: `Generate a daily networking brief. Return JSON: { "greeting": "...", "summary": "...", "items": [{ "title": "...", "description": "...", "priority": "high|medium|low", "type": "..." }], "reconnectSuggestions": [{ "personName": "...", "reason": "..." }] }`,
          },
          { role: "user", content: JSON.stringify(context) },
        ],
        response_format: { type: "json_object" as const },
      },
      schema: dailyBriefSchema,
      fallback: { greeting: "Good morning!", summary: "Here's your daily brief.", items: [] },
    });
    return data as DailyBriefData;
  }
}
