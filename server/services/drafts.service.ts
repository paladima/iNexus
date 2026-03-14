/**
 * Drafts Service (#10)
 * Provider-first: uses DraftProvider via getProviderWithFallback.
 * No manual try/catch fallback — the proxy handles it.
 */
import * as repo from "../repositories";
import { getProviderWithFallback } from "../providers/registry";
import type { DraftProvider } from "../providers/types";

function requireDraftProvider(): DraftProvider {
  const provider = getProviderWithFallback("draft") as DraftProvider | undefined;
  if (!provider) throw new Error("DraftProvider not registered");
  return provider;
}

export async function generateOutreachDraft(
  userId: number,
  personId: number,
  tone: string = "professional",
  context?: string,
  channel: string = "email"
) {
  const person = await repo.getPersonById(userId, personId);
  if (!person) throw new Error("Person not found");

  const goals = await repo.getUserGoals(userId);
  const provider = requireDraftProvider();

  const result = await provider.generateDraft({
    personName: person.fullName,
    personTitle: person.title ?? undefined,
    personCompany: person.company ?? undefined,
    context: context ?? "General networking",
    userGoals: goals ?? undefined,
    tone,
    draftType: channel,
  });

  const id = await repo.createDraft(userId, {
    personId,
    draftType: channel,
    subject: result.subject,
    body: result.body,
    tone: result.tone ?? tone,
    metadataJson: { generatedBy: "ai", provider: "registry", context },
  });

  await repo.logActivity(userId, {
    activityType: "draft_generated",
    title: `Generated draft for ${person.fullName}`,
    entityType: "draft",
    entityId: id ?? undefined,
  });

  return { id, ...result };
}

export async function generateIntroDraft(
  userId: number,
  personAId: number,
  personBId: number,
  reason: string,
  _tone: string = "warm"
) {
  const [personA, personB] = await Promise.all([
    repo.getPersonById(userId, personAId),
    repo.getPersonById(userId, personBId),
  ]);
  if (!personA || !personB) throw new Error("One or both people not found");

  const provider = requireDraftProvider();
  const result = await provider.generateIntroDraft(
    personA.fullName,
    personB.fullName,
    reason
  );

  return result;
}
