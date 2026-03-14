import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import * as db from "./db";

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
    generateBrief: protectedProcedure.mutation(async ({ ctx }) => {
      const stats = await db.getDashboardStats(ctx.user.id);
      const tasksResult = await db.getTasks(ctx.user.id, { view: "today", limit: 10 });
      const opps = await db.getOpportunities(ctx.user.id, { status: "open", limit: 5 });

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

      const content = response.choices[0]?.message?.content;
      const briefJson = typeof content === "string" ? JSON.parse(content) : {};
      const date = new Date().toISOString().split("T")[0];
      await db.saveDailyBrief(ctx.user.id, date, briefJson);
      return briefJson;
    }),
  }),

  // ─── People ──────────────────────────────────────────────────
  people: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        tag: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getPeople(ctx.user.id, input ?? {});
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const person = await db.getPersonById(ctx.user.id, input.id);
        if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
        const notes = await db.getPersonNotes(input.id);
        const interactionsList = await db.getInteractions(ctx.user.id, input.id, 20);
        return { ...person, notes, interactions: interactionsList };
      }),
    create: protectedProcedure
      .input(z.object({
        fullName: z.string().min(1),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        title: z.string().optional(),
        company: z.string().optional(),
        location: z.string().optional(),
        linkedinUrl: z.string().optional(),
        websiteUrl: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        sourceType: z.string().optional(),
        sourceUrl: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createPerson(ctx.user.id, input);
        await db.logActivity(ctx.user.id, {
          activityType: "person_added",
          title: `Added ${input.fullName}`,
          entityType: "person",
          entityId: id ?? undefined,
        });
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        fullName: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        title: z.string().optional(),
        company: z.string().optional(),
        location: z.string().optional(),
        linkedinUrl: z.string().optional(),
        websiteUrl: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.string().optional(),
        aiSummary: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updatePerson(ctx.user.id, id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deletePerson(ctx.user.id, input.id);
        await db.logActivity(ctx.user.id, {
          activityType: "person_deleted",
          title: "Removed a contact",
          entityType: "person",
          entityId: input.id,
        });
        return { success: true };
      }),
    addNote: protectedProcedure
      .input(z.object({ personId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await db.addPersonNote(ctx.user.id, input.personId, input.content);
        return { success: true };
      }),
    addInteraction: protectedProcedure
      .input(z.object({
        personId: z.number(),
        interactionType: z.string(),
        channel: z.string().optional(),
        content: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.addInteraction(ctx.user.id, { ...input, occurredAt: new Date() });
        return { success: true };
      }),
    generateSummary: protectedProcedure
      .input(z.object({ personId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const person = await db.getPersonById(ctx.user.id, input.personId);
        if (!person) throw new TRPCError({ code: "NOT_FOUND" });
        const notes = await db.getPersonNotes(input.personId);
        const ints = await db.getInteractions(ctx.user.id, input.personId, 10);
        const goals = await db.getUserGoals(ctx.user.id);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Generate a concise networking summary for this person. Explain why they matter to the user's goals. Return JSON: { "summary": "...", "keyPoints": ["..."], "connectionStrength": "strong|moderate|new" }`
            },
            {
              role: "user",
              content: `Person: ${JSON.stringify(person)}\nNotes: ${JSON.stringify(notes)}\nInteractions: ${JSON.stringify(ints)}\nUser goals: ${JSON.stringify(goals)}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : {};
        await db.updatePerson(ctx.user.id, input.personId, { aiSummary: parsed.summary ?? "" });
        return parsed;
      }),
  }),

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
        await db.addPersonToList(input.listId, input.personId);
        return { success: true };
      }),
    removePerson: protectedProcedure
      .input(z.object({ listId: z.number(), personId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.removePersonFromList(input.listId, input.personId);
        return { success: true };
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

  // ─── Opportunities ──────────────────────────────────────────
  opportunities: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        personId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getOpportunities(ctx.user.id, input ?? {});
      }),
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        opportunityType: z.string(),
        signalSummary: z.string(),
        personId: z.number().optional(),
        whyItMatters: z.string().optional(),
        recommendedAction: z.string().optional(),
        score: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createOpportunity(ctx.user.id, input);
        await db.logActivity(ctx.user.id, {
          activityType: "opportunity_created",
          title: `New opportunity: ${input.title}`,
          entityType: "opportunity",
          entityId: id ?? undefined,
        });
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.string().optional(),
        title: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateOpportunity(ctx.user.id, id, data);
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

        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : {};
        const draftId = await db.createDraft(ctx.user.id, {
          personId: input.personId,
          draftType: "outreach",
          tone: input.tone ?? "professional",
          subject: parsed.subject ?? "",
          body: parsed.body ?? "",
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

  // ─── Discover ────────────────────────────────────────────────
  discover: router({
    search: protectedProcedure
      .input(z.object({
        query: z.string().min(1),
        filters: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const goals = await db.getUserGoals(ctx.user.id);
        const queryId = await db.createSearchQuery(ctx.user.id, input.query, input.filters as Record<string, unknown>);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a networking discovery engine. Based on the search query and user goals, generate a list of 5-8 relevant people profiles. Return JSON: { "results": [{ "fullName": "...", "title": "...", "company": "...", "location": "...", "relevanceScore": 0.85, "whyRelevant": "...", "linkedinUrl": "", "sourceType": "web" }] }`
            },
            {
              role: "user",
              content: `Search: "${input.query}"\nFilters: ${JSON.stringify(input.filters ?? {})}\nUser goals: ${JSON.stringify(goals)}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : { results: [] };
        const results = parsed.results ?? [];

        if (queryId) {
          await db.saveSearchResults(queryId, results.map((r: Record<string, unknown>, i: number) => ({
            personSnapshotJson: r,
            rank: i + 1,
          })));
        }

        await db.logActivity(ctx.user.id, {
          activityType: "discovery_search",
          title: `Searched: "${input.query}"`,
          metadataJson: { resultCount: results.length },
        });

        return { queryId, results };
      }),
    savePerson: protectedProcedure
      .input(z.object({
        fullName: z.string(),
        title: z.string().optional(),
        company: z.string().optional(),
        location: z.string().optional(),
        linkedinUrl: z.string().optional(),
        sourceType: z.string().optional(),
        relevanceScore: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const names = input.fullName.split(" ");
        const id = await db.createPerson(ctx.user.id, {
          ...input,
          firstName: names[0],
          lastName: names.slice(1).join(" "),
          status: "saved",
        });
        await db.logActivity(ctx.user.id, {
          activityType: "person_saved_from_discovery",
          title: `Saved ${input.fullName} from discovery`,
          entityType: "person",
          entityId: id ?? undefined,
        });
        return { id };
      }),
  }),

  // ─── Voice ───────────────────────────────────────────────────
  voice: router({
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

        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : {};

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
      return {
        user: ctx.user,
        goals,
      };
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

        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : {};

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
