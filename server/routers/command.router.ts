/**
 * AI Command Bar Router — thin layer delegating to commandService
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as commandService from "../services/command.service";
import { trackEvent } from "../services/analytics.service";

export const commandRouter = router({
  execute: protectedProcedure
    .input(z.object({ command: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const startMs = Date.now();
      const result = await commandService.executeCommand(ctx.user.id, input.command);
      trackEvent(ctx.user.id, "command_executed", {
        query: input.command,
        source: "command",
        durationMs: Date.now() - startMs,
        success: true,
      }).catch(() => {});
      return result;
    }),
});
