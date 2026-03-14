/**
 * Command Service (#7-8 v6)
 * Pure orchestration layer: routes intents to service layer only.
 * No direct repo calls — delegates everything to services.
 */
import { callLLM } from "./llm.service";
import { enqueueJob } from "./job.service";
import * as discoverService from "./discover.service";
import * as peopleService from "./people.service";
import * as draftsService from "./drafts.service";
import * as repo from "../repositories";

interface CommandResult {
  intent: string;
  params: Record<string, unknown>;
  response: string;
  actionResult: Record<string, unknown>;
}

/**
 * Helper: find a person by name using people service search
 */
async function findPersonByName(userId: number, name: string) {
  const { items } = await repo.getPeople(userId, { search: name, limit: 1 });
  return items.length > 0 ? items[0] : null;
}

/**
 * Helper: find a list by name
 */
async function findListByName(userId: number, name: string) {
  const lists = await repo.getLists(userId);
  return lists.find((l: any) =>
    l.name?.toLowerCase().includes(name.toLowerCase())
  ) as any | null;
}

export async function executeCommand(userId: number, command: string): Promise<CommandResult> {
  const goals = await repo.getUserGoals(userId);

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
          content: `Command: "${command}"\nUser goals: ${JSON.stringify(goals)}`,
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

  // Step 2: Route to appropriate service (no direct repo for business logic)
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
        const { items: foundPeople } = await repo.getPeople(userId, { search: query, limit: 10 });
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
          const id = await repo.createTask(userId, {
            title: String(result.params.title),
            priority: (result.params.priority as string) ?? "medium",
            dueAt: result.params.dueDate ? new Date(String(result.params.dueDate)) : undefined,
            personId,
          });
          actionResult = { taskId: id, created: true };
          await repo.logActivity(userId, {
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
          const id = await repo.createList(userId, String(result.params.name));
          actionResult = { listId: id, created: true };
          await repo.logActivity(userId, {
            activityType: "list_created",
            title: `Created list via command: ${result.params.name}`,
            entityType: "list",
            entityId: id ?? undefined,
          });
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
            // Use drafts service to generate
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
        const stale = await repo.getPeopleNeedingReconnect(userId, 30);
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
          const list = await findListByName(userId, String(result.params.listName));
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
          const list = await findListByName(userId, String(result.params.listName));
          if (person && list) {
            await repo.addPersonToList(userId, list.id, person.id);
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

  // Step 3: Log command execution
  await repo.logActivity(userId, {
    activityType: "command_executed",
    title: `Command: ${command}`,
    metadataJson: { intent: result.intent, params: result.params },
  });

  return { ...result, actionResult };
}
