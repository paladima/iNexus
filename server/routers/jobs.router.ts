/**
 * Jobs Router - background job management with cancel, retry UX, dedupeKey (#6-8)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { enqueueJob, pollJobStatus, cancelJob } from "../services/job.service";
import * as jobRepo from "../repositories/jobs.repo";

export const jobsRouter = router({
  /** Poll job status with full metadata (progress, retries, entity info) */
  status: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      const status = await pollJobStatus(input.jobId);
      if (!status) return null;
      return {
        ...status,
        // Retry UX: show user-friendly retry info (#6)
        canRetry: status.status === "failed" && (status.retryCount ?? 0) < (status.maxRetries ?? 3),
        retriesRemaining: Math.max(0, (status.maxRetries ?? 3) - (status.retryCount ?? 0)),
        isRetrying: status.status === "pending" && (status.retryCount ?? 0) > 0,
      };
    }),

  /** Cancel a running or pending job */
  cancel: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const cancelled = await cancelJob(input.jobId, ctx.user.id);
      return { cancelled };
    }),

  /** Retry a failed job (#11) */
  retry: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const job = await jobRepo.getJobById(input.jobId);
      if (!job) throw new Error("Job not found");
      if (job.userId !== ctx.user.id) throw new Error("Not authorized");
      if (job.status !== "failed") throw new Error("Only failed jobs can be retried");
      const newJobId = await enqueueJob(ctx.user.id, job.jobType, job.payload ?? {}, {
        entityType: job.entityType ?? undefined,
        entityId: job.entityId ?? undefined,
      });
      return { jobId: newJobId, status: "queued" };
    }),

  /** List jobs for current user (#10) */
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      jobType: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return jobRepo.getJobsByUser(ctx.user.id, {
        status: input?.status,
        jobType: input?.jobType,
        limit: input?.limit ?? 50,
      });
    }),

  /** Trigger opportunity scan — deduped per user (#7) */
  triggerOpportunityScan: protectedProcedure.mutation(async ({ ctx }) => {
    const jobId = await enqueueJob(ctx.user.id, "scan_opportunities", {}, {
      dedupeKey: `scan_opportunities:${ctx.user.id}`,
      entityType: "user",
      entityId: ctx.user.id,
    });
    return { jobId, status: "queued" };
  }),

  /** Trigger reconnect detection — deduped per user (#7) */
  triggerReconnectDetection: protectedProcedure.mutation(async ({ ctx }) => {
    const jobId = await enqueueJob(ctx.user.id, "detect_reconnects", {}, {
      dedupeKey: `detect_reconnects:${ctx.user.id}`,
      entityType: "user",
      entityId: ctx.user.id,
    });
    return { jobId, status: "queued" };
  }),

  /** Trigger daily brief generation — deduped per user per day (#7) */
  triggerDailyBrief: protectedProcedure.mutation(async ({ ctx }) => {
    const today = new Date().toISOString().split("T")[0];
    const jobId = await enqueueJob(ctx.user.id, "generate_brief", {}, {
      dedupeKey: `generate_brief:${ctx.user.id}:${today}`,
      entityType: "user",
      entityId: ctx.user.id,
    });
    return { jobId, status: "queued" };
  }),
});
