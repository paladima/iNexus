/**
 * v15 Code Review Tests — Voice Ambiguity Resolution (#23), ENV Reference (#30)
 */
import { describe, it, expect } from "vitest";
import { nameSimilarity, isFuzzyNameMatch } from "../utils/fuzzyMatch";
import { scorePersonSimilarity } from "../utils/personMatcher";

// ─── Voice Ambiguity Resolution (#23) ────────────────────────────

describe("Voice Ambiguity Resolution — candidate scoring", () => {
  it("ranks exact match highest", () => {
    const candidates = [
      { name: "John Smith", similarity: nameSimilarity("John Smith", "John Smith") },
      { name: "Jon Smith", similarity: nameSimilarity("John Smith", "Jon Smith") },
      { name: "John Smyth", similarity: nameSimilarity("John Smith", "John Smyth") },
    ];
    const sorted = candidates.sort((a, b) => b.similarity - a.similarity);
    expect(sorted[0].name).toBe("John Smith");
    expect(sorted[0].similarity).toBe(1.0);
  });

  it("returns multiple candidates above 0.5 threshold", () => {
    const names = ["John Smith", "Jon Smith", "John Smyth", "Jane Smith", "Bob Jones"];
    const query = "John Smith";
    const scored = names
      .map((n) => ({ name: n, similarity: nameSimilarity(query, n) }))
      .filter((c) => c.similarity >= 0.5)
      .sort((a, b) => b.similarity - a.similarity);

    // John Smith (1.0), Jon Smith (~0.90), John Smyth (~0.80), Jane Smith (~0.80)
    expect(scored.length).toBeGreaterThanOrEqual(3);
    expect(scored[0].name).toBe("John Smith");
    expect(scored[0].similarity).toBe(1.0);
  });

  it("filters out completely unrelated names", () => {
    const query = "Alexander Petrov";
    const candidates = ["Bob Jones", "Maria Garcia", "Li Wei"];
    const scored = candidates
      .map((n) => ({ name: n, similarity: nameSimilarity(query, n) }))
      .filter((c) => c.similarity >= 0.5);

    expect(scored.length).toBe(0);
  });

  it("auto-resolve threshold: single strong match >= 0.85", () => {
    const query = "Jon Smith";
    const candidates = [
      { name: "John Smith", similarity: nameSimilarity(query, "John Smith") },
      { name: "Bob Jones", similarity: nameSimilarity(query, "Bob Jones") },
    ];
    const strong = candidates.filter((c) => c.similarity >= 0.85);
    // "Jon Smith" vs "John Smith" should be >= 0.85
    expect(strong.length).toBe(1);
    expect(strong[0].name).toBe("John Smith");
  });

  it("multiple strong matches trigger ambiguity UI", () => {
    // Two very similar names that both score high
    const query = "John S";
    const candidates = [
      { name: "John S", similarity: nameSimilarity(query, "John S") },
      { name: "John S.", similarity: nameSimilarity(query, "John S.") },
    ];
    const strong = candidates.filter((c) => c.similarity >= 0.85);
    // Both should be strong matches
    expect(strong.length).toBe(2);
  });
});

describe("Voice Ambiguity Resolution — person similarity integration", () => {
  it("scorePersonSimilarity helps disambiguate by company", () => {
    const voiceName = { fullName: "John Smith", company: "Google" };
    const candidate1 = { fullName: "John Smith", company: "Google" };
    const candidate2 = { fullName: "John Smith", company: "Apple" };

    const score1 = scorePersonSimilarity(voiceName, candidate1);
    const score2 = scorePersonSimilarity(voiceName, candidate2);

    expect(score1.overall).toBeGreaterThan(score2.overall);
    expect(score1.companyScore).toBe(1.0);
    expect(score2.companyScore).toBeLessThan(0.5);
  });

  it("LinkedIn URL match is strongest signal", () => {
    const voicePerson = { fullName: "John Smith", linkedinUrl: "linkedin.com/in/johnsmith" };
    const candidate = { fullName: "Jonathan Smith", linkedinUrl: "linkedin.com/in/johnsmith/" };

    const score = scorePersonSimilarity(voicePerson, candidate);
    expect(score.urlScore).toBe(1.0);
    expect(score.matchType).toBe("linkedin");
    expect(score.overall).toBeGreaterThan(0.6);
  });
});

describe("Voice Ambiguity Resolution — edge cases", () => {
  it("empty name returns no candidates", () => {
    const query = "";
    const candidates = ["John Smith", "Jane Doe"]
      .map((n) => ({ name: n, similarity: nameSimilarity(query, n) }))
      .filter((c) => c.similarity >= 0.5);
    expect(candidates.length).toBe(0);
  });

  it("handles names with different casing", () => {
    const sim = nameSimilarity("JOHN SMITH", "john smith");
    expect(sim).toBe(1.0);
  });

  it("handles names with prefixes/suffixes", () => {
    const sim = nameSimilarity("Dr. John Smith", "John Smith");
    expect(sim).toBe(1.0);
  });

  it("handles reversed name order", () => {
    const match = isFuzzyNameMatch("Smith John", "John Smith");
    expect(match).toBe(true);
  });
});
