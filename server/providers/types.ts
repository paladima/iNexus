/**
 * Provider interfaces for pluggable architecture.
 * These interfaces define the contracts for each AI-powered module.
 */

// ─── Discovery Provider ────────────────────────────────────────

/** Structured intent extracted from a raw user query. */
export interface DiscoveryIntent {
  topic: string;
  role?: string;
  geo?: string;
  industry?: string;
  speaker?: boolean;
  skills?: string[];
  negatives?: string[];
  queryVariants?: string[];
  /** Original language detected (e.g. "ru", "en") */
  originalLanguage?: string;
  /** Normalized English version of the query */
  normalizedQuery?: string;
}

/** A single person result from discovery. */
export interface DiscoveryResult {
  fullName: string;
  title?: string;
  company?: string;
  location?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  sourceType?: string;
  relevanceScore?: number;
  scoring?: Record<string, number>;
  matchReasons?: string[];
  whyRelevant?: string;
  /** Which query variant produced this result */
  sourceQuery?: string;
  [key: string]: unknown;
}

/**
 * DiscoveryProvider — full pipeline with stable contract:
 *   1. normalizeQuery  — RU→EN, typo fix, skill/geo extraction
 *   2. decomposeIntent — structured intent from normalized query
 *   3. expandQueries   — 8-15 query variants from intent
 *   4. search          — execute search for a single query variant
 *   5. rerank          — score and rerank aggregated results
 *   6. dedupe          — person-level deduplication
 *
 * Services orchestrate the pipeline; provider owns each step's LLM interaction.
 */
export interface DiscoveryProvider {
  /** Normalize raw query: translate non-EN, extract roles/skills/geo, fix typos */
  normalizeQuery(rawQuery: string): Promise<{
    normalized: string;
    originalLanguage: string;
    extractedRole?: string;
    extractedSkills?: string[];
    extractedGeo?: string;
  }>;

  /** Decompose a normalized query into structured intent */
  decomposeIntent(query: string, userGoals?: Record<string, unknown>): Promise<{
    intent: DiscoveryIntent;
    queryVariants: string[];
  }>;

  /** Expand intent into 8-15 diverse query variants */
  expandQueries(intent: DiscoveryIntent, baseVariants: string[]): Promise<string[]>;

  /** Search for people matching a single query variant */
  search(
    query: string,
    intent: DiscoveryIntent,
    queryVariants: string[],
    filters?: Record<string, unknown>,
    userGoals?: Record<string, unknown>
  ): Promise<DiscoveryResult[]>;

  /** Rerank aggregated results from multiple query variants */
  rerank(
    results: DiscoveryResult[],
    intent: DiscoveryIntent,
    userGoals?: Record<string, unknown>
  ): Promise<DiscoveryResult[]>;

  /** Person-level deduplication across results */
  dedupe(results: DiscoveryResult[]): DiscoveryResult[];
}

// ─── Draft Provider ────────────────────────────────────────────
export interface DraftInput {
  personName: string;
  personTitle?: string;
  personCompany?: string;
  context?: string;
  userGoals?: Record<string, unknown>;
  tone?: string;
  draftType?: string;
}

export interface DraftOutput {
  subject?: string;
  body: string;
  tone: string;
}

export interface DraftProvider {
  generateDraft(input: DraftInput): Promise<DraftOutput>;
  generateIntroDraft(personA: string, personB: string, reason: string): Promise<DraftOutput>;
}

// ─── Voice Parser Provider ─────────────────────────────────────
export interface VoiceParseResult {
  people: Array<{ name: string; role?: string; company?: string; action?: string }>;
  tasks: Array<{ title: string; priority?: string; dueDate?: string }>;
  notes: Array<{ personName?: string; content: string }>;
  reminders: Array<{ text: string; datetime?: string }>;
}

export interface VoiceParserProvider {
  parseTranscript(transcript: string): Promise<VoiceParseResult>;
}

// ─── Opportunity Provider ──────────────────────────────────────
export interface OpportunitySignal {
  personId?: number;
  title: string;
  opportunityType: string;
  signalSummary: string;
  whyItMatters?: string;
  recommendedAction?: string;
  score?: number;
}

export interface OpportunityProvider {
  detectOpportunities(
    people: Array<Record<string, unknown>>,
    userGoals?: Record<string, unknown>
  ): Promise<OpportunitySignal[]>;
}

// ─── Relationship Provider ─────────────────────────────────────
export interface WarmPath {
  connector: { id: number; fullName: string; title?: string; company?: string };
  relationshipType: string;
  confidence: string;
}

export interface RelationshipProvider {
  findWarmPaths(userId: number, targetPersonId: number): Promise<WarmPath[]>;
  suggestIntros(
    people: Array<Record<string, unknown>>
  ): Promise<Array<{ personAId: number; personBId: number; reason: string }>>;
}

// ─── Daily Brief Provider ──────────────────────────────────────
export interface DailyBriefData {
  greeting: string;
  summary: string;
  items: Array<{
    title: string;
    description?: string;
    priority: "high" | "medium" | "low";
    type?: string;
  }>;
  reconnectSuggestions?: Array<{ personName: string; reason: string }>;
  stats?: Record<string, number>;
}

export interface DailyBriefProvider {
  generateBrief(context: {
    goals?: Record<string, unknown>;
    opportunities: Array<Record<string, unknown>>;
    tasks: Array<Record<string, unknown>>;
    pendingDrafts: number;
    staleContacts: Array<Record<string, unknown>>;
  }): Promise<DailyBriefData>;
}
