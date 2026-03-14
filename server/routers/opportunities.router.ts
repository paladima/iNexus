/**
 * Opportunities Router — thin layer delegating to opportunitiesService
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import * as oppService from "../services/opportunities.service";
import * as scoringService from "../services/opportunityScoring.service";

export const opportunitiesRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      personId: z.number().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return repo.getOpportunities(ctx.user.id, input ?? {});
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      opportunityType: z.string(),
      signalSummary: z.string(),
      personId: z.number().optional(),
      whyItMatters: z.string().optional(),
      recommendedAction: z.string().optional(),
      score: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await oppService.createOpportunityIfUnique(ctx.user.id, input);
      if (result.duplicate) {
        return { id: null, duplicate: true, message: "A similar opportunity already exists" };
      }
      return { id: result.id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      title: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await repo.updateOpportunity(ctx.user.id, id, data);
      return { success: true };
    }),

  generateDraft: protectedProcedure
    .input(z.object({
      opportunityId: z.number(),
      tone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await oppService.generateDraftFromOpportunity(ctx.user.id, input.opportunityId, input.tone);
      } catch (e: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: e.message });
      }
    }),

  createTask: protectedProcedure
    .input(z.object({
      opportunityId: z.number(),
      title: z.string().optional(),
      dueAt: z.string().optional(),
      priority: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await oppService.createTaskFromOpportunity(
          ctx.user.id,
          input.opportunityId,
          input.title,
          input.dueAt,
          input.priority
        );
      } catch (e: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: e.message });
      }
    }),

  generateIntro: protectedProcedure
    .input(z.object({
      opportunityId: z.number(),
      tone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await oppService.generateIntroFromOpportunity(ctx.user.id, input.opportunityId, input.tone);
      } catch (e: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: e.message });
      }
    }),

  // ─── v9 Pillar 2: Opportunity Scoring Engine ──────────────
  ranked: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return scoringService.rankOpportunitiesForUser(ctx.user.id, input?.limit ?? 20);
    }),

  topActions: protectedProcedure
    .input(z.object({ count: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return scoringService.getTopActions(ctx.user.id, input?.count ?? 3);
    }),

  markActed: protectedProcedure
    .input(z.object({
      opportunityId: z.number(),
      action: z.enum(["acted", "archived", "ignored"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { markOpportunityActed } = await import("../services/action.service");
      return markOpportunityActed(ctx.user.id, input.opportunityId, input.action);
    }),
});
