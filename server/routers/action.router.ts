/**
 * Action Router (v16)
 *
 * Exposes the unified action dispatcher via tRPC.
 * Frontend can dispatch any registered action through a single endpoint.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { dispatch, batchDispatch, listActions, dispatchRequestSchema } from "../actions";

export const actionRouter = router({
  /** Dispatch a single action */
  dispatch: protectedProcedure
    .input(dispatchRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return dispatch(ctx.user.id, input);
    }),

  /** Batch dispatch — same action, multiple inputs */
  batchDispatch: protectedProcedure
    .input(z.object({
      actionId: z.string(),
      inputs: z.array(z.record(z.string(), z.unknown())),
      source: z.enum(["command", "voice", "bulk", "ui", "opportunity", "worker", "api"] as const).default("bulk"),
    }))
    .mutation(async ({ ctx, input }) => {
      return batchDispatch(ctx.user.id, input.actionId, input.inputs, input.source);
    }),

  /** List all available actions (for command bar hints, UI) */
  listActions: protectedProcedure.query(() => {
    return listActions().map((a) => ({
      id: a.id,
      label: a.label,
      description: a.description,
      mode: a.mode,
    }));
  }),
});
