/**
 * Core Actions (v16)
 *
 * Seven business actions that unify all entry points:
 *   1. people.save         — Save a person to contacts (with dedup)
 *   2. list.add_people     — Add person(s) to a list
 *   3. draft.generate      — Generate an outreach draft for a person
 *   4. task.create         — Create a task
 *   5. task.create_followup — Create a follow-up task for a person
 *   6. voice.confirm_actions — Confirm and save parsed voice actions
 *   7. opportunity.act     — Act on an opportunity (draft, task, mark, archive)
 */
import { z } from "zod";
import type { ActionDefinition, ActionContext, ActionResult } from "./action.types";
import * as peopleService from "../services/people.service";
import * as draftsService from "../services/drafts.service";
import * as tasksService from "../services/tasks.service";
import * as voiceService from "../services/voice.service";
import * as oppService from "../services/opportunities.service";
import { markOpportunityActed } from "../services/action.service";
import * as discoverService from "../services/discover.service";

// ─── Input Schemas ──────────────────────────────────────────────

const peopleSaveInput = z.object({
  fullName: z.string().min(1, "Name is required"),
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
});
type PeopleSaveInput = z.infer<typeof peopleSaveInput>;

const listAddPeopleInput = z.object({
  listId: z.number(),
  personIds: z.array(z.number()).min(1, "At least one person ID required"),
});
type ListAddPeopleInput = z.infer<typeof listAddPeopleInput>;

const draftGenerateInput = z.object({
  personId: z.number(),
  tone: z.string().default("professional"),
  context: z.string().optional(),
  channel: z.string().default("email"),
});
type DraftGenerateInput = z.infer<typeof draftGenerateInput>;

const taskCreateInput = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  personId: z.number().optional(),
  opportunityId: z.number().optional(),
  priority: z.string().default("medium"),
  dueDate: z.string().optional(),
});
type TaskCreateInput = z.infer<typeof taskCreateInput>;

const taskCreateFollowupInput = z.object({
  personId: z.number(),
  title: z.string().optional(),
  daysFromNow: z.number().default(3),
  priority: z.string().default("medium"),
});
type TaskCreateFollowupInput = z.infer<typeof taskCreateFollowupInput>;

const voiceConfirmInput = z.object({
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
});
type VoiceConfirmInput = z.infer<typeof voiceConfirmInput>;

const opportunityActInput = z.object({
  opportunityId: z.number(),
  action: z.enum(["generate_draft", "create_task", "generate_intro", "mark_acted", "archive", "ignore"]),
  tone: z.string().default("professional"),
});
type OpportunityActInput = z.infer<typeof opportunityActInput>;

// ─── 1. people.save ─────────────────────────────────────────────
export const peopleSaveAction: ActionDefinition<PeopleSaveInput> = {
  id: "people.save",
  label: "Save Person",
  description: "Save a person to contacts with automatic deduplication",
  mode: "sync",
  inputSchema: peopleSaveInput,
  async run(ctx: ActionContext, input: PeopleSaveInput): Promise<ActionResult> {
    const result = await peopleService.savePerson(ctx.userId, input);
    if ((result as any).duplicate) {
      return {
        success: true,
        data: result,
        message: `${input.fullName} already exists in contacts (dedup match)`,
        warnings: ["Duplicate detected — existing contact returned"],
      };
    }
    return {
      success: true,
      data: result,
      message: `Saved ${input.fullName} to contacts`,
    };
  },
};

// ─── 2. list.add_people ─────────────────────────────────────────
export const listAddPeopleAction: ActionDefinition<ListAddPeopleInput> = {
  id: "list.add_people",
  label: "Add to List",
  description: "Add one or more people to a list",
  mode: "sync",
  inputSchema: listAddPeopleInput,
  async run(ctx: ActionContext, input: ListAddPeopleInput): Promise<ActionResult> {
    const result = await discoverService.bulkAddToList(ctx.userId, input.listId, input.personIds);
    return {
      success: true,
      data: result,
      message: `Added ${result.added} people to list${result.failed ? ` (${result.failed} failed)` : ""}`,
      warnings: result.failed > 0 ? [`${result.failed} people could not be added`] : undefined,
    };
  },
};

// ─── 3. draft.generate ──────────────────────────────────────────
export const draftGenerateAction: ActionDefinition<DraftGenerateInput> = {
  id: "draft.generate",
  label: "Generate Draft",
  description: "Generate an AI outreach draft for a person",
  mode: "sync",
  inputSchema: draftGenerateInput,
  async run(ctx: ActionContext, input: DraftGenerateInput): Promise<ActionResult> {
    const result = await draftsService.generateOutreachDraft(
      ctx.userId,
      input.personId,
      input.tone,
      input.context,
      input.channel
    );
    return {
      success: true,
      data: result,
      message: `Generated ${input.channel} draft (${input.tone} tone)`,
    };
  },
};

