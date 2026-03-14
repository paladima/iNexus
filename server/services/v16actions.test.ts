/**
 * v16 Tests — Unified Action Registry + Workflow Engine
 *
 * Tests the action type system, registry, dispatcher, and all 7 core actions.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerAction,
  getAction,
  listActionIds,
  listActions,
  hasAction,
  clearRegistry,
} from "../actions/action.registry";
import type { ActionDefinition, ActionContext, ActionResult } from "../actions/action.types";
import { dispatchRequestSchema } from "../actions/action.types";
import { allActions } from "../actions/actions";
import { z } from "zod";

// ─── Action Registry Tests ──────────────────────────────────────

describe("Action Registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("registers and retrieves an action", () => {
    const action: ActionDefinition<{ name: string }> = {
      id: "test.hello",
      label: "Hello",
      description: "Test action",
      mode: "sync",
      inputSchema: z.object({ name: z.string() }),
      async run(ctx: ActionContext, input: { name: string }): Promise<ActionResult> {
        return { success: true, message: `Hello ${input.name}` };
      },
    };
    registerAction(action);
    expect(hasAction("test.hello")).toBe(true);
    expect(getAction("test.hello")?.label).toBe("Hello");
  });

  it("throws on duplicate registration", () => {
    const action: ActionDefinition = {
      id: "test.dup",
      label: "Dup",
      description: "Dup",
      mode: "sync",
      inputSchema: z.any(),
      async run(): Promise<ActionResult> {
        return { success: true, message: "ok" };
      },
    };
    registerAction(action);
    expect(() => registerAction(action)).toThrow('Action "test.dup" is already registered');
  });

  it("returns undefined for unknown action", () => {
    expect(getAction("nonexistent")).toBeUndefined();
    expect(hasAction("nonexistent")).toBe(false);
  });

  it("lists all registered action IDs", () => {
    const a1: ActionDefinition = {
      id: "test.a",
      label: "A",
      description: "A",
      mode: "sync",
      inputSchema: z.any(),
      async run(): Promise<ActionResult> {
        return { success: true, message: "a" };
      },
    };
    const a2: ActionDefinition = {
      id: "test.b",
      label: "B",
      description: "B",
      mode: "sync",
      inputSchema: z.any(),
      async run(): Promise<ActionResult> {
        return { success: true, message: "b" };
      },
    };
    registerAction(a1);
    registerAction(a2);
    expect(listActionIds()).toContain("test.a");
    expect(listActionIds()).toContain("test.b");
    expect(listActions().length).toBe(2);
  });

  it("clearRegistry removes all actions", () => {
    const action: ActionDefinition = {
      id: "test.clear",
      label: "Clear",
      description: "Clear",
      mode: "sync",
      inputSchema: z.any(),
      async run(): Promise<ActionResult> {
        return { success: true, message: "ok" };
      },
    };
    registerAction(action);
    expect(listActionIds().length).toBe(1);
    clearRegistry();
    expect(listActionIds().length).toBe(0);
  });
});

// ─── Dispatch Request Schema Tests ──────────────────────────────

describe("Dispatch Request Schema", () => {
  it("validates a minimal dispatch request", () => {
    const result = dispatchRequestSchema.parse({
      actionId: "people.save",
    });
    expect(result.actionId).toBe("people.save");
    expect(result.source).toBe("ui"); // default
    expect(result.input).toEqual({}); // default
  });

  it("validates a full dispatch request", () => {
    const result = dispatchRequestSchema.parse({
      actionId: "task.create",
      input: { title: "Follow up", priority: "high" },
      source: "command",
      meta: { origin: "command_bar" },
    });
    expect(result.actionId).toBe("task.create");
    expect(result.source).toBe("command");
    expect(result.input).toEqual({ title: "Follow up", priority: "high" });
    expect(result.meta).toEqual({ origin: "command_bar" });
  });

  it("rejects empty actionId", () => {
    expect(() => dispatchRequestSchema.parse({ actionId: "" })).toThrow();
  });

  it("rejects invalid source", () => {
    expect(() =>
      dispatchRequestSchema.parse({ actionId: "test", source: "invalid_source" })
    ).toThrow();
  });

  it("accepts all valid sources", () => {
    const sources = ["command", "voice", "bulk", "ui", "opportunity", "worker", "api"];
    for (const source of sources) {
      const result = dispatchRequestSchema.parse({ actionId: "test", source });
      expect(result.source).toBe(source);
    }
  });
});

// ─── Core Actions Definition Tests ──────────────────────────────

describe("Core Actions — definitions", () => {
  it("defines exactly 7 core actions", () => {
    expect(allActions.length).toBe(7);
  });

  it("all actions have unique IDs", () => {
    const ids = allActions.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all actions have required fields", () => {
    for (const action of allActions) {
      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.description).toBeTruthy();
      expect(["sync", "async"]).toContain(action.mode);
      expect(action.inputSchema).toBeDefined();
      expect(typeof action.run).toBe("function");
    }
  });

  it("action IDs follow namespace.verb pattern", () => {
    for (const action of allActions) {
      expect(action.id).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  const expectedActions = [
    "people.save",
    "list.add_people",
    "draft.generate",
    "task.create",
    "task.create_followup",
    "voice.confirm_actions",
    "opportunity.act",
  ];

  it("includes all expected action IDs", () => {
    const ids = allActions.map((a) => a.id);
    for (const expected of expectedActions) {
      expect(ids).toContain(expected);
    }
  });
});

// ─── Input Schema Validation Tests ──────────────────────────────

describe("Core Actions — input validation", () => {
  it("people.save requires fullName", () => {
    const action = allActions.find((a) => a.id === "people.save")!;
    expect(() => action.inputSchema.parse({})).toThrow();
    expect(() => action.inputSchema.parse({ fullName: "" })).toThrow();
    const valid = action.inputSchema.parse({ fullName: "John Smith" });
    expect(valid.fullName).toBe("John Smith");
  });

  it("people.save accepts full person data", () => {
    const action = allActions.find((a) => a.id === "people.save")!;
    const input = action.inputSchema.parse({
      fullName: "John Smith",
      title: "CTO",
      company: "Acme",
      email: "john@acme.com",
      tags: ["tech", "ai"],
    });
    expect(input.fullName).toBe("John Smith");
    expect(input.title).toBe("CTO");
    expect(input.tags).toEqual(["tech", "ai"]);
  });

  it("list.add_people requires listId and personIds", () => {
    const action = allActions.find((a) => a.id === "list.add_people")!;
    expect(() => action.inputSchema.parse({})).toThrow();
    expect(() => action.inputSchema.parse({ listId: 1, personIds: [] })).toThrow();
    const valid = action.inputSchema.parse({ listId: 1, personIds: [1, 2, 3] });
    expect(valid.listId).toBe(1);
    expect(valid.personIds).toEqual([1, 2, 3]);
  });

  it("draft.generate requires personId, defaults tone", () => {
    const action = allActions.find((a) => a.id === "draft.generate")!;
    expect(() => action.inputSchema.parse({})).toThrow();
    const valid = action.inputSchema.parse({ personId: 42 });
    expect(valid.personId).toBe(42);
    expect(valid.tone).toBe("professional");
    expect(valid.channel).toBe("email");
  });

  it("task.create requires title, defaults priority", () => {
    const action = allActions.find((a) => a.id === "task.create")!;
    expect(() => action.inputSchema.parse({})).toThrow();
    const valid = action.inputSchema.parse({ title: "Follow up" });
    expect(valid.title).toBe("Follow up");
    expect(valid.priority).toBe("medium");
  });

  it("task.create_followup requires personId, defaults daysFromNow", () => {
    const action = allActions.find((a) => a.id === "task.create_followup")!;
    expect(() => action.inputSchema.parse({})).toThrow();
    const valid = action.inputSchema.parse({ personId: 5 });
    expect(valid.personId).toBe(5);
    expect(valid.daysFromNow).toBe(3);
    expect(valid.priority).toBe("medium");
  });

  it("voice.confirm_actions defaults to empty arrays", () => {
    const action = allActions.find((a) => a.id === "voice.confirm_actions")!;
    const valid = action.inputSchema.parse({ captureId: 1 });
    expect(valid.captureId).toBe(1);
    expect(valid.people).toEqual([]);
    expect(valid.tasks).toEqual([]);
    expect(valid.notes).toEqual([]);
  });

  it("opportunity.act validates action enum", () => {
    const action = allActions.find((a) => a.id === "opportunity.act")!;
    expect(() => action.inputSchema.parse({ opportunityId: 1, action: "invalid" })).toThrow();
    const valid = action.inputSchema.parse({ opportunityId: 1, action: "generate_draft" });
    expect(valid.action).toBe("generate_draft");
    expect(valid.tone).toBe("professional");
  });

  it("opportunity.act accepts all valid actions", () => {
    const action = allActions.find((a) => a.id === "opportunity.act")!;
    const validActions = ["generate_draft", "create_task", "generate_intro", "mark_acted", "archive", "ignore"];
    for (const a of validActions) {
      const valid = action.inputSchema.parse({ opportunityId: 1, action: a });
      expect(valid.action).toBe(a);
    }
  });
});

// ─── Registry Auto-Registration Tests ───────────────────────────

describe("Action Registry — auto-registration via barrel import", () => {
  it("all 7 core actions are registered after importing index", async () => {
    // Import the barrel which auto-registers
    const { hasAction: has, listActionIds: ids } = await import("../actions");
    const allIds = ids();
    expect(allIds.length).toBeGreaterThanOrEqual(7);
    expect(has("people.save")).toBe(true);
    expect(has("list.add_people")).toBe(true);
    expect(has("draft.generate")).toBe(true);
    expect(has("task.create")).toBe(true);
    expect(has("task.create_followup")).toBe(true);
    expect(has("voice.confirm_actions")).toBe(true);
    expect(has("opportunity.act")).toBe(true);
  });
});
