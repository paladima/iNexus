/**
 * LLM-backed provider implementations (#7)
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

// ─── LLM Discovery Provider ──────────────────────────────────────
export class LLMDiscoveryProvider implements DiscoveryProvider {
  async decomposeIntent(query: string, userGoals?: Record<string, unknown>) {
    const { data } = await callLLM<{ intent: DiscoveryIntent; queryVariants: string[] }>({
      promptModule: "intent_decomposition",
      params: {
        messages: [
          {
            role: "system",
            content: `Decompose this networking search query into structured intent. Return JSON: { "intent": { "topic": "...", "role": "...", "geo": "...", "speaker": false, "negatives": [] }, "queryVariants": ["variant1", "variant2", "variant3"] }`,
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

  async search(query: string, intent: DiscoveryIntent, queryVariants: string[]): Promise<DiscoveryResult[]> {
    const { data } = await callLLM<{ results: DiscoveryResult[] }>({
      promptModule: "discovery_search",
      params: {
        messages: [
          {
            role: "system",
            content: `Find relevant people for networking based on this search. Return JSON: { "results": [{ "fullName": "...", "title": "...", "company": "...", "location": "...", "relevanceScore": 0.85, "matchReasons": ["reason1"] }] }`,
          },
          {
            role: "user",
            content: JSON.stringify({ query, intent, queryVariants }),
          },
        ],
        response_format: { type: "json_object" as const },
      },
      fallback: { results: [] },
    });
    return (data as any).results ?? [];
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
