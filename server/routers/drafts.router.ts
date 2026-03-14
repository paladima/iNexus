/**
 * Drafts Router
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import { callLLM } from "../services/llm.service";

export const draftsRouter = router({
  list: protectedProcedure
    .input(z.object({
      personId: z.number().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return repo.getDrafts(ctx.user.id, input ?? {});
    }),
  generate: protectedProcedure
    .input(z.object({
      personId: z.number(),
      tone: z.string().optional(),
      context: z.string().optional(),
      channel: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const person = await repo.getPersonById(ctx.user.id, input.personId);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });

      const goals = await repo.getUserGoals(ctx.user.id);

      const { data } = await callLLM({
        promptModule: "outreach_draft",
        params: {
          messages: [
            {
              role: "system",
              content: `You are a professional networking message writer. Generate a personalized outreach message. Return JSON: { "subject": "...", "body": "...", "tone": "${input.tone ?? "professional"}", "channel": "${input.channel ?? "email"}" }`,
            },
            {
              role: "user",
              content: `Person: ${person.fullName}, ${person.title ?? ""} at ${person.company ?? ""}. Location: ${person.location ?? "unknown"}. Summary: ${person.aiSummary ?? "N/A"}. Tags: ${JSON.stringify(person.tags ?? [])}.\nUser goals: ${JSON.stringify(goals)}\nContext: ${input.context ?? "General networking"}`,
            },
          ],
          response_format: { type: "json_object" },
        },
        fallback: { subject: "Let's connect", body: `Hi ${person.fullName}, I'd love to connect and learn more about your work.`, tone: input.tone ?? "professional", channel: input.channel ?? "email" },
        userId: ctx.user.id,
        entityType: "person",
        entityId: input.personId,
      });

      const draft = data as Record<string, string>;
      const id = await repo.createDraft(ctx.user.id, {
        personId: input.personId,
        draftType: draft.channel ?? input.channel ?? "email",
        subject: draft.subject,
        body: draft.body,
        tone: draft.tone ?? input.tone ?? "professional",
        metadataJson: { generatedBy: "ai", context: input.context },
      });

      await repo.logActivity(ctx.user.id, {
        activityType: "draft_generated",
        title: `Generated draft for ${person.fullName}`,
        entityType: "draft",
        entityId: id ?? undefined,
      });

      return { id, ...draft };
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      subject: z.string().optional(),
      body: z.string().optional(),
      status: z.enum(["pending_review", "approved", "sent", "rejected"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await repo.updateDraft(ctx.user.id, id, data);
      if (data.status === "approved") {
        await repo.logActivity(ctx.user.id, {
          activityType: "draft_approved",
          title: "Approved a draft message",
          entityType: "draft",
          entityId: id,
        });
      }
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await repo.deleteDraft(ctx.user.id, input.id);
      return { success: true };
    }),
});
