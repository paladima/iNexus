import { describe, it, expect } from "vitest";
import {
  getRoleSynonyms,
  getSkillSynonyms,
  expandQueryWithSynonyms,
  hasSynonyms,
} from "./skillSynonyms";

describe("Skill Synonym Engine (#8 v12)", () => {
  describe("getRoleSynonyms", () => {
    it("returns synonyms for instructor", () => {
      const syns = getRoleSynonyms("instructor");
      expect(syns.length).toBeGreaterThan(0);
      expect(syns).toContain("trainer");
      expect(syns).toContain("teacher");
    });

    it("returns synonyms for consultant", () => {
      const syns = getRoleSynonyms("consultant");
      expect(syns).toContain("advisor");
      expect(syns).toContain("specialist");
    });

    it("returns synonyms for attorney", () => {
      const syns = getRoleSynonyms("attorney");
      expect(syns).toContain("lawyer");
    });

    it("is case-insensitive", () => {
      const syns = getRoleSynonyms("INSTRUCTOR");
      expect(syns.length).toBeGreaterThan(0);
    });

    it("returns empty array for unknown role", () => {
      expect(getRoleSynonyms("astronaut")).toEqual([]);
    });

    it("respects limit parameter", () => {
      const syns = getRoleSynonyms("instructor", 2);
      expect(syns.length).toBeLessThanOrEqual(2);
    });
  });

  describe("getSkillSynonyms", () => {
    it("returns synonyms for welding", () => {
      const syns = getSkillSynonyms("welding");
      expect(syns.length).toBeGreaterThan(0);
      expect(syns).toContain("metal fabrication");
    });

    it("returns synonyms for HVAC", () => {
      const syns = getSkillSynonyms("HVAC");
      expect(syns).toContain("heating and cooling");
    });

    it("returns empty array for unknown skill", () => {
      expect(getSkillSynonyms("quantum computing")).toEqual([]);
    });
  });

  describe("expandQueryWithSynonyms", () => {
    it("expands query with role synonyms", () => {
      const variants = expandQueryWithSynonyms("welding instructor florida");
      expect(variants.length).toBeGreaterThan(0);
      // Should contain variants with trainer, teacher, etc.
      const hasTrainer = variants.some((v) => v.toLowerCase().includes("trainer"));
      const hasTeacher = variants.some((v) => v.toLowerCase().includes("teacher"));
      expect(hasTrainer || hasTeacher).toBe(true);
    });

    it("expands query with skill synonyms", () => {
      const variants = expandQueryWithSynonyms("HVAC technician");
      expect(variants.length).toBeGreaterThan(0);
    });

    it("returns empty for queries with no known synonyms", () => {
      const variants = expandQueryWithSynonyms("quantum physicist mars");
      expect(variants).toEqual([]);
    });

    it("respects maxVariants", () => {
      const variants = expandQueryWithSynonyms("welding instructor florida", 2);
      expect(variants.length).toBeLessThanOrEqual(2);
    });
  });

  describe("hasSynonyms", () => {
    it("returns true for known roles", () => {
      expect(hasSynonyms("instructor")).toBe(true);
      expect(hasSynonyms("consultant")).toBe(true);
      expect(hasSynonyms("attorney")).toBe(true);
    });

    it("returns true for known skills", () => {
      expect(hasSynonyms("welding")).toBe(true);
      expect(hasSynonyms("HVAC")).toBe(true);
    });

    it("returns false for unknown terms", () => {
      expect(hasSynonyms("astronaut")).toBe(false);
    });
  });
});
