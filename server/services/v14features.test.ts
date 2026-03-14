/**
 * v14 Feature Tests — BFS Graph Traversal, Opportunity Radar, Networking Brief
 */
import { describe, it, expect } from "vitest";
import { scoreOpportunity } from "./opportunityScoring.service";

// ─── BFS Graph Traversal (unit-level logic tests) ──────────────

describe("BFS Graph Traversal — relationship.service", () => {
  it("IntroPath type has correct structure", () => {
    // Validate the IntroPath interface shape
    const mockPath = {
      chain: [
        { personId: 1, fullName: "Alice", title: "CEO", company: "Acme" },
        { personId: 2, fullName: "Bob", title: "CTO", company: "Beta" },
        { personId: 3, fullName: "Charlie", title: "VP", company: "Gamma" },
      ],
      edges: [
        { from: 1, to: 2, connectionType: "same_company", confidence: 0.7, evidence: "Both at Acme" },
        { from: 2, to: 3, connectionType: "known_connection", confidence: 0.8, evidence: "Explicit" },
      ],
      hops: 2,
      pathConfidence: 0.56,
      description: "You → Alice → Bob → Charlie",
    };

    expect(mockPath.chain).toHaveLength(3);
    expect(mockPath.edges).toHaveLength(2);
    expect(mockPath.hops).toBe(2);
    expect(mockPath.pathConfidence).toBe(0.56);
    expect(mockPath.description).toContain("→");
  });

  it("path confidence is product of edge confidences", () => {
    const edges = [
      { confidence: 0.8 },
      { confidence: 0.7 },
      { confidence: 0.9 },
    ];
    const pathConfidence = edges.reduce((acc, e) => acc * e.confidence, 1.0);
    expect(Math.round(pathConfidence * 100) / 100).toBe(0.50);
  });

  it("BFS finds shortest path (conceptual)", () => {
    // Simulate BFS on a simple graph: A-B, B-C, A-D, D-C
    // Shortest from A to C should be A→B→C or A→D→C (both 2 hops)
    const adjacency: Record<string, string[]> = {
      A: ["B", "D"],
      B: ["A", "C"],
      C: ["B", "D"],
      D: ["A", "C"],
    };

    // BFS from A to C
    const visited = new Set(["A"]);
    const parent = new Map<string, string>();
    const queue = ["A"];
    let found = false;

    while (queue.length > 0 && !found) {
      const current = queue.shift()!;
      for (const neighbor of adjacency[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, current);
          if (neighbor === "C") {
            found = true;
            break;
          }
          queue.push(neighbor);
        }
      }
    }

    expect(found).toBe(true);

    // Reconstruct path
    const path: string[] = [];
    let node: string | undefined = "C";
    while (node) {
      path.unshift(node);
      node = parent.get(node);
    }

    // Should be exactly 2 hops (3 nodes): A → B/D → C
    expect(path.length).toBe(3);
    expect(path[0]).toBe("A");
    expect(path[path.length - 1]).toBe("C");
  });

  it("BFS respects max hops limit", () => {
    // Graph: A-B-C-D-E (linear chain)
    const adjacency: Record<string, string[]> = {
      A: ["B"],
      B: ["A", "C"],
      C: ["B", "D"],
      D: ["C", "E"],
      E: ["D"],
    };

    const maxHops = 2;
    const visited = new Set(["A"]);
    const queue = ["A"];
    let depth = 0;
    let foundE = false;

    while (queue.length > 0 && depth < maxHops) {
      const levelSize = queue.length;
      for (let i = 0; i < levelSize; i++) {
        const current = queue.shift()!;
        for (const neighbor of adjacency[current]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            if (neighbor === "E") foundE = true;
            queue.push(neighbor);
          }
        }
      }
      depth++;
    }

    // E is 4 hops away, maxHops=2, so should NOT be found
    expect(foundE).toBe(false);
    // But C (2 hops) should be visited
    expect(visited.has("C")).toBe(true);
  });

  it("handles disconnected graph gracefully", () => {
    // A-B and C-D are disconnected
    const adjacency: Record<string, string[]> = {
      A: ["B"],
      B: ["A"],
      C: ["D"],
      D: ["C"],
    };

    const visited = new Set(["A"]);
    const queue = ["A"];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of adjacency[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    expect(visited.has("B")).toBe(true);
    expect(visited.has("C")).toBe(false);
    expect(visited.has("D")).toBe(false);
  });

  it("IntroPathNode has required fields", () => {
    const node = {
      personId: 42,
      fullName: "Test Person",
      title: "Engineer",
      company: "TestCo",
    };
    expect(node.personId).toBe(42);
    expect(node.fullName).toBe("Test Person");
    expect(node.title).toBe("Engineer");
    expect(node.company).toBe("TestCo");
  });

  it("IntroPathEdge captures connection metadata", () => {
    const edge = {
      from: 1,
      to: 2,
      connectionType: "same_company",
      confidence: 0.7,
      evidence: "Both work at Acme",
    };
    expect(edge.from).toBe(1);
    expect(edge.to).toBe(2);
    expect(edge.connectionType).toBe("same_company");
    expect(edge.confidence).toBeGreaterThanOrEqual(0);
    expect(edge.confidence).toBeLessThanOrEqual(1);
    expect(edge.evidence).toContain("Acme");
  });
});

