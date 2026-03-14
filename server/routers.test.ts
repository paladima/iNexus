import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user-" + userId,
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// Mock the database module
vi.mock("./db", () => ({
  getUserGoals: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    primaryGoal: "Find co-founders",
    industries: ["AI", "SaaS"],
    geographies: ["San Francisco"],
    preferences: { bio: "Test bio" },
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  upsertUserGoals: vi.fn().mockResolvedValue(undefined),
  updateUserSettings: vi.fn().mockResolvedValue(undefined),
  logActivity: vi.fn().mockResolvedValue(undefined),
  getDashboardStats: vi.fn().mockResolvedValue({
    openOpportunities: 3,
    pendingDrafts: 2,
    openTasks: 5,
    totalPeople: 10,
    recentPeople: [],
  }),
  getDailyBrief: vi.fn().mockResolvedValue(null),
  saveDailyBrief: vi.fn().mockResolvedValue(undefined),
  getPeople: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getPersonById: vi.fn().mockResolvedValue({
    id: 1,
    fullName: "John Doe",
    title: "CEO",
    company: "Acme",
    email: "john@acme.com",
    location: "SF",
  }),
  createPerson: vi.fn().mockResolvedValue(1),
  updatePerson: vi.fn().mockResolvedValue(undefined),
  deletePerson: vi.fn().mockResolvedValue(undefined),
  getPersonNotes: vi.fn().mockResolvedValue([]),
  addPersonNote: vi.fn().mockResolvedValue(undefined),
  getInteractions: vi.fn().mockResolvedValue([]),
  addInteraction: vi.fn().mockResolvedValue(undefined),
  getLists: vi.fn().mockResolvedValue([]),
  getListById: vi.fn().mockResolvedValue({ id: 1, name: "Test List" }),
  getListPeople: vi.fn().mockResolvedValue([]),
  createList: vi.fn().mockResolvedValue(1),
  updateList: vi.fn().mockResolvedValue(undefined),
  deleteList: vi.fn().mockResolvedValue(undefined),
  addPersonToList: vi.fn().mockResolvedValue(undefined),
  removePersonFromList: vi.fn().mockResolvedValue(undefined),
  getTasks: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  createTask: vi.fn().mockResolvedValue(1),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  getOpportunities: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  createOpportunity: vi.fn().mockResolvedValue(1),
  updateOpportunity: vi.fn().mockResolvedValue(undefined),
  getDrafts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  createDraft: vi.fn().mockResolvedValue(1),
  updateDraft: vi.fn().mockResolvedValue(undefined),
  deleteDraft: vi.fn().mockResolvedValue(undefined),
  createSearchQuery: vi.fn().mockResolvedValue(1),
  saveSearchResults: vi.fn().mockResolvedValue(undefined),
  createVoiceCapture: vi.fn().mockResolvedValue(1),
  getVoiceCaptures: vi.fn().mockResolvedValue([]),
  getActivityLog: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ greeting: "Hello", items: [], summary: "All good" }) } }],
  }),
}));

// Mock voice transcription
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({ text: "Test transcript", language: "en" }),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://storage.example.com/test.webm", key: "voice/1/test.webm" }),
}));

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
  });

  it("returns null when unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("onboarding", () => {
  it("getGoals returns user goals", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.onboarding.getGoals();
    expect(result).toBeDefined();
    expect(result?.primaryGoal).toBe("Find co-founders");
    expect(result?.industries).toEqual(["AI", "SaaS"]);
  });

  it("saveGoals accepts valid input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.onboarding.saveGoals({
      primaryGoal: "Raise funding",
      industries: ["FinTech"],
      geographies: ["NYC"],
    });
    expect(result).toEqual({ success: true });
  });

  it("complete marks onboarding as done", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.onboarding.complete();
    expect(result).toEqual({ success: true });
  });

  it("getGoals requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.onboarding.getGoals()).rejects.toThrow();
  });
});

describe("dashboard", () => {
  it("stats returns dashboard statistics", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();
    expect(result).toBeDefined();
    expect(result.openOpportunities).toBe(3);
    expect(result.pendingDrafts).toBe(2);
    expect(result.openTasks).toBe(5);
    expect(result.totalPeople).toBe(10);
  });

  it("stats requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.stats()).rejects.toThrow();
  });
});

