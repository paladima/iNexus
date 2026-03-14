/**
 * Jobs Router - background job management with cancel support
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { enqueueJob, pollJobStatus, cancelJob } from "../services/job.service";

export const jobsRouter = router({
  status: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      return pollJobStatus(input.jobId);
    }),
  cancel: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const cancelled = await cancelJob(input.jobId, ctx.user.id);
      return { cancelled };
    }),
  triggerOpportunityScan: protectedProcedure.mutation(async ({ ctx }) => {
    const jobId = await enqueueJob(ctx.user.id, "opportunity_scan");
    return { jobId, status: "queued" };
  }),
  triggerReconnectDetection: protectedProcedure.mutation(async ({ ctx }) => {
    const jobId = await enqueueJob(ctx.user.id, "reconnect_detection");
    return { jobId, status: "queued" };
  }),
  triggerDailyBrief: protectedProcedure.mutation(async ({ ctx }) => {
    const jobId = await enqueueJob(ctx.user.id, "generate_brief");
    return { jobId, status: "queued" };
  }),
});
