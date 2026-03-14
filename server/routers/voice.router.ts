/**
 * Voice Router — thin layer delegating to voiceService
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import * as voiceService from "../services/voice.service";
import * as unlinkedNotesService from "../services/unlinkedNotes.service";

export const voiceRouter = router({
  uploadAudio: protectedProcedure
    .input(z.object({ audioBase64: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return voiceService.uploadAudio(ctx.user.id, input.audioBase64, input.mimeType);
    }),

  transcribe: protectedProcedure
    .input(z.object({
      audioUrl: z.string(),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await voiceService.transcribeAudioFile(input.audioUrl, input.language);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
      }
    }),

  parseIntent: protectedProcedure
    .input(z.object({ transcript: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return voiceService.parseVoiceIntent(ctx.user.id, input.transcript);
    }),

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
      return voiceService.confirmVoiceActions(
        ctx.user.id,
        input.captureId,
        input.people,
        input.tasks,
        input.notes
      );
    }),

  editCapture: protectedProcedure
    .input(z.object({
      captureId: z.number(),
      parsed: z.object({
        people: z.array(z.object({
          name: z.string(),
          role: z.string().optional(),
          company: z.string().optional(),
          action: z.string().optional(),
        })),
        tasks: z.array(z.object({
          title: z.string(),
          priority: z.string().optional(),
          dueDate: z.string().optional(),
        })),
        notes: z.array(z.object({
          personName: z.string().optional(),
          content: z.string(),
        })),
        reminders: z.array(z.object({
          text: z.string(),
          datetime: z.string().optional(),
        })),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      return voiceService.editVoiceCapture(ctx.user.id, input.captureId, input.parsed);
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    return repo.getVoiceCaptures(ctx.user.id);
  }),

  getCapture: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return repo.getVoiceCaptureById(ctx.user.id, input.id);
    }),

  /** Unlinked notes management (#13 v11) */
  unlinkedNotes: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().optional(),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      return unlinkedNotesService.getUnlinkedNotes(ctx.user.id, input);
    }),

  linkNote: protectedProcedure
    .input(z.object({ noteId: z.number(), personId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await unlinkedNotesService.linkNoteToPerson(ctx.user.id, input.noteId, input.personId);
      return { linked: true };
    }),

  deleteNote: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await unlinkedNotesService.deleteNote(ctx.user.id, input.noteId);
      return { deleted: true };
    }),
});
