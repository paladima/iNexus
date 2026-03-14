/**
 * Action Dispatcher (v16)
 *
 * Single entry point for executing any registered action.
 * Handles input validation, error wrapping, and activity logging.
 *
 * Usage:
 *   const result = await dispatch({ actionId: "task.create", input: {...}, source: "voice" }, userId);
 */
import { getAction, hasAction } from "./action.registry";
import type { ActionContext, ActionResult, DispatchRequest } from "./action.types";
import { dispatchRequestSchema } from "./action.types";
import * as repo from "../repositories";

/**
 * Dispatch an action by ID.
 *
 * 1. Validates the dispatch request shape
 * 2. Looks up the action in the registry
 * 3. Validates the action-specific input via its zod schema
 * 4. Runs the action
 * 5. Logs the dispatch to the activity timeline
 */
export async function dispatch(
  userId: number,
  request: DispatchRequest
): Promise<ActionResult> {
  // 1. Validate dispatch request envelope
  const parsed = dispatchRequestSchema.parse(request);

  // 2. Look up action
  if (!hasAction(parsed.actionId)) {
    return {
      success: false,
      message: `Unknown action: "${parsed.actionId}". Available: ${listAvailableActions().join(", ")}`,
    };
  }

  const action = getAction(parsed.actionId)!;

  // 3. Validate action-specific input
  let validatedInput: unknown;
  try {
    validatedInput = action.inputSchema.parse(parsed.input);
  } catch (err) {
    return {
      success: false,
      message: `Invalid input for "${parsed.actionId}": ${(err as Error).message}`,
    };
  }

  // 4. Build context
  const ctx: ActionContext = {
    userId,
    source: parsed.source,
    meta: parsed.meta,
  };

  // 5. Execute
  const startMs = Date.now();
  let result: ActionResult;
  try {
    result = await action.run(ctx, validatedInput);
  } catch (err) {
    result = {
      success: false,
      message: `Action "${parsed.actionId}" failed: ${(err as Error).message}`,
    };
  }
  const durationMs = Date.now() - startMs;

  // 6. Log dispatch to activity timeline
  try {
    await repo.logActivity(userId, {
      activityType: "action_dispatch",
      title: `${action.label}: ${result.message}`,
      metadataJson: {
        actionId: parsed.actionId,
        source: parsed.source,
        success: result.success,
        durationMs,
        mode: action.mode,
        ...(result.jobId ? { jobId: result.jobId } : {}),
      },
    });
  } catch {
    // Activity logging is best-effort — don't fail the action
  }

  return result;
}

/** Convenience: list all available action IDs (for error messages, command bar hints). */
function listAvailableActions(): string[] {
  const { listActionIds } = require("./action.registry");
  return listActionIds();
}

/**
 * Batch dispatch — run the same action for multiple inputs.
 * Returns per-item results. Failures don't stop the batch.
 */
export async function batchDispatch(
  userId: number,
  actionId: string,
  inputs: Record<string, unknown>[],
  source: DispatchRequest["source"] = "bulk"
): Promise<{ results: ActionResult[]; successCount: number; failCount: number }> {
  const results: ActionResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const input of inputs) {
    const result = await dispatch(userId, { actionId, input, source });
    results.push(result);
    if (result.success) successCount++;
    else failCount++;
  }

  return { results, successCount, failCount };
}
