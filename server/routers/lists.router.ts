/**
 * Lists Router (#4)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import { enqueueJob } from "../services/job.service";

export const listsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return repo.getLists(ctx.user.id);
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const list = await repo.getListById(ctx.user.id, input.id);
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });
      const people = await repo.getListPeople(ctx.user.id, input.id);
      return { ...list, people };
    }),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const id = await repo.createList(ctx.user.id, input.name, input.description);
      await repo.logActivity(ctx.user.id, {
        activityType: "list_created",
        title: `Created list "${input.name}"`,
        entityType: "list",
        entityId: id ?? undefined,
      });
      return { id };
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await repo.updateList(ctx.user.id, id, data);
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await repo.deleteList(ctx.user.id, input.id);
      return { success: true };
    }),
  addPerson: protectedProcedure
    .input(z.object({ listId: z.number(), personId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await repo.addPersonToList(ctx.user.id, input.listId, input.personId);
      return { success: true };
    }),
  removePerson: protectedProcedure
    .input(z.object({ listId: z.number(), personId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await repo.removePersonFromList(ctx.user.id, input.listId, input.personId);
      return { success: true };
    }),
  batchOutreach: protectedProcedure
    .input(z.object({
      listId: z.number(),
      tone: z.string().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listPeople = await repo.getListPeopleForBatch(ctx.user.id, input.listId);
      if (listPeople.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "List is empty" });

      const jobId = await enqueueJob(ctx.user.id, "batch_outreach", {
        listId: input.listId,
        tone: input.tone ?? "professional",
        context: input.context,
      });

      await repo.logActivity(ctx.user.id, {
        activityType: "batch_outreach",
        title: `Started batch outreach for ${listPeople.length} people`,
        entityType: "list",
        entityId: input.listId,
      });

      return { status: "processing", jobId, total: listPeople.length };
    }),
});
