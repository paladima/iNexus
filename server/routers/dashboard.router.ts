/**
 * Dashboard & Daily Brief Router (#12)
 * Thin layer — delegates to dashboard.service.ts
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as dashboardService from "../services/dashboard.service";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    return dashboardService.getDashboardStats(ctx.user.id);
  }),

  dailyBrief: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return dashboardService.getDailyBrief(ctx.user.id, input?.date);
    }),

  generateBrief: protectedProcedure.mutation(async ({ ctx }) => {
    return dashboardService.generateBrief(ctx.user.id);
  }),

  briefStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      return dashboardService.getBriefJobStatus(ctx.user.id, input.jobId);
    }),
});
