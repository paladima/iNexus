/**
 * Relationships & Warm Paths Router (v9 Pillar 3)
 * Delegates to relationship.service.ts for warm path engine
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import * as draftsService from "../services/drafts.service";
import * as relService from "../services/relationship.service";

export const relationshipsRouter = router({
  list: protectedProcedure
    .input(z.object({ personId: z.number() }))
    .query(async ({ ctx, input }) => {
      return repo.getRelationshipsForPerson(ctx.user.id, input.personId);
    }),

  create: protectedProcedure
    .input(z.object({
      personAId: z.number(),
      personBId: z.number(),
      relationshipType: z.string(),
      confidence: z.string().optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await repo.createRelationship(ctx.user.id, input);
      return { success: true };
    }),

  warmPaths: protectedProcedure
    .input(z.object({ personId: z.number() }))
    .query(async ({ ctx, input }) => {
      return relService.findWarmPaths(ctx.user.id, input.personId);
    }),

  suggestIntros: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return relService.suggestIntroductions(ctx.user.id, input?.limit ?? 10);
    }),

  buildIntroRequest: protectedProcedure
    .input(z.object({
      connectorPersonId: z.number(),
      targetPersonId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return relService.buildIntroRequest(
        ctx.user.id,
        input.connectorPersonId,
        input.targetPersonId,
        input.reason
      );
    }),

  generateIntro: protectedProcedure
    .input(z.object({
      personAId: z.number(),
      personBId: z.number(),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await draftsService.generateIntroDraft(
          ctx.user.id,
          input.personAId,
          input.personBId,
          input.context ?? "They share common interests and could benefit from connecting."
        );
      } catch {
        return { body: "Could not find one or both people." };
      }
    }),
});
