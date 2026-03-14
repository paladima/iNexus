# iNexus v0.6 — Deployment Guide

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

## Architecture (v6)

```
server/
  _core/        — Framework plumbing (auth, context, LLM, voice, image, etc.)
  repositories/ — Data access layer (14 repos, barrel-exported)
  services/     — Business logic layer (10 services)
    ├── llm.service.ts          — Unified LLM client with audit
    ├── job.service.ts          — DB-only job queue with worker polling
    ├── job.handlers.ts         — All background job type handlers
    ├── discover.service.ts     — Discovery pipeline (normalize → multi-query → rerank → dedupe → broad fallback)
    ├── drafts.service.ts       — Draft generation (provider-first with fallback)
    ├── people.service.ts       — Person CRUD + summary + dedup
    ├── opportunities.service.ts— Opportunity detection + fingerprint dedup + action layer
    ├── voice.service.ts        — Voice upload/transcribe/parse/edit/confirm/save
    ├── command.service.ts      — Command bar orchestrator (11 intents, service-only)
    └── dashboard.service.ts    — Dashboard stats + brief lifecycle
  providers/    — Pluggable AI providers with fallback chains
    ├── types.ts       — Provider interfaces (6 providers)
    ├── registry.ts    — Registry + feature flags + Proxy fallback
    ├── llm.providers.ts — LLM-backed implementations (broad fallback, general expansion)
    └── init.ts        — Startup wiring
  routers/      — tRPC routers by domain (13 thin routers, barrel-exported)
  workers.ts    — Background workers (opportunity scan, brief, reconnect) — service-layer only
  validators/   — Zod schemas for input validation
  llmHelpers.ts — Shared LLM parsing utilities
client/
  src/pages/    — 12 frontend screens (lazy-loaded for heavy pages)
  src/components/ — Reusable UI components (shadcn/ui)
```

### Key Architecture Principles (v6)

1. **Router → Service → Repository**: Routers are thin (input validation + delegation). Business logic lives in services. Data access in repositories.
2. **Provider-first AI**: All AI calls go through typed providers (DiscoveryProvider, DraftProvider, VoiceParserProvider, OpportunityProvider, RelationshipProvider, DailyBriefProvider). No direct `invokeLLM` in services or routers.
3. **Fallback chains**: `getProviderWithFallback()` returns a Proxy that tries primary → fallback → throws. Graceful degradation built-in.
4. **DB-only job queue**: Jobs enqueued to MySQL, worker polls with `FOR UPDATE SKIP LOCKED`, supports priority, cancellation, progress tracking, retry with exponential backoff, and deduplication keys.
5. **Discovery pipeline (v6)**: DiscoveryProvider.normalizeQuery → decomposeIntent → expandQueries (multi-query) → parallel search → aggregateResults → rerank → dedupe → **broad fallback via generateBroadFallbackQueries** (general professional expansion for non-LinkedIn queries).
6. **Service-only orchestration**: Command bar and workers use only service layer — no direct repo or LLM calls.
7. **Barrel exports**: All routers, services, repositories, and providers use barrel exports for clean imports.
8. **Lazy loading**: Heavy pages (Discover, Voice, PersonProfile, Opportunities) use React.lazy for faster initial load.

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

## Discovery Pipeline (v6)

The discovery system uses a multi-stage pipeline with broad fallback:

1. **Normalize**: Clean and standardize the user's query (RU→EN, role/skill/geo extraction)
2. **Decompose**: Extract intent, entity types, industry, geography
3. **Expand**: Generate 2-4 query variants for broader coverage
4. **Search**: Run all expanded queries in parallel
5. **Aggregate**: Merge results, boost items found by multiple queries
6. **Rerank**: Score by relevance to original query + user goals
7. **Dedupe**: Remove duplicates by name+company fingerprint
8. **Broad Fallback (v6)**: If zero results, generate broad fallback queries via `generateBroadFallbackQueries()` — expands to general professional categories (industry leaders, domain experts, adjacent roles) and retries search with relaxed filters

### Broad Fallback Strategy

When the primary pipeline returns zero results (common for niche or non-LinkedIn queries), the system:
- Generates 3-5 broader query variants via LLM (e.g., "AI ethics researcher" → ["AI ethics professor", "responsible AI leader", "AI governance expert"])
- Runs parallel search on all broad variants
- Aggregates and reranks with lower relevance threshold
- Returns results with `broadFallback: true` flag for UI indication

## Opportunity Action Layer (v6)

Each opportunity supports direct actions:

| Action | Endpoint | Description |
|---|---|---|
| Generate Draft | `opportunities.generateDraft` | Create outreach draft from opportunity signal |
| Create Task | `opportunities.createTask` | Create follow-up task from opportunity |
| Generate Intro | `opportunities.generateIntro` | Generate introduction request draft |
| Mark Acted On | `opportunities.update` | Mark opportunity as acted upon |
| Dismiss | `opportunities.update` | Dismiss irrelevant opportunity |

## Command Bar Intents (v6)

The command bar supports 11 natural language intents (service-only orchestration):

| Intent | Example | Action |
|---|---|---|
| `discover` | "find AI investors in NYC" | External people search |
| `search_people` | "search John" | Search existing contacts |
| `create_task` | "create task follow up with Sarah" | Create task via service |
| `create_list` | "create list VCs" | Create new list via service |
| `summarize_person` | "summarize John Smith" | Enqueue summary job via service |
| `generate_draft` | "draft message to Sarah" | Generate draft via service |
| `show_reconnects` | "show reconnects" | Show stale contacts via service |
| `batch_draft` | "draft messages for VC list" | Enqueue batch outreach via service |
| `add_to_list` | "add John to VC list" | Add person to list via service |
| `unknown` | — | Helpful error message |

## Voice Workflow (v6)

Full confirm-edit-save flow with first-class UX:

1. **Upload**: Audio → S3 → URL
2. **Transcribe**: URL → Whisper API → text
3. **Parse**: Text → VoiceParserProvider → structured actions (people, tasks, notes, reminders)
4. **Review**: User reviews parsed actions with inline editing
5. **Edit**: User can modify, remove, or add parsed actions before confirming
6. **Confirm**: Selected actions saved to database with dedup
7. **Activity**: All voice actions logged to activity timeline
8. **Retry**: On failure, user can retry transcription or parsing

## Person Profile (v6)

Relationship memory center with:
- **Quick Stats Bar**: Last contact, open tasks, opportunities, drafts count
- **Next Action Banner**: First open task with due date
- **Reconnect Warning**: Auto-detect when >30 days since last interaction
- **Tabbed Content**: Notes, Tasks, Drafts, Opportunities, Interactions
- **AI Summary**: "Why This Person Matters" section
- **Warm Paths**: Introduction paths through mutual connections
- **Connections**: Direct relationship graph links
