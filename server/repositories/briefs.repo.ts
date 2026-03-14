import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./base";
import { dailyBriefs } from "../../drizzle/schema";

export async function getDailyBrief(userId: number, date: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(dailyBriefs)
    .where(and(eq(dailyBriefs.userId, userId), sql`${dailyBriefs.briefDate} = ${date}`)).limit(1);
  return result[0] ?? null;
}

export async function saveDailyBrief(userId: number, date: string, briefJson: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(dailyBriefs).values({ userId, briefDate: new Date(date), briefJson });
  } catch {
    await db.update(dailyBriefs).set({ briefJson })
      .where(and(eq(dailyBriefs.userId, userId), sql`${dailyBriefs.briefDate} = ${date}`));
  }
}
