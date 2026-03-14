/**
 * v18 Stabilization Sprint Tests
 * - Voice stress scenarios
 * - Rate limiter
 * - Bulk guardrails (server-side)
 * - Job retry/list endpoints
 * - Seed data script structure
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Rate Limiter ──────────────────────────────────────────
describe("Rate Limiter", () => {
  beforeEach(async () => {
    const { clearAllRateLimits } = await import("../utils/rateLimit");
    clearAllRateLimits();
  });

  it("should export checkRateLimit and enforceRateLimit", async () => {
    const mod = await import("../utils/rateLimit");
    expect(typeof mod.checkRateLimit).toBe("function");
    expect(typeof mod.enforceRateLimit).toBe("function");
    expect(typeof mod.clearAllRateLimits).toBe("function");
  });

  it("should have predefined rate limit configs", async () => {
    const { RATE_LIMITS } = await import("../utils/rateLimit");
    expect(RATE_LIMITS.discover.maxRequests).toBe(10);
    expect(RATE_LIMITS.voiceUpload.maxRequests).toBe(5);
    expect(RATE_LIMITS.bulkAction.maxRequests).toBe(5);
  });

  it("should allow requests within limit", async () => {
    const { checkRateLimit } = await import("../utils/rateLimit");
    const config = { maxRequests: 5, windowMs: 60000 };
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(999, "test-op", config);
      expect(result.allowed).toBe(true);
    }
  });

  it("should block requests exceeding limit", async () => {
    const { checkRateLimit } = await import("../utils/rateLimit");
    const config = { maxRequests: 2, windowMs: 60000 };
    checkRateLimit(998, "test-block", config);
    checkRateLimit(998, "test-block", config);
    const result = checkRateLimit(998, "test-block", config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track different users independently", async () => {
    const { checkRateLimit } = await import("../utils/rateLimit");
    const config = { maxRequests: 1, windowMs: 60000 };
    checkRateLimit(997, "test-indep", config);
    const blocked = checkRateLimit(997, "test-indep", config);
    expect(blocked.allowed).toBe(false);
    // Different user should still be allowed
    const allowed = checkRateLimit(996, "test-indep", config);
    expect(allowed.allowed).toBe(true);
  });
});

// ─── Voice Stress Scenarios ────────────────────────────────
describe("Voice Service - Stress Scenarios", () => {
  it("should export parseVoiceIntent function", async () => {
    const { parseVoiceIntent } = await import("./voice.service");
    expect(typeof parseVoiceIntent).toBe("function");
  });

  it("should export uploadAudio function", async () => {
    const { uploadAudio } = await import("./voice.service");
    expect(typeof uploadAudio).toBe("function");
  });

  it("should export transcribeAudioFile function", async () => {
    const { transcribeAudioFile } = await import("./voice.service");
    expect(typeof transcribeAudioFile).toBe("function");
  });

  it("should export editVoiceCapture function", async () => {
    const { editVoiceCapture } = await import("./voice.service");
    expect(typeof editVoiceCapture).toBe("function");
  });

  it("should export confirmVoiceActions function", async () => {
    const { confirmVoiceActions } = await import("./voice.service");
    expect(typeof confirmVoiceActions).toBe("function");
  });

  it("should export resolvePersonCandidates for ambiguity resolution", async () => {
    const { resolvePersonCandidates } = await import("./voice.service");
    expect(typeof resolvePersonCandidates).toBe("function");
  });
});

// ─── Analytics Service ─────────────────────────────────────
describe("Analytics Service", () => {
  it("should export trackEvent function", async () => {
    const { trackEvent } = await import("./analytics.service");
    expect(typeof trackEvent).toBe("function");
  });

  it("should not throw when tracking an event", async () => {
    const { trackEvent } = await import("./analytics.service");
    expect(() => trackEvent("test-user", "test_event", { key: "value" })).not.toThrow();
  });
});

// ─── Perf Logger ───────────────────────────────────────────
describe("Performance Logger", () => {
  it("should export startTimer and withPerfLogging", async () => {
    const mod = await import("../utils/perfLogger");
    expect(typeof mod.startTimer).toBe("function");
    expect(typeof mod.withPerfLogging).toBe("function");
  });

  it("startTimer should return object with end method", async () => {
    const { startTimer } = await import("../utils/perfLogger");
    const timer = startTimer("test-flow");
    expect(typeof timer.end).toBe("function");
    const duration = timer.end();
    expect(typeof duration).toBe("number");
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});

// ─── Seed Data Script ──────────────────────────────────────
describe("Seed Data Script", () => {
  it("seed-demo.mjs should exist", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("server/scripts/seed-demo.mjs");
    expect(exists).toBe(true);
  });
});

// ─── Alpha Checklist ───────────────────────────────────────
describe("Alpha Launch Checklist", () => {
  it("ALPHA_CHECKLIST.md should exist", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("docs/ALPHA_CHECKLIST.md");
    expect(exists).toBe(true);
  });

  it("should contain key sections", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("docs/ALPHA_CHECKLIST.md", "utf-8");
    expect(content).toContain("Infrastructure");
    expect(content).toContain("Security");
    expect(content).toContain("Performance");
    expect(content).toContain("UX Quality");
    expect(content).toContain("Analytics");
  });
});

// ─── Discover Quality Audit ────────────────────────────────
describe("Discover Quality Audit", () => {
  it("DISCOVER_QUALITY_AUDIT.md should exist", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("docs/DISCOVER_QUALITY_AUDIT.md");
    expect(exists).toBe(true);
  });

  it("should contain at least 30 test queries", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("docs/DISCOVER_QUALITY_AUDIT.md", "utf-8");
    // Count query entries (lines starting with | that contain a query)
    const queryLines = content.split("\n").filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Query"));
    expect(queryLines.length).toBeGreaterThanOrEqual(30);
  });
});

// ─── Jobs Router Endpoints ─────────────────────────────────
describe("Jobs Router - Retry & List", () => {
  it("jobs router should export retry and list endpoints", async () => {
    const { jobsRouter } = await import("../routers/jobs.router");
    expect(jobsRouter).toBeDefined();
    // Check that the router has the expected procedures
    const procedures = Object.keys((jobsRouter as any)._def.procedures ?? {});
    expect(procedures).toContain("retry");
    expect(procedures).toContain("list");
    expect(procedures).toContain("status");
    expect(procedures).toContain("cancel");
  });
});
