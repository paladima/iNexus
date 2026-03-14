/**
 * Dashboard & Daily Brief Router (#3)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import { enqueueJob, pollJobStatus } from "../services/job.service";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    return repo.getDashboardStats(ctx.user.id);
  }),
  dailyBrief: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const date = input?.date ?? new Date().toISOString().split("T")[0];
      return repo.getDailyBrief(ctx.user.id, date);
    }),
  generateBrief: protectedProcedure.mutation(async ({ ctx }) => {
    const jobId = await enqueueJob(ctx.user.id, "generate_brief");
    return { status: "generating", jobId, message: "Daily brief is being generated. Refresh in a few seconds." };
  }),
});
