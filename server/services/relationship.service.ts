/**
 * Warm Path Engine (v9 Pillar 3, enhanced v14 with BFS)
 *
 * Not just "find person" but "how to reach them via the warmest path."
 *
 * v14 Enhancement: BFS graph traversal for multi-hop intro paths.
 * Instead of only finding direct (1-hop) connections, we now build
 * a full relationship graph and use BFS to find shortest intro chains:
 *   You → Alex → Mark → John (3 hops)
 *
 * Connection hints:
 *   - explicit relationship (DB)
 *   - same company
 *   - same list
 *   - same tags
 *   - same geography
 *
 * Methods:
 *   - findWarmPaths(userId, targetPersonId) — find all paths (1-hop)
 *   - findIntroPath(userId, targetPersonId) — BFS multi-hop path
 *   - suggestIntroductions(userId) — suggest intro opportunities
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

export interface IntroPathNode {
  personId: number;
  fullName: string;
  title?: string | null;
  company?: string | null;
}

export interface IntroPathEdge {
  from: number;
  to: number;
  connectionType: string;
  confidence: number;
  evidence: string;
}

export interface IntroPath {
  /** The chain of people: [You, Alex, Mark, John] */
  chain: IntroPathNode[];
  /** Edges between each pair in the chain */
  edges: IntroPathEdge[];
  /** Total hops */
  hops: number;
  /** Aggregate confidence (product of edge confidences) */
  pathConfidence: number;
  /** Human-readable path description */
  description: string;
}

export interface IntroSuggestion {
  connectorId: number;
  connectorName: string;
  targetId: number;
  targetName: string;
  reason: string;
  connectionType: string;
  confidence: number;
}

// ─── Graph Building ─────────────────────────────────────────────

interface GraphEdge {
  neighborId: number;
  connectionType: string;
  confidence: number;
  evidence: string;
}

/**
 * Build an adjacency list graph from all relationships + implicit connections
 * (same company, same list, shared tags, same geography).
 */
