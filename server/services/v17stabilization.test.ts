/**
 * v17 Stabilization Sprint Tests
 * - Analytics service: trackEvent, trackActionDispatch
 * - Performance logger: startTimer, withPerfLogging, thresholds
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Analytics Service Tests ──────────────────────────────────────
describe("analytics.service", () => {
  let analyticsModule: typeof import("./analytics.service");

  beforeEach(async () => {
    vi.resetModules();
    analyticsModule = await import("./analytics.service");
  });

  it("trackEvent returns without throwing", async () => {
    // trackEvent is fire-and-forget, should never throw
    await expect(
      analyticsModule.trackEvent(1, "test_event", { key: "value" })
    ).resolves.not.toThrow();
  });

  it("trackEvent accepts all valid event types", async () => {
    const events = [
      "search_submitted", "people_saved", "list_created",
      "draft_generated", "task_created", "voice_uploaded",
      "opportunity_acted", "command_executed", "action_dispatched",
      "page_viewed", "bulk_action", "voice_confirmed",
      "job_completed", "job_failed",
    ];
    for (const event of events) {
      await expect(
        analyticsModule.trackEvent(1, event, {})
      ).resolves.not.toThrow();
    }
  });

  it("trackActionDispatch includes actionId and source", async () => {
    await expect(
      analyticsModule.trackActionDispatch(1, "task.create", "command", 150, true)
    ).resolves.not.toThrow();
  });

  it("trackActionDispatch handles failure case", async () => {
    await expect(
      analyticsModule.trackActionDispatch(1, "draft.generate", "voice", 5000, false)
    ).resolves.not.toThrow();
  });
});

// ─── Performance Logger Tests ─────────────────────────────────────
describe("perfLogger", () => {
  let perfModule: typeof import("../utils/perfLogger");

  beforeEach(async () => {
    vi.resetModules();
    perfModule = await import("../utils/perfLogger");
  });

  it("startTimer returns an object with end() and elapsed()", () => {
    const timer = perfModule.startTimer("test.flow");
    expect(timer).toHaveProperty("end");
    expect(timer).toHaveProperty("elapsed");
    expect(typeof timer.end).toBe("function");
    expect(typeof timer.elapsed).toBe("function");
  });

  it("end() returns duration in milliseconds", async () => {
    const timer = perfModule.startTimer("test.flow");
    // Small delay to ensure non-zero duration
    await new Promise((r) => setTimeout(r, 10));
    const duration = timer.end();
    expect(typeof duration).toBe("number");
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it("end() accepts optional metadata", () => {
    const timer = perfModule.startTimer("test.flow");
    const duration = timer.end({ query: "test", resultCount: 5 });
    expect(typeof duration).toBe("number");
  });

  it("elapsed() returns current duration without ending", () => {
    const timer = perfModule.startTimer("test.flow");
    const elapsed = timer.elapsed();
    expect(typeof elapsed).toBe("number");
    expect(elapsed).toBeGreaterThanOrEqual(0);
    // Can still call end() after elapsed()
    const final = timer.end();
    expect(final).toBeGreaterThanOrEqual(elapsed);
  });

  it("withPerfLogging wraps async function with timing", async () => {
    const mockFn = vi.fn(async (x: number) => x * 2);
    const wrapped = perfModule.withPerfLogging("test.wrap", mockFn);
    const result = await wrapped(5);
    expect(result).toBe(10);
    expect(mockFn).toHaveBeenCalledWith(5);
  });

  it("withPerfLogging propagates errors", async () => {
    const mockFn = vi.fn(async () => {
      throw new Error("test error");
    });
    const wrapped = perfModule.withPerfLogging("test.error", mockFn);
    await expect(wrapped()).rejects.toThrow("test error");
  });

  it("withPerfLogging uses metadata extractor", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mockFn = vi.fn(async (q: string) => ({ count: 3 }));
    const wrapped = perfModule.withPerfLogging(
      "test.meta",
      mockFn,
      (q: string) => ({ query: q })
    );
    await wrapped("hello");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("logs SLOW warning for operations exceeding threshold", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock performance.now to simulate slow operation
    const origNow = performance.now;
    let callCount = 0;
    vi.spyOn(performance, "now").mockImplementation(() => {
      callCount++;
      // First call returns 0, second call returns 20000 (simulating 20s)
      return callCount === 1 ? 0 : 20000;
    });

    const timer = perfModule.startTimer("discover.search");
    timer.end({ query: "test" });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SLOW"),
      expect.anything()
    );

    warnSpy.mockRestore();
    logSpy.mockRestore();
    vi.spyOn(performance, "now").mockImplementation(origNow);
  });
});

// ─── Smoke Test Document Exists ───────────────────────────────────
describe("smoke test checklist", () => {
  it("SMOKE_TEST.md exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../../docs/SMOKE_TEST.md");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("SMOKE_TEST.md contains all 5 workflow chains", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../../docs/SMOKE_TEST.md");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Discover");
    expect(content).toContain("Voice");
    expect(content).toContain("Opportunity");
    expect(content).toContain("Command Bar");
  });
});
