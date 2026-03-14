/**
 * Job Service (#4-8) — Production-ready job queue:
 *   #4  - DB-only enqueue (no inline execution)
 *   #5  - DB-based cancellation (no in-memory Set)
 *   #6  - Full job model (runAfter, dedupeKey, workerId, entityType/entityId)
 *   #7  - Idempotency via dedupeKey
 *   #8  - All DB access through repo layer
 */

import * as jobRepo from "../repositories/jobs.repo";

type JobHandler = (jobId: number, userId: number, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface JobOptions {
  priority?: number;       // Higher = more important (default 0)
  maxRetries?: number;     // Max retry attempts (default 3)
  dedupeKey?: string;      // Idempotency key (userId + jobType + entityId)
  entityType?: string;     // Related entity type
  entityId?: number;       // Related entity ID
  runAfter?: Date;         // Delay execution until this time
}

const handlers = new Map<string, JobHandler>();
let workerRunning = false;
const POLL_INTERVAL_MS = 2000;
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

/** Register a handler for a job type */
export function registerJobHandler(jobType: string, handler: JobHandler) {
  handlers.set(jobType, handler);
}

/**
 * Enqueue a job — DB-only, no inline execution (#4).
 * With deduplication: if a pending/running job with same dedupeKey exists, return its ID (#7).
 */
export async function enqueueJob(
  userId: number,
  jobType: string,
  payload: Record<string, unknown> = {},
  options: JobOptions = {}
): Promise<number | null> {
  // Dedupe check (#7)
  const dedupeKey = options.dedupeKey ?? null;
  if (dedupeKey) {
    const existing = await jobRepo.findByDedupeKey(dedupeKey);
    if (existing && (existing.status === "pending" || existing.status === "running")) {
      console.log(`[JobService] Dedup hit for key=${dedupeKey}, returning existing job ${existing.id}`);
      return existing.id;
    }
  }

  const jobId = await jobRepo.createJobFull(userId, {
    jobType,
    payload,
    priority: options.priority ?? 0,
    maxRetries: options.maxRetries ?? 3,
    dedupeKey: dedupeKey ?? undefined,
    entityType: options.entityType,
    entityId: options.entityId,
    runAfter: options.runAfter,
  });

  return jobId;
}

/** Cancel a job — DB-based, no in-memory state (#5) */
export async function cancelJob(jobId: number, userId: number): Promise<boolean> {
  const job = await jobRepo.getJobById(jobId);
  if (!job || job.userId !== userId) return false;
  if (job.status === "completed" || job.status === "failed") return false;

  await jobRepo.cancelJob(jobId);
  return true;
}

/** Check if a job has been cancelled — reads from DB (#5) */
export async function isJobCancelled(jobId: number): Promise<boolean> {
  const job = await jobRepo.getJobById(jobId);
  return job?.cancelledAt !== null || job?.status === "failed" && job?.error === "Cancelled by user";
}

/** Update job progress (0-100) */
export async function updateJobProgress(jobId: number, progress: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  await jobRepo.updateJobProgress(jobId, clamped);
}

/** Poll for job status with full metadata */
export async function pollJobStatus(jobId: number) {
  const job = await jobRepo.getJobById(jobId);
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    progress: job.progress ?? 0,
    result: job.result,
    error: job.error,
    retryCount: job.retryCount ?? 0,
    maxRetries: job.maxRetries ?? 3,
    entityType: job.entityType,
    entityId: job.entityId,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    cancelledAt: job.cancelledAt,
  };
}

/**
 * Process a single job with retry logic.
 * Called by the worker loop, not by enqueue.
 */
async function processJob(job: jobRepo.JobRow) {
  const handler = handlers.get(job.jobType);
  if (!handler) {
    await jobRepo.failJob(job.id, `No handler registered for job type: ${job.jobType}`);
    return;
  }

  // Claim the job
  await jobRepo.claimJob(job.id, WORKER_ID);

  try {
    const result = await handler(job.id, job.userId, (job.payload ?? {}) as Record<string, unknown>);

    // Check cancellation after handler completes
    const refreshed = await jobRepo.getJobById(job.id);
    if (refreshed?.cancelledAt) return;

    await jobRepo.completeJob(job.id, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const attempt = (job.retryCount ?? 0) + 1;
    const maxRetries = job.maxRetries ?? 3;

    console.error(`[JobService] Job ${job.id} (${job.jobType}) attempt ${attempt} failed:`, errorMessage);

    if (attempt < maxRetries) {
      // Schedule retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      const runAfter = new Date(Date.now() + delay);
      await jobRepo.retryJob(job.id, attempt, errorMessage, runAfter);
      console.log(`[JobService] Retrying job ${job.id} after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
    } else {
      await jobRepo.failJob(job.id, errorMessage);
    }
  }
}

/**
 * Worker loop: polls DB for pending jobs and processes them (#4).
 * Respects priority ordering and runAfter scheduling.
 */
async function workerLoop() {
  while (workerRunning) {
    try {
      const job = await jobRepo.claimNextPendingJob(WORKER_ID);
      if (job) {
        await processJob(job);
      } else {
        // No jobs available, wait before polling again
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err) {
      console.error("[JobService] Worker loop error:", (err as Error).message);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS * 2));
    }
  }
}

/** Start the job processor — DB polling worker (#4) */
export function startJobProcessor() {
  if (workerRunning) return;
  workerRunning = true;
  console.log(`[JobService] Job worker started (id=${WORKER_ID}, poll=${POLL_INTERVAL_MS}ms)`);
  workerLoop().catch(err => {
    console.error("[JobService] Worker loop crashed:", err);
    workerRunning = false;
  });
}

/** Stop the job processor gracefully */
export function stopJobProcessor() {
  workerRunning = false;
  console.log("[JobService] Job worker stopping...");
}
