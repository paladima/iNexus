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

// Mock the repositories module
vi.mock("./repositories", () => ({
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
  getVoiceCaptureById: vi.fn().mockResolvedValue(null),
  updateVoiceCapture: vi.fn().mockResolvedValue(undefined),
  getActivityLog: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getRelationshipsForPerson: vi.fn().mockResolvedValue([
    { id: 1, personAId: 1, personBId: 2, relationshipType: "colleague", confidence: "0.8", personA: { id: 1, fullName: "John" }, personB: { id: 2, fullName: "Jane" } }
  ]),
  createRelationship: vi.fn().mockResolvedValue(1),
  findWarmPaths: vi.fn().mockResolvedValue([
    { intermediary: { id: 3, fullName: "Bob" }, relationshipType: "colleague", confidence: "0.7" }
  ]),
  getListPeopleForBatch: vi.fn().mockResolvedValue([
    { person: { id: 1, fullName: "John Doe", title: "CEO", company: "Acme" } },
    { person: { id: 2, fullName: "Jane Smith", title: "CTO", company: "TechCo" } }
  ]),
  getOpportunityById: vi.fn().mockResolvedValue({
    id: 1, title: "Intro Opportunity", opportunityType: "intro_suggestion",
    signalSummary: "Both interested in AI",
    metadataJson: { personAId: 1, personBId: 2 }
  }),
  getPeopleNeedingReconnect: vi.fn().mockResolvedValue([]),
  healthCheck: vi.fn().mockResolvedValue(true),
  getDb: vi.fn().mockResolvedValue({}),
  requireDb: vi.fn().mockResolvedValue({}),
  logAiAction: vi.fn().mockResolvedValue(undefined),
  getAiAuditLog: vi.fn().mockResolvedValue([]),
  getAuditForEntity: vi.fn().mockResolvedValue([]),
  getAiUsageStats: vi.fn().mockResolvedValue({ totalCalls: 10, successCount: 9, fallbackCount: 1, errorCount: 1, avgDurationMs: 500, totalDurationMs: 5000 }),
  getAiUsageByModule: vi.fn().mockResolvedValue([]),
  createJob: vi.fn().mockResolvedValue(1),
  getJobById: vi.fn().mockResolvedValue({ id: 1, status: "completed", result: {} }),
  updateJobStatus: vi.fn().mockResolvedValue(undefined),
  getJobsByUser: vi.fn().mockResolvedValue([]),
  cleanupOldJobs: vi.fn().mockResolvedValue(undefined),
  getAllUsersWithBriefEnabled: vi.fn().mockResolvedValue([]),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ greeting: "Hello", items: [], summary: "All good" }) } }],
  }),
}));

// Mock workers
vi.mock("./workers", () => ({
  runAllWorkers: vi.fn().mockResolvedValue(undefined),
  generateDailyBriefForUser: vi.fn().mockResolvedValue(undefined),
  scanOpportunitiesForUser: vi.fn().mockResolvedValue(undefined),
}));

// Mock job service
vi.mock("./services/job.service", () => ({
  enqueueJob: vi.fn().mockResolvedValue(1),
  pollJobStatus: vi.fn().mockResolvedValue({ id: 1, status: "completed", result: {}, progress: 100, retryCount: 0 }),
  registerJobHandler: vi.fn(),
  startJobProcessor: vi.fn(),
  cancelJob: vi.fn().mockResolvedValue(true),
  isJobCancelled: vi.fn().mockReturnValue(false),
  updateJobProgress: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM service
vi.mock("./services/llm.service", () => ({
  callLLM: vi.fn().mockResolvedValue({
    data: { subject: "Introduction", body: "I'd like to introduce..." },
    usedFallback: false,
    durationMs: 500,
  }),
  callLLMText: vi.fn().mockResolvedValue({ text: "Summary text", usedFallback: false, durationMs: 300 }),
}));

// Mock voice transcription
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({ text: "Test transcript", language: "en" }),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://storage.example.com/test.webm", key: "voice/1/test.webm" }),
}));

