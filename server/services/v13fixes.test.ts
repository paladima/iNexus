/**
 * v13 Tests — Intent Schema, Person Similarity Scoring, Merge Service
 */
import { describe, it, expect } from "vitest";
import type { DiscoveryIntent, DiscoveryResult, DiscoveryMeta } from "../../shared/discoverIntent.schema";
import { scorePersonSimilarity } from "../utils/personMatcher";

// ─── #5: Intent Schema Module ──────────────────────────────────
describe("DiscoveryIntent schema (#5)", () => {
  it("supports all required fields including confidence", () => {
    const intent: DiscoveryIntent = {
      topic: "machine learning engineers",
      role: "ML Engineer",
      geo: "San Francisco",
      industry: "tech",
      speaker: false,
      skills: ["PyTorch", "TensorFlow"],
      negatives: ["intern"],
      queryVariants: ["ML engineer SF", "machine learning developer Bay Area"],
      originalLanguage: "en",
      normalizedQuery: "machine learning engineers san francisco",
      domain: "tech",
      confidence: 0.92,
    };
    expect(intent.confidence).toBe(0.92);
    expect(intent.domain).toBe("tech");
    expect(intent.skills).toHaveLength(2);
  });

  it("supports optional fields as undefined", () => {
    const intent: DiscoveryIntent = { topic: "welding instructors" };
    expect(intent.confidence).toBeUndefined();
    expect(intent.role).toBeUndefined();
  });

  it("DiscoveryResult supports all fields", () => {
    const result: DiscoveryResult = {
      fullName: "John Smith",
      title: "Senior Engineer",
      company: "Google",
      location: "Mountain View",
      linkedinUrl: "https://linkedin.com/in/johnsmith",
      websiteUrl: "https://johnsmith.dev",
      email: "john@example.com",
      phone: "+1234567890",
      sourceType: "linkedin",
      relevanceScore: 0.95,
      scoring: { goalFit: 0.9, signalRecency: 0.8 },
      matchReasons: ["exact role match"],
      whyRelevant: "Senior ML engineer at top company",
      sourceQuery: "ML engineer Google",
    };
    expect(result.fullName).toBe("John Smith");
    expect(result.email).toBe("john@example.com");
  });

  it("DiscoveryMeta supports pipeline metadata", () => {
    const meta: DiscoveryMeta = {
      normalizedQuery: {
        original: "инженеры ML",
        normalized: "ML engineers",
        language: "ru",
        extractedRole: "ML Engineer",
        extractedSkills: ["machine learning"],
        extractedGeo: undefined,
      },
      intent: { topic: "ML engineers", confidence: 0.88 },
      expandedQueries: ["ML engineer", "machine learning developer", "AI engineer"],
      broadSearchUsed: false,
      totalBeforeDedupe: 45,
      totalAfterDedupe: 28,
    };
    expect(meta.normalizedQuery?.language).toBe("ru");
    expect(meta.broadSearchUsed).toBe(false);
  });
});

// ─── #14: Person Similarity Scoring ────────────────────────────
describe("scorePersonSimilarity (#14)", () => {
  it("returns 1.0 for identical records", () => {
    const person = { fullName: "John Smith", company: "Google", linkedinUrl: "https://linkedin.com/in/jsmith" };
    const score = scorePersonSimilarity(person, person);
    expect(score.overall).toBeGreaterThanOrEqual(0.9);
    expect(score.nameScore).toBe(1.0);
    expect(score.companyScore).toBe(1.0);
    expect(score.urlScore).toBe(1.0);
    expect(score.matchType).toBe("linkedin");
  });

  it("scores high for same LinkedIn URL with different names", () => {
    const a = { fullName: "John Smith", company: "Google", linkedinUrl: "https://linkedin.com/in/jsmith" };
    const b = { fullName: "Jonathan Smith", company: "Alphabet", linkedinUrl: "https://linkedin.com/in/jsmith" };
    const score = scorePersonSimilarity(a, b);
    expect(score.urlScore).toBe(1.0);
    expect(score.matchType).toBe("linkedin");
    expect(score.overall).toBeGreaterThan(0.5);
  });

  it("scores medium for fuzzy name match at same company", () => {
    const a = { fullName: "John Smith", company: "Google" };
    const b = { fullName: "Jon Smith", company: "Google" };
    const score = scorePersonSimilarity(a, b);
    expect(score.nameScore).toBeGreaterThan(0.85);
    expect(score.companyScore).toBe(1.0);
    expect(score.matchType).toBe("fuzzy_name");
    expect(score.overall).toBeGreaterThan(0.5);
  });

  it("scores low for completely different people", () => {
    const a = { fullName: "John Smith", company: "Google" };
    const b = { fullName: "Maria Garcia", company: "Amazon" };
    const score = scorePersonSimilarity(a, b);
    expect(score.overall).toBeLessThan(0.4);
    expect(score.matchType).toBe("no_match");
  });

  it("handles missing company gracefully", () => {
    const a = { fullName: "John Smith" };
    const b = { fullName: "John Smith" };
    const score = scorePersonSimilarity(a, b);
    expect(score.nameScore).toBe(1.0);
    expect(score.companyScore).toBe(0.5); // Both empty = neutral
    expect(score.matchType).toBe("exact_name");
  });

  it("handles company substring matching", () => {
    const a = { fullName: "John Smith", company: "Google LLC" };
    const b = { fullName: "John Smith", company: "Google" };
    const score = scorePersonSimilarity(a, b);
    expect(score.companyScore).toBe(0.8); // substring match
  });

  it("returns overall between 0 and 1", () => {
    const a = { fullName: "Alice", company: "X" };
    const b = { fullName: "Bob", company: "Y" };
    const score = scorePersonSimilarity(a, b);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(1);
  });
});

// ─── #15: Merge People Service ─────────────────────────────────
describe("people.merge module (#15)", () => {
  it("exports mergePeople and findDuplicates functions", async () => {
    const mod = await import("./people.merge");
    expect(typeof mod.mergePeople).toBe("function");
    expect(typeof mod.findDuplicates).toBe("function");
  });
});
