/**
 * Dashboard Service (#12)
 * Orchestration layer for dashboard: stats, brief retrieval, brief generation, fallback.
 */
import * as repo from "../repositories";
import { enqueueJob, pollJobStatus } from "./job.service";

export async function getDashboardStats(userId: number) {
  return repo.getDashboardStats(userId);
}

export async function getDailyBrief(userId: number, date?: string) {
  const briefDate = date ?? new Date().toISOString().split("T")[0];
  const brief = await repo.getDailyBrief(userId, briefDate);

  if (brief) {
    return { status: "ready" as const, brief };
  }

  // Check if there's a pending/running generate_brief job
  const recentJobs = await repo.getJobsByUser(userId, {
    jobType: "generate_brief",
    limit: 1,
  });
  const latestJob = recentJobs[0];

  if (latestJob && (latestJob.status === "pending" || latestJob.status === "running")) {
    return {
      status: "generating" as const,
      jobId: latestJob.id,
      progress: latestJob.progress ?? 0,
    };
  }

  return { status: "empty" as const };
}

export async function generateBrief(userId: number) {
  // Dedupe: don't create a new job if one is already pending/running
  const recentJobs = await repo.getJobsByUser(userId, {
    jobType: "generate_brief",
    limit: 1,
  });
  const latestJob = recentJobs[0];

  if (latestJob && (latestJob.status === "pending" || latestJob.status === "running")) {
    return {
      status: "already_generating" as const,
      jobId: latestJob.id,
      progress: latestJob.progress ?? 0,
    };
  }

  const jobId = await enqueueJob(userId, "generate_brief", {}, {
    dedupeKey: `generate_brief:${userId}:${new Date().toISOString().split("T")[0]}`,
    priority: 2,
  });

  return {
    status: "queued" as const,
    jobId,
    message: "Daily brief generation started.",
  };
}

export async function getBriefJobStatus(userId: number, jobId: number) {
  const status = await pollJobStatus(jobId);
  if (!status) return null;
  return status;
}