// Mock providers init
vi.mock("./providers/init", () => ({
  initializeProviders: vi.fn(),
}));

// ─── Auth ─────────────────────────────────────────────────────

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

// ─── Onboarding ───────────────────────────────────────────────

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
      primaryGoal: "Find investors",
      industries: ["FinTech"],
      geographies: ["New York"],
    });
    expect(result).toEqual({ success: true });
  });
});

// ─── Dashboard ────────────────────────────────────────────────

describe("dashboard", () => {
  it("stats returns dashboard stats", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();
    expect(result).toBeDefined();
    expect(result.totalPeople).toBe(10);
    expect(result.openTasks).toBe(5);
  });

  it("dailyBrief returns brief", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.dailyBrief();
    expect(result).toBeNull(); // No brief generated yet
  });

  it("generateBrief returns generating status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.generateBrief();
    expect(result).toBeDefined();
    expect(result.status).toBe("generating");
    expect(result.message).toContain("being generated");
  });
});

// ─── People ───────────────────────────────────────────────────

describe("people", () => {
  it("list returns people", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.list();
    expect(result).toBeDefined();
    expect(result.items).toEqual([]);
  });

  it("get returns a person", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.getById({ id: 1 });
    expect(result).toBeDefined();
    expect(result?.fullName).toBe("John Doe");
  });

  it("create adds a new person", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.create({
      fullName: "Jane Smith",
      title: "CTO",
      company: "TechCo",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("update changes person fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.update({
      id: 1,
      title: "CTO",
      company: "NewCo",
    });
    expect(result).toEqual({ success: true });
  });

  it("delete removes a person", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("addInteraction adds an interaction", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.addInteraction({
      personId: 1,
      interactionType: "meeting",
      channel: "in_person",
      content: "Discussed partnership",
    });
    expect(result).toEqual({ success: true });
  });

  it("generateSummary enqueues a job", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.people.generateSummary({ personId: 1 });
    expect(result).toBeDefined();
  });
});

// ─── Lists ────────────────────────────────────────────────────

describe("lists", () => {
  it("list returns lists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.list();
    expect(result).toEqual([]);
  });

  it("create adds a new list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.create({ name: "My List" });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("update changes list name", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.update({ id: 1, name: "Updated List" });
    expect(result).toEqual({ success: true });
  });

  it("delete removes a list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });

  it("batchOutreach enqueues a batch outreach job", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lists.batchOutreach({ listId: 1 });
    expect(result).toBeDefined();
    expect(result.jobId).toBe(1);
  });
});

// ─── Tasks ────────────────────────────────────────────────────

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
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("create rejects empty title", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tasks.create({ title: "" })).rejects.toThrow();
  });

  it("update changes task status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Use valid enum value: "done" instead of "completed"
    const result = await caller.tasks.update({ id: 1, status: "done" });
    expect(result).toEqual({ success: true });
  });

  it("delete removes a task", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

// ─── Opportunities ────────────────────────────────────────────

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

  it("generateDraft generates a draft from an opportunity", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.opportunities.generateDraft({
      opportunityId: 1,
      tone: "casual",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("createTask creates a task from an opportunity", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.opportunities.createTask({
      opportunityId: 1,
      title: "Follow up on intro",
      priority: "high",
    });
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("generateIntro generates an intro message", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.opportunities.generateIntro({ opportunityId: 1 });
    expect(result).toBeDefined();
  });
});

// ─── Drafts ───────────────────────────────────────────────────

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

// ─── Discover ─────────────────────────────────────────────────

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

  it("bulkSave saves multiple people", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.discover.bulkSave({
      people: [
        { fullName: "Alice", title: "CEO" },
        { fullName: "Bob", title: "CTO" },
      ],
    });
    expect(result.count).toBe(2);
  });

  it("bulkCreateTasks creates tasks for multiple people", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.discover.bulkCreateTasks({
      personIds: [1, 2],
      taskPrefix: "Follow up with",
    });
    expect(result).toBeDefined();
    expect(result.count).toBe(2);
  });
});

