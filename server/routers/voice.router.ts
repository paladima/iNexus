/**
 * #17: Voice router — transcription, intent parsing, audio upload
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import * as db from "../db";
import { parseLLMWithSchema, voiceIntentSchema } from "../llmHelpers";

export const voiceRouter = router({
  transcribe: protectedProcedure
    .input(z.object({
      audioUrl: z.string(),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await transcribeAudio(input);
      if ("error" in result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return result;
    }),
  parseIntent: protectedProcedure
    .input(z.object({ transcript: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Parse this voice transcript into structured networking actions. Return JSON: { "people": [{ "name": "...", "context": "..." }], "tasks": [{ "title": "...", "dueHint": "..." }], "notes": [{ "personName": "...", "content": "..." }], "reminders": [{ "text": "...", "when": "..." }] }`
          },
          { role: "user", content: input.transcript }
        ],
        response_format: { type: "json_object" },
      });

      const parsed = parseLLMWithSchema(response, voiceIntentSchema, "voice.parseIntent", { people: [], tasks: [], notes: [], reminders: [] });

      const captureId = await db.createVoiceCapture(ctx.user.id, {
        transcript: input.transcript,
        parsedJson: parsed,
        status: "parsed",
      });

      await db.logActivity(ctx.user.id, {
        activityType: "voice_capture",
        title: "Voice note captured",
        entityType: "voice_capture",
        entityId: captureId ?? undefined,
      });

      return { id: captureId, ...parsed };
    }),
  uploadAudio: protectedProcedure
    .input(z.object({ audioBase64: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const ext = input.mimeType.includes("webm") ? "webm" : "mp3";
      const key = `voice/${ctx.user.id}/${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
  history: protectedProcedure.query(async ({ ctx }) => {
    return db.getVoiceCaptures(ctx.user.id);
  }),
});
