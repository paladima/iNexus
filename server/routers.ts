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
import { runAllWorkers, generateDailyBriefForUser, scanOpportunitiesForUser } from "./workers";

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
            const content = response.choices[0]?.message?.content;
            const parsed = typeof content === "string" ? JSON.parse(content) : {};
            const draftId = await db.createDraft(ctx.user.id, {
              personId: person.id,
              listId: input.listId,
              draftType: "batch_outreach",
              tone: input.tone ?? "professional",
              subject: parsed.subject ?? "",
              body: parsed.body ?? "",
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
    generateDraft: protectedProcedure
      .input(z.object({
        opportunityId: z.number(),
        tone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const opp = await db.getOpportunityById(ctx.user.id, input.opportunityId);
        if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
        let person = null;
        if (opp.personId) person = await db.getPersonById(ctx.user.id, opp.personId);
        const goals = await db.getUserGoals(ctx.user.id);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a professional networking message writer. Generate a message based on a detected opportunity. Tone: ${input.tone ?? "professional"}. Return JSON: { "subject": "...", "body": "..." }`
            },
            {
              role: "user",
              content: `Opportunity: ${JSON.stringify(opp)}\nPerson: ${JSON.stringify(person)}\nUser goals: ${JSON.stringify(goals)}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : {};
        const draftId = await db.createDraft(ctx.user.id, {
          personId: opp.personId ?? undefined,
          draftType: "opportunity_outreach",
          tone: input.tone ?? "professional",
          subject: parsed.subject ?? "",
          body: parsed.body ?? "",
          metadataJson: { opportunityId: input.opportunityId },
        });
        await db.logActivity(ctx.user.id, {
          activityType: "draft_from_opportunity",
          title: `Generated draft from opportunity: ${opp.title}`,
          entityType: "draft",
          entityId: draftId ?? undefined,
        });
        return { id: draftId, ...parsed };
      }),
    createTask: protectedProcedure
      .input(z.object({
        opportunityId: z.number(),
        title: z.string().optional(),
        dueAt: z.string().optional(),
        priority: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const opp = await db.getOpportunityById(ctx.user.id, input.opportunityId);
        if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
        const taskId = await db.createTask(ctx.user.id, {
          title: input.title ?? opp.recommendedAction ?? `Follow up on: ${opp.title}`,
          description: opp.signalSummary,
          personId: opp.personId ?? undefined,
          opportunityId: input.opportunityId,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          priority: input.priority ?? "medium",
          source: "opportunity",
        });
        await db.logActivity(ctx.user.id, {
          activityType: "task_from_opportunity",
          title: `Created task from opportunity: ${opp.title}`,
          entityType: "task",
          entityId: taskId ?? undefined,
        });
        return { id: taskId };
      }),
    generateIntro: protectedProcedure
      .input(z.object({
        opportunityId: z.number(),
        tone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const opp = await db.getOpportunityById(ctx.user.id, input.opportunityId);
        if (!opp) throw new TRPCError({ code: "NOT_FOUND" });
        const meta = opp.metadataJson as Record<string, unknown> | null;
        const personAId = meta?.personAId as number | undefined;
        const personBId = meta?.personBId as number | undefined;
        let personA = null, personB = null;
        if (personAId) personA = await db.getPersonById(ctx.user.id, personAId);
        if (personBId) personB = await db.getPersonById(ctx.user.id, personBId);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a professional networking assistant. Write an introduction message connecting two people. Tone: ${input.tone ?? "warm"}. Return JSON: { "subject": "...", "body": "..." }`
            },
            {
              role: "user",
              content: `Person A: ${JSON.stringify(personA)}\nPerson B: ${JSON.stringify(personB)}\nReason for intro: ${opp.signalSummary}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : {};
        const draftId = await db.createDraft(ctx.user.id, {
          draftType: "intro_message",
          tone: input.tone ?? "warm",
          subject: parsed.subject ?? "",
          body: parsed.body ?? "",
          metadataJson: { opportunityId: input.opportunityId, personAId, personBId },
        });
        await db.logActivity(ctx.user.id, {
          activityType: "intro_draft_generated",
          title: `Generated intro between ${personA?.fullName ?? "?"} and ${personB?.fullName ?? "?"}`,
          entityType: "draft",
          entityId: draftId ?? undefined,
        });
        return { id: draftId, ...parsed };
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

  // ─── Discover (Intent Decomposition + Role-Aware Ranking) ───
  discover: router({
    search: protectedProcedure
      .input(z.object({
        query: z.string().min(1),
        filters: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const goals = await db.getUserGoals(ctx.user.id);

        // Step 1: Intent Decomposition — parse query into structured intent
        const intentResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a search intent parser for a networking tool. Decompose the user's search query into structured intent. Return JSON: { "topic": "...", "role": "...", "geo": "...", "industry": "...", "speaker": true/false, "negatives": ["..."], "queryVariants": ["variant1", "variant2", "variant3"] }. queryVariants should be 2-3 alternative phrasings of the same search to broaden recall.`
            },
            {
              role: "user",
              content: `Query: "${input.query}"\nUser goals: ${JSON.stringify(goals)}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const intentContent = intentResponse.choices[0]?.message?.content;
        const intent = typeof intentContent === "string" ? JSON.parse(intentContent) : {};
        const queryVariants = intent.queryVariants ?? [input.query];
        const negatives = intent.negatives ?? [];

        // Save search query with parsed intents
        const queryId = await db.createSearchQuery(ctx.user.id, input.query, input.filters as Record<string, unknown>, {
          parsedIntentsJson: intent,
          queryVariantsJson: queryVariants,
          negativeTermsJson: negatives,
        });

        // Step 2: Multi-query search — generate candidates from all variants
        const searchResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a networking discovery engine with role-aware ranking. Generate 8-12 relevant people profiles based on the search intent. For each person, provide scoring on 6 axes (0-1 each):\n- roleMatch: how well their title/role matches the query\n- industryMatch: alignment with target industry\n- geoMatch: geographic relevance\n- seniorityMatch: appropriate seniority level\n- goalAlignment: relevance to user's networking goals\n- signalStrength: strength of the networking signal\n\nReturn JSON: { "results": [{ "fullName": "...", "title": "...", "company": "...", "location": "...", "sourceType": "web", "linkedinUrl": "", "scoring": { "roleMatch": 0.9, "industryMatch": 0.8, "geoMatch": 0.7, "seniorityMatch": 0.85, "goalAlignment": 0.9, "signalStrength": 0.75 }, "matchReasons": ["reason1", "reason2"], "whyRelevant": "..." }] }. Exclude anyone matching these negatives: ${JSON.stringify(negatives)}`
            },
            {
              role: "user",
              content: `Intent: ${JSON.stringify(intent)}\nQuery variants: ${JSON.stringify(queryVariants)}\nFilters: ${JSON.stringify(input.filters ?? {})}\nUser goals: ${JSON.stringify(goals)}`
            }
          ],
          response_format: { type: "json_object" },
        });

        const searchContent = searchResponse.choices[0]?.message?.content;
        const searchParsed = typeof searchContent === "string" ? JSON.parse(searchContent) : { results: [] };
        let results = searchParsed.results ?? [];

        // Step 3: Score and rank with weighted formula
        const weights = { roleMatch: 0.25, industryMatch: 0.20, geoMatch: 0.15, seniorityMatch: 0.15, goalAlignment: 0.15, signalStrength: 0.10 };
        results = results.map((r: Record<string, unknown>) => {
          const scoring = (r.scoring ?? {}) as Record<string, number>;
          const totalScore = Object.entries(weights).reduce((sum, [key, weight]) => {
            return sum + (scoring[key] ?? 0) * weight;
          }, 0);
          return { ...r, relevanceScore: Math.round(totalScore * 100) / 100 };
        });

        // Step 4: Deduplicate by name
        const seen = new Set<string>();
        results = results.filter((r: Record<string, unknown>) => {
          const name = (r.fullName as string ?? "").toLowerCase();
          if (seen.has(name)) return false;
          seen.add(name);
          return true;
        });

        // Sort by relevanceScore descending
        results.sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((b.relevanceScore as number) ?? 0) - ((a.relevanceScore as number) ?? 0));

        if (queryId) {
          await db.saveSearchResults(queryId, results.map((r: Record<string, unknown>, i: number) => ({
            personSnapshotJson: r,
            rank: i + 1,
            scoringJson: (r.scoring ?? {}) as Record<string, unknown>,
            matchReasonsJson: (r.matchReasons ?? []) as string[],
          })));
        }

        await db.logActivity(ctx.user.id, {
          activityType: "discovery_search",
          title: `Searched: "${input.query}"`,
          metadataJson: { resultCount: results.length, intent },
        });

        return { queryId, results, intent, queryVariants };
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
    runAll: protectedProcedure.mutation(async ({ ctx }) => {
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
