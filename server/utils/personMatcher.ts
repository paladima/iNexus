/**
 * PersonMatcher — Centralized person dedup/matching utility (#9, #10).
 *
 * Used by: discover.service, people.service, voice.service, command.service.
 * Combines exact index lookups (linkedinUrl, websiteUrl, name+company)
 * with fuzzy name matching via Levenshtein distance.
 */
import { isFuzzyNameMatch, nameSimilarity } from "./fuzzyMatch";

export interface PersonCandidate {
  id: number;
  fullName: string;
  company?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
}

export interface MatchResult {
  matched: boolean;
  existingId?: number;
  matchType?: "linkedin" | "website" | "exact_name" | "fuzzy_name";
}

/**
 * Build lookup indexes from a list of existing people.
 * Call once per batch to avoid repeated full-table scans.
 */
export function buildPersonIndex(people: PersonCandidate[]) {
  const nameCompanyIndex = new Map<string, number>();
  const linkedinIndex = new Map<string, number>();
  const websiteIndex = new Map<string, number>();

  for (const p of people) {
    const nameKey = `${(p.fullName ?? "").toLowerCase().trim()}|${(p.company ?? "").toLowerCase().trim()}`;
    nameCompanyIndex.set(nameKey, p.id);

    if (p.linkedinUrl) {
      linkedinIndex.set(normalizeUrl(p.linkedinUrl), p.id);
    }
    if (p.websiteUrl) {
      websiteIndex.set(normalizeUrl(p.websiteUrl), p.id);
    }
  }

  return { nameCompanyIndex, linkedinIndex, websiteIndex };
}

/**
 * Canonicalize URL for dedup matching (#13 v12):
 * - Strip protocol (http/https)
 * - Strip www prefix
 * - Strip trailing slashes
 * - Strip query parameters and fragments
 * - Normalize LinkedIn profile URLs (remove locale suffixes)
 */
export function normalizeUrl(url: string): string {
  let u = url.toLowerCase().trim();
  // Strip protocol
  u = u.replace(/^https?:\/\//, "");
  // Strip www
  u = u.replace(/^www\./, "");
  // Strip query params and fragments
  u = u.replace(/[?#].*$/, "");
  // Strip trailing slashes
  u = u.replace(/\/+$/, "");
  // Normalize LinkedIn: remove locale suffixes like /en, /ru
  u = u.replace(/\/(?:en|ru|fr|de|es|pt|it|nl|ja|ko|zh-cn|zh-tw)$/i, "");
  return u;
}

/**
 * Match a candidate against existing people using multi-layer dedup:
 *   1. LinkedIn URL (exact)
 *   2. Website URL (exact)
 *   3. Name + Company (exact, case-insensitive)
 *   4. Fuzzy name match (Levenshtein, same company)
 */
export function matchPerson(
  candidate: { fullName: string; company?: string; linkedinUrl?: string; websiteUrl?: string },
  existingPeople: PersonCandidate[],
  indexes?: ReturnType<typeof buildPersonIndex>
): MatchResult {
  const idx = indexes ?? buildPersonIndex(existingPeople);

  // Layer 1: LinkedIn URL
  if (candidate.linkedinUrl) {
    const id = idx.linkedinIndex.get(normalizeUrl(candidate.linkedinUrl));
    if (id) return { matched: true, existingId: id, matchType: "linkedin" };
  }

  // Layer 2: Website URL
  if (candidate.websiteUrl) {
    const id = idx.websiteIndex.get(normalizeUrl(candidate.websiteUrl));
    if (id) return { matched: true, existingId: id, matchType: "website" };
  }

  // Layer 3: Exact name + company
  const nameKey = `${candidate.fullName.toLowerCase().trim()}|${(candidate.company ?? "").toLowerCase().trim()}`;
  const exactId = idx.nameCompanyIndex.get(nameKey);
  if (exactId) return { matched: true, existingId: exactId, matchType: "exact_name" };

  // Layer 4: Fuzzy name match (same company or no company specified)
  const fuzzyMatch = existingPeople.find(
    (e) =>
      isFuzzyNameMatch(e.fullName, candidate.fullName) &&
      (!candidate.company || (e.company ?? "").toLowerCase().trim() === (candidate.company ?? "").toLowerCase().trim())
  );
  if (fuzzyMatch) return { matched: true, existingId: fuzzyMatch.id, matchType: "fuzzy_name" };

  return { matched: false };
}

// ─── Person Similarity Scoring (#14 v13) ────────────────────────

export interface PersonSimilarityScore {
  overall: number;       // 0.0 - 1.0 composite score
  nameScore: number;     // 0.0 - 1.0
  companyScore: number;  // 0.0 - 1.0
  urlScore: number;      // 0.0 or 1.0 (exact match)
  matchType: "linkedin" | "website" | "exact_name" | "fuzzy_name" | "no_match";
}

/**
 * Score how similar two person records are (#14 v13).
 * Returns a composite score (0.0-1.0) with breakdown by dimension.
 *
 * Weights: name (0.40), company (0.25), URL (0.35)
 */
export function scorePersonSimilarity(
  personA: { fullName: string; company?: string | null; linkedinUrl?: string | null; websiteUrl?: string | null },
  personB: { fullName: string; company?: string | null; linkedinUrl?: string | null; websiteUrl?: string | null }
): PersonSimilarityScore {
  // URL match (strongest signal)
  let urlScore = 0;
  let matchType: PersonSimilarityScore["matchType"] = "no_match";

  if (personA.linkedinUrl && personB.linkedinUrl) {
    if (normalizeUrl(personA.linkedinUrl) === normalizeUrl(personB.linkedinUrl)) {
      urlScore = 1.0;
      matchType = "linkedin";
    }
  }
  if (urlScore === 0 && personA.websiteUrl && personB.websiteUrl) {
    if (normalizeUrl(personA.websiteUrl) === normalizeUrl(personB.websiteUrl)) {
      urlScore = 1.0;
      matchType = "website";
    }
  }

  // Name similarity
  const nameScore = nameSimilarity(personA.fullName, personB.fullName);
  if (matchType === "no_match" && nameScore >= 0.85) {
    matchType = nameScore === 1.0 ? "exact_name" : "fuzzy_name";
  }

  // Company similarity
  const compA = (personA.company ?? "").toLowerCase().trim();
  const compB = (personB.company ?? "").toLowerCase().trim();
  let companyScore = 0;
  if (compA && compB) {
    if (compA === compB) {
      companyScore = 1.0;
    } else if (compA.includes(compB) || compB.includes(compA)) {
      companyScore = 0.8;
    } else {
      companyScore = nameSimilarity(compA, compB);
    }
  } else if (!compA && !compB) {
    companyScore = 0.5; // Both empty — neutral
  }

  // Composite: name (0.40), company (0.25), URL (0.35)
  const overall = Math.round((nameScore * 0.40 + companyScore * 0.25 + urlScore * 0.35) * 100) / 100;

  return { overall, nameScore, companyScore, urlScore, matchType };
}

/**
 * Find a person by name (exact or fuzzy) from a list.
 * Used by command.service for "find person by name" lookups.
 */
export function findPersonByNameFuzzy(
  name: string,
  people: PersonCandidate[]
): PersonCandidate | null {
  // Exact match first
  const exact = people.find(
    (p) => p.fullName.toLowerCase().trim() === name.toLowerCase().trim()
  );
  if (exact) return exact;

  // Fuzzy match
  const fuzzy = people.find((p) => isFuzzyNameMatch(p.fullName, name));
  return fuzzy ?? null;
}