async function buildRelationshipGraph(
  userId: number
): Promise<{
  adjacency: Map<number, GraphEdge[]>;
  peopleMap: Map<number, { id: number; fullName: string; title?: string | null; company?: string | null; location?: string | null; tags?: string[] | null }>;
}> {
  const { items: allPeople } = await repo.getPeople(userId, { limit: 500 });
  const allRels = await repo.getAllRelationships(userId);

  const peopleMap = new Map<number, any>();
  for (const p of allPeople) {
    peopleMap.set((p as any).id, p);
  }

  const adjacency = new Map<number, GraphEdge[]>();

  const addEdge = (a: number, b: number, type: string, confidence: number, evidence: string) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    // Avoid duplicate edges
    const existingA = adjacency.get(a)!;
    if (!existingA.some(e => e.neighborId === b && e.connectionType === type)) {
      existingA.push({ neighborId: b, connectionType: type, confidence, evidence });
    }
    const existingB = adjacency.get(b)!;
    if (!existingB.some(e => e.neighborId === a && e.connectionType === type)) {
      existingB.push({ neighborId: a, connectionType: type, confidence, evidence });
    }
  };

  // 1. Explicit relationships from DB
  for (const rel of allRels) {
    addEdge(
      rel.personAId,
      rel.personBId,
      rel.relationshipType ?? "known_connection",
      parseFloat(rel.confidence ?? "0.7"),
      `Explicit: ${rel.relationshipType}${rel.source ? ` (${rel.source})` : ""}`
    );
  }

  // 2. Same company connections
  const companyGroups = new Map<string, number[]>();
  for (const p of allPeople) {
    const company = (p as any).company;
    if (company) {
      const key = company.toLowerCase().trim();
      if (!companyGroups.has(key)) companyGroups.set(key, []);
      companyGroups.get(key)!.push((p as any).id);
    }
  }
  for (const [company, ids] of Array.from(companyGroups)) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addEdge(ids[i], ids[j], "same_company", 0.7, `Both work at ${company}`);
      }
    }
  }

  // 3. Same list connections
  const allLists = await repo.getLists(userId);
  for (const list of allLists as any[]) {
    const members = await repo.getListPeople(userId, list.id);
    const memberIds = (members as any[]).map((m: any) => m.personId);
    if (memberIds.length < 2) continue;
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        addEdge(memberIds[i], memberIds[j], "same_list", 0.5, `Both in list "${list.name}"`);
      }
    }
  }

  // 4. Shared tags (only if 2+ shared tags for graph edges)
  const tagGroups = new Map<string, number[]>();
  for (const p of allPeople) {
    const tags = ((p as any).tags as string[]) ?? [];
    for (const tag of tags) {
      const key = tag.toLowerCase().trim();
      if (!tagGroups.has(key)) tagGroups.set(key, []);
      tagGroups.get(key)!.push((p as any).id);
    }
  }
  // Build shared tag counts between pairs
  const pairTagCounts = new Map<string, { count: number; tags: string[] }>();
  for (const [tag, ids] of Array.from(tagGroups)) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${Math.min(ids[i], ids[j])}:${Math.max(ids[i], ids[j])}`;
        if (!pairTagCounts.has(key)) pairTagCounts.set(key, { count: 0, tags: [] });
        const entry = pairTagCounts.get(key)!;
        entry.count++;
        entry.tags.push(tag);
      }
    }
  }
  for (const [key, { count, tags }] of Array.from(pairTagCounts)) {
    if (count >= 2) {
      const [a, b] = key.split(":").map(Number);
      addEdge(a, b, "shared_tags", 0.4 + Math.min(count * 0.1, 0.3), `Shared tags: ${tags.join(", ")}`);
    }
  }

  return { adjacency, peopleMap };
}

// ─── BFS Intro Path ─────────────────────────────────────────────

/**
 * BFS to find the shortest intro path from any of the user's "strong" contacts
 * to the target person. Returns the chain: [strongContact, ..., target].
 *
 * A "strong contact" is someone the user has interacted with recently
 * or has a high-confidence relationship with.
 * 
 * maxHops limits the search depth (default 4).
 */
export async function findIntroPath(
  userId: number,
  targetPersonId: number,
  maxHops: number = 4
): Promise<IntroPath | null> {
  const { adjacency, peopleMap } = await buildRelationshipGraph(userId);

  if (!adjacency.has(targetPersonId)) return null;

  // Identify "strong contacts" — people with recent interactions or high-confidence relationships
  const interactions = await repo.getInteractions(userId, undefined, 500);
  const interactionPersonIds = new Set<number>();
  for (const int of interactions) {
    const pid = (int as any).personId;
    if (pid) interactionPersonIds.add(pid);
  }

  // Strong contacts: people with interactions OR high-confidence direct relationships
  const strongContacts = new Set<number>();
  for (const [personId, edges] of Array.from(adjacency)) {
    if (interactionPersonIds.has(personId)) {
      strongContacts.add(personId);
    }
    // Also add people with high-confidence explicit relationships
    for (const edge of edges) {
      if (edge.confidence >= 0.7 && edge.connectionType !== "same_geography") {
        strongContacts.add(personId);
      }
    }
  }

  // If target is a strong contact, no intro needed
  if (strongContacts.has(targetPersonId)) return null;

  // BFS from target backwards to find closest strong contact
  const visited = new Set<number>([targetPersonId]);
  const parent = new Map<number, { from: number; edge: GraphEdge }>();
  const queue: number[] = [targetPersonId];
  let found: number | null = null;

  let depth = 0;
  while (queue.length > 0 && depth < maxHops) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) ?? [];

      for (const edge of neighbors) {
        if (visited.has(edge.neighborId)) continue;
        visited.add(edge.neighborId);
        parent.set(edge.neighborId, { from: current, edge });

        if (strongContacts.has(edge.neighborId)) {
          found = edge.neighborId;
          break;
        }
        queue.push(edge.neighborId);
      }
      if (found) break;
    }
    if (found) break;
    depth++;
  }

  if (!found) return null;

  // Reconstruct path: found → ... → target
  const chain: IntroPathNode[] = [];
  const edges: IntroPathEdge[] = [];
  let current = found;

  while (current !== targetPersonId) {
    const person = peopleMap.get(current);
    chain.push({
      personId: current,
      fullName: person?.fullName ?? `Person #${current}`,
      title: person?.title,
      company: person?.company,
    });

    const parentInfo = parent.get(current);
    if (!parentInfo) break;

    edges.push({
      from: current,
      to: parentInfo.from,
      connectionType: parentInfo.edge.connectionType,
      confidence: parentInfo.edge.confidence,
      evidence: parentInfo.edge.evidence,
    });

    current = parentInfo.from;
  }

  // Add target at the end
  const targetPerson = peopleMap.get(targetPersonId);
  chain.push({
    personId: targetPersonId,
    fullName: targetPerson?.fullName ?? `Person #${targetPersonId}`,
    title: targetPerson?.title,
    company: targetPerson?.company,
  });

  // Calculate aggregate confidence
  const pathConfidence = edges.reduce((acc, e) => acc * e.confidence, 1.0);

  // Build description
  const chainNames = chain.map(n => n.fullName);
  const description = `You → ${chainNames.join(" → ")}`;

  return {
    chain,
    edges,
    hops: chain.length - 1,
    pathConfidence: Math.round(pathConfidence * 100) / 100,
    description,
  };
}

