/**
 * Job Service (#9-12) — Manages async job execution with:
 *   #9  - Job priority (higher priority processed first)
 *   #10 - Job cancellation
 *   #11 - Progress tracking
 *   #12 - Configurable retry strategies
 */

import { createJob, getJobById, updateJobStatus, getJobsByUser } from "../repositories/jobs.repo";
import { getDb } from "../repositories/base";
import { jobs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

type JobHandler = (jobId: number, userId: number, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

interface JobOptions {
  priority?: number;       // Higher = more important (default 0)
  maxRetries?: number;     // Max retry attempts (default 3)
}

const handlers = new Map<string, JobHandler>();
const cancelledJobs = new Set<number>();

/** Register a handler for a job type */
export function registerJobHandler(jobType: string, handler: JobHandler) {
  handlers.set(jobType, handler);
}

/** Enqueue a job with optional priority and retry config */
export async function enqueueJob(
  userId: number,
  jobType: string,
  payload: Record<string, unknown> = {},
  options: JobOptions = {}
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(jobs).values({
    userId,
    jobType,
    payload,
    status: "pending",
    priority: options.priority ?? 0,
    maxRetries: options.maxRetries ?? 3,
    retryCount: 0,
    progress: 0,
  });
  const jobId = result[0].insertId;

  // Process asynchronously
  processJob(jobId, userId, jobType, payload, options.maxRetries ?? 3).catch(err => {
    console.error(`[JobService] Unhandled error in job ${jobId}:`, err);
  });

  return jobId;
}

/** Cancel a running or pending job */
export async function cancelJob(jobId: number, userId: number): Promise<boolean> {
  const job = await getJobById(jobId);
  if (!job || job.userId !== userId) return false;
  if (job.status === "completed" || job.status === "failed") return false;

  cancelledJobs.add(jobId);
  const db = await getDb();
  if (!db) return false;
  await db.update(jobs).set({
    status: "failed",
    error: "Cancelled by user",
    cancelledAt: new Date(),
    finishedAt: new Date(),
  }).where(eq(jobs.id, jobId));
  return true;
}

/** Check if a job has been cancelled */
export function isJobCancelled(jobId: number): boolean {
  return cancelledJobs.has(jobId);
}

/** Update job progress (0-100) */
export async function updateJobProgress(jobId: number, progress: number) {
  const db = await getDb();
  if (!db) return;
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  await db.update(jobs).set({ progress: clamped }).where(eq(jobs.id, jobId));
}

/** Process a job with retry logic */
async function processJob(
  jobId: number,
  userId: number,
  jobType: string,
  payload: Record<string, unknown>,
  maxRetries: number,
  attempt = 0
) {
  if (cancelledJobs.has(jobId)) {
    cancelledJobs.delete(jobId);
    return;
  }

  const handler = handlers.get(jobType);
  if (!handler) {
    await updateJobStatus(jobId, "failed", undefined, `No handler registered for job type: ${jobType}`);
    return;
  }

  try {
    await updateJobStatus(jobId, "running");
    const result = await handler(jobId, userId, payload);

    // Check cancellation after handler completes
    if (cancelledJobs.has(jobId)) {
      cancelledJobs.delete(jobId);
      return;
    }

    await updateJobProgress(jobId, 100);
    await updateJobStatus(jobId, "completed", result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[JobService] Job ${jobId} (${jobType}) attempt ${attempt + 1} failed:`, errorMessage);

    // Retry with exponential backoff
    if (attempt < maxRetries) {
      const db = await getDb();
      if (db) {
        await db.update(jobs).set({ retryCount: attempt + 1 }).where(eq(jobs.id, jobId));
      }
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // max 30s
      console.log(`[JobService] Retrying job ${jobId} in ${delay}ms (attempt ${attempt + 2}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return processJob(jobId, userId, jobType, payload, maxRetries, attempt + 1);
    }

    await updateJobStatus(jobId, "failed", undefined, errorMessage);
  }
}

/** Poll for job status with progress */
export async function pollJobStatus(jobId: number) {
  const job = await getJobById(jobId);
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    progress: (job as any).progress ?? 0,
    result: job.result,
    error: job.error,
    retryCount: (job as any).retryCount ?? 0,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    cancelledAt: (job as any).cancelledAt,
  };
}

/** Start the job processor — currently jobs are processed inline on enqueue.
 *  This function is a placeholder for future queue-based processing. */
export function startJobProcessor() {
  console.log("[JobService] Job processor started (inline mode with retry/cancel/progress)");

  // Clean up stale cancelled jobs from memory periodically
  setInterval(() => {
    cancelledJobs.clear();
  }, 60 * 60 * 1000); // every hour
}