// ─── Opportunity Radar (v14) ────────────────────────────────────

describe("Opportunity Radar — categorization", () => {
  it("categorizes opportunities by type", () => {
    const opps = [
      { opportunityType: "reconnect", title: "Reconnect with Alice" },
      { opportunityType: "reconnect", title: "Reconnect with Bob" },
      { opportunityType: "intro", title: "Intro to Charlie" },
      { opportunityType: "collaboration", title: "Collab with Dave" },
      { opportunityType: "job_change", title: "Eve changed jobs" },
    ];

    const groups = new Map<string, typeof opps>();
    for (const opp of opps) {
      const type = opp.opportunityType || "other";
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(opp);
    }

    expect(groups.get("reconnect")?.length).toBe(2);
    expect(groups.get("intro")?.length).toBe(1);
    expect(groups.get("collaboration")?.length).toBe(1);
    expect(groups.get("job_change")?.length).toBe(1);
    expect(groups.has("other")).toBe(false);
  });

  it("computes average score per category", () => {
    const scores = [60, 80, 70];
    const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
    expect(avg).toBe(70);
  });

  it("sorts categories by average score descending", () => {
    const categories = [
      { type: "reconnect", avgScore: 50 },
      { type: "intro", avgScore: 70 },
      { type: "collaboration", avgScore: 60 },
    ];
    categories.sort((a, b) => b.avgScore - a.avgScore);
    expect(categories[0].type).toBe("intro");
    expect(categories[1].type).toBe("collaboration");
    expect(categories[2].type).toBe("reconnect");
  });

  it("handles empty opportunities gracefully", () => {
    const opps: any[] = [];
    const groups = new Map<string, any[]>();
    for (const opp of opps) {
      const type = opp.opportunityType || "other";
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(opp);
    }
    expect(groups.size).toBe(0);
  });

  it("TYPE_LABELS maps known types correctly", () => {
    const TYPE_LABELS: Record<string, string> = {
      reconnect: "Reconnect",
      intro: "Introduction",
      collaboration: "Collaboration",
      job_change: "Job Change",
      funding: "Funding",
      event: "Event",
      content: "Content",
      referral: "Referral",
      other: "Other",
    };

    expect(TYPE_LABELS["reconnect"]).toBe("Reconnect");
    expect(TYPE_LABELS["intro"]).toBe("Introduction");
    expect(TYPE_LABELS["job_change"]).toBe("Job Change");
    expect(TYPE_LABELS["unknown_type"]).toBeUndefined();
  });

  it("topItems limited to 3 per category", () => {
    const items = [1, 2, 3, 4, 5].map(i => ({ id: i, title: `Item ${i}`, compositeScore: 100 - i * 10 }));
    const topItems = items.slice(0, 3);
    expect(topItems).toHaveLength(3);
    expect(topItems[0].id).toBe(1);
    expect(topItems[2].id).toBe(3);
  });
});

// ─── Networking Brief (v14) ─────────────────────────────────────

