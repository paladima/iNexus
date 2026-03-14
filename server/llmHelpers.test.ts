import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  safeParseJson,
  parseLLMContent,
  parseLLMWithSchema,
  dailyBriefSchema,
  personSummarySchema,
  draftSchema,
  voiceIntentSchema,
  intentDecompositionSchema,
  aiCommandSchema,
} from "./llmHelpers";

// ─── safeParseJson ─────────────────────────────────────────────

describe("safeParseJson", () => {
  it("parses valid JSON string", () => {
    const result = safeParseJson('{"name": "John"}', "test", null);
    expect(result).toEqual({ name: "John" });
  });

  it("returns fallback for invalid JSON", () => {
    const result = safeParseJson("not json", "test", { fallback: true });
    expect(result).toEqual({ fallback: true });
  });

  it("returns fallback for invalid JSON with null fallback", () => {
    const result = safeParseJson("not json", "test", null);
    expect(result).toBeNull();
  });

  it("handles empty string", () => {
    const result = safeParseJson("", "test", { empty: true });
    expect(result).toEqual({ empty: true });
  });

  it("handles null input", () => {
    const result = safeParseJson(null as unknown as string, "test", { x: 1 });
    expect(result).toEqual({ x: 1 });
  });

  it("handles markdown code block wrapper gracefully", () => {
    // safeParseJson doesn't strip markdown, it returns fallback
    const result = safeParseJson('```json\n{"key": "value"}\n```', "test", { key: "fallback" });
    expect(result).toEqual({ key: "fallback" });
  });

  it("parses nested JSON objects", () => {
    const result = safeParseJson('{"a": {"b": [1, 2, 3]}}', "test");
    expect(result).toEqual({ a: { b: [1, 2, 3] } });
  });
});

// ─── parseLLMContent ───────────────────────────────────────────

describe("parseLLMContent", () => {
  it("extracts content from LLM response", () => {
    const response = {
      choices: [{ message: { content: '{"greeting": "Hello"}' } }],
    };
    const result = parseLLMContent(response, "test", { greeting: "" });
    expect(result).toEqual({ greeting: "Hello" });
  });

  it("returns fallback when response has no choices", () => {
    const response = { choices: [] };
    const result = parseLLMContent(response, "test", { greeting: "default" });
    expect(result).toEqual({ greeting: "default" });
  });

  it("returns fallback when content is null", () => {
    const response = { choices: [{ message: { content: null } }] };
    const result = parseLLMContent(response, "test", { x: 42 });
    expect(result).toEqual({ x: 42 });
  });

  it("returns fallback when content is invalid JSON", () => {
    const response = { choices: [{ message: { content: "not json" } }] };
    const result = parseLLMContent(response, "test", { fallback: true });
    expect(result).toEqual({ fallback: true });
  });
});

// ─── parseLLMWithSchema ────────────────────────────────────────

describe("parseLLMWithSchema", () => {
  it("validates and returns data matching schema", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const response = {
      choices: [{ message: { content: '{"name": "Alice", "age": 30}' } }],
    };
    const result = parseLLMWithSchema(response, schema, "test", { name: "", age: 0 });
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("returns fallback when schema validation fails", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const response = {
      choices: [{ message: { content: '{"name": 123}' } }],
    };
    const result = parseLLMWithSchema(response, schema, "test", { name: "default", age: 0 });
    expect(result).toEqual({ name: "default", age: 0 });
  });

  it("returns fallback for empty response", () => {
    const schema = z.object({ x: z.string() });
    const response = { choices: [] };
    const result = parseLLMWithSchema(response, schema, "test", { x: "fallback" });
    expect(result).toEqual({ x: "fallback" });
  });
});

// ─── Schema validation ────────────────────────────────────────

describe("dailyBriefSchema", () => {
  it("validates correct daily brief", () => {
    const data = {
      greeting: "Good morning!",
      items: [{ title: "Follow up", description: "Call John", priority: "high", action: "call" }],
      summary: "You have 3 tasks today.",
    };
    const result = dailyBriefSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts missing greeting with default", () => {
    const data = { items: [], summary: "test" };
    const result = dailyBriefSchema.safeParse(data);
    // greeting has .optional().default("") so it should succeed
    expect(result.success).toBe(true);
  });
});

describe("personSummarySchema", () => {
  it("validates correct person summary", () => {
    const data = {
      summary: "Key contact in AI space",
      keyTopics: ["AI", "Funding"],
      relevanceScore: 0.85,
    };
    const result = personSummarySchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("draftSchema", () => {
  it("validates correct draft", () => {
    const data = { subject: "Hello", body: "Nice to meet you" };
    const result = draftSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("accepts missing body with default", () => {
    const data = { subject: "Hello" };
    const result = draftSchema.safeParse(data);
    // body has .optional().default("") so it should succeed
    expect(result.success).toBe(true);
  });
});

describe("voiceIntentSchema", () => {
  it("validates correct voice intent", () => {
    const data = {
      people: [{ name: "John", action: "follow_up" }],
      tasks: [{ title: "Follow up", dueDate: "tomorrow" }],
      notes: [{ personName: "John", content: "Interested in AI" }],
      reminders: [{ title: "Call John", when: "3pm" }],
    };
    const result = voiceIntentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates empty arrays", () => {
    const data = { people: [], tasks: [], notes: [], reminders: [] };
    const result = voiceIntentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("intentDecompositionSchema", () => {
  it("validates correct intent decomposition", () => {
    const data = {
      topic: "AI founders",
      role: "CEO",
      geo: "San Francisco",
      industry: "AI",
      speaker: true,
      negatives: ["recruiters"],
      queryVariants: ["AI startup founders", "AI company CEOs"],
    };
    const result = intentDecompositionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("aiCommandSchema", () => {
  it("validates correct AI command response", () => {
    const data = {
      action: "search",
      params: { query: "AI investors" },
      response: "Searching for AI investors...",
    };
    const result = aiCommandSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
