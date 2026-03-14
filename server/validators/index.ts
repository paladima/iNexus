/**
 * Shared Zod validators (#2) — single source of truth for input validation.
 * Used by routers and services.
 */
import { z } from "zod";

// ─── Pagination ─────────────────────────────────────────────────
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

// ─── Person ─────────────────────────────────────────────────────
export const createPersonSchema = z.object({
  fullName: z.string().min(1).max(200),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  sourceType: z.string().max(32).optional(),
  sourceUrl: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  status: z.enum(["active", "archived", "lead"]).optional(),
  relevanceScore: z.string().optional(),
});

export const updatePersonSchema = createPersonSchema.partial();

// ─── List ───────────────────────────────────────────────────────
export const createListSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

// ─── Task ───────────────────────────────────────────────────────
export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  personId: z.number().int().optional(),
  listId: z.number().int().optional(),
  opportunityId: z.number().int().optional(),
  dueAt: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  source: z.string().max(32).optional(),
});

// ─── Draft ──────────────────────────────────────────────────────
export const generateDraftSchema = z.object({
  personId: z.number().int(),
  tone: z.enum(["professional", "casual", "friendly", "formal"]).optional().default("professional"),
  context: z.string().max(2000).optional(),
  draftType: z.enum(["outreach", "follow_up", "intro_request", "thank_you"]).optional().default("outreach"),
});

// ─── Opportunity ────────────────────────────────────────────────
export const createOpportunitySchema = z.object({
  title: z.string().min(1).max(300),
  opportunityType: z.string().max(64),
  signalSummary: z.string().max(2000),
  personId: z.number().int().optional(),
  whyItMatters: z.string().max(2000).optional(),
  recommendedAction: z.string().max(1000).optional(),
  score: z.string().optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

// ─── Search / Discover ──────────────────────────────────────────
export const discoverSearchSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.record(z.string(), z.unknown()).optional(),
});

// ─── Voice ──────────────────────────────────────────────────────
export const voiceUploadSchema = z.object({
  audioUrl: z.string().url(),
  language: z.string().max(10).optional(),
});

// ─── Onboarding / Goals ─────────────────────────────────────────
export const saveGoalsSchema = z.object({
  primaryGoal: z.string().max(200).optional(),
  industries: z.array(z.string().max(100)).max(20).optional(),
  geographies: z.array(z.string().max(100)).max(20).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

// ─── Settings ───────────────────────────────────────────────────
export const updateSettingsSchema = z.object({
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  dailyBriefEnabled: z.number().int().min(0).max(1).optional(),
  reminderMode: z.enum(["email", "push", "none"]).optional(),
  name: z.string().max(200).optional(),
});

// ─── Relationship ───────────────────────────────────────────────
export const createRelationshipSchema = z.object({
  personAId: z.number().int(),
  personBId: z.number().int(),
  relationshipType: z.string().max(64),
  confidence: z.string().optional(),
  source: z.string().max(32).optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

// ─── AI Command ─────────────────────────────────────────────────
export const aiCommandSchema = z.object({
  command: z.string().min(1).max(1000),
});
