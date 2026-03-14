/**
 * PersonMatcher — Centralized person dedup/matching utility (#9, #10).
 *
 * Used by: discover.service, people.service, voice.service, command.service.
 * Combines exact index lookups (linkedinUrl, websiteUrl, name+company)
 * with fuzzy name matching via Levenshtein distance.
 */
import { isFuzzyNameMatch } from "./fuzzyMatch";

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

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
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
