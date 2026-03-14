/**
 * v19 Tests — AI Contact Ingest
 *
 * Tests for input type detection, extracted contact schema, and ingest pipeline.
 */
import { describe, it, expect } from "vitest";
import { detectInputType } from "./ingest.service";
import type { ExtractedContact, IngestResult, DuplicateInfo, InputType } from "./ingest.service";

describe("v19 — AI Contact Ingest", () => {
  describe("detectInputType", () => {
    it("detects LinkedIn URLs", () => {
      expect(detectInputType("https://linkedin.com/in/john-doe")).toBe("linkedin_url");
      expect(detectInputType("linkedin.com/in/john-doe")).toBe("linkedin_url");
      expect(detectInputType("https://www.linkedin.com/in/jane-smith")).toBe("linkedin_url");
    });

    it("detects email addresses", () => {
      expect(detectInputType("john@acme.com")).toBe("email");
      expect(detectInputType("jane.doe@company.org")).toBe("email");
    });

    it("detects phone numbers", () => {
      expect(detectInputType("+1 415 555 2233")).toBe("phone");
      expect(detectInputType("(415) 555-2233")).toBe("phone");
      expect(detectInputType("+7 999 123 4567")).toBe("phone");
    });

    it("detects free text", () => {
      expect(detectInputType("Malcolm Nowlin CEO at Acme")).toBe("free_text");
      expect(detectInputType("Met John at the conference, he works at Google")).toBe("free_text");
    });

    it("handles edge cases", () => {
      expect(detectInputType("  https://linkedin.com/in/test  ")).toBe("linkedin_url");
      expect(detectInputType("  john@test.com  ")).toBe("email");
      expect(detectInputType("just a name")).toBe("free_text");
    });

    it("prioritizes LinkedIn over free text when URL is present", () => {
      expect(detectInputType("https://linkedin.com/in/john-doe CEO")).toBe("linkedin_url");
    });
  });

  describe("ExtractedContact type shape", () => {
    it("has required fields", () => {
      const contact: ExtractedContact = {
        fullName: "John Doe",
        confidence: 85,
        fieldConfidence: { fullName: 95, title: 70 },
        inputType: "free_text",
        rawInput: "John Doe CEO at Acme",
      };
      expect(contact.fullName).toBe("John Doe");
      expect(contact.confidence).toBe(85);
      expect(contact.inputType).toBe("free_text");
    });

    it("supports optional fields", () => {
      const contact: ExtractedContact = {
        fullName: "Jane Smith",
        title: "CTO",
        company: "TechCorp",
        email: "jane@techcorp.com",
        phone: "+1 555 0123",
        linkedinUrl: "https://linkedin.com/in/jane-smith",
        location: "San Francisco",
        websiteUrl: "https://techcorp.com",
        confidence: 92,
        fieldConfidence: {},
        inputType: "linkedin_url",
        rawInput: "https://linkedin.com/in/jane-smith",
      };
      expect(contact.title).toBe("CTO");
      expect(contact.company).toBe("TechCorp");
      expect(contact.email).toBe("jane@techcorp.com");
    });
  });

  describe("DuplicateInfo type shape", () => {
    it("represents a match", () => {
      const dup: DuplicateInfo = {
        matched: true,
        existingId: 42,
        matchType: "linkedin",
        existingPerson: { id: 42, fullName: "John Doe", company: "Acme" },
      };
      expect(dup.matched).toBe(true);
      expect(dup.existingId).toBe(42);
    });

    it("represents no match", () => {
      const dup: DuplicateInfo = { matched: false };
      expect(dup.matched).toBe(false);
      expect(dup.existingId).toBeUndefined();
    });
  });

  describe("IngestResult type shape", () => {
    it("combines extracted contact and duplicate info", () => {
      const result: IngestResult = {
        extracted: {
          fullName: "Test Person",
          confidence: 75,
          fieldConfidence: {},
          inputType: "email",
          rawInput: "test@example.com",
        },
        duplicateMatch: null,
        isDuplicate: false,
      };
      expect(result.isDuplicate).toBe(false);
      expect(result.extracted.fullName).toBe("Test Person");
    });
  });

  describe("InputType values", () => {
    it("covers all supported types", () => {
      const types: InputType[] = ["linkedin_url", "email", "phone", "free_text"];
      expect(types).toHaveLength(4);
      types.forEach(t => expect(typeof t).toBe("string"));
    });
  });

  describe("ingest service exports", () => {
    it("exports all required functions", async () => {
      const mod = await import("./ingest.service");
      expect(typeof mod.detectInputType).toBe("function");
      expect(typeof mod.extractContact).toBe("function");
      expect(typeof mod.checkDuplicate).toBe("function");
      expect(typeof mod.ingestContact).toBe("function");
    });
  });
});
