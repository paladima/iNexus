import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as repo from "./repositories";
import { enqueueJob, pollJobStatus } from "./services/job.service";
import {
  parseLLMWithSchema,
  dailyBriefSchema,
  draftSchema,
  aiCommandSchema as aiCommandLLMSchema,
} from "./llmHelpers";

// #17: Split routers for maintainability
import { discoverRouter } from "./routers/discover.router";
import { opportunitiesRouter } from "./routers/opportunities.router";
import { voiceRouter } from "./routers/voice.router";
import { peopleRouter } from "./routers/people.router";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Onboarding ──────────────────────────────────────────────
  onboarding: router({
    getGoals: protectedProcedure.query(async ({ ctx }) => {
      return repo.getUserGoals(ctx.user.id);
    }),
    saveGoals: protectedProcedure
      .input(z.object({
        primaryGoal: z.string().optional(),
        industries: z.array(z.string()).optional(),
        geographies: z.array(z.string()).optional(),
        preferences: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await repo.upsertUserGoals(ctx.user.id, input);
        await repo.logActivity(ctx.user.id, {
          activityType: "onboarding_goals_saved",
          title: "Updated networking goals",
        });
        return { success: true };
      }),
    complete: protectedProcedure.mutation(async ({ ctx }) => {
      await repo.updateUserSettings(ctx.user.id, { onboardingCompleted: 1 });
      await repo.logActivity(ctx.user.id, {
        activityType: "onboarding_completed",
        title: "Completed onboarding",
      });
      return { success: true };
    }),
  }),

  // ─── Dashboard ───────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return repo.getDashboardStats(ctx.user.id);
    }),
    dailyBrief: protectedProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const date = input?.date ?? new Date().toISOString().split("T")[0];
        return repo.getDailyBrief(ctx.user.id, date);
      }),
    // #5/#6: Use job system for async brief generation
    generateBrief: protectedProcedure.mutation(async ({ ctx }) => {
      const jobId = await enqueueJob(ctx.user.id, "generate_brief");
      return { status: "generating", jobId, message: "Daily brief is being generated. Refresh in a few seconds." };
    }),
  }),

  // #17: Split routers
  people: peopleRouter,
  discover: discoverRouter,
  opportunities: opportunitiesRouter,
  voice: voiceRouter,

  // ─── Lists ───────────────────────────────────────────────────
  lists: router({
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
    // #5/#6: Use job system for batch outreach
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
  }),

  // ─── Tasks ───────────────────────────────────────────────────
  tasks: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        personId: z.number().optional(),
        view: z.enum(["today", "upcoming", "completed"]).optional(),
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
        listId: z.number().optional(),
        dueAt: z.string().optional(),
        priority: z.string().optional(),
        source: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { dueAt, ...rest } = input;
        const id = await repo.createTask(ctx.user.id, {
          ...rest,
          dueAt: dueAt ? new Date(dueAt) : undefined,
        });
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
        dueAt: z.string().nullable().optional(),
        priority: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, dueAt, ...rest } = input;
        const data: Record<string, unknown> = { ...rest };
        if (dueAt !== undefined) data.dueAt = dueAt ? new Date(dueAt) : null;
        if (rest.status === "completed") data.completedAt = new Date();
        await repo.updateTask(ctx.user.id, id, data);
        if (rest.status === "completed") {
          await repo.logActivity(ctx.user.id, {
            activityType: "task_completed",
            title: `Completed a task`,
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
  }),

  // ─── Drafts ──────────────────────────────────────────────────
  drafts: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        personId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return repo.getDrafts(ctx.user.id, input ?? {});
      }),
    create: protectedProcedure
      .input(z.object({
        personId: z.number().optional(),
        listId: z.number().optional(),
        draftType: z.string(),
        tone: z.string().optional(),
        subject: z.string().optional(),
        body: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await repo.createDraft(ctx.user.id, input);
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        body: z.string().optional(),
        subject: z.string().optional(),
        tone: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await repo.updateDraft(ctx.user.id, id, data);
        if (data.status === "approved") {
          await repo.logActivity(ctx.user.id, {
            activityType: "draft_approved",
            title: "Approved a message draft",
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
    generate: protectedProcedure
      .input(z.object({
        personId: z.number(),
        tone: z.string().optional(),
        context: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const person = await repo.getPersonById(ctx.user.id, input.personId);
        if (!person) throw new TRPCError({ code: "NOT_FOUND" });
        const goals = await repo.getUserGoals(ctx.user.id);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a professional networking message writer. Generate a personalized outreach message. Tone: ${input.tone ?? "professional"}. Return JSON: { "subject": "...", "body": "...", "versions": [{ "tone": "...", "body": "..." }] }`
            },
            {
              role: "user",
              content: `Person: ${JSON.stringify(person)}\nUser goals: ${JSON.stringify(goals)}\nAdditional context: ${input.context ?? "Initial outreach"}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const parsed = parseLLMWithSchema(response, draftSchema, "drafts.generate", { subject: "", body: "" });
        const draftId = await repo.createDraft(ctx.user.id, {
          personId: input.personId,
          draftType: "outreach",
          tone: input.tone ?? "professional",
          subject: parsed.subject,
          body: parsed.body,
        });
        await repo.logActivity(ctx.user.id, {
          activityType: "draft_generated",
          title: `Generated draft for ${person.fullName}`,
          entityType: "draft",
          entityId: draftId ?? undefined,
        });
        return { id: draftId, ...parsed };
      }),
  }),

  // ─── Activity ────────────────────────────────────────────────
  activity: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return repo.getActivityLog(ctx.user.id, input?.limit ?? 50, input?.offset ?? 0);
      }),
  }),

  // ─── Settings ────────────────────────────────────────────────
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const goals = await repo.getUserGoals(ctx.user.id);
      return { user: ctx.user, goals };
    }),
    update: protectedProcedure
      .input(z.object({
        timezone: z.string().optional(),
        language: z.string().optional(),
        dailyBriefEnabled: z.number().optional(),
        reminderMode: z.string().optional(),
        name: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await repo.updateUserSettings(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── Relationships & Warm Paths ──────────────────────────────
  relationships: router({
    forPerson: protectedProcedure
      .input(z.object({ personId: z.number() }))
      .query(async ({ ctx, input }) => {
        return repo.getRelationshipsForPerson(ctx.user.id, input.personId);
      }),
    create: protectedProcedure
      .input(z.object({
        personAId: z.number(),
        personBId: z.number(),
        relationshipType: z.string(),
        confidence: z.string().optional(),
        source: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await repo.createRelationship(ctx.user.id, input);
        return { id };
      }),
    warmPaths: protectedProcedure
      .input(z.object({ targetPersonId: z.number() }))
      .query(async ({ ctx, input }) => {
        return repo.findWarmPaths(ctx.user.id, input.targetPersonId);
      }),
  }),

  // ─── Jobs (status polling + manual triggers) ─────────────────
  jobs: router({
    status: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        const status = await pollJobStatus(input.jobId);
        if (!status) throw new TRPCError({ code: "NOT_FOUND" });
        return status;
      }),
    triggerBrief: protectedProcedure.mutation(async ({ ctx }) => {
      const jobId = await enqueueJob(ctx.user.id, "generate_brief");
      return { jobId };
    }),
    triggerOpportunityScan: protectedProcedure.mutation(async ({ ctx }) => {
      const jobId = await enqueueJob(ctx.user.id, "scan_opportunities");
      return { jobId };
    }),
  }),

  // ─── AI Command Bar ─────────────────────────────────────────
  ai: router({
    command: protectedProcedure
      .input(z.object({ command: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const goals = await repo.getUserGoals(ctx.user.id);
        const stats = await repo.getDashboardStats(ctx.user.id);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are iNexus AI assistant. Parse the user's command and determine the action. Return JSON: { "action": "search|add_person|create_task|generate_draft|navigate|info", "params": {...}, "response": "Human-readable response" }`
            },
            {
              role: "user",
              content: `Command: "${input.command}"\nUser goals: ${JSON.stringify(goals)}\nCurrent stats: ${JSON.stringify(stats)}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const parsed = parseLLMWithSchema(response, aiCommandLLMSchema, "ai.command", { action: "info", params: {}, response: "" });

        await repo.logActivity(ctx.user.id, {
          activityType: "ai_command",
          title: `AI command: "${input.command}"`,
          metadataJson: { action: parsed.action },
        });

        return parsed;
      }),
  }),

  // ─── Health (#20) ───────────────────────────────────────────
  health: router({
    check: publicProcedure.query(async () => {
      const dbOk = await repo.healthCheck();
      return {
        status: dbOk ? "healthy" : "degraded",
        timestamp: Date.now(),
        db: dbOk ? "connected" : "unavailable",
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
