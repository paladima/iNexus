/**
 * People Router — thin layer delegating to peopleService
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import * as peopleService from "../services/people.service";

export const peopleRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      tag: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return repo.getPeople(ctx.user.id, input ?? {});
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await peopleService.getPersonProfile(ctx.user.id, input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      return result;
    }),

  create: protectedProcedure
    .input(z.object({
      fullName: z.string().min(1),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      title: z.string().optional(),
      company: z.string().optional(),
      location: z.string().optional(),
      linkedinUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      sourceType: z.string().optional(),
      sourceUrl: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return peopleService.savePerson(ctx.user.id, input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      fullName: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      title: z.string().optional(),
      company: z.string().optional(),
      location: z.string().optional(),
      linkedinUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.string().optional(),
      aiSummary: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await repo.updatePerson(ctx.user.id, id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await repo.deletePerson(ctx.user.id, input.id);
      await repo.logActivity(ctx.user.id, {
        activityType: "person_deleted",
        title: "Removed a contact",
        entityType: "person",
        entityId: input.id,
      });
      return { success: true };
    }),

  addNote: protectedProcedure
    .input(z.object({ personId: z.number(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await repo.addPersonNote(ctx.user.id, input.personId, input.content);
      return { success: true };
    }),

  addInteraction: protectedProcedure
    .input(z.object({
      personId: z.number(),
      interactionType: z.string(),
      channel: z.string().optional(),
      content: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await repo.addInteraction(ctx.user.id, { ...input, occurredAt: new Date() });
      return { success: true };
    }),

  generateSummary: protectedProcedure
    .input(z.object({ personId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await peopleService.generatePersonSummary(ctx.user.id, input.personId);
      } catch (e: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: e.message });
      }
    }),
});
