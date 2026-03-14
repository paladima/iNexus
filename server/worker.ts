/**
 * Standalone Worker Entrypoint (#6)
 *
 * Runs independently from the web server process.
 * Polls the jobs table for pending work and processes jobs with:
 *   - Configurable concurrency limit
 *   - Graceful shutdown on SIGINT/SIGTERM
 *   - DB-based cancellation checks
 *   - Exponential backoff retries (handled by job.service)
 *
 * Usage:
 *   pnpm worker          # start the worker
 *   pnpm worker:once     # run one cycle and exit
 */
import "dotenv/config";
import { registerAllHandlers } from "./services/job.handlers";
import { initializeProviders } from "./providers/init";
import { startJobProcessor, stopJobProcessor } from "./services/job.service";
import { startWorkers, stopWorkers } from "./workers";

const MODE = process.argv.includes("--once") ? "once" : "daemon";
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10);

let shuttingDown = false;

async function main() {
  console.log(`[Worker] Starting in ${MODE} mode (concurrency=${CONCURRENCY}, pid=${process.pid})`);

  // Initialize providers and register job handlers
  initializeProviders();
  registerAllHandlers();

  if (MODE === "once") {
    // Run periodic workers once and exit
    const { runAllWorkers } = await import("./workers");
    await runAllWorkers();
    console.log("[Worker] One-shot cycle complete. Exiting.");
    process.exit(0);
  }

  // Daemon mode: start job processor + periodic workers
  startJobProcessor();
  startWorkers();

  console.log("[Worker] Daemon running. Press Ctrl+C to stop.");
}

// ─── Graceful Shutdown ─────────────────────────────────────────
function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[Worker] Received ${signal}. Shutting down gracefully...`);

  stopJobProcessor();
  stopWorkers();

  // Give in-flight jobs 10s to finish
  setTimeout(() => {
    console.log("[Worker] Shutdown complete.");
    process.exit(0);
  }, 10_000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  console.error("[Worker] Uncaught exception:", err);
  gracefulShutdown("uncaughtException");
});

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
