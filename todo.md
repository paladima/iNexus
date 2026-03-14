# iNexus — Project TODO

## Database & Backend
- [x] Database schema (users, user_goals, people, person_notes, interactions, lists, list_people, tasks, opportunities, drafts, search_queries, search_results, voice_captures, daily_briefs, activity_log)
- [x] DB query helpers for all tables
- [x] tRPC routers: auth, onboarding, dashboard, discover, people, lists, tasks, opportunities, drafts, voice, activity, daily brief, settings, AI command
- [x] Relationships table and DB helpers (person_a, person_b, relationship_type, confidence)
- [x] Background workers module (opportunity scan, daily brief, reconnect detection)

## Core Layout & Auth
- [x] Dark theme with CSS variables (deep navy/dark palette)
- [x] DashboardLayout with sidebar navigation (Dashboard, Discover, People, Lists, Opportunities, Tasks, Drafts, Activity, Voice, Settings)
- [x] Auth flow (Manus OAuth login/logout)
- [x] Onboarding flow (goals, industries, geography saved via settings)

## Screens
- [x] Dashboard (stats cards, daily brief with AI generation, recent contacts, discover CTA)
- [x] Discover (search input, AI-powered results with intent decomposition, scoring breakdown, match reasons, save person)
- [x] People list (search, filter by status, person cards with edit/delete)
- [x] Person Profile (header, AI summary, notes, interactions, warm paths, relationships/connections)
- [x] Lists (create/view/delete lists, add/remove people)
- [x] List Detail (view people in list, remove from list, batch outreach button)
- [x] Opportunities (create/view, status management, generate draft, create task, generate intro actions)
- [x] Tasks (create/complete tasks, views: today/upcoming/completed, priority, due dates)
- [x] Drafts (view/edit/approve/delete drafts, generate new AI drafts)
- [x] Activity timeline (all activity types with icons and timestamps)
- [x] Voice Capture (record via MediaRecorder, upload, transcribe, parse intent, confirm actions)
- [x] AI Command Bar (global command input in sidebar header)
- [x] Settings (profile display, networking goals, industries, geographies, target roles, sign out)

## AI Integration
- [x] Discovery ranking via LLM
- [x] Person summary generation via LLM
- [x] Outreach draft generation via LLM
- [x] Opportunity detection via LLM (manual creation with AI-suggested fields)
- [x] Voice intent parsing via LLM
- [x] Daily brief composition via LLM
- [x] AI Command Bar processing via LLM

## Discovery Intent Decomposition + Role-Aware Ranking
- [x] Query Intent Decomposition — parse user query into topic, role, geo, speaker, negative intents via LLM
- [x] Multi-query expansion — generate role-specific sub-queries from parsed intents
- [x] Role-aware scoring — compute roleMatch, industryMatch, geoMatch, seniorityMatch, goalAlignment, signalStrength
- [x] Weighted scoring formula with composite score
- [x] Deduplication of results across multi-query search
- [x] Save parsed intents, query variants, negative terms, match reasons as metadata
- [x] Update Discover UI to show scoring breakdown (expandable per card)
- [x] Update Discover result cards with match reason tags and score badges
- [x] Intent analysis panel (collapsible, shows topic/role/geo/industry/negatives/query variants)
- [x] Example query buttons for quick search

## Sprint 3-4 Remaining Tasks
- [x] #22 Opportunity detection worker (background job, every 12h)
- [x] #24 Opportunity → Draft flow (generate draft from opportunity context)
- [x] #25 Opportunity → Task flow (create task linked to opportunity)
- [x] #28 Daily brief worker (cron job, runs with workers)
- [x] #30 Reconnect detection logic (last_interaction > 90 days → opportunity)
- [x] #34 Relationship graph table (person_a, person_b, relationship_type, confidence)
- [x] #35-36 WarmPath provider + Suggested intro detection (warm paths on person profile)
- [x] #37 Intro draft generator (intro_message type from opportunity)
- [x] #16 Batch outreach for lists (generate drafts for all people in a list)

