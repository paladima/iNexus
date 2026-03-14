/**
 * Voice Router (#17) — Full confirm-edit-save workflow
 * Flow: upload → transcribe → parse → confirm/edit → save actions
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import * as repo from "../repositories";
import { parseLLMWithSchema, voiceIntentSchema } from "../llmHelpers";

export const voiceRouter = router({
  // Step 1: Upload audio
  uploadAudio: protectedProcedure
    .input(z.object({ audioBase64: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const ext = input.mimeType.includes("webm") ? "webm" : "mp3";
      const key = `voice/${ctx.user.id}/${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  // Step 2: Transcribe
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

  // Step 3: Parse intent from transcript
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

      const captureId = await repo.createVoiceCapture(ctx.user.id, {
        transcript: input.transcript,
        parsedJson: parsed,
        status: "parsed",
      });

      await repo.logActivity(ctx.user.id, {
        activityType: "voice_capture",
        title: "Voice note captured",
        entityType: "voice_capture",
        entityId: captureId ?? undefined,
      });

      return { id: captureId, ...parsed };
    }),

  // Step 4: Confirm and save parsed actions (with optional edits)
  confirmActions: protectedProcedure
    .input(z.object({
      captureId: z.number(),
      people: z.array(z.object({
        name: z.string(),
        role: z.string().optional(),
        company: z.string().optional(),
        action: z.string().optional(),
        save: z.boolean().default(true),
      })).default([]),
      tasks: z.array(z.object({
        title: z.string(),
        priority: z.string().default("medium"),
        dueDate: z.string().optional(),
        save: z.boolean().default(true),
      })).default([]),
      notes: z.array(z.object({
        personName: z.string().optional(),
        content: z.string(),
        save: z.boolean().default(true),
      })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = { savedPeople: 0, savedTasks: 0, savedNotes: 0 };

      // Save people
      for (const p of input.people.filter(p => p.save)) {
        const names = p.name.split(" ");
        await repo.createPerson(ctx.user.id, {
          fullName: p.name,
          firstName: names[0],
          lastName: names.slice(1).join(" "),
          title: p.role,
          company: p.company,
          status: "saved",
          sourceType: "voice",
        });
        results.savedPeople++;
      }

      // Save tasks
      for (const t of input.tasks.filter(t => t.save)) {
        const dueAt = t.dueDate ? new Date(t.dueDate) : undefined;
        await repo.createTask(ctx.user.id, {
          title: t.title,
          priority: t.priority,
          dueAt,
          source: "voice",
        });
        results.savedTasks++;
      }

      // Save notes (attach to person if found)
      for (const n of input.notes.filter(n => n.save)) {
        if (n.personName) {
          const { items } = await repo.getPeople(ctx.user.id, { search: n.personName, limit: 1 });
          if (items.length > 0) {
            await repo.addPersonNote(ctx.user.id, items[0].id, n.content, "voice", "ai");
          }
        }
        results.savedNotes++;
      }

      // Update capture status
      await repo.updateVoiceCapture(ctx.user.id, input.captureId, { status: "confirmed" });

      await repo.logActivity(ctx.user.id, {
        activityType: "voice_actions_confirmed",
        title: `Confirmed voice actions: ${results.savedPeople} people, ${results.savedTasks} tasks, ${results.savedNotes} notes`,
        entityType: "voice_capture",
        entityId: input.captureId,
      });

      return results;
    }),

  // Get capture history
  history: protectedProcedure.query(async ({ ctx }) => {
    return repo.getVoiceCaptures(ctx.user.id);
  }),

  // Get single capture detail
  getCapture: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return repo.getVoiceCaptureById(ctx.user.id, input.id);
    }),
});
