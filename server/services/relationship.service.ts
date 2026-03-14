/**
 * Warm Path Engine (v9 Pillar 3)
 *
 * Not just "find person" but "how to reach them via the warmest path."
 *
 * Connection hints:
 *   - same company
 *   - same list
 *   - same tags
 *   - same geography
 *   - manually linked relationship
 *   - inferred from interactions
 *
 * Methods:
 *   - findWarmPaths(userId, targetPersonId) — find all paths to reach target
 *   - suggestIntroductions(userId) — suggest intro opportunities across network
 *   - buildIntroRequest(userId, connectorId, targetId) — generate intro draft
 */
import * as repo from "../repositories";
import { getProviderWithFallback } from "../providers/registry";
import type { DraftProvider } from "../providers/types";

// ─── Types ──────────────────────────────────────────────────────

export interface WarmPath {
  /** The connector person who can introduce you */
  connector: {
    id: number;
    fullName: string;
    title?: string | null;
    company?: string | null;
  };
  /** How they're connected to the target */
  connectionType: string;
  /** Confidence in this path (0-1) */
  confidence: number;
  /** Evidence for the connection */
  evidence: string;
  /** Suggested intro approach */
  suggestedApproach: string;
}

export interface IntroSuggestion {
  /** Person A (connector) */
  connectorId: number;
  connectorName: string;
  /** Person B (target) */
  targetId: number;
  targetName: string;
  /** Why this intro makes sense */
  reason: string;
  /** Connection type */
  connectionType: string;
  /** Confidence */
  confidence: number;
}

// ─── Find Warm Paths ────────────────────────────────────────────

export async function findWarmPaths(
  userId: number,
  targetPersonId: number
): Promise<WarmPath[]> {
  const target = await repo.getPersonById(userId, targetPersonId);
  if (!target) return [];

  const paths: WarmPath[] = [];
  const { items: allPeople } = await repo.getPeople(userId, { limit: 500 });

  // Exclude the target from potential connectors
  const others = allPeople.filter((p: any) => p.id !== targetPersonId);

  // 1. Check explicit relationships from DB
  const relationships = await repo.getRelationshipsForPerson(userId, targetPersonId);
  for (const rel of relationships as any[]) {
    const connectorId = rel.personAId === targetPersonId ? rel.personBId : rel.personAId;
    const connector = others.find((p: any) => p.id === connectorId);
    if (connector) {
      paths.push({
        connector: {
          id: connector.id,
          fullName: (connector as any).fullName,
          title: (connector as any).title,
          company: (connector as any).company,
        },
        connectionType: rel.relationshipType ?? "known_connection",
        confidence: parseFloat(rel.confidence ?? "0.7"),
        evidence: `Explicit relationship: ${rel.relationshipType}${rel.source ? ` (${rel.source})` : ""}`,
        suggestedApproach: `Ask ${(connector as any).fullName} for a direct introduction`,
      });
    }
  }

  // 2. Same company connections
  if (target.company) {
    const sameCompany = others.filter(
      (p: any) => p.company && p.company.toLowerCase() === target.company!.toLowerCase() && p.id !== targetPersonId
    );
    for (const connector of sameCompany) {
      if (!paths.some((p) => p.connector.id === (connector as any).id)) {
        paths.push({
          connector: {
            id: (connector as any).id,
            fullName: (connector as any).fullName,
            title: (connector as any).title,
            company: (connector as any).company,
          },
          connectionType: "same_company",
          confidence: 0.7,
          evidence: `Both work at ${target.company}`,
          suggestedApproach: `Mention your connection with ${(connector as any).fullName} at ${target.company}`,
        });
      }
    }
  }

  // 3. Same list connections
  // Get all lists the target is in
  const targetLists = await getPersonLists(userId, targetPersonId);
  for (const listInfo of targetLists) {
    // Get other people in the same list
    const listMembers = await repo.getListPeople(userId, listInfo.listId);
    for (const member of listMembers as any[]) {
      if (member.personId !== targetPersonId) {
        const connector = others.find((p: any) => p.id === member.personId);
        if (connector && !paths.some((p) => p.connector.id === (connector as any).id)) {
          paths.push({
            connector: {
              id: (connector as any).id,
              fullName: (connector as any).fullName,
              title: (connector as any).title,
              company: (connector as any).company,
            },
            connectionType: "same_list",
            confidence: 0.5,
            evidence: `Both in list "${listInfo.listName}"`,
            suggestedApproach: `You grouped them together — leverage the shared context`,
          });
        }
      }
    }
  }

  // 4. Same tags
  const targetTags = (target.tags as string[]) ?? [];
  if (targetTags.length > 0) {
    for (const other of others) {
      const otherTags = ((other as any).tags as string[]) ?? [];
      const sharedTags = targetTags.filter((t) => otherTags.includes(t));
      if (sharedTags.length > 0 && !paths.some((p) => p.connector.id === (other as any).id)) {
        paths.push({
          connector: {
            id: (other as any).id,
            fullName: (other as any).fullName,
            title: (other as any).title,
            company: (other as any).company,
          },
          connectionType: "shared_tags",
          confidence: 0.4 + Math.min(sharedTags.length * 0.1, 0.3),
          evidence: `Shared tags: ${sharedTags.join(", ")}`,
          suggestedApproach: `Mention your shared interest in ${sharedTags[0]}`,
        });
      }
    }
  }

  // 5. Same geography
  if (target.location) {
    const targetLoc = target.location.toLowerCase();
    const sameGeo = others.filter(
      (p: any) => p.location && p.location.toLowerCase().includes(targetLoc.split(",")[0].trim())
    );
    for (const connector of sameGeo) {
      if (!paths.some((p) => p.connector.id === (connector as any).id)) {
        paths.push({
          connector: {
            id: (connector as any).id,
            fullName: (connector as any).fullName,
            title: (connector as any).title,
            company: (connector as any).company,
          },
          connectionType: "same_geography",
          confidence: 0.3,
          evidence: `Both based in ${target.location}`,
          suggestedApproach: `Leverage the local connection through ${(connector as any).fullName}`,
        });
      }
    }
  }

  // Sort by confidence descending
  paths.sort((a, b) => b.confidence - a.confidence);

  return paths;
}

