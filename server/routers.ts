import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { runAllWorkers, generateDailyBriefForUser, scanOpportunitiesForUser } from "./workers";
import {
  parseLLMWithSchema,
  dailyBriefSchema,
  draftSchema,
  aiCommandSchema,
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
      return db.getUserGoals(ctx.user.id);
    }),
    saveGoals: protectedProcedure
      .input(z.object({
        primaryGoal: z.string().optional(),
        industries: z.array(z.string()).optional(),
        geographies: z.array(z.string()).optional(),
        preferences: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserGoals(ctx.user.id, input);
        await db.logActivity(ctx.user.id, {
          activityType: "onboarding_goals_saved",
          title: "Updated networking goals",
        });
        return { success: true };
      }),
    complete: protectedProcedure.mutation(async ({ ctx }) => {
      await db.updateUserSettings(ctx.user.id, { onboardingCompleted: 1 });
      await db.logActivity(ctx.user.id, {
        activityType: "onboarding_completed",
        title: "Completed onboarding",
      });
      return { success: true };
    }),
  }),

  // ─── Dashboard ───────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return db.getDashboardStats(ctx.user.id);
    }),
    dailyBrief: protectedProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const date = input?.date ?? new Date().toISOString().split("T")[0];
        return db.getDailyBrief(ctx.user.id, date);
      }),
    // #13: Generate brief in background, return status immediately
    generateBrief: protectedProcedure.mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      const date = new Date().toISOString().split("T")[0];

      (async () => {
        try {
          const stats = await db.getDashboardStats(userId);
          const tasksResult = await db.getTasks(userId, { view: "today", limit: 10 });
          const opps = await db.getOpportunities(userId, { status: "open", limit: 5 });

          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an AI networking assistant. Generate a daily brief with top 3-5 actionable items. Return JSON: { "greeting": "...", "items": [{ "title": "...", "description": "...", "priority": "high|medium|low", "type": "task|opportunity|follow_up" }], "summary": "..." }`
              },
              {
                role: "user",
                content: `Stats: ${JSON.stringify(stats)}\nToday's tasks: ${JSON.stringify(tasksResult.items)}\nOpen opportunities: ${JSON.stringify(opps.items)}`
              }
            ],
            response_format: { type: "json_object" },
          });

          const briefJson = parseLLMWithSchema(response, dailyBriefSchema, "dashboard.generateBrief", { greeting: "", items: [], summary: "" });
          await db.saveDailyBrief(userId, date, briefJson);
          console.log(`[DailyBrief] Background generation complete for user ${userId}`);
        } catch (error) {
          console.error(`[DailyBrief] Background generation failed for user ${userId}:`, error);
        }
      })();

      return { status: "generating", message: "Daily brief is being generated. Refresh in a few seconds." };
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
      return db.getLists(ctx.user.id);
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const list = await db.getListById(ctx.user.id, input.id);
        if (!list) throw new TRPCError({ code: "NOT_FOUND" });
        const people = await db.getListPeople(ctx.user.id, input.id);
        return { ...list, people };
      }),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createList(ctx.user.id, input.name, input.description);
        await db.logActivity(ctx.user.id, {
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
        await db.updateList(ctx.user.id, id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteList(ctx.user.id, input.id);
        return { success: true };
      }),
    addPerson: protectedProcedure
      .input(z.object({ listId: z.number(), personId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.addPersonToList(ctx.user.id, input.listId, input.personId);
        return { success: true };
      }),
    removePerson: protectedProcedure
      .input(z.object({ listId: z.number(), personId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.removePersonFromList(ctx.user.id, input.listId, input.personId);
        return { success: true };
      }),
    batchOutreach: protectedProcedure
      .input(z.object({
        listId: z.number(),
        tone: z.string().optional(),
        context: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const listPeople = await db.getListPeopleForBatch(ctx.user.id, input.listId);
        if (listPeople.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "List is empty" });
        const goals = await db.getUserGoals(ctx.user.id);
        const draftsCreated: Array<{ personId: number; personName: string; draftId: number | null }> = [];

        for (const { person } of listPeople) {
          try {
            const response = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `Generate a personalized outreach message. Tone: ${input.tone ?? "professional"}. Return JSON: { "subject": "...", "body": "..." }`
                },
                {
                  role: "user",
                  content: `Person: ${JSON.stringify(person)}\nUser goals: ${JSON.stringify(goals)}\nContext: ${input.context ?? "Batch outreach for list"}`
                }
              ],
              response_format: { type: "json_object" },
            });
            const parsed = parseLLMWithSchema(response, draftSchema, "lists.batchOutreach", { subject: "", body: "" });
            const draftId = await db.createDraft(ctx.user.id, {
              personId: person.id,
              listId: input.listId,
              draftType: "batch_outreach",
              tone: input.tone ?? "professional",
              subject: parsed.subject,
              body: parsed.body,
            });
            draftsCreated.push({ personId: person.id, personName: person.fullName, draftId });
          } catch (err) {
            console.error(`[BatchOutreach] Failed for person ${person.id}:`, err);
            draftsCreated.push({ personId: person.id, personName: person.fullName, draftId: null });
          }
        }

        await db.logActivity(ctx.user.id, {
          activityType: "batch_outreach",
          title: `Batch outreach: ${draftsCreated.length} drafts for list`,
          entityType: "list",
          entityId: input.listId,
          metadataJson: { count: draftsCreated.length },
        });
        return { drafts: draftsCreated, total: draftsCreated.length };
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
        return db.getTasks(ctx.user.id, input ?? {});
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
        const id = await db.createTask(ctx.user.id, {
          ...rest,
          dueAt: dueAt ? new Date(dueAt) : undefined,
        });
        await db.logActivity(ctx.user.id, {
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
        await db.updateTask(ctx.user.id, id, data);
        if (rest.status === "completed") {
          await db.logActivity(ctx.user.id, {
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
        await db.deleteTask(ctx.user.id, input.id);
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
        return db.getDrafts(ctx.user.id, input ?? {});
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
        const id = await db.createDraft(ctx.user.id, input);
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
        await db.updateDraft(ctx.user.id, id, data);
        if (data.status === "approved") {
          await db.logActivity(ctx.user.id, {
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
        await db.deleteDraft(ctx.user.id, input.id);
        return { success: true };
      }),
    generate: protectedProcedure
      .input(z.object({
        personId: z.number(),
        tone: z.string().optional(),
        context: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const person = await db.getPersonById(ctx.user.id, input.personId);
        if (!person) throw new TRPCError({ code: "NOT_FOUND" });
        const goals = await db.getUserGoals(ctx.user.id);

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
        const draftId = await db.createDraft(ctx.user.id, {
          personId: input.personId,
          draftType: "outreach",
          tone: input.tone ?? "professional",
          subject: parsed.subject,
          body: parsed.body,
        });
        await db.logActivity(ctx.user.id, {
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
        return db.getActivityLog(ctx.user.id, input?.limit ?? 50, input?.offset ?? 0);
      }),
  }),

  // ─── Settings ────────────────────────────────────────────────
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const goals = await db.getUserGoals(ctx.user.id);
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
        await db.updateUserSettings(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── Relationships & Warm Paths ──────────────────────────────
  relationships: router({
    forPerson: protectedProcedure
      .input(z.object({ personId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getRelationshipsForPerson(ctx.user.id, input.personId);
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
        const id = await db.createRelationship(ctx.user.id, input);
        return { id };
      }),
    warmPaths: protectedProcedure
      .input(z.object({ targetPersonId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.findWarmPaths(ctx.user.id, input.targetPersonId);
      }),
  }),

  // ─── Workers (manual trigger) ───────────────────────────────
  workers: router({
    runAll: protectedProcedure.mutation(async () => {
      await runAllWorkers();
      return { success: true };
    }),
    generateBrief: protectedProcedure.mutation(async ({ ctx }) => {
      await generateDailyBriefForUser(ctx.user.id);
      return { success: true };
    }),
    scanOpportunities: protectedProcedure.mutation(async ({ ctx }) => {
      await scanOpportunitiesForUser(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── AI Command Bar ─────────────────────────────────────────
  ai: router({
    command: protectedProcedure
      .input(z.object({ command: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const goals = await db.getUserGoals(ctx.user.id);
        const stats = await db.getDashboardStats(ctx.user.id);

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

        const parsed = parseLLMWithSchema(response, aiCommandSchema, "ai.command", { action: "info", params: {}, response: "" });

        await db.logActivity(ctx.user.id, {
          activityType: "ai_command",
          title: `AI command: "${input.command}"`,
          metadataJson: { action: parsed.action },
        });

        return parsed;
      }),
  }),
});

export type AppRouter = typeof appRouter;
