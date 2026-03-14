import { z } from "zod";
import type { InvokeResult, TextContent, ImageContent, FileContent } from "./_core/llm";

/**
 * Extract text content from an LLM response message.
 * Handles both string and array content types.
 */
function extractTextContent(
  content: string | Array<TextContent | ImageContent | FileContent> | null | undefined
): string | null {
  if (!content) return null;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find((p) => p.type === "text") as TextContent | undefined;
    return textPart?.text ?? null;
  }
  return null;
}

/**
 * Safely parse JSON from LLM responses with logging and fallback.
 * #4 — Wraps all JSON.parse calls for LLM output.
 */
export function safeParseJson<T = unknown>(
  raw: string | null | undefined,
  context: string,
  fallback: T
): T {
  if (!raw) {
    console.warn(`[LLM:${context}] Empty response, using fallback`);
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[LLM:${context}] Failed to parse JSON. Raw response:`, raw);
    return fallback;
  }
}

/**
 * Parse LLM response content string safely.
 */
export function parseLLMContent<T = unknown>(
  response: InvokeResult,
  context: string,
  fallback: T
): T {
  const rawContent = response.choices[0]?.message?.content;
  const content = extractTextContent(rawContent);
  return safeParseJson(content, context, fallback);
}

/**
 * Parse and validate LLM response against a zod schema.
 * Returns validated data or fallback on failure.
 */
export function parseLLMWithSchema<T>(
  response: InvokeResult,
  schema: z.ZodType<T>,
  context: string,
  fallback: T
): T {
  const parsed = parseLLMContent(response, context, fallback);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      `[LLM:${context}] Schema validation failed:`,
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
    );
    console.warn(`[LLM:${context}] Raw parsed:`, JSON.stringify(parsed).slice(0, 500));
    return fallback;
  }
  return result.data;
}

// ─── Zod Schemas for LLM Responses (#5) ────────────────────────

/** Daily Brief */
export const dailyBriefSchema = z.object({
  greeting: z.string().optional().default(""),
  items: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional().default(""),
        priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
        action: z.string().optional().default(""),
      })
    )
    .optional()
    .default([]),
  summary: z.string().optional().default(""),
});
export type DailyBriefLLM = z.infer<typeof dailyBriefSchema>;

/** Person Summary */
export const personSummarySchema = z.object({
  summary: z.string(),
  keyTopics: z.array(z.string()).optional().default([]),
  relevanceScore: z.number().optional().default(0),
});
export type PersonSummaryLLM = z.infer<typeof personSummarySchema>;

/** Opportunity Detection */
export const opportunityDetectionSchema = z.object({
  opportunities: z
    .array(
      z.object({
        title: z.string(),
        opportunityType: z.string().optional().default("general"),
        signalSummary: z.string().optional().default(""),
        relevanceScore: z.number().optional().default(50),
        personId: z.number().optional(),
      })
    )
    .optional()
    .default([]),
});
export type OpportunityDetectionLLM = z.infer<typeof opportunityDetectionSchema>;

/** Voice Intent Parsing */
export const voiceIntentSchema = z.object({
  people: z
    .array(
      z.object({
        name: z.string(),
        action: z.string().optional().default(""),
      })
    )
    .optional()
    .default([]),
  tasks: z
    .array(
      z.object({
        title: z.string(),
        dueDate: z.string().optional(),
        priority: z.string().optional().default("medium"),
      })
    )
    .optional()
    .default([]),
  notes: z
    .array(
      z.object({
        personName: z.string().optional().default(""),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  reminders: z
    .array(
      z.object({
        title: z.string(),
        when: z.string().optional().default(""),
      })
    )
    .optional()
    .default([]),
});
export type VoiceIntentLLM = z.infer<typeof voiceIntentSchema>;

/** Draft Generation */
export const draftSchema = z.object({
  subject: z.string().optional().default(""),
  body: z.string().optional().default(""),
});
export type DraftLLM = z.infer<typeof draftSchema>;

/** Discovery Ranking */
export const discoveryRankingSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        title: z.string().optional().default(""),
        company: z.string().optional().default(""),
        relevanceScore: z.number().optional().default(50),
        matchReasons: z.array(z.string()).optional().default([]),
        roleMatch: z.number().optional().default(0),
        industryMatch: z.number().optional().default(0),
        geoMatch: z.number().optional().default(0),
        seniorityMatch: z.number().optional().default(0),
        goalAlignment: z.number().optional().default(0),
        signalStrength: z.number().optional().default(0),
      })
    )
    .optional()
    .default([]),
});
export type DiscoveryRankingLLM = z.infer<typeof discoveryRankingSchema>;

/** Intent Decomposition */
export const intentDecompositionSchema = z.object({
  topic: z.string().optional().default(""),
  role: z.string().optional().default(""),
  geo: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  speaker: z.boolean().optional().default(false),
  negatives: z.array(z.string()).optional().default([]),
  queryVariants: z.array(z.string()).optional().default([]),
});
export type IntentDecompositionLLM = z.infer<typeof intentDecompositionSchema>;

/** AI Command */
export const aiCommandSchema = z.object({
  action: z
    .enum(["search", "add_person", "create_task", "generate_draft", "navigate", "info"])
    .optional()
    .default("info"),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  response: z.string().optional().default(""),
});
export type AICommandLLM = z.infer<typeof aiCommandSchema>;