// ─── Find Warm Paths (1-hop, original) ──────────────────────────

export async function findWarmPaths(
  userId: number,
  targetPersonId: number
): Promise<WarmPath[]> {
  const target = await repo.getPersonById(userId, targetPersonId);
  if (!target) return [];

  const paths: WarmPath[] = [];
  const { items: allPeople } = await repo.getPeople(userId, { limit: 500 });
  const others = allPeople.filter((p: any) => p.id !== targetPersonId);

  // 1. Explicit relationships
  const rels = await repo.getRelationshipsForPerson(userId, targetPersonId);
  for (const rel of rels as any[]) {
    const connectorId = rel.personAId === targetPersonId ? rel.personBId : rel.personAId;
    const connector = others.find((p: any) => p.id === connectorId);
    if (connector) {
      paths.push({
        connector: { id: (connector as any).id, fullName: (connector as any).fullName, title: (connector as any).title, company: (connector as any).company },
        connectionType: rel.relationshipType ?? "known_connection",
        confidence: parseFloat(rel.confidence ?? "0.7"),
        evidence: `Explicit relationship: ${rel.relationshipType}${rel.source ? ` (${rel.source})` : ""}`,
        suggestedApproach: `Ask ${(connector as any).fullName} for a direct introduction`,
      });
    }
  }

  // 2. Same company
  if (target.company) {
    const sameCompany = others.filter(
      (p: any) => p.company && p.company.toLowerCase() === target.company!.toLowerCase()
    );
    for (const c of sameCompany) {
      if (!paths.some(p => p.connector.id === (c as any).id)) {
        paths.push({
          connector: { id: (c as any).id, fullName: (c as any).fullName, title: (c as any).title, company: (c as any).company },
          connectionType: "same_company",
          confidence: 0.7,
          evidence: `Both work at ${target.company}`,
          suggestedApproach: `Mention your connection with ${(c as any).fullName} at ${target.company}`,
        });
      }
    }
  }

  // 3. Same list
  const targetLists = await getPersonLists(userId, targetPersonId);
  for (const listInfo of targetLists) {
    const listMembers = await repo.getListPeople(userId, listInfo.listId);
    for (const member of listMembers as any[]) {
      if (member.personId !== targetPersonId) {
        const c = others.find((p: any) => p.id === member.personId);
        if (c && !paths.some(p => p.connector.id === (c as any).id)) {
          paths.push({
            connector: { id: (c as any).id, fullName: (c as any).fullName, title: (c as any).title, company: (c as any).company },
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
      const sharedTags = targetTags.filter(t => otherTags.includes(t));
      if (sharedTags.length > 0 && !paths.some(p => p.connector.id === (other as any).id)) {
        paths.push({
          connector: { id: (other as any).id, fullName: (other as any).fullName, title: (other as any).title, company: (other as any).company },
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
    for (const c of sameGeo) {
      if (!paths.some(p => p.connector.id === (c as any).id)) {
        paths.push({
          connector: { id: (c as any).id, fullName: (c as any).fullName, title: (c as any).title, company: (c as any).company },
          connectionType: "same_geography",
          confidence: 0.3,
          evidence: `Both based in ${target.location}`,
          suggestedApproach: `Leverage the local connection through ${(c as any).fullName}`,
        });
      }
    }
  }

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

  for (let i = 0; i < allPeople.length; i++) {
    for (let j = i + 1; j < allPeople.length; j++) {
      const a = allPeople[i] as any;
      const b = allPeople[j] as any;

      if (a.company && b.company && a.company.toLowerCase() === b.company.toLowerCase()) {
        suggestions.push({
          connectorId: a.id, connectorName: a.fullName,
          targetId: b.id, targetName: b.fullName,
          reason: `Both work at ${a.company}`,
          connectionType: "same_company", confidence: 0.7,
        });
      }

      const aTags = (a.tags as string[]) ?? [];
      const bTags = (b.tags as string[]) ?? [];
      const shared = aTags.filter((t: string) => bTags.includes(t));
      if (shared.length >= 2) {
        suggestions.push({
          connectorId: a.id, connectorName: a.fullName,
          targetId: b.id, targetName: b.fullName,
          reason: `Shared interests: ${shared.join(", ")}`,
          connectionType: "shared_tags",
          confidence: 0.4 + Math.min(shared.length * 0.1, 0.3),
        });
      }
    }
  }

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

  const draftId = await repo.createDraft(userId, {
    draftType: "intro_request",
    subject: result.subject,
    body: result.body,
    personId: connectorPersonId,
    metadataJson: {
      targetPersonId, connectorPersonId,
      targetName: target.fullName, connectorName: connector.fullName,
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
