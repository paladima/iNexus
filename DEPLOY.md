# iNexus — Deployment Guide

## Prerequisites

- **Node.js** 22+ and **pnpm** 10+
- **MySQL 8** or **TiDB** database
- Environment variables configured (see Settings > Secrets in the Management UI)

## Quick Start (Development)

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:push

# Start the dev server (app + worker in one process)
pnpm dev
```

The app will be available at `http://localhost:3000`.

## Production Deployment

### 1. Build

```bash
pnpm build
```

This compiles the Vite frontend and bundles the Express server into `dist/`.

### 2. Run Migrations

```bash
pnpm db:push
```

Or apply SQL files from `drizzle/` manually against your production database.

### 3. Start the App Server

```bash
pnpm start
```

The server listens on the port defined by the platform (default: 3000).

### 4. Start the Worker (Separate Process)

```bash
pnpm worker
```

The worker polls the `jobs` table for pending work and processes them with:
- Configurable concurrency via `WORKER_CONCURRENCY` env var (default: 3)
- Graceful shutdown on SIGINT/SIGTERM
- Exponential backoff retries

For a one-shot run (e.g., cron job):

```bash
pnpm worker:once
```

### 5. Health Check

```
GET /api/health
```

Returns JSON with `status`, `uptime`, `timestamp`, and `version`.

## Architecture

```
App Server (Express+tRPC)     Worker Process (job processor)
  /api/trpc/*                   polls jobs table
  /api/health                   runs handlers
  /api/oauth/*                  periodic scans
  static assets
         |                           |
         +----------+----------------+
                    |
              MySQL / TiDB
```

## Environment Variables

All secrets are managed through the Manus Management UI (Settings > Secrets).
Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend |
| `BUILT_IN_FORGE_API_URL` | Forge API for LLM/storage |
| `BUILT_IN_FORGE_API_KEY` | Forge API auth token |
| `WORKER_CONCURRENCY` | Max concurrent jobs (default: 3) |
| `ENABLE_WORKER` | Set to `true` to run job processor in-process with app server (default: `false` in production, `true` in development) |

## Scripts Reference

| Script | Description |
|--------|-------------|
| `pnpm dev` | Development server with hot reload |
| `pnpm build` | Production build |
| `pnpm start` | Start production app server |
| `pnpm worker` | Start worker daemon |
| `pnpm worker:once` | Run worker cycle once and exit |
| `pnpm worker:dev` | Worker with hot reload (dev) |
| `pnpm test` | Run Vitest test suite |
| `pnpm check` | TypeScript type check |
| `pnpm db:push` | Generate and apply DB migrations |

## Publishing via Manus

1. Save a checkpoint in the Manus chat
2. Click the **Publish** button in the Management UI header
3. Configure your domain in Settings > Domains
