# iNexus — AI-Powered Networking Intelligence Platform

iNexus is a relationship intelligence tool that helps professionals discover, manage, and nurture their professional network using AI-powered discovery, opportunity detection, and outreach automation.

## Core Features

**Discovery Engine** — Multi-query AI search with intent decomposition, RU/EN normalization, 8-15 query variants, and 6-axis relevance scoring. Includes broad fallback mode when narrow search yields few results.

**People CRM** — Contact management with tags, notes, interaction history, relationship mapping, and warm path detection. Enhanced deduplication across LinkedIn URL, website, and name+company.

**Opportunity Detection** — Automated scanning for reconnect signals, introduction suggestions, and networking opportunities based on your goals and contact patterns.

**Outreach Drafts** — AI-generated personalized messages with tone control (professional, casual, warm). Supports bulk draft generation for entire lists.

**Voice Capture** — Record voice memos, auto-transcribe, parse into structured actions (people, tasks, notes), review/edit parsed data, then save with full activity logging.

**Command Bar** — Natural language command interface that routes intents to the same services as the main UI: discover, create tasks, generate drafts, search contacts, manage lists.

**Daily Brief** — AI-generated morning briefing with priorities, reconnect suggestions, and network stats.

**Lists & Tasks** — Organize contacts into lists, create follow-up tasks with due dates and priorities, track completion.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui, Wouter, TanStack Query
- **Backend**: Express 4, tRPC 11, Drizzle ORM
- **Database**: MySQL 8 / TiDB
- **AI**: LLM-powered providers for discovery, drafts, voice parsing, opportunities
- **Architecture**: Provider registry with fallback chains, service layer, repository pattern, DB-based job queue

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
  pages/             Page components
  components/        Reusable UI components
server/              Backend (Express + tRPC)
  routers/           tRPC route handlers
  services/          Business logic layer
  repositories/      Database access layer
  providers/         AI provider implementations
  _core/             Framework plumbing
drizzle/             Database schema & migrations
shared/              Shared types & constants
```

## License

MIT
