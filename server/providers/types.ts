/**
 * Provider interfaces for pluggable architecture.
 * These interfaces define the contracts for each AI-powered module.
 */

// ─── Discovery Provider ────────────────────────────────────────
export interface DiscoveryIntent {
  topic: string;
  role?: string;
  geo?: string;
  industry?: string;
  speaker?: boolean;
  negatives?: string[];
  queryVariants?: string[];
}

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
  [key: string]: unknown;
}

/**
 * DiscoveryProvider — full pipeline: decompose → search → score.
 * Services call provider methods; provider owns the LLM interaction.
 */
export interface DiscoveryProvider {
  decomposeIntent(query: string, userGoals?: Record<string, unknown>): Promise<{
    intent: DiscoveryIntent;
    queryVariants: string[];
  }>;
  search(
    query: string,
    intent: DiscoveryIntent,
    queryVariants: string[],
    filters?: Record<string, unknown>,
    userGoals?: Record<string, unknown>
  ): Promise<DiscoveryResult[]>;
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
