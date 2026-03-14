import { eq } from "drizzle-orm";
import { getDb, requireDb } from "./base";
import { InsertUser, users, userGoals } from "../../drizzle/schema";
import { ENV } from "../_core/env";

// ─── Users ───────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserSettings(userId: number, settings: {
  timezone?: string; language?: string; dailyBriefEnabled?: number;
  reminderMode?: string; onboardingCompleted?: number; name?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(settings).where(eq(users.id, userId));
}

// ─── User Goals ──────────────────────────────────────────────────
export async function upsertUserGoals(userId: number, data: {
  primaryGoal?: string; industries?: string[]; geographies?: string[];
  preferences?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(userGoals).set(data).where(eq(userGoals.userId, userId));
  } else {
    await db.insert(userGoals).values({ userId, ...data });
  }
}

export async function getUserGoals(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userGoals).where(eq(userGoals.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function getAllUsersWithBriefEnabled() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.dailyBriefEnabled, 1));
}