describe("people", () => {
  it("list returns people", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.list();
    expect(result).toBeDefined();
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("create adds a new person", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.create({
      fullName: "Jane Smith",
      title: "CTO",
      company: "TechCorp",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("create requires fullName", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.people.create({ fullName: "" })).rejects.toThrow();
  });

  it("getById returns person with notes and interactions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.getById({ id: 1 });
    expect(result).toBeDefined();
    expect(result.fullName).toBe("John Doe");
    expect(result.notes).toEqual([]);
    expect(result.interactions).toEqual([]);
  });

  it("addNote adds a note to a person", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.addNote({
      personId: 1,
      content: "Met at conference",
    });
    expect(result).toEqual({ success: true });
  });

  it("delete removes a person", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("lists", () => {
  it("list returns user lists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.list();
    expect(result).toEqual([]);
  });

  it("create adds a new list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.create({
      name: "VC Partners",
      description: "Potential investors",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("create requires name", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.lists.create({ name: "" })).rejects.toThrow();
  });

  it("addPerson adds a person to a list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.addPerson({ listId: 1, personId: 1 });
    expect(result).toEqual({ success: true });
  });

  it("removePerson removes a person from a list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.removePerson({ listId: 1, personId: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("tasks", () => {
  it("list returns tasks", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.list();
    expect(result).toBeDefined();
    expect(result.items).toEqual([]);
  });

  it("create adds a new task", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.create({
      title: "Follow up with John",
      priority: "high",
      dueAt: "2026-03-20",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("create requires title", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tasks.create({ title: "" })).rejects.toThrow();
  });

  it("update changes task status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.update({ id: 1, status: "completed" });
    expect(result).toEqual({ success: true });
  });

  it("delete removes a task", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("opportunities", () => {
  it("list returns opportunities", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.opportunities.list();
    expect(result).toBeDefined();
    expect(result.items).toEqual([]);
  });

  it("create adds a new opportunity", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.opportunities.create({
      title: "Series A Funding",
      opportunityType: "funding",
      signalSummary: "Company raising Series A",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("update changes opportunity status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.opportunities.update({ id: 1, status: "acted_on" });
    expect(result).toEqual({ success: true });
  });
});

describe("drafts", () => {
  it("list returns drafts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.drafts.list();
    expect(result).toBeDefined();
    expect(result.items).toEqual([]);
  });

  it("generate creates an AI draft", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.drafts.generate({ personId: 1 });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("update changes draft content", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.drafts.update({ id: 1, body: "Updated body" });
    expect(result).toEqual({ success: true });
  });

  it("delete removes a draft", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.drafts.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

describe("discover", () => {
  it("search returns results", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.discover.search({ query: "AI founders" });
    expect(result).toBeDefined();
    expect(result.queryId).toBe(1);
  });

  it("search requires non-empty query", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.discover.search({ query: "" })).rejects.toThrow();
  });

  it("savePerson saves a discovered person", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.discover.savePerson({
      fullName: "Jane Doe",
      title: "VP Engineering",
      company: "TechCo",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });
});

describe("voice", () => {
  it("uploadAudio uploads and returns URL", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.voice.uploadAudio({
      audioBase64: Buffer.from("test audio").toString("base64"),
      mimeType: "audio/webm",
    });
    expect(result).toBeDefined();
    expect(result.url).toContain("https://");
  });

  it("transcribe returns text", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.voice.transcribe({
      audioUrl: "https://storage.example.com/test.webm",
    });
    expect(result).toBeDefined();
    expect(result.text).toBe("Test transcript");
  });

  it("parseIntent returns parsed actions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.voice.parseIntent({
      transcript: "Remind me to follow up with John tomorrow",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("history returns voice captures", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.voice.history();
    expect(result).toEqual([]);
  });
});

describe("activity", () => {
  it("list returns activity log", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.activity.list();
    expect(result).toBeDefined();
    expect(result.items).toEqual([]);
  });

  it("list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.activity.list()).rejects.toThrow();
  });
});

describe("ai command", () => {
  it("command processes AI request", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.ai.command({ command: "Find AI investors" });
    expect(result).toBeDefined();
  });

  it("command requires non-empty input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.ai.command({ command: "" })).rejects.toThrow();
  });
});

describe("settings", () => {
  it("get returns user settings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.get();
    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.goals).toBeDefined();
  });

  it("update changes settings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.update({ timezone: "America/New_York" });
    expect(result).toEqual({ success: true });
  });
});