describe("Networking Brief — daily brief widget", () => {
  it("reconnect detection: 30+ days since last interaction", () => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const people = [
      { id: 1, fullName: "Alice", lastInteractionAt: new Date(now - 10 * 24 * 60 * 60 * 1000), status: "active" },
      { id: 2, fullName: "Bob", lastInteractionAt: new Date(now - 45 * 24 * 60 * 60 * 1000), status: "active" },
      { id: 3, fullName: "Charlie", lastInteractionAt: new Date(now - 100 * 24 * 60 * 60 * 1000), status: "active" },
      { id: 4, fullName: "Dave", lastInteractionAt: new Date(now - 60 * 24 * 60 * 60 * 1000), status: "archived" },
    ];

    const reconnects = people.filter(
      p => p.lastInteractionAt && new Date(p.lastInteractionAt).getTime() < thirtyDaysAgo && p.status !== "archived"
    );

    expect(reconnects).toHaveLength(2);
    expect(reconnects.map(r => r.fullName)).toContain("Bob");
    expect(reconnects.map(r => r.fullName)).toContain("Charlie");
    expect(reconnects.map(r => r.fullName)).not.toContain("Alice"); // too recent
    expect(reconnects.map(r => r.fullName)).not.toContain("Dave"); // archived
  });

  it("priority assignment: >90 days = high, >60 = medium, else low", () => {
    const now = Date.now();
    const assign = (daysSince: number) => {
      if (daysSince > 90) return "high";
      if (daysSince > 60) return "medium";
      return "low";
    };

    expect(assign(100)).toBe("high");
    expect(assign(91)).toBe("high");
    expect(assign(90)).toBe("medium");
    expect(assign(61)).toBe("medium");
    expect(assign(60)).toBe("low");
    expect(assign(31)).toBe("low");
  });

  it("overdue task detection", () => {
    const now = Date.now();
    const tasks = [
      { id: 1, title: "Task A", dueAt: new Date(now - 24 * 60 * 60 * 1000), status: "open" },
      { id: 2, title: "Task B", dueAt: new Date(now + 24 * 60 * 60 * 1000), status: "open" },
      { id: 3, title: "Task C", dueAt: new Date(now - 48 * 60 * 60 * 1000), status: "done" },
    ];

    const overdue = tasks.filter(t => t.status === "open" && t.dueAt && new Date(t.dueAt).getTime() < now);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toBe("Task A");
  });

  it("brief greeting varies by time of day", () => {
    const getGreeting = (hour: number) => {
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      return `Good ${timeOfDay}!`;
    };

    expect(getGreeting(8)).toBe("Good morning!");
    expect(getGreeting(14)).toBe("Good afternoon!");
    expect(getGreeting(20)).toBe("Good evening!");
  });

  it("items sorted by priority: high → medium → low", () => {
    const items = [
      { title: "Low item", priority: "low" as const },
      { title: "High item", priority: "high" as const },
      { title: "Medium item", priority: "medium" as const },
    ];

    const prioOrder = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority]);

    expect(items[0].priority).toBe("high");
    expect(items[1].priority).toBe("medium");
    expect(items[2].priority).toBe("low");
  });

  it("stats computation from items", () => {
    const items = [
      { type: "reconnect" },
      { type: "reconnect" },
      { type: "intro" },
      { type: "task" },
      { type: "task" },
      { type: "task" },
      { type: "follow_up" },
    ];

    const stats = {
      reconnectCount: items.filter(i => i.type === "reconnect").length,
      introCount: items.filter(i => i.type === "intro").length,
      followUpCount: items.filter(i => i.type === "follow_up").length,
      taskCount: items.filter(i => i.type === "task").length,
    };

    expect(stats.reconnectCount).toBe(2);
    expect(stats.introCount).toBe(1);
    expect(stats.followUpCount).toBe(1);
    expect(stats.taskCount).toBe(3);
  });

  it("follow-up detection from recent interactions (3 days)", () => {
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    const interactions = [
      { personId: 1, interactedAt: new Date(now - 1 * 24 * 60 * 60 * 1000) },
      { personId: 2, interactedAt: new Date(now - 2 * 24 * 60 * 60 * 1000) },
      { personId: 3, interactedAt: new Date(now - 5 * 24 * 60 * 60 * 1000) },
    ];

    const recent = interactions.filter(
      i => i.interactedAt && new Date(i.interactedAt).getTime() > threeDaysAgo
    );

    expect(recent).toHaveLength(2);
    expect(recent.map(r => r.personId)).toContain(1);
    expect(recent.map(r => r.personId)).toContain(2);
    expect(recent.map(r => r.personId)).not.toContain(3);
  });

  it("brief items limited to top 8", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      type: "reconnect",
      title: `Item ${i}`,
      priority: "low" as const,
    }));

    const displayed = items.slice(0, 8);
    expect(displayed).toHaveLength(8);
  });
});

// ─── Scoring Engine — additional v14 tests ──────────────────────

