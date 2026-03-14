import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal, date, index, uniqueIndex } from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  timezone: varchar("timezone", { length: 64 }).default("America/New_York"),
  language: varchar("language", { length: 8 }).default("en"),
  dailyBriefEnabled: int("dailyBriefEnabled").default(1),
  reminderMode: varchar("reminderMode", { length: 16 }).default("smart"),
  onboardingCompleted: int("onboardingCompleted").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── User Goals ──────────────────────────────────────────────────
export const userGoals = mysqlTable("user_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  primaryGoal: varchar("primaryGoal", { length: 128 }),
  industries: json("industries").$type<string[]>().default([]),
  geographies: json("geographies").$type<string[]>().default([]),
  preferences: json("preferences").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_user_goals_userId").on(table.userId),
]);

export type UserGoal = typeof userGoals.$inferSelect;

// ─── People ──────────────────────────────────────────────────────
export const people = mysqlTable("people", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  firstName: varchar("firstName", { length: 128 }),
  lastName: varchar("lastName", { length: 128 }),
  title: varchar("title", { length: 255 }),
  company: varchar("company", { length: 255 }),
  location: varchar("location", { length: 255 }),
  linkedinUrl: text("linkedinUrl"),
  websiteUrl: text("websiteUrl"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  sourceType: varchar("sourceType", { length: 64 }),
  sourceUrl: text("sourceUrl"),
  aiSummary: text("aiSummary"),
  tags: json("tags").$type<string[]>().default([]),
  status: varchar("status", { length: 32 }).default("saved"),
  relevanceScore: decimal("relevanceScore", { precision: 5, scale: 2 }),
  lastInteractionAt: timestamp("lastInteractionAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_people_userId").on(table.userId),
  index("idx_people_userId_fullName").on(table.userId, table.fullName),
]);

export type Person = typeof people.$inferSelect;

// ─── Person Notes ────────────────────────────────────────────────
export const personNotes = mysqlTable("person_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  personId: int("personId").notNull(),
  noteType: varchar("noteType", { length: 32 }).default("manual"),
  content: text("content").notNull(),
  createdBy: varchar("createdBy", { length: 32 }).default("user"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_person_notes_personId").on(table.personId),
]);

export type PersonNote = typeof personNotes.$inferSelect;

// ─── Interactions ────────────────────────────────────────────────
export const interactions = mysqlTable("interactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  personId: int("personId").notNull(),
  interactionType: varchar("interactionType", { length: 64 }).notNull(),
  channel: varchar("channel", { length: 32 }),
  content: text("content"),
  metadataJson: json("metadataJson").$type<Record<string, unknown>>(),
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_interactions_userId_occurred").on(table.userId, table.occurredAt),
  index("idx_interactions_personId").on(table.personId),
]);

export type Interaction = typeof interactions.$inferSelect;

// ─── Lists ───────────────────────────────────────────────────────
export const lists = mysqlTable("lists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  listType: varchar("listType", { length: 32 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_lists_userId").on(table.userId),
]);

export type List = typeof lists.$inferSelect;

// ─── List People ─────────────────────────────────────────────────
export const listPeople = mysqlTable("list_people", {
  id: int("id").autoincrement().primaryKey(),
  listId: int("listId").notNull(),
  personId: int("personId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_list_people_unique").on(table.listId, table.personId),
]);

export type ListPerson = typeof listPeople.$inferSelect;

// ─── Tasks ───────────────────────────────────────────────────────
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  personId: int("personId"),
  listId: int("listId"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  dueAt: timestamp("dueAt"),
  priority: varchar("priority", { length: 16 }).default("medium"),
  status: varchar("status", { length: 16 }).default("open"),
  opportunityId: int("opportunityId"),
  source: varchar("source", { length: 32 }).default("manual"),
  metadataJson: json("metadataJson").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [
  index("idx_tasks_userId_status_due").on(table.userId, table.status, table.dueAt),
  index("idx_tasks_personId").on(table.personId),
]);

export type Task = typeof tasks.$inferSelect;

// ─── Opportunities ───────────────────────────────────────────────
export const opportunities = mysqlTable("opportunities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  personId: int("personId"),
  title: varchar("title", { length: 500 }).notNull(),
  opportunityType: varchar("opportunityType", { length: 64 }).notNull(),
  signalSummary: text("signalSummary").notNull(),
  whyItMatters: text("whyItMatters"),
  recommendedAction: text("recommendedAction"),
  score: decimal("score", { precision: 5, scale: 2 }),
  status: varchar("status", { length: 16 }).default("open"),
  metadataJson: json("metadataJson").$type<Record<string, unknown>>(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_opportunities_userId_status").on(table.userId, table.status),
  index("idx_opportunities_personId").on(table.personId),
]);

export type Opportunity = typeof opportunities.$inferSelect;

