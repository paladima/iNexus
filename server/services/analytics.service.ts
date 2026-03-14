/**
 * Analytics Service (v17 — Stabilization Sprint)
 *
 * Lightweight product analytics for tracking user behavior.
 * Events are logged to the activity table (reusing existing infrastructure)
 * and can be exported for analysis.
 *
 * Core events:
 *   search_submitted, people_saved, list_created, draft_generated,
 *   task_created, voice_uploaded, opportunity_acted, command_executed,
 *   action_dispatched
 */
import * as activityRepo from "../repositories/activity.repo";

export type AnalyticsEvent =
  | "search_submitted"
  | "people_saved"
  | "list_created"
  | "draft_generated"
  | "task_created"
  | "voice_uploaded"
  | "opportunity_acted"
  | "command_executed"
  | "action_dispatched"
  | "page_viewed"
  | "bulk_action"
  | "voice_confirmed"
  | "job_completed"
  | "job_failed";

export interface EventMetadata {
  /** Action ID (for action_dispatched events) */
  actionId?: string;
  /** Source of the action (command, voice, bulk, ui, etc.) */
  source?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Number of items affected */
  itemCount?: number;
  /** Search query (for search_submitted) */
  query?: string;
  /** Result count */
  resultCount?: number;
  /** Entity type and ID */
  entityType?: string;
  entityId?: number;
  /** Success/failure */
  success?: boolean;
  /** Error message if failed */
  error?: string;
  /** Any additional context */
  [key: string]: unknown;
}

/**
 * Track a product analytics event.
 * Persists to the activity table for unified timeline + analytics.
 */
export async function trackEvent(
  userId: number,
  event: AnalyticsEvent,
  metadata?: EventMetadata
): Promise<void> {
  try {
    await activityRepo.logActivity(userId, {
      activityType: `analytics:${event}`,
      title: formatEventTitle(event, metadata),
      metadataJson: {
        event,
        ...metadata,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    // Analytics should never break the main flow
    console.error(`[Analytics] Failed to track ${event}:`, (err as Error).message);
  }
}

/**
 * Track action dispatch events automatically.
 * Called by the action dispatcher after every dispatch.
 */
export async function trackActionDispatch(
  userId: number,
  actionId: string,
  source: string,
  success: boolean,
  durationMs: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Map action IDs to specific analytics events
  const eventMap: Record<string, AnalyticsEvent> = {
    "people.save": "people_saved",
    "list.add_people": "bulk_action",
    "draft.generate": "draft_generated",
    "task.create": "task_created",
    "task.create_followup": "task_created",
    "voice.confirm_actions": "voice_confirmed",
    "opportunity.act": "opportunity_acted",
  };

  const specificEvent = eventMap[actionId];

  // Always track the generic action_dispatched event
  await trackEvent(userId, "action_dispatched", {
    actionId,
    source,
    success,
    durationMs,
    ...metadata,
  });

  // Also track the specific event if mapped
  if (specificEvent) {
    await trackEvent(userId, specificEvent, {
      actionId,
      source,
      success,
      durationMs,
      ...metadata,
    });
  }
}

/**
 * Format a human-readable title for the activity timeline.
 */
function formatEventTitle(event: AnalyticsEvent, metadata?: EventMetadata): string {
  switch (event) {
    case "search_submitted":
      return `Searched: ${metadata?.query ?? "unknown query"}`;
    case "people_saved":
      return `Saved ${metadata?.itemCount ?? 1} contact(s)`;
    case "list_created":
      return "Created a new list";
    case "draft_generated":
      return "Generated outreach draft";
    case "task_created":
      return "Created a task";
    case "voice_uploaded":
      return "Uploaded voice memo";
    case "voice_confirmed":
      return `Confirmed voice actions`;
    case "opportunity_acted":
      return "Acted on opportunity";
    case "command_executed":
      return `Command: ${metadata?.query ?? ""}`;
    case "action_dispatched":
      return `Action: ${metadata?.actionId ?? "unknown"} via ${metadata?.source ?? "ui"}`;
    case "page_viewed":
      return `Viewed page`;
    case "bulk_action":
      return `Bulk action: ${metadata?.itemCount ?? 0} items`;
    case "job_completed":
      return `Job completed (${metadata?.durationMs ?? 0}ms)`;
    case "job_failed":
      return `Job failed: ${metadata?.error ?? "unknown error"}`;
    default:
      return event;
  }
}