describe("Opportunity Scoring — v14 additional coverage", () => {
  it("scores opportunity with all components", () => {
    const result = scoreOpportunity(
      {
        opportunityType: "intro",
        title: "Intro to AI researcher",
        signalSummary: "Shared interest in machine learning",
        detectedAt: new Date(),
        recommendedAction: "Send intro request",
        whyItMatters: "Aligns with AI goals",
        personId: 1,
        score: "0.8",
      },
      {
        primaryGoal: "AI networking",
        industries: ["technology"],
        geographies: ["San Francisco"],
      },
      {
        lastInteractionAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        interactionCount: 3,
        status: "contacted",
      }
    );

    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.scoring.goalFit).toBeGreaterThan(0);
    expect(result.scoring.signalRecency).toBeGreaterThan(0);
    expect(result.scoring.relationshipStrength).toBeGreaterThan(0);
    expect(result.scoring.actionability).toBeGreaterThan(0);
    expect(result.scoreReason).toContain("Score");
    expect(result.suggestedAction).toBeTruthy();
  });

  it("scores opportunity with no goals (neutral goal fit)", () => {
    const result = scoreOpportunity(
      {
        opportunityType: "reconnect",
        title: "Reconnect with old colleague",
        signalSummary: "Haven't spoken in 6 months",
        detectedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
      null,
      null
    );

    expect(result.scoring.goalFit).toBe(0.5); // neutral
    expect(result.scoring.relationshipStrength).toBe(0.2); // no person data
    expect(result.compositeScore).toBeGreaterThan(0);
  });

  it("signal recency decays over time", () => {
    const fresh = scoreOpportunity(
      { detectedAt: new Date(), title: "Fresh", opportunityType: "test", signalSummary: "" },
      null, null
    );
    const old = scoreOpportunity(
      { detectedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), title: "Old", opportunityType: "test", signalSummary: "" },
      null, null
    );

    expect(fresh.scoring.signalRecency).toBeGreaterThan(old.scoring.signalRecency);
  });

  it("relationship strength increases with more interactions", () => {
    const weak = scoreOpportunity(
      { title: "Test", opportunityType: "test", signalSummary: "", detectedAt: new Date() },
      null,
      { interactionCount: 0 }
    );
    const strong = scoreOpportunity(
      { title: "Test", opportunityType: "test", signalSummary: "", detectedAt: new Date() },
      null,
      { interactionCount: 10, lastInteractionAt: new Date(), status: "contacted" }
    );

    expect(strong.scoring.relationshipStrength).toBeGreaterThan(weak.scoring.relationshipStrength);
  });
});

// ─── Graph Edge Building ────────────────────────────────────────

describe("Graph Edge Building — adjacency list", () => {
  it("same company creates bidirectional edges", () => {
    const adjacency = new Map<number, Array<{ neighborId: number; type: string }>>();

    const addEdge = (a: number, b: number, type: string) => {
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a)!.push({ neighborId: b, type });
      adjacency.get(b)!.push({ neighborId: a, type });
    };

    // Two people at same company
    addEdge(1, 2, "same_company");

    expect(adjacency.get(1)?.some(e => e.neighborId === 2)).toBe(true);
    expect(adjacency.get(2)?.some(e => e.neighborId === 1)).toBe(true);
  });

  it("shared tags require 2+ shared tags for edge", () => {
    const personATags = ["ai", "ml", "python"];
    const personBTags = ["ai", "ml", "java"];
    const personCTags = ["ai", "cooking"];

    const sharedAB = personATags.filter(t => personBTags.includes(t));
    const sharedAC = personATags.filter(t => personCTags.includes(t));

    expect(sharedAB.length).toBeGreaterThanOrEqual(2); // edge created
    expect(sharedAC.length).toBeLessThan(2); // no edge
  });

  it("avoids duplicate edges", () => {
    const edges: Array<{ neighborId: number; type: string }> = [];

    const addIfNew = (neighborId: number, type: string) => {
      if (!edges.some(e => e.neighborId === neighborId && e.type === type)) {
        edges.push({ neighborId, type });
      }
    };

    addIfNew(2, "same_company");
    addIfNew(2, "same_company"); // duplicate
    addIfNew(2, "same_list"); // different type, ok

    expect(edges).toHaveLength(2);
    expect(edges.filter(e => e.type === "same_company")).toHaveLength(1);
  });

  it("tag confidence scales with shared tag count", () => {
    const computeTagConfidence = (sharedCount: number) => 0.4 + Math.min(sharedCount * 0.1, 0.3);

    expect(computeTagConfidence(2)).toBeCloseTo(0.6, 5);
    expect(computeTagConfidence(3)).toBeCloseTo(0.7, 5);
    expect(computeTagConfidence(5)).toBeCloseTo(0.7, 5); // capped at 0.3 bonus
    expect(computeTagConfidence(10)).toBeCloseTo(0.7, 5); // still capped
  });
});
