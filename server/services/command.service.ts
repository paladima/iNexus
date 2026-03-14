/**
 * Command Service (#1-2 v11)
 * Pure orchestration layer: routes intents to service layer ONLY.
 * Zero direct repo calls — all business logic delegated to services.
 */
import { callLLM } from "./llm.service";
import { enqueueJob } from "./job.service";
import * as discoverService from "./discover.service";
import * as peopleService from "./people.service";
import * as draftsService from "./drafts.service";
import * as tasksService from "./tasks.service";
import * as listsService from "./lists.service";
import * as activityService from "./activity.service";
import { findPersonByNameFuzzy, type PersonCandidate } from "../utils/personMatcher";

interface CommandResult {
  intent: string;
  params: Record<string, unknown>;
  response: string;
  actionResult: Record<string, unknown>;
}

/**
 * Helper: find a person by name using fuzzy matching via people service (#2, #9)
 */
async function findPersonByName(userId: number, name: string): Promise<PersonCandidate | null> {
  const { items } = await peopleService.searchPeople(userId, name);
  return findPersonByNameFuzzy(name, items as PersonCandidate[]);
}

export async function executeCommand(userId: number, command: string): Promise<CommandResult> {
  // Step 1: Classify intent via LLM
  const { data } = await callLLM<Record<string, unknown>>({
    promptModule: "command_bar",
    params: {
      messages: [
        {
          role: "system",
          content: `You are an AI command router for a networking assistant. Parse the user's natural language command and determine the intent. Return JSON:
{ "intent": "discover|create_task|generate_draft|show_reconnects|create_list|summarize_person|search_people|batch_draft|add_to_list|unknown",
  "params": { ... },
  "response": "..." }
Intents:
- "discover": params.query (string) — search for new people externally
- "create_task": params.title, params.priority (high/medium/low), params.dueDate, params.personName (optional)
- "generate_draft": params.personName, params.tone (professional/casual/warm)
- "show_reconnects": no params — show stale contacts
- "create_list": params.name — create a new list
- "summarize_person": params.personName — get AI summary
- "search_people": params.query — search existing contacts
- "batch_draft": params.listName — generate drafts for all people in a list
- "add_to_list": params.personName, params.listName — add a person to a list
Always include a helpful "response" message.`,
        },
        {
          role: "user",
          content: `Command: "${command}"`,
        },
      ],
      response_format: { type: "json_object" },
    },
    fallback: {
      intent: "unknown",
      params: {},
      response:
        "I didn't understand that command. Try: 'find investors in AI', 'create task follow up with John', 'draft message to Sarah', or 'show reconnects'.",
    },
    userId,
  });

  const result = data as { intent: string; params: Record<string, unknown>; response: string };

  // Step 2: Route to appropriate service — NO direct repo calls
  let actionResult: Record<string, unknown> = {};

  try {
    switch (result.intent) {
      case "discover": {
        const query = String(result.params?.query ?? command);
        const searchResult = await discoverService.executeSearch(userId, query);
        actionResult = {
          results: searchResult.results.slice(0, 5),
          count: searchResult.results.length,
          queryId: searchResult.queryId,
          navigateTo: `/discover?q=${encodeURIComponent(query)}`,
        };
        break;
      }

      case "search_people": {
        const query = String(result.params?.query ?? command);
        const { items: foundPeople } = await peopleService.searchPeople(userId, query);
        actionResult = {
          people: foundPeople.map((p: any) => ({
            id: p.id,
            fullName: p.fullName,
            title: p.title,
            company: p.company,
          })),
          count: foundPeople.length,
        };
        break;
      }

      case "create_task": {
        if (result.params?.title) {
          let personId: number | undefined;
          if (result.params?.personName) {
            const person = await findPersonByName(userId, String(result.params.personName));
            if (person) personId = person.id;
          }
          const id = await tasksService.createTask(userId, {
            title: String(result.params.title),
            priority: (result.params.priority as string) ?? "medium",
            dueAt: result.params.dueDate ? new Date(String(result.params.dueDate)) : undefined,
            personId,
          });
          actionResult = { taskId: id, created: true };
        }
        break;
      }

      case "create_list": {
        if (result.params?.name) {
          const id = await listsService.createList(userId, String(result.params.name));
          actionResult = { listId: id, created: true };
        }
        break;
      }

      case "summarize_person": {
        if (result.params?.personName) {
          const person = await findPersonByName(userId, String(result.params.personName));
          if (person) {
            const jobId = await enqueueJob(userId, "generate_summary", {
              personId: person.id,
            }, {
              entityType: "person",
              entityId: person.id,
              dedupeKey: `generate_summary:${userId}:person:${person.id}`,
            });
            actionResult = {
              personId: person.id,
              personName: person.fullName,
              jobId,
              status: "generating",
            };
          } else {
            actionResult = { found: false };
            result.response = `I couldn't find anyone named "${result.params.personName}" in your contacts.`;
          }
        }
        break;
      }

      case "generate_draft": {
        if (result.params?.personName) {
          const person = await findPersonByName(userId, String(result.params.personName));
          if (person) {
            const draft = await draftsService.generateOutreachDraft(
              userId,
              person.id,
              (result.params.tone as string) ?? "professional",
            );
            actionResult = {
              personId: person.id,
              personName: person.fullName,
              draftId: draft?.id,
              navigateTo: `/drafts`,
            };
          } else {
            actionResult = { found: false };
            result.response = `I couldn't find anyone named "${result.params.personName}" in your contacts.`;
          }
        }
        break;
      }

      case "show_reconnects": {
        const stale = await activityService.getPeopleNeedingReconnect(userId, 30);
        actionResult = {
          contacts: stale.map((p: any) => ({
            id: p.id,
            fullName: p.fullName,
            lastContactAt: p.lastContactAt,
          })),
          count: stale.length,
          navigateTo: "/activity?tab=reconnects",
        };
        break;
      }

      case "batch_draft": {
        if (result.params?.listName) {
          const list = await listsService.findListByName(userId, String(result.params.listName));
          if (list) {
            const jobId = await enqueueJob(userId, "batch_outreach", {
              listId: list.id,
              tone: "professional",
            }, {
              entityType: "list",
              entityId: list.id,
              priority: 1,
              dedupeKey: `batch_outreach:${userId}:list:${list.id}`,
            });
            actionResult = {
              listId: list.id,
              listName: list.name,
              jobId,
              status: "queued",
            };
          } else {
            actionResult = { found: false };
            result.response = `I couldn't find a list matching "${result.params.listName}".`;
          }
        }
        break;
      }

      case "add_to_list": {
        if (result.params?.personName && result.params?.listName) {
          const person = await findPersonByName(userId, String(result.params.personName));
          const list = await listsService.findListByName(userId, String(result.params.listName));
          if (person && list) {
            await discoverService.bulkAddToList(userId, list.id, [person.id]);
            actionResult = {
              personId: person.id,
              personName: person.fullName,
              listId: list.id,
              listName: list.name,
              added: true,
            };
          } else {
            actionResult = { found: false };
            result.response = !person
              ? `I couldn't find "${result.params.personName}" in your contacts.`
              : `I couldn't find a list matching "${result.params.listName}".`;
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    actionResult = { error: (err as Error).message };
  }

  // Step 3: Log command execution via activity service
  await activityService.logActivity(userId, {
    activityType: "command_executed",
    title: `Command: ${command}`,
    metadataJson: { intent: result.intent, params: result.params },
  });

  return { ...result, actionResult };
}
