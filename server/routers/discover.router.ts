/**
 * Discover Router (#14-15) — Intent Decomposition + Role-Aware Ranking + Bulk Actions
 * End-to-end workflow: search → save → add to list → generate drafts → create tasks
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import { enqueueJob } from "../services/job.service";
import {
  parseLLMContent,
  parseLLMWithSchema,
  intentDecompositionSchema,
} from "../llmHelpers";

const personInputSchema = z.object({
  fullName: z.string(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
  sourceType: z.string().optional(),
  relevanceScore: z.string().optional(),
});

export const discoverRouter = router({
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      filters: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const goals = await repo.getUserGoals(ctx.user.id);

      // Step 1: Intent Decomposition
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

      const intent = parseLLMWithSchema(intentResponse, intentDecompositionSchema, "discover.intentDecomposition", { topic: "", role: "", geo: "", industry: "", speaker: false, negatives: [], queryVariants: [input.query] });
      const queryVariants = intent.queryVariants.length > 0 ? intent.queryVariants : [input.query];
      const negatives = intent.negatives;

      const queryId = await repo.createSearchQuery(ctx.user.id, input.query, input.filters as Record<string, unknown>, {
        parsedIntentsJson: intent,
        queryVariantsJson: queryVariants,
        negativeTermsJson: negatives,
      });

      // Step 2: Multi-query search with role-aware ranking
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

      const searchParsed = parseLLMContent<{ results: Array<Record<string, unknown>> }>(searchResponse, "discover.search", { results: [] });
      let results: Array<Record<string, unknown>> = searchParsed.results ?? [];

      // Step 3: Score and rank
      const weights = { roleMatch: 0.25, industryMatch: 0.20, geoMatch: 0.15, seniorityMatch: 0.15, goalAlignment: 0.15, signalStrength: 0.10 };
      results = results.map((r: Record<string, unknown>) => {
        const scoring = (r.scoring ?? {}) as Record<string, number>;
        const totalScore = Object.entries(weights).reduce((sum, [key, weight]) => {
          return sum + (scoring[key] ?? 0) * weight;
        }, 0);
        return { ...r, relevanceScore: Math.round(totalScore * 100) / 100 };
      });

      // Step 4: Deduplicate
      const seen = new Set<string>();
      results = results.filter((r: Record<string, unknown>) => {
        const name = (r.fullName as string ?? "").toLowerCase();
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });

      results.sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((b.relevanceScore as number) ?? 0) - ((a.relevanceScore as number) ?? 0));

      if (queryId) {
        await repo.saveSearchResults(queryId, results.map((r: Record<string, unknown>, i: number) => ({
          personSnapshotJson: r,
          rank: i + 1,
          scoringJson: (r.scoring ?? {}) as Record<string, unknown>,
          matchReasonsJson: (r.matchReasons ?? []) as string[],
        })));
      }

      await repo.logActivity(ctx.user.id, {
        activityType: "discovery_search",
        title: `Searched: "${input.query}"`,
        metadataJson: { resultCount: results.length, intent },
      });

      return { queryId, results, intent, queryVariants };
    }),

  // ─── Save single person ─────────────────────────────────────
  savePerson: protectedProcedure
    .input(personInputSchema)
    .mutation(async ({ ctx, input }) => {
      const names = input.fullName.split(" ");
      const id = await repo.createPerson(ctx.user.id, {
        ...input,
        firstName: names[0],
        lastName: names.slice(1).join(" "),
        status: "saved",
      });
      await repo.logActivity(ctx.user.id, {
        activityType: "person_saved_from_discovery",
        title: `Saved ${input.fullName} from discovery`,
        entityType: "person",
        entityId: id ?? undefined,
      });
      return { id };
    }),

  // ─── Bulk save selected people (#15) ────────────────────────
  bulkSave: protectedProcedure
    .input(z.object({ people: z.array(personInputSchema) }))
    .mutation(async ({ ctx, input }) => {
      const savedIds: number[] = [];
      for (const p of input.people) {
        const names = p.fullName.split(" ");
        const id = await repo.createPerson(ctx.user.id, {
          ...p,
          firstName: names[0],
          lastName: names.slice(1).join(" "),
          status: "saved",
        });
        if (id) savedIds.push(id);
      }
      await repo.logActivity(ctx.user.id, {
        activityType: "bulk_save_from_discovery",
        title: `Bulk saved ${savedIds.length} people from discovery`,
        metadataJson: { count: savedIds.length },
      });
      return { savedIds, count: savedIds.length };
    }),

  // ─── Bulk add to list (#15) ─────────────────────────────────
  bulkAddToList: protectedProcedure
    .input(z.object({
      personIds: z.array(z.number()),
      listId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify list ownership
      const list = await repo.getListById(ctx.user.id, input.listId);
      if (!list) throw new TRPCError({ code: "NOT_FOUND", message: "List not found" });

      let added = 0;
      for (const personId of input.personIds) {
        try {
          await repo.addPersonToList(ctx.user.id, input.listId, personId);
          added++;
        } catch {
          // Skip duplicates
        }
      }
      await repo.logActivity(ctx.user.id, {
        activityType: "bulk_add_to_list",
        title: `Added ${added} people to list "${(list as any).name}"`,
        entityType: "list",
        entityId: input.listId,
      });
      return { added };
    }),

  // ─── Bulk generate drafts (#15) ─────────────────────────────
  bulkGenerateDrafts: protectedProcedure
    .input(z.object({
      personIds: z.array(z.number()),
      tone: z.string().default("professional"),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const jobId = await enqueueJob(ctx.user.id, "batch_outreach", {
        personIds: input.personIds,
        tone: input.tone,
        context: input.context,
      }, { priority: 1 });
      return { jobId, status: "queued", count: input.personIds.length };
    }),

  // ─── Bulk create follow-up tasks (#15) ──────────────────────
  bulkCreateTasks: protectedProcedure
    .input(z.object({
      personIds: z.array(z.number()),
      taskPrefix: z.string().default("Follow up with"),
      priority: z.string().default("medium"),
      daysFromNow: z.number().default(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const createdIds: number[] = [];
      for (const personId of input.personIds) {
        const person = await repo.getPersonById(ctx.user.id, personId);
        if (!person) continue;
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + input.daysFromNow);
        const id = await repo.createTask(ctx.user.id, {
          title: `${input.taskPrefix} ${person.fullName}`,
          priority: input.priority,
          dueAt,
          personId,
        });
        if (id) createdIds.push(id);
      }
      await repo.logActivity(ctx.user.id, {
        activityType: "bulk_create_tasks",
        title: `Created ${createdIds.length} follow-up tasks`,
        metadataJson: { count: createdIds.length },
      });
      return { createdIds, count: createdIds.length };
    }),
});
