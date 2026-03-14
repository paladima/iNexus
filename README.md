# iNexus — AI-Powered Networking Intelligence Platform

iNexus is a relationship intelligence tool that helps professionals discover, manage, and nurture their professional network using AI-powered discovery, opportunity detection, and outreach automation.

## Core Features

**Discovery Engine** — Multi-query AI search with intent decomposition, RU/EN normalization, 8-15 query variants, skill synonym expansion (23 role + 23 skill groups), and 6-axis relevance scoring. Includes broad fallback mode when narrow search yields few results.

**People CRM** — Contact management with tags, notes, interaction history, relationship mapping, and warm path detection. Enhanced deduplication via PersonMatcher (LinkedIn URL, website, name+company, fuzzy Levenshtein). Duplicate detection and merge support.

**Relationship Graph** — BFS multi-hop intro path discovery. Builds adjacency graph from explicit relationships and implicit connections (same company, same list, shared tags, same geography). Finds shortest intro chains: You → Alex → Mark → John with configurable max hops.

**Opportunity Radar** — Categorized opportunity dashboard showing reconnect signals, intro opportunities, and collaboration potential. 4-component scoring engine (goal fit, signal recency, relationship strength, actionability) with ranked top actions.

**Networking Brief** — Real-time daily networking plan combining reconnect signals (30+ day gaps), overdue/due-today tasks, intro opportunities, and follow-up signals from recent interactions. Priority-sorted with time-of-day greeting.

**Warm Path Engine** — Find warm introductions through existing connections. Connection hints from explicit relationships, same company, same list, shared tags, and same geography. "Ask for Intro" generates LLM-powered intro request drafts.

**Outreach Drafts** — AI-generated personalized messages with tone control (professional, casual, warm). Supports bulk draft generation for entire lists.

**Voice Capture** — Record voice memos, auto-transcribe, parse into structured actions (people, tasks, notes), review/edit parsed data, then save with full activity logging. Unlinked notes management.

**Unified Action Registry** — Type-safe action dispatcher that unifies all entry points (command bar, voice, bulk toolbar, opportunity buttons) through a single dispatch layer. 7 core actions: people.save, list.add_people, draft.generate, task.create, task.create_followup, voice.confirm_actions, opportunity.act. Zod-validated inputs, activity logging, batch support.

**Command Bar** — Natural language command interface that routes intents through the Action Registry: discover, create tasks, generate drafts, search contacts, manage lists.

**Daily Brief** — AI-generated morning briefing with priorities, reconnect suggestions, and network stats.

**Lists & Tasks** — Organize contacts into lists, create follow-up tasks with due dates and priorities, track completion.

## Architecture

```
Routers → Action Registry → Services → Repositories → Database
    ↓              ↓
  Providers     Dispatcher (validate → run → log → respond)
    ↓
  Job System (DB-based queue, standalone worker, dedup, retry, progress)
```

**Key Patterns:**
- Provider registry with fallback chains (primary → fallback → graceful degradation)
- PersonMatcher utility for unified fuzzy matching and deduplication
- Service-only architecture (no direct repo calls from command layer)
- Unified Action Registry with type-safe dispatch, Zod validation, batch support
- dedupeKey on all job producers (userId+jobType+entityId)
- Graceful shutdown with SIGINT/SIGTERM handlers

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui, Wouter, TanStack Query
- **Backend**: Express 4, tRPC 11, Drizzle ORM
- **Database**: MySQL 8 / TiDB
- **AI**: LLM-powered providers for discovery, drafts, voice parsing, opportunities
- **Testing**: Vitest (244 tests across 12 test files)

## Getting Started

See [DEPLOY.md](./DEPLOY.md) for full setup and deployment instructions.

```bash
pnpm install
pnpm db:push
pnpm dev
```

## Project Structure

```
client/src/          Frontend (React + Tailwind)
  pages/             Page components (14 pages)
  components/        Reusable UI (TopActions, OpportunityRadar, DailyBriefWidget,
                     WarmPaths, IntroPathVisualizer, ActionRail, JobStatusBadge)
server/              Backend (Express + tRPC)
  actions/           Unified Action Registry (types, registry, dispatcher, 7 actions)
  routers/           tRPC route handlers (15 routers)
  services/          Business logic layer (15 services)
  repositories/      Database access layer (14 repos)
  providers/         AI provider implementations
  utils/             Shared utilities (personMatcher, fuzzyMatch, skillSynonyms)
  _core/             Framework plumbing
drizzle/             Database schema & migrations
shared/              Shared types & constants
```

## Version History

| Version | Focus | Tests |
|---------|-------|-------|
| v16 | Unified Action Registry + Workflow Engine, 7 core actions, useAction hook | 244 |
| v15 | Voice ambiguity resolution, ENV reference docs | 219 |
| v14 | BFS graph traversal, Opportunity Radar, Networking Brief widget | 208 |
| v13 | Shared intent schema, person similarity scoring, duplicate merge | 179 |
| v12 | Skill synonym engine, URL canonicalization, bulk insert | 167 |
| v11 | Service-only command layer, unlinked notes, worker gating | 151 |
| v10 | PersonMatcher utility, fuzzy person lookup | 140 |
| v9 | Action Layer, Scoring Engine, Warm Path Engine | 127 |

## License

MIT
