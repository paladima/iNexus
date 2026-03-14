/**
 * Discovery Intent Schema (#5 v13)
 *
 * Centralized type definitions for the discovery intent model.
 * Used by providers, services, and frontend for consistent typing.
 */

/** Structured intent extracted from a raw user query. */
export interface DiscoveryIntent {
  /** Main topic or search subject */
  topic: string;
  /** Target role or job title */
  role?: string;
  /** Geographic constraint */
  geo?: string;
  /** Industry or sector */
  industry?: string;
  /** Whether looking for speakers/presenters */
  speaker?: boolean;
  /** Specific skills to match */
  skills?: string[];
  /** Terms to exclude from results */
  negatives?: string[];
  /** Initial query variants from decomposition */
  queryVariants?: string[];
  /** Original language detected (e.g. "ru", "en") */
  originalLanguage?: string;
  /** Normalized English version of the query */
  normalizedQuery?: string;
  /** Professional domain (tech, medical, legal, trades, etc.) */
  domain?: string;
  /** Confidence score for the parsed intent (0.0-1.0) */
  confidence?: number;
}

/** A single person result from discovery. */
export interface DiscoveryResult {
  fullName: string;
  title?: string;
  company?: string;
  location?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;
  sourceType?: string;
  relevanceScore?: number;
  scoring?: Record<string, number>;
  matchReasons?: string[];
  whyRelevant?: string;
  /** Which query variant produced this result */
  sourceQuery?: string;
  [key: string]: unknown;
}

/** Normalized query output from Step 1 of the pipeline. */
export interface NormalizedQuery {
  original: string;
  normalized: string;
  language: string;
  extractedRole?: string;
  extractedSkills?: string[];
  extractedGeo?: string;
}

/** Intent decomposition output from Step 2 of the pipeline. */
export interface IntentDecomposition {
  intent: DiscoveryIntent;
  queryVariants: string[];
}

/** Discovery pipeline metadata for UI display. */
export interface DiscoveryMeta {
  normalizedQuery?: NormalizedQuery;
  intent?: DiscoveryIntent;
  expandedQueries?: string[];
  broadSearchUsed?: boolean;
  totalBeforeDedupe?: number;
  totalAfterDedupe?: number;
}
