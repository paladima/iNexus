import { describe, it, expect } from "vitest";
import { buildPersonIndex, matchPerson, findPersonByNameFuzzy, type PersonCandidate } from "./personMatcher";

const people: PersonCandidate[] = [
  { id: 1, fullName: "John Smith", company: "Acme Corp", linkedinUrl: "https://linkedin.com/in/johnsmith", websiteUrl: null },
  { id: 2, fullName: "Jane Doe", company: "TechCo", linkedinUrl: null, websiteUrl: "https://janedoe.com" },
  { id: 3, fullName: "Alexander Petrov", company: "StartupXYZ", linkedinUrl: null, websiteUrl: null },
  { id: 4, fullName: "Maria Garcia", company: "HealthCorp", linkedinUrl: "https://linkedin.com/in/mariagarcia", websiteUrl: "https://mariagarcia.com" },
];

describe("buildPersonIndex", () => {
  it("builds all three indexes", () => {
    const idx = buildPersonIndex(people);
    expect(idx.nameCompanyIndex.size).toBe(4);
    expect(idx.linkedinIndex.size).toBe(2);
    expect(idx.websiteIndex.size).toBe(2);
  });

  it("normalizes URLs in indexes", () => {
    const idx = buildPersonIndex(people);
    // Should strip protocol and trailing slash
    expect(idx.linkedinIndex.has("linkedin.com/in/johnsmith")).toBe(true);
    expect(idx.websiteIndex.has("janedoe.com")).toBe(true);
  });
});

describe("matchPerson", () => {
  const indexes = buildPersonIndex(people);

  it("matches by LinkedIn URL", () => {
    const result = matchPerson(
      { fullName: "John Smith", linkedinUrl: "https://www.linkedin.com/in/johnsmith/" },
      people,
      indexes
    );
    expect(result.matched).toBe(true);
    expect(result.existingId).toBe(1);
    expect(result.matchType).toBe("linkedin");
  });

  it("matches by website URL", () => {
    const result = matchPerson(
      { fullName: "Jane D", websiteUrl: "https://www.janedoe.com/" },
      people,
      indexes
    );
    expect(result.matched).toBe(true);
    expect(result.existingId).toBe(2);
    expect(result.matchType).toBe("website");
  });

  it("matches by exact name + company", () => {
    const result = matchPerson(
      { fullName: "Alexander Petrov", company: "StartupXYZ" },
      people,
      indexes
    );
    expect(result.matched).toBe(true);
    expect(result.existingId).toBe(3);
    expect(result.matchType).toBe("exact_name");
  });

  it("matches by fuzzy name (same company)", () => {
    const result = matchPerson(
      { fullName: "Jon Smith", company: "Acme Corp" },
      people,
      indexes
    );
    expect(result.matched).toBe(true);
    expect(result.existingId).toBe(1);
    expect(result.matchType).toBe("fuzzy_name");
  });

  it("does not match completely different person", () => {
    const result = matchPerson(
      { fullName: "Bob Wilson", company: "NewCo" },
      people,
      indexes
    );
    expect(result.matched).toBe(false);
  });

  it("does not fuzzy match when company differs", () => {
    const result = matchPerson(
      { fullName: "Jon Smith", company: "DifferentCorp" },
      people,
      indexes
    );
    expect(result.matched).toBe(false);
  });

  it("LinkedIn match takes priority over name match", () => {
    const result = matchPerson(
      { fullName: "Wrong Name", linkedinUrl: "https://linkedin.com/in/johnsmith" },
      people,
      indexes
    );
    expect(result.matched).toBe(true);
    expect(result.matchType).toBe("linkedin");
    expect(result.existingId).toBe(1);
  });
});

describe("findPersonByNameFuzzy", () => {
  it("finds exact match", () => {
    const result = findPersonByNameFuzzy("John Smith", people);
    expect(result?.id).toBe(1);
  });

  it("finds fuzzy match", () => {
    const result = findPersonByNameFuzzy("Jon Smith", people);
    expect(result?.id).toBe(1);
  });

  it("returns null for no match", () => {
    const result = findPersonByNameFuzzy("Unknown Person", people);
    expect(result).toBeNull();
  });

  it("prefers exact match over fuzzy", () => {
    const result = findPersonByNameFuzzy("Jane Doe", people);
    expect(result?.id).toBe(2);
  });
});
