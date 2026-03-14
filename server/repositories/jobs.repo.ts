import { eq, and, desc, sql, lte } from "drizzle-orm";
import { getDb } from "./base";
import { jobs } from "../../drizzle/schema";

export type JobStatus = "pending" | "running" | "completed" | "failed";
export type JobType = "generate_brief" | "generate_summary" | "scan_opportunities" | "detect_reconnects" | "batch_outreach" | "voice_transcribe" | "voice_parse";

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

export async function getJobById(jobId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return result[0] ?? null;
}

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

/** Clean up old completed/failed jobs older than N days */
export async function cleanupOldJobs(daysOld = 7) {
  const db = await getDb();
  if (!db) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  await db.delete(jobs).where(lte(jobs.createdAt, cutoff));
}
