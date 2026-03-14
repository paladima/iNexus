/**
 * #17: People router — CRUD, notes, interactions, AI summary
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import { parseLLMWithSchema, personSummarySchema } from "../llmHelpers";

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
      const person = await repo.getPersonById(ctx.user.id, input.id);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const notes = await repo.getPersonNotes(ctx.user.id, input.id);
      const interactionsList = await repo.getInteractions(ctx.user.id, input.id, 20);
      return { ...person, notes, interactions: interactionsList };
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
      const id = await repo.createPerson(ctx.user.id, input);
      await repo.logActivity(ctx.user.id, {
        activityType: "person_added",
        title: `Added ${input.fullName}`,
        entityType: "person",
        entityId: id ?? undefined,
      });
      return { id };
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
      const person = await repo.getPersonById(ctx.user.id, input.personId);
      if (!person) throw new TRPCError({ code: "NOT_FOUND" });
      const notes = await repo.getPersonNotes(ctx.user.id, input.personId);
      const ints = await repo.getInteractions(ctx.user.id, input.personId, 10);
      const goals = await repo.getUserGoals(ctx.user.id);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Generate a concise networking summary for this person. Explain why they matter to the user's goals. Return JSON: { "summary": "...", "keyPoints": ["..."], "connectionStrength": "strong|moderate|new" }`
          },
          {
            role: "user",
            content: `Person: ${JSON.stringify(person)}\nNotes: ${JSON.stringify(notes)}\nInteractions: ${JSON.stringify(ints)}\nUser goals: ${JSON.stringify(goals)}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const parsed = parseLLMWithSchema(response, personSummarySchema, "people.generateSummary", { summary: "", keyTopics: [], relevanceScore: 0 });
      await repo.updatePerson(ctx.user.id, input.personId, { aiSummary: parsed.summary });
      return parsed;
    }),
});
