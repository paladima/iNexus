/**
 * AI Command Bar Router — thin layer delegating to commandService
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as commandService from "../services/command.service";

export const commandRouter = router({
  execute: protectedProcedure
    .input(z.object({ command: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return commandService.executeCommand(ctx.user.id, input.command);
    }),
});
