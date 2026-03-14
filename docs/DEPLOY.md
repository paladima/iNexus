# iNexus v0.2 — Deployment Guide

## Prerequisites

- Node.js 22+
- MySQL 8+ (or TiDB)
- pnpm package manager

## Environment Variables

All secrets are managed through the Manus platform. Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Session cookie signing secret |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API URL |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in API key (server) |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key |

## Database Setup

1. Create the database and apply migrations:

```bash
pnpm drizzle-kit generate   # Generate migration SQL
# Apply migrations via webdev_execute_sql or mysql client
```

2. Tables created (17 total):
   - `users`, `user_goals` — Auth and user preferences
   - `people`, `person_notes`, `interactions` — Contact management
   - `lists`, `list_people` — List management
   - `tasks` — Task tracking
   - `opportunities` — Opportunity detection
   - `drafts` — Outreach drafts
   - `search_queries`, `search_results` — Discovery history
   - `voice_captures` — Voice capture data
   - `daily_briefs` — Daily brief cache
   - `activity_log` — Activity timeline
   - `relationships` — Relationship graph
   - `jobs` — Background job queue
   - `ai_audit_log` — AI operation audit trail

## Running

### Development

```bash
pnpm install
pnpm dev
```

### Production

```bash
pnpm install
pnpm build
NODE_ENV=production node dist/server/index.js
```

## Architecture

```
server/
  _core/        — Framework plumbing (auth, context, LLM, etc.)
  repositories/ — Data access layer (14 repos)
  services/     — Business logic (LLM client, job system)
  providers/    — Pluggable AI providers with feature flags
  routers/      — tRPC routers by domain (14 routers)
  workers/      — Background workers (opportunity scan, brief, reconnect)
  validators/   — Zod schemas for input validation
client/
  src/pages/    — 13 frontend screens
  src/components/ — Reusable UI components
```

## Health Check

```
GET /api/trpc/system.health
```

Returns server status, uptime, and feature flags.

## Background Workers

Workers run automatically on server start:
- **Opportunity Scanner** — Detects networking opportunities (12h interval)
- **Daily Brief Generator** — Generates personalized daily briefs
- **Reconnect Detector** — Identifies stale contacts needing follow-up
- **Intro Detection** — Suggests warm introductions

## Feature Flags

Configured in `server/providers/registry.ts`:
- `USE_MOCK_DISCOVERY` — Use mock discovery provider
- `USE_OPENAI_DRAFTS` — Enable AI draft generation
- `USE_BACKGROUND_BRIEF` — Enable background daily brief
- `USE_VOICE_CAPTURE` — Enable voice capture features
- `USE_OPPORTUNITY_SCAN` — Enable opportunity scanning
- `USE_WARM_PATHS` — Enable warm path detection
