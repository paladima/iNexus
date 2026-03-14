/**
 * Unified LLM Client (#8) — callLLM -> parse -> validate -> normalize -> log
 * Also integrates AI audit logging (#9).
 */

import { invokeLLM, type InvokeParams, type InvokeResult } from "../_core/llm";
import { safeParseJson } from "../llmHelpers";
import { logAiAction } from "../repositories";
import { z } from "zod";

// Rate limiting state
let lastLLMCall = 0;
const MIN_INTERVAL_MS = 500;

interface LLMCallOptions<T> {
  /** Descriptive name for audit logging */
  promptModule: string;
  /** The LLM invocation params */
  params: InvokeParams;
  /** Zod schema to validate the parsed JSON response */
  schema?: z.ZodType<T>;
  /** Fallback value if LLM call or parsing fails */
  fallback?: T;
  /** User ID for audit logging */
  userId?: number;
  /** Entity type for audit logging (e.g., "person", "opportunity") */
  entityType?: string;
  /** Entity ID for audit logging */
  entityId?: number;
}

interface LLMCallResult<T> {
  data: T;
  raw: string | null;
  usedFallback: boolean;
  durationMs: number;
}

/**
 * Unified LLM call with rate limiting, parsing, validation, and audit logging.
 * 
 * Usage:
 *   const { data } = await callLLM({
 *     promptModule: "person_summary",
 *     params: { messages: [...] },
 *     schema: personSummarySchema,
 *     fallback: { summary: "N/A" },
 *     userId: ctx.user.id,
 *     entityType: "person",
 *     entityId: personId,
 *   });
 */
export async function callLLM<T>(options: LLMCallOptions<T>): Promise<LLMCallResult<T>> {
  const { promptModule, params, schema, fallback, userId, entityType, entityId } = options;
  const start = Date.now();
  let usedFallback = false;
  let raw: string | null = null;
  let data: T;

  try {
    // Rate limiting
    const now = Date.now();
    const elapsed = now - lastLLMCall;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
    }
    lastLLMCall = Date.now();

    // Call LLM
    const response: InvokeResult = await invokeLLM(params);
    const rawContent = response.choices?.[0]?.message?.content;
    raw = typeof rawContent === "string" ? rawContent : 
      (Array.isArray(rawContent) ? (rawContent.find((p: any) => p.type === "text") as any)?.text ?? null : null);

    if (!raw) {
      throw new Error("Empty LLM response");
    }

    // Parse and validate
    if (schema) {
      const parsed = safeParseJson(raw, promptModule, null);
      if (parsed === null) {
        throw new Error("Failed to parse LLM JSON response");
      }
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        console.warn(`[LLM] Schema validation failed for ${promptModule}:`, validated.error.message);
        throw new Error(`Schema validation failed: ${validated.error.message}`);
      }
      data = validated.data;
    } else {
      // No schema — return raw string as T
      data = raw as unknown as T;
    }

    // Audit log success
    const durationMs = Date.now() - start;
    if (userId) {
      logAiAction(userId, {
        promptModule,
        entityType,
        entityId,
        success: true,
        usedFallback: false,
        durationMs,
      }).catch(() => {}); // fire-and-forget
    }

    return { data, raw, usedFallback: false, durationMs };

  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Audit log failure
    if (userId) {
      logAiAction(userId, {
        promptModule,
        entityType,
        entityId,
        success: false,
        usedFallback: fallback !== undefined,
        errorMessage,
        durationMs,
      }).catch(() => {}); // fire-and-forget
    }

    if (fallback !== undefined) {
      usedFallback = true;
      data = fallback;
      console.warn(`[LLM] ${promptModule} failed, using fallback:`, errorMessage);
      return { data, raw, usedFallback, durationMs };
    }

    throw error;
  }
}

/**
 * Simple LLM call that returns raw text (no JSON parsing).
 */
export async function callLLMText(options: Omit<LLMCallOptions<string>, "schema" | "fallback"> & { fallback?: string }): Promise<LLMCallResult<string>> {
  return callLLM<string>({ ...options });
}
