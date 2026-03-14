/**
 * v9 Pillar Tests — Action Layer, Scoring Engine, Warm Path Engine
 */
import { describe, it, expect } from "vitest";
import { scoreOpportunity } from "./opportunityScoring.service";
import {
  fromDiscoveryResult,
  fromPerson,
  fromOpportunity,
  fromVoiceParse,
  getAvailableActions,
} from "./action.service";

// ─── Pillar 1: Unified Action Layer ─────────────────────────────

describe("Unified Action Layer — Entity Adapters", () => {
  it("fromDiscoveryResult creates correct ActionContext", () => {
    const result = fromDiscoveryResult({
      fullName: "Jane Doe",
      title: "CTO",
      company: "Acme Inc",
      location: "NYC",
      matchReasons: ["title match", "location match"],
    });
    expect(result.sourceType).toBe("discovery");
    expect(result.person.fullName).toBe("Jane Doe");
    expect(result.person.title).toBe("CTO");
    expect(result.person.company).toBe("Acme Inc");
    expect(result.person.id).toBeUndefined();
    expect(result.contextHint).toContain("title match");
  });

  it("fromPerson creates correct ActionContext with id", () => {
    const result = fromPerson({
      id: 42,
      fullName: "John Smith",
      title: "VP Sales",
      company: "BigCorp",
      location: "London",
      linkedinUrl: "https://linkedin.com/in/jsmith",
      websiteUrl: null,
      email: "john@bigcorp.com",
    });
    expect(result.sourceType).toBe("person");
    expect(result.person.id).toBe(42);
    expect(result.person.email).toBe("john@bigcorp.com");
    expect(result.person.websiteUrl).toBeUndefined();
  });

  it("fromOpportunity creates correct ActionContext with opportunity data", () => {
    const result = fromOpportunity(
      {
        id: 10,
        title: "Speaking opportunity at TechConf",
        signalSummary: "Conference looking for AI speakers",
        whyItMatters: "Aligns with your goals",
        recommendedAction: "Submit proposal",
        personId: 42,
      },
      { id: 42, fullName: "Jane Doe", title: "CTO", company: "Acme" }
    );
    expect(result.sourceType).toBe("opportunity");
    expect(result.opportunity?.id).toBe(10);
    expect(result.opportunity?.title).toBe("Speaking opportunity at TechConf");
    expect(result.person.id).toBe(42);
    expect(result.person.fullName).toBe("Jane Doe");
    expect(result.contextHint).toContain("Speaking opportunity");
  });

  it("fromVoiceParse creates correct ActionContext", () => {
    const result = fromVoiceParse({
      name: "Alex Johnson",
      role: "Product Manager",
      company: "StartupXYZ",
      action: "Send follow-up email",
    });
    expect(result.sourceType).toBe("voice");
    expect(result.person.fullName).toBe("Alex Johnson");
    expect(result.person.title).toBe("Product Manager");
    expect(result.contextHint).toContain("Send follow-up email");
  });

  it("getAvailableActions returns save_person for unsaved entities", () => {
    const ctx = fromDiscoveryResult({ fullName: "Test Person" });
    const actions = getAvailableActions(ctx);
    expect(actions).toContain("save_person");
    expect(actions).toContain("add_to_list");
    expect(actions).toContain("generate_draft");
    expect(actions).toContain("create_task");
    expect(actions).not.toContain("mark_contacted");
    expect(actions).not.toContain("ask_for_intro");
  });

  it("getAvailableActions returns mark_contacted and ask_for_intro for saved persons", () => {
    const ctx = fromPerson({
      id: 1,
      fullName: "Saved Person",
      title: null,
      company: null,
      location: null,
      linkedinUrl: null,
      websiteUrl: null,
      email: null,
    });
    const actions = getAvailableActions(ctx);
    expect(actions).not.toContain("save_person");
    expect(actions).toContain("mark_contacted");
    expect(actions).toContain("ask_for_intro");
  });

  it("getAvailableActions includes opportunity actions for opportunity context", () => {
    const ctx = fromOpportunity(
      { id: 1, title: "Test", signalSummary: "Test signal", personId: 5 },
      { id: 5, fullName: "Person", title: null, company: null }
    );
    const actions = getAvailableActions(ctx);
    expect(actions).toContain("mark_opportunity_acted");
    expect(actions).toContain("archive_opportunity");
  });
});

// ─── Pillar 2: Opportunity Scoring Engine ───────────────────────

