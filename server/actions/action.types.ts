/**
 * Action Registry — Type Definitions (v16)
 *
 * Every business action in iNexus is represented as an ActionDefinition.
 * Any interface (command bar, voice, bulk toolbar, opportunity buttons, UI buttons)
 * dispatches through the same registry, ensuring a single code path per action.
 *
 * Architecture:
 *   UI / Voice / Command / Worker / Bulk
 *           ↓
 *     Action Registry (dispatch)
 *           ↓
 *        Services
 *           ↓
 *   Repositories / Providers / Jobs
 */
import { z } from "zod";

// ─── Execution Mode ─────────────────────────────────────────────
export type ActionMode = "sync" | "async";

// ─── Action Context (injected by dispatcher) ────────────────────
export interface ActionContext {
  userId: number;
  /** Where the action was triggered from */
  source: "command" | "voice" | "bulk" | "ui" | "opportunity" | "worker" | "api";
  /** Optional metadata from the caller */
  meta?: Record<string, unknown>;
}

// ─── Action Result ──────────────────────────────────────────────
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  /** For async actions, the job ID to poll */
  jobId?: number;
  /** Human-readable summary of what happened */
  message: string;
  /** Errors (non-fatal) that occurred during execution */
  warnings?: string[];
}

// ─── Action Definition ──────────────────────────────────────────
export interface ActionDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique action ID, e.g. "people.save", "task.create_followup" */
  id: string;
  /** Human-readable label for UI display */
  label: string;
  /** Short description */
  description: string;
  /** Whether the action runs synchronously or enqueues a background job */
  mode: ActionMode;
  /** Zod schema for input validation */
  inputSchema: z.ZodType<TInput>;
  /** Execute the action */
  run: (ctx: ActionContext, input: TInput) => Promise<ActionResult<TOutput>>;
}

// ─── Registry Map Type ──────────────────────────────────────────
export type ActionRegistryMap = Record<string, ActionDefinition<any, any>>;

// ─── Dispatch Request (from frontend / tRPC) ────────────────────
export const dispatchRequestSchema = z.object({
  actionId: z.string("actionId is required").min(1, "actionId must not be empty"),
  input: z.record(z.string(), z.unknown()).default({}),
  source: z.enum(["command", "voice", "bulk", "ui", "opportunity", "worker", "api"] as const).default("ui"),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type DispatchRequest = z.infer<typeof dispatchRequestSchema>;
