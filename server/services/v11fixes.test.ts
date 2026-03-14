/**
 * v11 Tests — service wrappers, unlinked notes, command service refactor
 */
import { describe, it, expect } from "vitest";

// ─── Tasks Service ──────────────────────────────────────────────
describe("tasks.service", () => {
  it("exports createTask and getTasks functions", async () => {
    const mod = await import("./tasks.service");
    expect(typeof mod.createTask).toBe("function");
    expect(typeof mod.getTasks).toBe("function");
  });
});

// ─── Lists Service ──────────────────────────────────────────────
describe("lists.service", () => {
  it("exports createList, getLists, and findListByName functions", async () => {
    const mod = await import("./lists.service");
    expect(typeof mod.createList).toBe("function");
    expect(typeof mod.getLists).toBe("function");
    expect(typeof mod.findListByName).toBe("function");
  });
});

// ─── Activity Service ───────────────────────────────────────────
describe("activity.service", () => {
  it("exports logActivity and getPeopleNeedingReconnect functions", async () => {
    const mod = await import("./activity.service");
    expect(typeof mod.logActivity).toBe("function");
    expect(typeof mod.getPeopleNeedingReconnect).toBe("function");
  });
});

// ─── Unlinked Notes Service ─────────────────────────────────────
describe("unlinkedNotes.service", () => {
  it("exports saveUnlinkedNote, getUnlinkedNotes, linkNoteToPerson, deleteNote", async () => {
    const mod = await import("./unlinkedNotes.service");
    expect(typeof mod.saveUnlinkedNote).toBe("function");
    expect(typeof mod.getUnlinkedNotes).toBe("function");
    expect(typeof mod.linkNoteToPerson).toBe("function");
    expect(typeof mod.deleteNote).toBe("function");
  });
});

// ─── Command Service (service-only orchestration) ───────────────
describe("command.service", () => {
  it("exports executeCommand function", async () => {
    const mod = await import("./command.service");
    expect(typeof mod.executeCommand).toBe("function");
  });

  it("does not import from repositories directly", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("./command.service.ts", import.meta.url).pathname,
      "utf-8"
    );
    // Should NOT have direct repo imports
    expect(content).not.toContain('from "../repositories"');
    expect(content).not.toContain("from '../repositories'");
    // Should use service imports
    expect(content).toContain('from "./tasks.service"');
    expect(content).toContain('from "./lists.service"');
    expect(content).toContain('from "./activity.service"');
  });
});

// ─── Unlinked Notes Repository ──────────────────────────────────
describe("unlinkedNotes.repo", () => {
  it("exports createUnlinkedNote, getUnlinkedNotes, linkNoteToPersonId, deleteUnlinkedNote", async () => {
    const mod = await import("../repositories/unlinkedNotes.repo");
    expect(typeof mod.createUnlinkedNote).toBe("function");
    expect(typeof mod.getUnlinkedNotes).toBe("function");
    expect(typeof mod.linkNoteToPersonId).toBe("function");
    expect(typeof mod.deleteUnlinkedNote).toBe("function");
  });
});

// ─── Voice Service (unlinked notes integration) ─────────────────
describe("voice.service unlinked notes", () => {
  it("uses createUnlinkedNote for unlinked voice notes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("../services/voice.service.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("createUnlinkedNote");
    expect(content).toContain("unlinked_notes table");
  });
});

// ─── Worker Startup (#15) ───────────────────────────────────────
describe("server/_core/index.ts worker startup", () => {
  it("conditionally starts job processor based on ENABLE_WORKER env", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("../_core/index.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("ENABLE_WORKER");
    expect(content).toContain("pnpm worker");
  });
});

// ─── Routers Barrel Export (#3) ─────────────────────────────────
describe("routers/index.ts barrel export", () => {
  it("exports onboardingRouter and settingsRouter", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("../routers/index.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("onboardingRouter");
    expect(content).toContain("settingsRouter");
  });
});

// ─── Schema: unlinked_notes table ───────────────────────────────
describe("drizzle schema", () => {
  it("defines unlinkedNotes table", async () => {
    const schema = await import("../../drizzle/schema");
    expect(schema.unlinkedNotes).toBeDefined();
  });
});