// ─── 4. task.create ─────────────────────────────────────────────
export const taskCreateAction: ActionDefinition<TaskCreateInput> = {
  id: "task.create",
  label: "Create Task",
  description: "Create a new task",
  mode: "sync",
  inputSchema: taskCreateInput,
  async run(ctx: ActionContext, input: TaskCreateInput): Promise<ActionResult> {
    const id = await tasksService.createTask(ctx.userId, input);
    return {
      success: true,
      data: { id },
      message: `Created task: ${input.title}`,
    };
  },
};

// ─── 5. task.create_followup ────────────────────────────────────
export const taskCreateFollowupAction: ActionDefinition<TaskCreateFollowupInput> = {
  id: "task.create_followup",
  label: "Create Follow-up",
  description: "Create a follow-up task for a person with a due date",
  mode: "sync",
  inputSchema: taskCreateFollowupInput,
  async run(ctx: ActionContext, input: TaskCreateFollowupInput): Promise<ActionResult> {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + input.daysFromNow);
    const title = input.title ?? `Follow up (${input.daysFromNow}d)`;
    const id = await tasksService.createTask(ctx.userId, {
      title,
      personId: input.personId,
      priority: input.priority,
      dueAt,
    });
    return {
      success: true,
      data: { id, dueAt: dueAt.toISOString() },
      message: `Created follow-up task: ${title} (due ${dueAt.toLocaleDateString()})`,
    };
  },
};

// ─── 6. voice.confirm_actions ───────────────────────────────────
export const voiceConfirmActionsAction: ActionDefinition<VoiceConfirmInput> = {
  id: "voice.confirm_actions",
  label: "Confirm Voice Actions",
  description: "Confirm and save parsed voice capture actions (people, tasks, notes)",
  mode: "sync",
  inputSchema: voiceConfirmInput,
  async run(ctx: ActionContext, input: VoiceConfirmInput): Promise<ActionResult> {
    const result = await voiceService.confirmVoiceActions(
      ctx.userId,
      input.captureId,
      input.people,
      input.tasks,
      input.notes
    );
    const parts: string[] = [];
    if (result.savedPeople > 0) parts.push(`${result.savedPeople} people`);
    if (result.savedTasks > 0) parts.push(`${result.savedTasks} tasks`);
    if (result.savedNotes > 0) parts.push(`${result.savedNotes} notes`);
    return {
      success: true,
      data: result,
      message: parts.length > 0 ? `Saved ${parts.join(", ")}` : "No items to save",
      warnings: result.errors.length > 0 ? result.errors : undefined,
    };
  },
};

// ─── 7. opportunity.act ─────────────────────────────────────────
export const opportunityActAction: ActionDefinition<OpportunityActInput> = {
  id: "opportunity.act",
  label: "Act on Opportunity",
  description: "Take action on an opportunity: generate draft, create task, mark acted, or archive",
  mode: "sync",
  inputSchema: opportunityActInput,
  async run(ctx: ActionContext, input: OpportunityActInput): Promise<ActionResult> {
    switch (input.action) {
      case "generate_draft": {
        const result = await oppService.generateDraftFromOpportunity(ctx.userId, input.opportunityId, input.tone);
        return { success: true, data: result, message: "Generated draft from opportunity" };
      }
      case "create_task": {
        const result = await oppService.createTaskFromOpportunity(ctx.userId, input.opportunityId);
        return { success: true, data: result, message: "Created task from opportunity" };
      }
      case "generate_intro": {
        const result = await oppService.generateIntroFromOpportunity(ctx.userId, input.opportunityId, input.tone);
        return { success: true, data: result, message: "Generated intro from opportunity" };
      }
      case "mark_acted": {
        await markOpportunityActed(ctx.userId, input.opportunityId, "acted");
        return { success: true, message: "Marked opportunity as acted" };
      }
      case "archive": {
        await markOpportunityActed(ctx.userId, input.opportunityId, "archived");
        return { success: true, message: "Archived opportunity" };
      }
      case "ignore": {
        await markOpportunityActed(ctx.userId, input.opportunityId, "ignored");
        return { success: true, message: "Ignored opportunity" };
      }
    }
  },
};

// ─── Export all actions as array ─────────────────────────────────
export const allActions: ActionDefinition<any>[] = [
  peopleSaveAction,
  listAddPeopleAction,
  draftGenerateAction,
  taskCreateAction,
  taskCreateFollowupAction,
  voiceConfirmActionsAction,
  opportunityActAction,
];
