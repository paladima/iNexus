/**
 * Relationships & Warm Paths Router
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import { callLLM } from "../services/llm.service";

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
      // Warm paths = relationships where this person is connected
      return repo.getRelationshipsForPerson(ctx.user.id, input.personId);
    }),
  generateIntro: protectedProcedure
    .input(z.object({
      personAId: z.number(),
      personBId: z.number(),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [personA, personB] = await Promise.all([
        repo.getPersonById(ctx.user.id, input.personAId),
        repo.getPersonById(ctx.user.id, input.personBId),
      ]);
      if (!personA || !personB) return { body: "Could not find one or both people." };

      const { data } = await callLLM({
        promptModule: "intro_draft",
        params: {
          messages: [
            {
              role: "system",
              content: `You are a professional networking assistant. Write a warm introduction message connecting two people. Return JSON: { "subject": "...", "body": "..." }`,
            },
            {
              role: "user",
              content: `Person A: ${personA.fullName}, ${personA.title ?? ""} at ${personA.company ?? ""}.\nPerson B: ${personB.fullName}, ${personB.title ?? ""} at ${personB.company ?? ""}.\nContext: ${input.context ?? "They share common interests and could benefit from connecting."}`,
            },
          ],
          response_format: { type: "json_object" },
        },
        fallback: { subject: "Introduction", body: `I'd like to introduce ${personA.fullName} and ${personB.fullName}.` },
        userId: ctx.user.id,
        entityType: "relationship",
      });

      const intro = data as Record<string, string>;
      return intro;
    }),
});
