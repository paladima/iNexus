/**
 * Tasks Router (#5)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";

export const tasksRouter = router({
  list: protectedProcedure
    .input(z.object({
      view: z.enum(["today", "upcoming", "completed"]).optional(),
      personId: z.number().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return repo.getTasks(ctx.user.id, input ?? {});
    }),
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      personId: z.number().optional(),
      opportunityId: z.number().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await repo.createTask(ctx.user.id, input);
      await repo.logActivity(ctx.user.id, {
        activityType: "task_created",
        title: `Created task: ${input.title}`,
        entityType: "task",
        entityId: id ?? undefined,
      });
      return { id };
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await repo.updateTask(ctx.user.id, id, data);
      if (data.status === "done") {
        await repo.logActivity(ctx.user.id, {
          activityType: "task_completed",
          title: `Completed task`,
          entityType: "task",
          entityId: id,
        });
      }
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await repo.deleteTask(ctx.user.id, input.id);
      return { success: true };
    }),
});
