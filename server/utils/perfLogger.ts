/**
 * Performance Logger (v17 — Stabilization Sprint)
 *
 * Lightweight server-side latency tracking for key flows.
 * Logs timing data to console with structured format for easy parsing.
 *
 * Usage:
 *   const timer = startTimer("discover.search");
 *   // ... do work ...
 *   timer.end({ query, resultCount: 42 });
 */

export interface PerfEntry {
  flow: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

const LOG_PREFIX = "[Perf]";

/**
 * Start a performance timer for a named flow.
 * Returns an object with an `end()` method that logs the duration.
 */
export function startTimer(flow: string) {
  const startMs = performance.now();
  const startTime = new Date().toISOString();

  return {
    /** End the timer and log the result. Returns the duration in ms. */
    end(metadata?: Record<string, unknown>): number {
      const durationMs = Math.round(performance.now() - startMs);
      const entry: PerfEntry = {
        flow,
        durationMs,
        metadata,
        timestamp: startTime,
      };

      // Structured log for easy grep/parsing
      console.log(
        `${LOG_PREFIX} ${flow} ${durationMs}ms`,
        metadata ? JSON.stringify(metadata) : ""
      );

      // Warn on slow operations
      const thresholds: Record<string, number> = {
        "discover.search": 15000,
        "discover.expand": 5000,
        "draft.generate": 10000,
        "voice.transcribe": 10000,
        "voice.parse": 5000,
        "job.execute": 30000,
        "llm.call": 15000,
      };

      const threshold = thresholds[flow] ?? 10000;
      if (durationMs > threshold) {
        console.warn(
          `${LOG_PREFIX} SLOW ${flow} took ${durationMs}ms (threshold: ${threshold}ms)`,
          metadata ? JSON.stringify(metadata) : ""
        );
      }

      return durationMs;
    },

    /** Get elapsed time without ending the timer. */
    elapsed(): number {
      return Math.round(performance.now() - startMs);
    },
  };
}

/**
 * Wrap an async function with automatic performance logging.
 */
export function withPerfLogging<T extends (...args: any[]) => Promise<any>>(
  flow: string,
  fn: T,
  metadataExtractor?: (...args: Parameters<T>) => Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    const timer = startTimer(flow);
    try {
      const result = await fn(...args);
      const metadata = metadataExtractor ? metadataExtractor(...args) : undefined;
      timer.end({ ...metadata, success: true });
      return result;
    } catch (err) {
      timer.end({ success: false, error: (err as Error).message });
      throw err;
    }
  }) as T;
}
