import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

/** Lazily create the drizzle instance. */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Require DB connection — throws in production, returns null in dev. */
export async function requireDb() {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Database connection unavailable");
    }
    console.warn("[Database] Connection unavailable in dev mode");
  }
  return db;
}
