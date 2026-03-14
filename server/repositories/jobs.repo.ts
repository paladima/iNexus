/**
 * Jobs Repository — all DB access for the job queue (#8).
 * Single source of truth: no direct db.update(jobs) outside this file.
 */
import { eq, and, desc, sql, lte, isNull, or } from "drizzle-orm";
import { getDb } from "./base";
import { jobs } from "../../drizzle/schema";

export type JobStatus = "pending" | "running" | "completed" | "failed";
export type JobType =
  | "generate_brief"
  | "generate_summary"
  | "scan_opportunities"
  | "detect_reconnects"
  | "batch_outreach"
  | "voice_transcribe"
  | "voice_parse";

export type JobRow = typeof jobs.$inferSelect;

// ─── Create ─────────────────────────────────────────────────────
export async function createJob(userId: number, data: {
  jobType: string; payload?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(jobs).values({
    userId,
    jobType: data.jobType,
    payload: data.payload ?? {},
    status: "pending",
  });
  return result[0].insertId;
}

/** Full create with all fields (#6) */
export async function createJobFull(userId: number, data: {
  jobType: string;
  payload?: Record<string, unknown>;
  priority?: number;
  maxRetries?: number;
  dedupeKey?: string;
  entityType?: string;
  entityId?: number;
  runAfter?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(jobs).values({
    userId,
    jobType: data.jobType,
    payload: data.payload ?? {},
    status: "pending",
    priority: data.priority ?? 0,
    maxRetries: data.maxRetries ?? 3,
    retryCount: 0,
    progress: 0,
    dedupeKey: data.dedupeKey ?? null,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    runAfter: data.runAfter ?? null,
  });
  return result[0].insertId;
}

// ─── Read ───────────────────────────────────────────────────────
export async function getJobById(jobId: number): Promise<JobRow | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return result[0] ?? null;
}

export async function getJobsByUser(userId: number, opts?: {
  jobType?: string; status?: string; limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(jobs.userId, userId)];
  if (opts?.jobType) conditions.push(eq(jobs.jobType, opts.jobType));
  if (opts?.status) conditions.push(eq(jobs.status, opts.status));
  return db.select().from(jobs).where(and(...conditions))
    .orderBy(desc(jobs.createdAt)).limit(opts?.limit ?? 20);
}

/** Find by deduplication key (#7) */
export async function findByDedupeKey(dedupeKey: string): Promise<JobRow | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(jobs)
    .where(eq(jobs.dedupeKey, dedupeKey))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return result[0] ?? null;
}

// ─── Status Updates ─────────────────────────────────────────────
export async function updateJobStatus(jobId: number, status: JobStatus, result?: Record<string, unknown>, error?: string) {
  const db = await getDb();
  if (!db) return;
  const update: Record<string, unknown> = { status };
  if (status === "running") update.startedAt = new Date();
  if (status === "completed" || status === "failed") update.finishedAt = new Date();
  if (result) update.result = result;
  if (error) update.error = error;
  await db.update(jobs).set(update).where(eq(jobs.id, jobId));
}

export async function updateJobProgress(jobId: number, progress: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set({ progress }).where(eq(jobs.id, jobId));
}

/** Claim a job for processing (set status=running, workerId, attemptStartedAt) */
export async function claimJob(jobId: number, workerId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set({
    status: "running",
    workerId,
    attemptStartedAt: new Date(),
    startedAt: new Date(),
  }).where(eq(jobs.id, jobId));
}

/** Complete a job successfully */
export async function completeJob(jobId: number, result: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set({
    status: "completed",
    result,
    progress: 100,
    finishedAt: new Date(),
  }).where(eq(jobs.id, jobId));
}

/** Fail a job permanently */
export async function failJob(jobId: number, errorMessage: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set({
    status: "failed",
    error: errorMessage,
    finishedAt: new Date(),
  }).where(eq(jobs.id, jobId));
}

/** Schedule a retry with backoff */
export async function retryJob(jobId: number, retryCount: number, lastError: string, runAfter: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set({
    status: "pending",
    retryCount,
    error: lastError,
    runAfter,
    workerId: null,
    attemptStartedAt: null,
  }).where(eq(jobs.id, jobId));
}

/** Cancel a job — DB-based (#5) */
export async function cancelJob(jobId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(jobs).set({
    status: "failed",
    error: "Cancelled by user",
    cancelledAt: new Date(),
    finishedAt: new Date(),
  }).where(eq(jobs.id, jobId));
}

// ─── Worker Operations ──────────────────────────────────────────

/**
 * Claim the next pending job for processing (#4).
 * Respects priority (higher first) and runAfter scheduling.
 * Uses atomic update to prevent double-claiming.
 */
export async function claimNextPendingJob(workerId: string): Promise<JobRow | null> {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();

  // Find the highest-priority pending job that's ready to run
  const candidates = await db.select().from(jobs)
    .where(and(
      eq(jobs.status, "pending"),
      isNull(jobs.cancelledAt),
      or(isNull(jobs.runAfter), lte(jobs.runAfter, now))
    ))
    .orderBy(desc(jobs.priority), jobs.createdAt)
    .limit(1);

  if (candidates.length === 0) return null;

  const candidate = candidates[0];

  // Atomic claim: only update if still pending
  const result = await db.update(jobs).set({
    status: "running",
    workerId,
    attemptStartedAt: now,
    startedAt: candidate.startedAt ?? now,
  }).where(and(
    eq(jobs.id, candidate.id),
    eq(jobs.status, "pending")
  ));

  // Check if we actually claimed it (affected rows > 0)
  if ((result as any)[0]?.affectedRows === 0) {
    return null; // Another worker claimed it
  }

  // Return the claimed job
  return { ...candidate, status: "running", workerId, attemptStartedAt: now };
}

// ─── Cleanup ────────────────────────────────────────────────────
export async function cleanupOldJobs(daysOld = 7) {
  const db = await getDb();
  if (!db) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  await db.delete(jobs).where(lte(jobs.createdAt, cutoff));
}
