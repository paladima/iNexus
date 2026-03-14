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
   * Works for ANY professional domain — not just startups/tech.
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
This tool is used to find ANY type of professional — not just tech/startup people.
Users search for doctors, attorneys, welding instructors, plumbers, consultants, coaches, etc.

Your job:
1. Detect the language of the input query.
2. Translate to English if not already English.
3. Extract structured metadata: role, skills, geographic location, industry/domain.
4. Produce a clean, normalized English search query suitable for finding professionals.
5. Fix typos and expand abbreviations.
6. For non-English queries, preserve domain-specific terminology accurately.

Return JSON:
{
  "normalized": "welding instructors in Florida",
  "originalLanguage": "ru",
  "extractedRole": "instructor",
  "extractedSkills": ["welding", "metal fabrication"],
  "extractedGeo": "Florida, USA",
  "extractedIndustry": "manufacturing/trades"
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
This can be ANY profession — tech, medical, legal, trades, education, creative, etc.
Extract: topic, role, geo, industry, skills, speaker flag, negatives, domain.

Also generate 3-5 initial query variants that cover different angles.

Return JSON:
{
  "intent": {
    "topic": "...",
    "role": "...",
    "geo": "...",
    "industry": "...",
    "skills": ["..."],
    "speaker": false,
    "negatives": [],
    "domain": "...",
    "confidence": 0.85
  },
  "queryVariants": ["variant1", "variant2", "variant3"]
}

confidence is 0.0-1.0: how confident you are in the parsed intent. Low confidence means the query is ambiguous or unclear.`,
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
   * Key to multi-query discovery — diverse angles produce richer results.
   * Works for ANY professional domain.
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

IMPORTANT: This tool works for ALL professions, not just tech/startup.
Adapt your expansion strategy to the actual domain:

For tech/business roles:
- Vary title (CTO → VP Engineering → Head of Technology)
- Vary industry (fintech → banking technology → financial services)

For medical/healthcare:
- Vary specialty (cardiologist → heart surgeon → cardiovascular specialist)
- Include certification variants (board-certified, fellowship-trained)

For legal:
- Vary practice area (patent attorney → IP lawyer → intellectual property counsel)
- Include jurisdiction variants

For trades/vocational:
- Vary certification (licensed, certified, master)
- Include related trades and specializations

For education/training:
- Vary level (instructor → professor → trainer → coach)
- Include subject matter variants

General strategies for ALL domains:
- Vary geographic scope (city → metro area → state → region)
- Add skill-based variants
- Include at least 2 broader/adjacent queries for fallback coverage
- Add "top" or "leading" variants for quality signal
- Include industry association or certification body terms

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
This can be ANY profession — generate realistic profiles for the actual domain requested.

For each person provide scoring on 6 axes (0-1 each):
- roleMatch: how well their title/role matches the query
- industryMatch: alignment with target industry/domain
- geoMatch: geographic relevance
- seniorityMatch: appropriate seniority/experience level
- goalAlignment: relevance to user's networking goals
- signalStrength: strength of the networking signal

Return JSON: { "results": [{ "fullName": "...", "title": "...", "company": "...", "location": "...", "sourceType": "web", "linkedinUrl": "", "websiteUrl": "", "scoring": { "roleMatch": 0.9, "industryMatch": 0.8, "geoMatch": 0.7, "seniorityMatch": 0.85, "goalAlignment": 0.9, "signalStrength": 0.75 }, "matchReasons": ["reason1", "reason2"], "whyRelevant": "..." }] }
Exclude anyone matching these negatives: ${JSON.stringify(negatives)}
Generate realistic, diverse results. Vary companies/organizations, experience levels, and backgrounds.`,
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
    return results.map((r) => ({
      ...r,
      sourceQuery: query,
      relevanceScore: computeWeightedScore((r.scoring ?? {}) as Record<string, number>),
    }));
  }

  /**
   * Step 5: Rerank aggregated results from all query variants.
   */
  async rerank(
    results: DiscoveryResult[],
    intent: DiscoveryIntent,
    userGoals?: Record<string, unknown>
  ): Promise<DiscoveryResult[]> {
    if (results.length <= 5) return results;

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
- Industry/domain fit
- Geographic relevance
- Seniority/experience appropriateness
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

    candidates.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
    return candidates;
  }

  /**
   * Step 6: Person-level deduplication.
   * Matches by normalized name + company + linkedinUrl + websiteUrl.
   * Handles slight URL variants and name normalization.
   */
  dedupe(results: DiscoveryResult[]): DiscoveryResult[] {
    const seen = new Map<string, DiscoveryResult>();

    for (const r of results) {
      const name = (r.fullName ?? "").toLowerCase().trim().replace(/\s+/g, " ");
      const company = (r.company ?? "").toLowerCase().trim().replace(/\s+/g, " ");
      const linkedin = (r.linkedinUrl ?? "").toLowerCase().trim();
      const website = (r.websiteUrl ?? "").toLowerCase().trim();

      // Normalize URLs: remove trailing slash, www, protocol
      const normalizeUrl = (url: string) =>
        url.replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");

      // Primary key: linkedinUrl if available
      if (linkedin && linkedin.length > 5) {
        const normalizedLinkedin = normalizeUrl(linkedin);
        const liKey = `li:${normalizedLinkedin}`;
        if (seen.has(liKey)) {
          const existing = seen.get(liKey)!;
          if ((r.relevanceScore ?? 0) > (existing.relevanceScore ?? 0)) {
            seen.set(liKey, {
              ...r,
              matchReasons: Array.from(new Set([...(existing.matchReasons ?? []), ...(r.matchReasons ?? [])])),
            });
          }
          continue;
        }
        seen.set(liKey, r);
        continue;
      }

      // Secondary key: websiteUrl if available
      if (website && website.length > 5) {
        const normalizedWebsite = normalizeUrl(website);
        const wsKey = `ws:${normalizedWebsite}`;
        if (seen.has(wsKey)) {
          const existing = seen.get(wsKey)!;
          if ((r.relevanceScore ?? 0) > (existing.relevanceScore ?? 0)) {
            seen.set(wsKey, {
              ...r,
              matchReasons: Array.from(new Set([...(existing.matchReasons ?? []), ...(r.matchReasons ?? [])])),
            });
          }
          continue;
        }
        seen.set(wsKey, r);
        continue;
      }

      // Tertiary key: name + company
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

      // Name-only match (same name, no company = likely same person)
      if (!company && seen.has(`${name}|`)) {
        continue;
      }

      seen.set(key, r);
    }

    return Array.from(seen.values());
  }

  /**
   * Step 7: Broad fallback strategy (#1).
   * When narrow search yields too few results, generate broader queries
   * by relaxing constraints: wider geo, adjacent roles, broader industry.
   */
  async generateBroadFallbackQueries(intent: DiscoveryIntent): Promise<string[]> {
    const { data } = await callLLM<{ queries: string[] }>({
      promptModule: "broad_fallback",
      params: {
        messages: [
          {
            role: "system",
            content: `The initial search for professionals returned too few results.
Generate 5-8 BROADER search queries by relaxing the original constraints:

Strategies:
1. WIDEN GEOGRAPHY: If city-specific, expand to state/region/country. If country-specific, go global.
2. RELAX ROLE: Use parent/adjacent role titles. "Senior React Developer" → "Frontend Developer" → "Software Engineer"
3. BROADEN INDUSTRY: Use parent industry. "Fintech" → "Financial Services" → "Technology"
4. ADD SYNONYMS: Include alternative titles, certifications, and related specializations.
5. REMOVE CONSTRAINTS: Drop seniority, specific skills, or niche requirements one at a time.
6. ADJACENT DOMAINS: Include related fields that often overlap.

Return JSON: { "queries": ["broader query 1", "broader query 2", ...] }
Return exactly 5-8 queries. Each should be progressively broader than the original.`,
          },
          {
            role: "user",
            content: `Original intent: ${JSON.stringify(intent)}`,
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { queries: [intent.topic ?? "professionals"] },
    });

    return Array.isArray((data as any).queries) ? (data as any).queries as string[] : [intent.topic ?? "professionals"];
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
