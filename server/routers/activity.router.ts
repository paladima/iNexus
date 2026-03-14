/**
 * Activity & Settings Routers (#6, #18)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";

export const activityRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return repo.getActivityLog(ctx.user.id, input?.limit ?? 50, input?.offset ?? 0);
    }),
});

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const goals = await repo.getUserGoals(ctx.user.id);
    return { goals };
  }),
  updateGoals: protectedProcedure
    .input(z.object({
      primaryGoal: z.string().optional(),
      industries: z.array(z.string()).optional(),
      geographies: z.array(z.string()).optional(),
      preferences: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await repo.upsertUserGoals(ctx.user.id, input);
      return { success: true };
    }),
  // #18: AI usage stats and audit trail
  aiUsage: protectedProcedure
    .input(z.object({ days: z.number().default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const [stats, byModule, recentLog] = await Promise.all([
        repo.getAiUsageStats(ctx.user.id, days),
        repo.getAiUsageByModule(ctx.user.id, days),
        repo.getAiAuditLog(ctx.user.id, 20),
      ]);
      return { stats, byModule, recentLog };
    }),
  // #18: Audit trail for a specific entity
  entityAudit: protectedProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      return repo.getAuditForEntity(ctx.user.id, input.entityType, input.entityId);
    }),
});
