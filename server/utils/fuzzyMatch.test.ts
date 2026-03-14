import { describe, it, expect } from "vitest";
import { levenshtein, nameSimilarity, normalizeName, isFuzzyNameMatch } from "./fuzzyMatch";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });

  it("returns length for empty vs non-empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("computes single-char edits", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
    expect(levenshtein("cat", "cats")).toBe(1);
    expect(levenshtein("cat", "at")).toBe(1);
  });

  it("computes multi-char edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("normalizeName", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  John Smith  ")).toBe("john smith");
  });

  it("removes common prefixes", () => {
    expect(normalizeName("Dr. John Smith")).toBe("john smith");
    expect(normalizeName("Mr. John Smith")).toBe("john smith");
  });

  it("removes common suffixes", () => {
    expect(normalizeName("John Smith Jr.")).toBe("john smith");
    expect(normalizeName("John Smith III")).toBe("john smith");
  });

  it("collapses whitespace", () => {
    expect(normalizeName("John   Smith")).toBe("john smith");
  });
});

describe("nameSimilarity", () => {
  it("returns 1.0 for identical names", () => {
    expect(nameSimilarity("John Smith", "John Smith")).toBe(1.0);
  });

  it("returns 1.0 for case-different names", () => {
    expect(nameSimilarity("john smith", "JOHN SMITH")).toBe(1.0);
  });

  it("returns high similarity for typos", () => {
    const sim = nameSimilarity("John Smith", "Jon Smith");
    expect(sim).toBeGreaterThan(0.85);
  });

  it("returns low similarity for different names", () => {
    const sim = nameSimilarity("John Smith", "Bob Jones");
    expect(sim).toBeLessThan(0.5);
  });
});

describe("isFuzzyNameMatch", () => {
  it("matches exact names", () => {
    expect(isFuzzyNameMatch("John Smith", "John Smith")).toBe(true);
  });

  it("matches case-insensitive", () => {
    expect(isFuzzyNameMatch("john smith", "JOHN SMITH")).toBe(true);
  });

  it("matches with prefix/suffix differences", () => {
    expect(isFuzzyNameMatch("Dr. John Smith", "John Smith")).toBe(true);
    expect(isFuzzyNameMatch("John Smith Jr.", "John Smith")).toBe(true);
  });

  it("matches reversed name order", () => {
    expect(isFuzzyNameMatch("Smith John", "John Smith")).toBe(true);
  });

  it("matches common typos", () => {
    expect(isFuzzyNameMatch("John Smith", "Jon Smith")).toBe(true);
    // Alexander vs Aleksander: similarity ~0.80, below default 0.85 threshold
    // but matches at a lower threshold
    expect(isFuzzyNameMatch("Alexander", "Aleksander", 0.75)).toBe(true);
    expect(isFuzzyNameMatch("Alexander", "Aleksander")).toBe(false);
  });

  it("rejects clearly different names", () => {
    expect(isFuzzyNameMatch("John Smith", "Bob Jones")).toBe(false);
    expect(isFuzzyNameMatch("Alice Brown", "Charlie White")).toBe(false);
  });

  it("rejects similar-length but different names", () => {
    expect(isFuzzyNameMatch("John Smith", "Jane Smith")).toBe(false);
  });

  it("handles empty strings", () => {
    expect(isFuzzyNameMatch("", "")).toBe(true);
    expect(isFuzzyNameMatch("John", "")).toBe(false);
  });

  it("respects custom threshold", () => {
    // "John" vs "Jon" — similarity ~0.75
    expect(isFuzzyNameMatch("John", "Jon", 0.7)).toBe(true);
    expect(isFuzzyNameMatch("John", "Jon", 0.9)).toBe(false);
  });
});