## Tests
- [x] Vitest tests for backend procedures (100 tests passing)
- [x] Tests for auth, onboarding, dashboard, people, lists, tasks, opportunities, drafts, discover, voice, activity, AI command, settings
- [x] Tests for relationships, warm paths, batch outreach, intro generation, workers
- [x] Tests for llmHelpers (safeParseJson, parseLLMContent, parseLLMWithSchema, all zod schemas)
- [x] Tests for opportunity→draft, opportunity→task, multi-tenant isolation
- [x] Tests for health endpoint, job system, async brief generation

## Polish
- [x] Loading states and skeletons
- [x] Empty states for all screens
- [x] Error handling and toast notifications
- [ ] Responsive design improvements for mobile
- [ ] Onboarding wizard (multi-step flow for first-time users)

## Code Review Fixes (20 items)
- [x] #1 Fix invalid hook call in Home.tsx — move trpc.useUtils() to component body
- [x] #2 Fix side effect in useAuth — move localStorage.setItem from useMemo to useEffect
- [x] #3 Guard localStorage access in DashboardLayout — add typeof window check
- [x] #4 Add safeParseJson helper for all LLM responses in routers.ts and workers.ts
- [x] #5 Add zod validation schemas for LLM responses (daily brief, person summary, opportunities, voice parsing, drafts)
- [x] #6 Implement tag filter in getPeople (added to db.ts)
- [x] #7 Fix multi-tenant leak in getPersonNotes — added userId filter
- [x] #8 Validate ownership when adding person to list
- [x] #9 Validate ownership in all related operations (removePersonFromList, getListPeople, createRelationship, batch flows)
- [x] #10 Throw errors on missing DB in production instead of silent fallback
- [x] #11 Replace result[0].insertId with safer pattern
- [x] #12 Refactor worker orchestration — added rate limits, retries, dedup, separate jobs
- [x] #13 Move dashboard.generateBrief to background job with polling
- [x] #14 Fix N+1 queries in detectSuggestedIntrosForUser
- [x] #15 Add opportunity dedup (fingerprint in workers)
- [x] #16 Extract provider interfaces (server/providers/types.ts)
- [x] #17 Split routers.ts into routers/ (discover, people, opportunities, voice)
- [x] #18 Clean production bundle — no debug artifacts present
- [x] #19 Add optimistic/error UX on key screens (Tasks, Drafts, People — optimistic deletes, error states, retry buttons)
- [x] #20 Add integration tests — 94 tests total (llmHelpers: 23, routers: 70, auth: 1) covering auth, onboarding, CRUD, discover, voice, workers, relationships, multi-tenant isolation

## MVP Hardening (20 items)
- [x] #1 Complete architecture split: routers/, services/, providers/, validators/, repositories/
- [x] #2 Refactored routers.ts — extracted discover, people, opportunities, voice to split modules
- [x] #3 Created provider interfaces in server/providers/types.ts
- [x] #4 Provider registry with feature flags in server/providers/registry.ts
- [x] #5 Dashboard brief uses async job system with polling
- [x] #6 Jobs table created with full lifecycle (pending → running → completed/failed)
- [x] #7 Heavy LLM calls moved to async job handlers (brief, summary, opportunity scan, batch outreach, voice)
- [x] #8 Unified LLM client in server/services/llm.service.ts with audit logging
- [x] #9 AI audit logging via ai_audit_log table and logAiAction repo
- [x] #10 Zod validation schemas for all LLM responses in llmHelpers.ts
- [x] #11 Ownership validation on all mutations (userId filters on all repos)
- [x] #12 Workflow chain: discover → save person → add to list → batch outreach → draft
- [x] #13 Batch outreach on lists, opportunity→draft/task flows
- [x] #14 People page with optimistic updates, error states, retry
- [x] #15 Voice flow with async job-based transcription and parsing
- [x] #16 AI Command Bar with LLM-based intent routing
- [x] #17 Full repository layer: user, people, lists, tasks, opportunities, drafts, voice, activity, search, briefs, interactions, dashboard, jobs, audit
- [x] #18 Clean production — no debug artifacts, proper .gitignore
- [x] #19 Client bundle clean — no debug UI or showcase components
- [x] #20 Health endpoint at /api/trpc/health.check, job system with worker launch at startup
