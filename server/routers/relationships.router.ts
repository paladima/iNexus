/**
 * Relationships & Warm Paths Router — thin layer delegating to draftsService
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import * as draftsService from "../services/drafts.service";

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
      return repo.getRelationshipsForPerson(ctx.user.id, input.personId);
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