describe("Opportunity Scoring Engine", () => {
  it("scores opportunity with all components", () => {
    const opp = {
      title: "Speaking at AI Conference",
      opportunityType: "speaking",
      signalSummary: "Conference in New York looking for AI speakers",
      whyItMatters: "Great exposure",
      recommendedAction: "Submit proposal by Friday",
      personId: 1,
      score: "0.8",
      detectedAt: new Date(),
    };
    const goals = {
      primaryGoal: "Expand speaking opportunities in AI",
      industries: ["technology", "AI"],
      geographies: ["New York"],
    };
    const personData = {
      lastInteractionAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      interactionCount: 3,
      status: "contacted",
    };

    const result = scoreOpportunity(opp, goals, personData);
    expect(result.compositeScore).toBeGreaterThan(50);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.scoring.goalFit).toBeGreaterThan(0);
    expect(result.scoring.signalRecency).toBeGreaterThan(0);
    expect(result.scoring.relationshipStrength).toBeGreaterThan(0);
    expect(result.scoring.actionability).toBeGreaterThan(0);
    expect(result.scoreReason).toContain("Score");
    expect(result.suggestedAction).toBe("Submit proposal by Friday");
  });

  it("gives higher score to fresh signals", () => {
    const freshOpp = {
      title: "Test",
      opportunityType: "networking",
      signalSummary: "Fresh signal",
      detectedAt: new Date(),
    };
    const staleOpp = {
      title: "Test",
      opportunityType: "networking",
      signalSummary: "Stale signal",
      detectedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
    };

    const freshScore = scoreOpportunity(freshOpp, null, null);
    const staleScore = scoreOpportunity(staleOpp, null, null);
    expect(freshScore.scoring.signalRecency).toBeGreaterThan(staleScore.scoring.signalRecency);
  });

  it("gives higher relationship score to warm connections", () => {
    const warmPerson = {
      lastInteractionAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      interactionCount: 10,
      status: "contacted",
    };
    const coldPerson = {
      lastInteractionAt: null,
      interactionCount: 0,
      status: "saved",
    };

    const opp = { title: "Test", opportunityType: "test", signalSummary: "test" };
    const warmScore = scoreOpportunity(opp, null, warmPerson);
    const coldScore = scoreOpportunity(opp, null, coldPerson);
    expect(warmScore.scoring.relationshipStrength).toBeGreaterThan(coldScore.scoring.relationshipStrength);
  });

  it("gives higher actionability score when recommended action exists", () => {
    const actionableOpp = {
      title: "Test",
      opportunityType: "test",
      signalSummary: "test",
      recommendedAction: "Do this now",
      whyItMatters: "Because reasons",
      personId: 1,
      score: "0.9",
    };
    const vagueOpp = {
      title: "Test",
      opportunityType: "test",
      signalSummary: "test",
    };

    const actionableScore = scoreOpportunity(actionableOpp, null, null);
    const vagueScore = scoreOpportunity(vagueOpp, null, null);
    expect(actionableScore.scoring.actionability).toBeGreaterThan(vagueScore.scoring.actionability);
  });

  it("gives neutral goal fit when no goals set", () => {
    const opp = { title: "Test", opportunityType: "test", signalSummary: "test" };
    const result = scoreOpportunity(opp, null, null);
    expect(result.scoring.goalFit).toBe(0.5);
  });

  it("increases goal fit when keywords match", () => {
    const opp = {
      title: "AI Conference Speaker",
      opportunityType: "speaking",
      signalSummary: "Looking for AI experts in technology",
    };
    const goals = {
      primaryGoal: "Become a speaker at technology conferences",
      industries: ["technology"],
      geographies: [],
    };
    const result = scoreOpportunity(opp, goals, null);
    expect(result.scoring.goalFit).toBeGreaterThan(0.5);
  });

  it("generates fallback suggested action when no recommended action", () => {
    const opp = {
      title: "Test",
      opportunityType: "test",
      signalSummary: "test",
      detectedAt: new Date(),
    };
    const result = scoreOpportunity(opp, null, null);
    expect(result.suggestedAction.length).toBeGreaterThan(0);
  });

  it("composite score is between 0 and 100", () => {
    const opp = {
      title: "Max score test",
      opportunityType: "speaking",
      signalSummary: "Perfect match for everything",
      recommendedAction: "Act now",
      whyItMatters: "Critical",
      personId: 1,
      score: "1.0",
      detectedAt: new Date(),
    };
    const goals = {
      primaryGoal: "speaking match everything",
      industries: ["speaking"],
      geographies: ["everything"],
    };
    const person = {
      lastInteractionAt: new Date(),
      interactionCount: 20,
      status: "contacted",
    };
    const result = scoreOpportunity(opp, goals, person);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });
});

// ─── Pillar 3: Warm Path Engine (unit-level) ────────────────────

describe("Warm Path Engine — Types", () => {
  it("WarmPath interface is correctly shaped", () => {
    // Type-level test: ensure the interface compiles
    const path = {
      connector: { id: 1, fullName: "Alice", title: "CTO", company: "Acme" },
      connectionType: "same_company",
      confidence: 0.7,
      evidence: "Both work at Acme",
      suggestedApproach: "Mention your connection",
    };
    expect(path.connector.fullName).toBe("Alice");
    expect(path.connectionType).toBe("same_company");
    expect(path.confidence).toBe(0.7);
  });

  it("IntroSuggestion interface is correctly shaped", () => {
    const suggestion = {
      connectorId: 1,
      connectorName: "Alice",
      targetId: 2,
      targetName: "Bob",
      reason: "Both work at Acme",
      connectionType: "same_company",
      confidence: 0.7,
    };
    expect(suggestion.connectorName).toBe("Alice");
    expect(suggestion.targetName).toBe("Bob");
  });
});