// ─── Drafts ──────────────────────────────────────────────────────
export const drafts = mysqlTable("drafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  personId: int("personId"),
  listId: int("listId"),
  draftType: varchar("draftType", { length: 64 }).notNull(),
  tone: varchar("tone", { length: 32 }).default("professional"),
  subject: varchar("subject", { length: 500 }),
  body: text("body").notNull(),
  status: varchar("status", { length: 32 }).default("pending_review"),
  metadataJson: json("metadataJson").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_drafts_userId").on(table.userId),
  index("idx_drafts_personId").on(table.personId),
]);

export type Draft = typeof drafts.$inferSelect;

// ─── Search Queries ──────────────────────────────────────────────
export const searchQueries = mysqlTable("search_queries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  queryText: text("queryText").notNull(),
  filtersJson: json("filtersJson").$type<Record<string, unknown>>(),
  parsedIntentsJson: json("parsedIntentsJson").$type<Record<string, unknown>>(),
  queryVariantsJson: json("queryVariantsJson").$type<string[]>(),
  negativeTermsJson: json("negativeTermsJson").$type<string[]>(),
  resultCount: int("resultCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_search_queries_userId").on(table.userId),
]);

export type SearchQuery = typeof searchQueries.$inferSelect;

// ─── Search Results ──────────────────────────────────────────────
export const searchResults = mysqlTable("search_results", {
  id: int("id").autoincrement().primaryKey(),
  searchQueryId: int("searchQueryId").notNull(),
  personSnapshotJson: json("personSnapshotJson").$type<Record<string, unknown>>().notNull(),
  rank: int("rank"),
  scoringJson: json("scoringJson").$type<Record<string, unknown>>(),
  matchReasonsJson: json("matchReasonsJson").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_search_results_queryId").on(table.searchQueryId),
]);

export type SearchResult = typeof searchResults.$inferSelect;

// ─── Voice Captures ──────────────────────────────────────────────
export const voiceCaptures = mysqlTable("voice_captures", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  audioUrl: text("audioUrl"),
  transcript: text("transcript").notNull(),
  parsedJson: json("parsedJson").$type<Record<string, unknown>>(),
  status: varchar("status", { length: 32 }).default("parsed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_voice_captures_userId").on(table.userId),
]);

export type VoiceCapture = typeof voiceCaptures.$inferSelect;

// ─── Daily Briefs ────────────────────────────────────────────────
export const dailyBriefs = mysqlTable("daily_briefs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  briefDate: date("briefDate").notNull(),
  briefJson: json("briefJson").$type<Record<string, unknown>>().notNull(),
  deliveredVia: varchar("deliveredVia", { length: 16 }).default("web"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_daily_briefs_userId_date").on(table.userId, table.briefDate),
]);

export type DailyBrief = typeof dailyBriefs.$inferSelect;

// ─── Activity Log ────────────────────────────────────────────────
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  activityType: varchar("activityType", { length: 64 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  entityType: varchar("entityType", { length: 32 }),
  entityId: int("entityId"),
  metadataJson: json("metadataJson").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_activity_log_userId").on(table.userId, table.createdAt),
]);

export type ActivityLogEntry = typeof activityLog.$inferSelect;

// ─── Relationships (Graph) ───────────────────────────────────────
export const relationships = mysqlTable("relationships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  personAId: int("personAId").notNull(),
  personBId: int("personBId").notNull(),
  relationshipType: varchar("relationshipType", { length: 64 }).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.50"),
  source: varchar("source", { length: 32 }).default("inferred"),
  metadataJson: json("metadataJson").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_relationships_userId").on(table.userId),
  index("idx_relationships_personA").on(table.personAId),
  index("idx_relationships_personB").on(table.personBId),
]);

export type Relationship = typeof relationships.$inferSelect;

// ─── Jobs ───────────────────────────────────────────────────────
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobType: varchar("jobType", { length: 64 }).notNull(),
  status: varchar("status", { length: 16 }).default("pending").notNull(),
  priority: int("priority").default(0).notNull(),
  progress: int("progress").default(0),
  retryCount: int("retryCount").default(0).notNull(),
  maxRetries: int("maxRetries").default(3).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().default({}),
  result: json("result").$type<Record<string, unknown>>(),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_jobs_userId_type").on(table.userId, table.jobType),
  index("idx_jobs_status").on(table.status),
  index("idx_jobs_priority").on(table.priority),
]);

export type Job = typeof jobs.$inferSelect;

// ─── AI Audit Log ───────────────────────────────────────────────
export const aiAuditLog = mysqlTable("ai_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  promptModule: varchar("promptModule", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 32 }),
  entityId: int("entityId"),
  success: int("success").default(1).notNull(),
  usedFallback: int("usedFallback").default(0).notNull(),
  errorMessage: text("errorMessage"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_audit_userId").on(table.userId),
  index("idx_ai_audit_module").on(table.promptModule),
]);

export type AiAuditEntry = typeof aiAuditLog.$inferSelect;
