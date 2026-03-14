/**
 * Drafts Router — thin layer delegating to draftsService
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import * as draftsService from "../services/drafts.service";

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
      try {
        return await draftsService.generateOutreachDraft(
          ctx.user.id,
          input.personId,
          input.tone ?? "professional",
          input.context,
          input.channel ?? "email"
        );
      } catch (e: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: e.message });
      }
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