// ─── Voice ────────────────────────────────────────────────────

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

  it("confirmActions saves parsed actions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.voice.confirmActions({
      captureId: 1,
      people: [{ name: "John Doe", save: true }],
      tasks: [{ title: "Follow up", save: true }],
      notes: [],
    });
    expect(result).toBeDefined();
    expect(result.savedPeople).toBe(1);
    expect(result.savedTasks).toBe(1);
  });
});

// ─── Activity ─────────────────────────────────────────────────

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

// ─── AI Command ───────────────────────────────────────────────

describe("command", () => {
  it("execute processes AI request", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.command.execute({ command: "Find AI investors" });
    expect(result).toBeDefined();
  });

  it("execute requires non-empty input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.command.execute({ command: "" })).rejects.toThrow();
  });
});

// ─── Settings ─────────────────────────────────────────────────

describe("settings", () => {
  it("get returns user settings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.get();
    expect(result).toBeDefined();
    expect(result.goals).toBeDefined();
  });

  it("updateGoals changes goals", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.updateGoals({
      primaryGoal: "Find investors",
      industries: ["FinTech"],
    });
    expect(result).toEqual({ success: true });
  });

  it("aiUsage returns AI usage stats", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.aiUsage();
    expect(result).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.byModule).toBeDefined();
    expect(result.recentLog).toBeDefined();
  });
});

// ─── Relationships ────────────────────────────────────────────

describe("relationships", () => {
  it("list returns relationships for a person", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.relationships.list({ personId: 1 });
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(result[0].relationshipType).toBe("colleague");
  });

  it("create adds a new relationship", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.relationships.create({
      personAId: 1,
      personBId: 2,
      relationshipType: "colleague",
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("warmPaths returns warm paths", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.relationships.warmPaths({ personId: 1 });
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
  });

  it("list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.relationships.list({ personId: 1 })).rejects.toThrow();
  });
});

// ─── Jobs ─────────────────────────────────────────────────────

describe("jobs", () => {
  it("triggerDailyBrief enqueues a brief generation job", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.jobs.triggerDailyBrief();
    expect(result).toBeDefined();
    expect(result.jobId).toBe(1);
  });

  it("triggerOpportunityScan enqueues an opportunity scan job", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.jobs.triggerOpportunityScan();
    expect(result).toBeDefined();
    expect(result.jobId).toBe(1);
  });

  it("status returns job status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.jobs.status({ jobId: 1 });
    expect(result).toBeDefined();
    expect(result?.status).toBe("completed");
  });

  it("cancel cancels a job", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.jobs.cancel({ jobId: 1 });
    expect(result).toBeDefined();
    expect(result.cancelled).toBe(true);
  });

  it("jobs require authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.jobs.triggerDailyBrief()).rejects.toThrow();
  });
});

// ─── Multi-tenant Isolation ───────────────────────────────────

describe("multi-tenant isolation", () => {
  it("different users get separate contexts", async () => {
    const ctx1 = createAuthContext(1);
    const ctx2 = createAuthContext(2);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    const result1 = await caller1.auth.me();
    const result2 = await caller2.auth.me();

    expect(result1?.id).toBe(1);
    expect(result2?.id).toBe(2);
    expect(result1?.openId).not.toBe(result2?.openId);
  });

  it("protected routes reject unauthenticated users consistently", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.people.list()).rejects.toThrow();
    await expect(caller.tasks.list()).rejects.toThrow();
    await expect(caller.drafts.list()).rejects.toThrow();
    await expect(caller.opportunities.list()).rejects.toThrow();
    await expect(caller.discover.search({ query: "test" })).rejects.toThrow();
    await expect(caller.voice.history()).rejects.toThrow();
    await expect(caller.settings.get()).rejects.toThrow();
  });
});
