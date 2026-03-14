/**
 * Activity Service (#1 v11)
 * Business logic wrapper for activity logging and reconnect detection.
 */
import * as repo from "../repositories";

export async function logActivity(
  userId: number,
  data: {
    activityType: string;
    title: string;
    entityType?: string;
    entityId?: number;
    metadataJson?: Record<string, unknown>;
  }
) {
  return repo.logActivity(userId, data);
}

export async function getPeopleNeedingReconnect(userId: number, days: number = 30) {
  return repo.getPeopleNeedingReconnect(userId, days);
}
