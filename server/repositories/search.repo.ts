import { eq } from "drizzle-orm";
import { getDb } from "./base";
import { searchQueries, searchResults } from "../../drizzle/schema";

export async function createSearchQuery(userId: number, queryText: string, filtersJson?: Record<string, unknown>, extra?: {
  parsedIntentsJson?: Record<string, unknown>;
  queryVariantsJson?: string[];
  negativeTermsJson?: string[];
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(searchQueries).values({ userId, queryText, filtersJson, ...extra });
  return result[0].insertId;
}

export async function saveSearchResults(searchQueryId: number, results: Array<{
  personSnapshotJson: Record<string, unknown>; rank: number;
  scoringJson?: Record<string, unknown>; matchReasonsJson?: string[];
}>) {
  const db = await getDb();
  if (!db) return;
  if (results.length === 0) return;
  await db.insert(searchResults).values(results.map(r => ({ searchQueryId, ...r })));
  await db.update(searchQueries).set({ resultCount: results.length }).where(eq(searchQueries.id, searchQueryId));
}
