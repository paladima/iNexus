/**
 * AI Command Bar Router (#13) — Full orchestrator
 * Handles: discover, create_task, generate_draft, show_reconnects,
 *          create_list, summarize_person, search_people, create_list_from_results
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as repo from "../repositories";
import { callLLM } from "../services/llm.service";
import { enqueueJob } from "../services/job.service";

export const commandRouter = router({
  execute: protectedProcedure
    .input(z.object({ command: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const goals = await repo.getUserGoals(ctx.user.id);

      const { data } = await callLLM<Record<string, unknown>>({
        promptModule: "command_bar",
        params: {
          messages: [
            {
              role: "system",
              content: `You are an AI command router for a networking assistant. Parse the user's natural language command and determine the intent. Return JSON:
{ "intent": "discover|create_task|generate_draft|show_reconnects|create_list|summarize_person|search_people|batch_draft|unknown",
  "params": { ... },
  "response": "..." }
Intents:
- "discover": params.query (string) — search for people
- "create_task": params.title, params.priority (high/medium/low), params.dueDate
- "generate_draft": params.personName, params.tone (professional/casual/warm)
- "show_reconnects": no params — show stale contacts
- "create_list": params.name — create a new list
- "summarize_person": params.personName — get AI summary
- "search_people": params.query — search existing contacts
- "batch_draft": params.listName — generate drafts for all people in a list
Always include a helpful "response" message.`,
            },
            {
              role: "user",
              content: `Command: "${input.command}"\nUser goals: ${JSON.stringify(goals)}`,
            },
          ],
          response_format: { type: "json_object" },
        },
        fallback: {
          intent: "unknown",
          params: {},
          response: "I didn't understand that command. Try: 'find investors in AI', 'create task follow up with John', 'draft message to Sarah', or 'show reconnects'.",
        },
        userId: ctx.user.id,
      });

      const result = data as { intent: string; params: Record<string, unknown>; response: string };
      let actionResult: Record<string, unknown> = {};

      // ─── Execute intents ──────────────────────────────────
      switch (result.intent) {
        case "create_task": {
          if (result.params?.title) {
            const id = await repo.createTask(ctx.user.id, {
              title: String(result.params.title),
              priority: (result.params.priority as string) ?? "medium",
              dueAt: result.params.dueDate ? new Date(String(result.params.dueDate)) : undefined,
            });
            actionResult = { taskId: id, created: true };
            await repo.logActivity(ctx.user.id, {
              activityType: "task_created",
              title: `Created task via command: ${result.params.title}`,
              entityType: "task",
              entityId: id ?? undefined,
            });
          }
          break;
        }

        case "create_list": {
          if (result.params?.name) {
            const id = await repo.createList(ctx.user.id, String(result.params.name));
            actionResult = { listId: id, created: true };
            await repo.logActivity(ctx.user.id, {
              activityType: "list_created",
              title: `Created list via command: ${result.params.name}`,
              entityType: "list",
              entityId: id ?? undefined,
            });
          }
          break;
        }

        case "discover":
        case "search_people": {
          const query = String(result.params?.query ?? input.command);
          const { items: foundPeople } = await repo.getPeople(ctx.user.id, { search: query, limit: 10 });
          actionResult = { people: foundPeople.map((p: any) => ({ id: p.id, fullName: p.fullName, title: p.title, company: p.company })), count: foundPeople.length };
          break;
        }

        case "summarize_person": {
          if (result.params?.personName) {
            const { items: matchedPeople } = await repo.getPeople(ctx.user.id, { search: String(result.params.personName), limit: 1 });
            if (matchedPeople.length > 0) {
              const person = matchedPeople[0] as any;
              const jobId = await enqueueJob(ctx.user.id, "generate_summary", { personId: person.id });
              actionResult = { personId: person.id, personName: person.fullName, jobId, status: "generating" };
            } else {
              actionResult = { found: false };
              result.response = `I couldn't find anyone named "${result.params.personName}" in your contacts.`;
            }
          }
          break;
        }

        case "generate_draft": {
          if (result.params?.personName) {
            const { items: draftPeople } = await repo.getPeople(ctx.user.id, { search: String(result.params.personName), limit: 1 });
            if (draftPeople.length > 0) {
              const person = draftPeople[0] as any;
              actionResult = {
                personId: person.id,
                personName: person.fullName,
                navigateTo: `/drafts?personId=${person.id}&auto=true`,
              };
            } else {
              actionResult = { found: false };
              result.response = `I couldn't find anyone named "${result.params.personName}" in your contacts.`;
            }
          }
          break;
        }

        case "show_reconnects": {
          const stale = await repo.getPeopleNeedingReconnect(ctx.user.id, 30);
          actionResult = {
            contacts: stale.map((p: any) => ({ id: p.id, fullName: p.fullName, lastContactAt: p.lastContactAt })),
            count: stale.length,
            navigateTo: "/activity?tab=reconnects",
          };
          break;
        }

        case "batch_draft": {
          if (result.params?.listName) {
            const lists = await repo.getLists(ctx.user.id);
            const list = lists.find((l: any) => l.name?.toLowerCase().includes(String(result.params.listName).toLowerCase()));
            if (list) {
              actionResult = { listId: (list as any).id, listName: (list as any).name, navigateTo: `/lists/${(list as any).id}?batch=true` };
            } else {
              actionResult = { found: false };
              result.response = `I couldn't find a list matching "${result.params.listName}".`;
            }
          }
          break;
        }

        default:
          break;
      }

      await repo.logActivity(ctx.user.id, {
        activityType: "command_executed",
        title: `Command: ${input.command}`,
        metadataJson: { intent: result.intent, params: result.params },
      });

      return { ...result, actionResult };
    }),
});
