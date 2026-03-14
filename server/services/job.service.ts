/**
 * Job Service (#5, #6) — Manages async job execution with status tracking.
 * All long-running operations (LLM calls, batch processing) go through here.
 */

import { createJob, getJobById, updateJobStatus } from "../repositories/jobs.repo";

type JobHandler = (jobId: number, userId: number, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

const handlers = new Map<string, JobHandler>();

/** Register a handler for a job type */
export function registerJobHandler(jobType: string, handler: JobHandler) {
  handlers.set(jobType, handler);
}

/** Enqueue a job and start processing it asynchronously */
export async function enqueueJob(userId: number, jobType: string, payload: Record<string, unknown> = {}): Promise<number | null> {
  const jobId = await createJob(userId, { jobType, payload });
  if (!jobId) return null;

  // Process asynchronously
  processJob(jobId, userId, jobType, payload).catch(err => {
    console.error(`[JobService] Unhandled error in job ${jobId}:`, err);
  });

  return jobId;
}

async function processJob(jobId: number, userId: number, jobType: string, payload: Record<string, unknown>) {
  const handler = handlers.get(jobType);
  if (!handler) {
    await updateJobStatus(jobId, "failed", undefined, `No handler registered for job type: ${jobType}`);
    return;
  }

  try {
    await updateJobStatus(jobId, "running");
    const result = await handler(jobId, userId, payload);
    await updateJobStatus(jobId, "completed", result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[JobService] Job ${jobId} (${jobType}) failed:`, errorMessage);
    await updateJobStatus(jobId, "failed", undefined, errorMessage);
  }
}

/** Poll for job status */
export async function pollJobStatus(jobId: number) {
  const job = await getJobById(jobId);
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

/** Start the job processor — currently jobs are processed inline on enqueue.
 *  This function is a placeholder for future queue-based processing. */
export function startJobProcessor() {
  console.log("[JobService] Job processor started (inline mode)");
}
