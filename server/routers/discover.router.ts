/**
 * Discover Router — thin layer delegating to discoverService
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as discoverService from "../services/discover.service";

const personInputSchema = z.object({
  fullName: z.string(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
  sourceType: z.string().optional(),
  relevanceScore: z.string().optional(),
});

export const discoverRouter = router({
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      filters: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return discoverService.executeSearch(ctx.user.id, input.query, input.filters as Record<string, unknown>);
    }),

  savePerson: protectedProcedure
    .input(personInputSchema)
    .mutation(async ({ ctx, input }) => {
      return discoverService.bulkSavePeople(ctx.user.id, [input]).then(r => ({ id: r.savedIds[0] }));
    }),

  bulkSave: protectedProcedure
    .input(z.object({ people: z.array(personInputSchema) }))
    .mutation(async ({ ctx, input }) => {
      return discoverService.bulkSavePeople(ctx.user.id, input.people);
    }),

  bulkAddToList: protectedProcedure
    .input(z.object({
      personIds: z.array(z.number()),
      listId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await discoverService.bulkAddToList(ctx.user.id, input.listId, input.personIds);
      } catch (e: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: e.message });
      }
    }),

  bulkGenerateDrafts: protectedProcedure
    .input(z.object({
      personIds: z.array(z.number()),
      tone: z.string().default("professional"),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return discoverService.bulkGenerateDrafts(ctx.user.id, input.personIds, input.tone, input.context);
    }),

  bulkCreateTasks: protectedProcedure
    .input(z.object({
      personIds: z.array(z.number()),
      taskPrefix: z.string().default("Follow up with"),
      priority: z.string().default("medium"),
      daysFromNow: z.number().default(3),
    }))
    .mutation(async ({ ctx, input }) => {
      return discoverService.bulkCreateTasks(ctx.user.id, input.personIds, input.taskPrefix, input.priority, input.daysFromNow);
    }),
});
