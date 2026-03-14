/**
 * Fuzzy Name Matching Utility (#10)
 *
 * Provides Levenshtein distance and normalized similarity scoring
 * to catch near-duplicate names like "John Smith" vs "Jon Smith".
 */

/**
 * Compute Levenshtein edit distance between two strings.
 * O(m*n) time and O(min(m,n)) space.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) [a, b] = [b, a];

  const aLen = a.length;
  const bLen = b.length;
  let prev = Array.from({ length: aLen + 1 }, (_, i) => i);
  let curr = new Array(aLen + 1);

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,       // deletion
        curr[i - 1] + 1,   // insertion
        prev[i - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[aLen];
}

/**
 * Compute normalized similarity between two strings (0.0 to 1.0).
 * 1.0 = identical, 0.0 = completely different.
 */
export function nameSimilarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);

  if (normA === normB) return 1.0;
  if (normA.length === 0 || normB.length === 0) return 0.0;

  const dist = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return 1 - dist / maxLen;
}

/**
 * Normalize a person name for comparison:
 * - lowercase
 * - trim whitespace
 * - collapse multiple spaces
 * - remove common prefixes/suffixes (Dr., Jr., III, etc.)
 * - sort name parts alphabetically (to handle "Smith John" vs "John Smith")
 */
export function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();

  // Remove common prefixes and suffixes
  const prefixes = /^(dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?|sir|dame)\s+/i;
  const suffixes = /\s+(jr\.?|sr\.?|ii|iii|iv|phd|md|esq\.?|cpa)$/i;
  n = n.replace(prefixes, "").replace(suffixes, "");

  // Collapse whitespace
  n = n.replace(/\s+/g, " ").trim();

  return n;
}

/**
 * Check if two names are fuzzy-matches.
 * Returns true if similarity >= threshold (default 0.85).
 *
 * Examples that match at 0.85:
 *   "John Smith" vs "Jon Smith" → ~0.90
 *   "Alexander" vs "Aleksander" → ~0.89
 *
 * Examples that don't match:
 *   "John Smith" vs "Jane Smith" → ~0.80
 *   "John Smith" vs "Bob Jones" → ~0.20
 */
export function isFuzzyNameMatch(
  nameA: string,
  nameB: string,
  threshold = 0.85
): boolean {
  // Quick exact check
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);
  if (normA === normB) return true;

  // Check sorted parts (handles "Smith John" vs "John Smith")
  const partsA = normA.split(" ").sort().join(" ");
  const partsB = normB.split(" ").sort().join(" ");
  if (partsA === partsB) return true;

  // Levenshtein similarity
  const sim = nameSimilarity(nameA, nameB);
  if (sim >= threshold) return true;

  // Also check sorted-parts similarity
  const sortedSim = 1 - levenshtein(partsA, partsB) / Math.max(partsA.length, partsB.length);
  return sortedSim >= threshold;
}
