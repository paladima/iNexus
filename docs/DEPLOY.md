# iNexus v0.5 — Deployment Guide

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
   - `jobs` — Background job queue (priority, cancellation, progress, retry, deduplication)
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

## Architecture (v5)

```
server/
  _core/        — Framework plumbing (auth, context, LLM, voice, image, etc.)
  repositories/ — Data access layer (14 repos, barrel-exported)
  services/     — Business logic layer (9 services)
    ├── llm.service.ts          — Unified LLM client with audit
    ├── job.service.ts          — DB-only job queue with worker polling
    ├── job.handlers.ts         — All background job type handlers
    ├── discover.service.ts     — Discovery pipeline (normalize → multi-query → rerank → dedupe)
    ├── drafts.service.ts       — Draft generation (provider-first with fallback)
    ├── people.service.ts       — Person CRUD + summary + dedup
    ├── opportunities.service.ts— Opportunity detection + fingerprint dedup
    ├── voice.service.ts        — Voice upload/transcribe/parse/edit/confirm/save
    ├── command.service.ts      — Command bar orchestrator (11 intents)
    └── dashboard.service.ts    — Dashboard stats + brief lifecycle
  providers/    — Pluggable AI providers with fallback chains
    ├── types.ts       — Provider interfaces (6 providers)
    ├── registry.ts    — Registry + feature flags + Proxy fallback
    ├── llm.providers.ts — LLM-backed implementations
    └── init.ts        — Startup wiring
  routers/      — tRPC routers by domain (13 thin routers, barrel-exported)
  workers/      — Background workers (opportunity scan, brief, reconnect)
  validators/   — Zod schemas for input validation
  llmHelpers.ts — Shared LLM parsing utilities
client/
  src/pages/    — 13 frontend screens
  src/components/ — Reusable UI components
```

### Key Architecture Principles

1. **Router → Service → Repository**: Routers are thin (input validation + delegation). Business logic lives in services. Data access in repositories.
2. **Provider-first AI**: All AI calls go through typed providers (DiscoveryProvider, DraftProvider, VoiceParserProvider, OpportunityProvider, RelationshipProvider, DailyBriefProvider). No direct `invokeLLM` in services or routers.
3. **Fallback chains**: `getProviderWithFallback()` returns a Proxy that tries primary → fallback → throws. Graceful degradation built-in.
4. **DB-only job queue**: Jobs enqueued to MySQL, worker polls with `FOR UPDATE SKIP LOCKED`, supports priority, cancellation, progress tracking, retry with exponential backoff, and deduplication keys.
5. **Discovery pipeline (v5)**: DiscoveryProvider.normalizeQuery → decomposeIntent → expandQueries (multi-query) → parallel search → aggregateResults → rerank → dedupe. Fallback to broad mode on empty results.
6. **Barrel exports**: All routers, services, repositories, and providers use barrel exports for clean imports.

## Health Check

```
GET /api/trpc/system.health
```

Returns server status, uptime, and feature flags.

## Background Job System

The job system uses DB-based polling (no external queue required):

- **Worker polling interval**: 2 seconds
- **Retry strategy**: Exponential backoff (base 2s, max 30s, up to 3 attempts)
- **Cancellation**: DB-based via `cancelledAt` column
- **Deduplication**: `dedupeKey` column prevents duplicate jobs (format: `{jobType}:{userId}:{entityId}`)
- **Priority**: Higher number = processed first (default 0)
- **Entity tracking**: `entityType` + `entityId` for linking jobs to domain objects

### Registered Job Types

| Job Type | Description | Dedup Pattern |
|---|---|---|
| `generate_brief` | Generate personalized daily brief | `generate_brief:{userId}:{date}` |
| `generate_summary` | Generate AI summary for a person | `generate_summary:{userId}:person:{personId}` |
| `scan_opportunities` | Detect networking opportunities | `scan_opportunities:{userId}` |
| `detect_reconnects` | Find stale contacts needing reconnect | `detect_reconnects:{userId}` |
| `voice_transcribe` | Transcribe audio to text | — |
| `voice_parse` | Parse voice transcript into actions | — |
| `batch_outreach` | Generate drafts for multiple people | `batch_outreach:{userId}:list:{listId}` |

## Feature Flags

Configured in `server/providers/registry.ts`:

| Flag | Default | Description |
|---|---|---|
| `USE_MOCK_DISCOVERY` | `false` | Use mock discovery provider |
| `USE_OPENAI_DRAFTS` | `true` | Enable AI draft generation |
| `USE_BACKGROUND_BRIEF` | `true` | Enable background daily brief |
| `USE_VOICE_CAPTURE` | `true` | Enable voice capture features |
| `USE_OPPORTUNITY_SCAN` | `true` | Enable opportunity scanning |
| `USE_WARM_PATHS` | `true` | Enable warm path detection |
| `USE_EXTERNAL_PEOPLE_ENGINE` | `false` | Use external people search |

## Discovery Pipeline (v5)

The discovery system uses a multi-stage pipeline:

1. **Normalize**: Clean and standardize the user's query
2. **Decompose**: Extract intent, entity types, industry, geography
3. **Expand**: Generate 2-4 query variants for broader coverage
4. **Search**: Run all expanded queries in parallel
5. **Aggregate**: Merge results, boost items found by multiple queries
6. **Rerank**: Score by relevance to original query + user goals
7. **Dedupe**: Remove duplicates by name+company fingerprint
8. **Fallback**: If zero results, retry with broad mode (relaxed filters)

## Command Bar Intents (v5)

The command bar supports 11 natural language intents:

| Intent | Example | Action |
|---|---|---|
| `discover` | "find AI investors in NYC" | External people search |
| `search_people` | "search John" | Search existing contacts |
| `create_task` | "create task follow up with Sarah" | Create task |
| `create_list` | "create list VCs" | Create new list |
| `summarize_person` | "summarize John Smith" | Enqueue summary job |
| `generate_draft` | "draft message to Sarah" | Navigate to draft editor |
| `show_reconnects` | "show reconnects" | Show stale contacts |
| `batch_draft` | "draft messages for VC list" | Enqueue batch outreach job |
| `add_to_list` | "add John to VC list" | Add person to list |
| `unknown` | — | Helpful error message |

## Voice Workflow (v5)

Full confirm-edit-save flow:

1. **Upload**: Audio → S3 → URL
2. **Transcribe**: URL → Whisper API → text
3. **Parse**: Text → VoiceParserProvider → structured actions (people, tasks, notes, reminders)
4. **Edit**: User can modify parsed actions before confirming
5. **Confirm**: Selected actions saved to database with dedup
6. **Activity**: All voice actions logged to activity timeline
