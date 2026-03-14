/**
 * Auth & Onboarding Router (#2)
 */
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

export const onboardingRouter = router({
  getGoals: protectedProcedure.query(async ({ ctx }) => {
    return repo.getUserGoals(ctx.user.id);
  }),
  saveGoals: protectedProcedure
    .input(z.object({
      primaryGoal: z.string().optional(),
      industries: z.array(z.string()).optional(),
      geographies: z.array(z.string()).optional(),
      preferences: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await repo.upsertUserGoals(ctx.user.id, input);
      await repo.logActivity(ctx.user.id, {
        activityType: "onboarding_goals_saved",
        title: "Updated networking goals",
      });
      return { success: true };
    }),
  complete: protectedProcedure.mutation(async ({ ctx }) => {
    await repo.updateUserSettings(ctx.user.id, { onboardingCompleted: 1 });
    await repo.logActivity(ctx.user.id, {
      activityType: "onboarding_completed",
      title: "Completed onboarding",
    });
    return { success: true };
  }),
});