// ─── Suggest Introductions ──────────────────────────────────────

export async function suggestIntroductions(
  userId: number,
  limit: number = 10
): Promise<IntroSuggestion[]> {
  const { items: allPeople } = await repo.getPeople(userId, { limit: 200 });
  const suggestions: IntroSuggestion[] = [];

  // Find pairs that share company, tags, or geography but aren't explicitly connected
  for (let i = 0; i < allPeople.length; i++) {
    for (let j = i + 1; j < allPeople.length; j++) {
      const a = allPeople[i] as any;
      const b = allPeople[j] as any;

      // Same company
      if (a.company && b.company && a.company.toLowerCase() === b.company.toLowerCase()) {
        suggestions.push({
          connectorId: a.id,
          connectorName: a.fullName,
          targetId: b.id,
          targetName: b.fullName,
          reason: `Both work at ${a.company}`,
          connectionType: "same_company",
          confidence: 0.7,
        });
      }

      // Shared tags
      const aTags = (a.tags as string[]) ?? [];
      const bTags = (b.tags as string[]) ?? [];
      const shared = aTags.filter((t: string) => bTags.includes(t));
      if (shared.length >= 2) {
        suggestions.push({
          connectorId: a.id,
          connectorName: a.fullName,
          targetId: b.id,
          targetName: b.fullName,
          reason: `Shared interests: ${shared.join(", ")}`,
          connectionType: "shared_tags",
          confidence: 0.4 + Math.min(shared.length * 0.1, 0.3),
        });
      }
    }
  }

  // Sort by confidence, return top N
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, limit);
}

// ─── Build Intro Request ────────────────────────────────────────

export async function buildIntroRequest(
  userId: number,
  connectorPersonId: number,
  targetPersonId: number,
  reason?: string
) {
  const [connector, target] = await Promise.all([
    repo.getPersonById(userId, connectorPersonId),
    repo.getPersonById(userId, targetPersonId),
  ]);
  if (!connector || !target) throw new Error("One or both people not found");

  const provider = getProviderWithFallback("draft") as DraftProvider | undefined;
  if (!provider) throw new Error("DraftProvider not registered");

  const introReason = reason
    ?? `I'd love to connect with ${target.fullName}${target.title ? ` (${target.title})` : ""}${target.company ? ` at ${target.company}` : ""}. We share common interests and I believe we could benefit from connecting.`;

  const result = await provider.generateIntroDraft(
    connector.fullName,
    target.fullName,
    introReason
  );

  // Save as draft
  const draftId = await repo.createDraft(userId, {
    draftType: "intro_request",
    subject: result.subject,
    body: result.body,
    personId: connectorPersonId,
    metadataJson: {
      targetPersonId,
      connectorPersonId,
      targetName: target.fullName,
      connectorName: connector.fullName,
      warmPathEngine: true,
    },
  });

  await repo.logActivity(userId, {
    activityType: "intro_request_built",
    title: `Intro request: ask ${connector.fullName} to introduce ${target.fullName}`,
    entityType: "draft",
    entityId: draftId ?? undefined,
  });

  return {
    id: draftId,
    connector: { id: connector.id, fullName: connector.fullName },
    target: { id: target.id, fullName: target.fullName },
    ...result,
  };
}

// ─── Helper: get lists a person belongs to ──────────────────────

async function getPersonLists(
  userId: number,
  personId: number
): Promise<Array<{ listId: number; listName: string }>> {
  // Get all user lists and check membership
  const allLists = await repo.getLists(userId);
  const result: Array<{ listId: number; listName: string }> = [];

  for (const list of allLists as any[]) {
    const members = await repo.getListPeople(userId, list.id);
    if ((members as any[]).some((m: any) => m.personId === personId)) {
      result.push({ listId: list.id, listName: list.name });
    }
  }

  return result;
}
