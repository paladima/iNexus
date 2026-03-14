/**
 * #17: Opportunities router — CRUD + Opportunity→Draft/Task flows + Intro generation
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { parseLLMWithSchema, draftSchema } from "../llmHelpers";

export const opportunitiesRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      personId: z.number().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.getOpportunities(ctx.user.id, input ?? {});
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
      const id = await db.createOpportunity(ctx.user.id, input);
      await db.logActivity(ctx.user.id, {
        activityType: "opportunity_created",
        title: `New opportunity: ${input.title}`,
        entityType: "opportunity",
        entityId: id ?? undefined,
      });
      return { id };
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      title: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.updateOpportunity(ctx.user.id, id, data);
      return { success: true };
    }),
  generateDraft: protectedProcedure
    .input(z.object({
      opportunityId: z.number(),
      tone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const opp = await db.getOpportunityById(ctx.user.id, input.opportunityId);
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      let person = null;
      if (opp.personId) person = await db.getPersonById(ctx.user.id, opp.personId);
      const goals = await db.getUserGoals(ctx.user.id);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a professional networking message writer. Generate a message based on a detected opportunity. Tone: ${input.tone ?? "professional"}. Return JSON: { "subject": "...", "body": "..." }`
          },
          {
            role: "user",
            content: `Opportunity: ${JSON.stringify(opp)}\nPerson: ${JSON.stringify(person)}\nUser goals: ${JSON.stringify(goals)}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const parsed = parseLLMWithSchema(response, draftSchema, "opportunities.generateDraft", { subject: "", body: "" });
      const draftId = await db.createDraft(ctx.user.id, {
        personId: opp.personId ?? undefined,
        draftType: "opportunity_outreach",
        tone: input.tone ?? "professional",
        subject: parsed.subject,
        body: parsed.body,
        metadataJson: { opportunityId: input.opportunityId },
      });
      await db.logActivity(ctx.user.id, {
        activityType: "draft_from_opportunity",
        title: `Generated draft from opportunity: ${opp.title}`,
        entityType: "draft",
        entityId: draftId ?? undefined,
      });
      return { id: draftId, ...parsed };
    }),
  createTask: protectedProcedure
    .input(z.object({
      opportunityId: z.number(),
      title: z.string().optional(),
      dueAt: z.string().optional(),
      priority: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const opp = await db.getOpportunityById(ctx.user.id, input.opportunityId);
      if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      const taskId = await db.createTask(ctx.user.id, {
        title: input.title ?? opp.recommendedAction ?? `Follow up on: ${opp.title}`,
        description: opp.signalSummary,
        personId: opp.personId ?? undefined,
        opportunityId: input.opportunityId,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        priority: input.priority ?? "medium",
        source: "opportunity",
      });
      await db.logActivity(ctx.user.id, {
        activityType: "task_from_opportunity",
        title: `Created task from opportunity: ${opp.title}`,
        entityType: "task",
        entityId: taskId ?? undefined,
      });
      return { id: taskId };
    }),
  generateIntro: protectedProcedure
    .input(z.object({
      opportunityId: z.number(),
      tone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const opp = await db.getOpportunityById(ctx.user.id, input.opportunityId);
      if (!opp) throw new TRPCError({ code: "NOT_FOUND" });
      const meta = opp.metadataJson as Record<string, unknown> | null;
      const personAId = meta?.personAId as number | undefined;
      const personBId = meta?.personBId as number | undefined;
      let personA = null, personB = null;
      if (personAId) personA = await db.getPersonById(ctx.user.id, personAId);
      if (personBId) personB = await db.getPersonById(ctx.user.id, personBId);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a professional networking assistant. Write an introduction message connecting two people. Tone: ${input.tone ?? "warm"}. Return JSON: { "subject": "...", "body": "..." }`
          },
          {
            role: "user",
            content: `Person A: ${JSON.stringify(personA)}\nPerson B: ${JSON.stringify(personB)}\nReason for intro: ${opp.signalSummary}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const parsed = parseLLMWithSchema(response, draftSchema, "opportunities.generateIntro", { subject: "", body: "" });
      const draftId = await db.createDraft(ctx.user.id, {
        draftType: "intro_message",
        tone: input.tone ?? "warm",
        subject: parsed.subject,
        body: parsed.body,
        metadataJson: { opportunityId: input.opportunityId, personAId, personBId },
      });
      await db.logActivity(ctx.user.id, {
        activityType: "intro_draft_generated",
        title: `Generated intro between ${personA?.fullName ?? "?"} and ${personB?.fullName ?? "?"}`,
        entityType: "draft",
        entityId: draftId ?? undefined,
      });
      return { id: draftId, ...parsed };
    }),
});
