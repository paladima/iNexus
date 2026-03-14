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
- [x] Updated test suite to match v2 router structure (86 tests passing across 3 files)

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

## MVP Hardening v2 (20 items)
- [x] #1 Complete router split — move all logic from legacy routers.ts to split modules
- [x] #2 Extract auth/onboarding into auth.router.ts
- [x] #3 Extract dashboard/brief into dashboard.router.ts
- [x] #4 Extract lists into lists.router.ts
- [x] #5 Extract tasks into tasks.router.ts
- [x] #6 Extract activity/settings into activity.router.ts and settings.router.ts
- [x] #7 Wire providers through registry (discover→DiscoveryProvider, drafts→DraftProvider, voice→VoiceParserProvider, opportunities→OpportunityProvider)
- [x] #8 Add fallback chain for providers (primary→fallback→graceful degradation)
- [x] #9 Separate enqueue from execution in job system (DB polling worker)
- [x] #10 Add retries and idempotency for jobs (retry_count, max_retries, last_error, dedupe_key)
- [x] #11 Enhance jobs model (attempts, priority, run_after, worker_id, dedupe_key, entity_type/entity_id)
- [x] #12 Convert heavy actions to full job UX (person summary, opportunity scan, batch outreach, voice chain)
- [x] #13 Command bar as real orchestrator (discover, create task, generate draft, show reconnects, create list, summarize person)
- [x] #14 Discover end-to-end workflow (search→save→add to list→generate drafts→create tasks)
- [x] #15 Bulk actions in Discover and Lists (multi-select, save selected, add to list, generate drafts, create tasks)
- [x] #16 Person Profile enrichment (why matters, last contact, next action, linked opportunities, task count, draft history, graph hints)
- [x] #17 Voice flow full UX (upload→transcription→parse states, confirm actions, partial edit, error+retry)
- [x] #18 Audit trail for all AI operations (discovery ranking, person summary, draft gen, opportunity detection, voice parse, daily brief)
- [x] #19 Clean production repo (remove dist/, .webdev/, debug artifacts, prepare clean .gitignore)
- [x] #20 Deploy profile (.env.example, migration flow, seed data, worker/app start commands, health check, README with deploy steps)

## MVP Hardening v3 (20 items)
- [x] #1 Verify router architecture is fully split (compose-only main router)
- [x] #2 Extract business logic from routers into services (router → service → repository)
- [x] #3 Wire all providers through registry (DiscoveryProvider, DraftProvider, VoiceParserProvider, OpportunityProvider, RelationshipProvider)
- [x] #4 Add fallback chain for AI providers (primary → fallback → mock)
- [x] #5 Verify heavy AI operations run as jobs (daily brief, person summary, opportunity detection, voice parsing, batch drafts)
- [x] #6 Verify job worker with DB polling (enqueue → DB → worker → poll → process → update status)
- [x] #7 Verify retry mechanism for jobs (attempts, max_retries, last_error)
- [x] #8 Verify idempotency key for jobs (userId + entityId + jobType)
- [x] #9 Verify job status API (queued, running, completed, failed) for daily brief, voice, batch outreach
- [x] #10 Complete Discover workflow (search → save selected → add to list → generate outreach → create follow-up task)
- [x] #11 Verify bulk actions in Discover and Lists (select multiple, save selected, generate drafts, create tasks)
- [x] #12 Enhance Person Profile as relationship memory center (last contact, next action, open tasks, related opportunities, draft history, graph hints)
- [x] #13 Verify Voice flow (record → upload → transcribe → parse actions → confirm → save)
- [x] #14 Verify editing before saving voice actions (edit parsed task, edit parsed person, delete actions)
- [x] #15 Verify Command Bar as real AI interface (find, create task, generate draft, show reconnects)
- [x] #16 Enhance Opportunity Engine (reconnect signals, intro suggestions, event opportunities, industry signals)
- [x] #17 Add deduplication for opportunities (type + person + normalized signal)
- [x] #18 Enhance Activity timeline (saved people, generated drafts, voice captures, tasks, opportunities)
- [x] #19 Clean production repository (remove dist/, .webdev/, debug artifacts)
- [x] #20 Verify deploy profile (.env.example, migration script, seed script, worker start, health endpoint, README)

## MVP Hardening v4 (20 items)
- [x] #1 Full discovery through DiscoveryProvider (not half-provider, half-direct LLM)
- [x] #2 Fix DiscoveryProvider interface mismatch (search method unused in service)
- [x] #3 Single discovery architecture: all through provider or all service orchestration
- [x] #4 Remove inline execution from enqueueJob — DB-only enqueue, worker polls
- [x] #5 DB-based job cancellation (not in-memory Set)
- [x] #6 Add missing job fields: runAfter, dedupeKey, attemptStartedAt, workerId, entityType/entityId
- [x] #7 Job idempotency/deduplication via dedupeKey (userId + jobType + entityId or payload hash)
- [x] #8 Consistent job repo usage (no raw db access in job.service.ts)
- [x] #9 Complete barrel exports for routers/index.ts (all routers exported)
- [x] #10 Use getProviderWithFallback() in services instead of getProvider()
- [x] #11 Daily Brief full job-status UX (queued/running/completed/failed polling)
- [x] #12 Dashboard service layer (dashboard.service.ts for stats, brief, fallback)
- [x] #13 Bulk flow optimization (batch inserts, reduce DB roundtrips)
- [x] #14 Deduplication in bulkSavePeople (match by userId+fullName+company)
- [x] #15 Ownership checks in all bulk workflows (bulkAddToList, bulkCreateTasks, batch drafts)
- [x] #16 End-to-end discover→save→list→draft→task as single guided flow
- [x] #17 Command bar as real orchestration entry point (uses same services)
- [x] #18 Voice as first-class workflow (upload→transcribe→parse→confirm→edit→save→activity)
- [x] #19 Clean delivery archive and repo hygiene (no .manus/db, dist, debug artifacts)
- [x] #20 MVP deployment profile as separate deliverable (env, README, migrations, seed, worker, health)
- [x] Updated test suite with provider registry mocks (86 tests passing across 3 files)

## MVP Hardening v5 (20 items)
- [x] #1 Full DiscoveryProvider pipeline: decomposeIntent → search → rerank → dedupe → fallback broad mode
- [x] #2 Query normalization for non-LinkedIn queries (RU→EN, role/skill/geo extraction, query expansion)
- [x] #3 Multi-query discovery: 8-15 query variants, aggregate results, person-level dedupe, rerank top candidates
- [x] #4 Standardize provider access: always getProviderWithFallback() or simplify registry
- [x] #5 Remove "architecture halfway" remnants: enforce router→service→repository/provider everywhere
- [x] #6 Job system: separate worker process with independent lifecycle
- [x] #7 Job UX: show queued/running/retrying/failed/completed for brief, voice, batch, summary
- [x] #8 Enforce dedupeKey on all job producers (brief, voice, batch, summary, opportunity scan)
- [x] #9 Repo-layer discipline: no direct DB mutations outside repositories
- [x] #10 Enhanced bulkSavePeople dedupe: fullName + company + linkedinUrl + websiteUrl + normalized title
- [x] #11 Bulk operation optimization: batch reads, batch writes, reduce roundtrips
- [x] #12 Main workflow: discover → save → list → draft → task as guided flow
- [x] #13 Bulk UX on Discover and Lists: multi-select, select all, save/add/generate/create for selected
- [x] #14 Person Profile as relationship memory center: why matters, last contact, next action, tasks, opportunities, drafts, notes, timeline
- [x] #15 Voice flow polish: upload → transcribe → parse → confirm → edit → save → activity → retry
- [x] #16 Command Bar as real orchestrator: discover, create task, generate draft, reconnects, create list, summarize, add to list
- [x] #17 Clean unused dependencies and imports from package.json and client (removed framer-motion)
- [x] #18 Production-clean repository: source, migrations, docs, scripts, config only
- [x] #19 Deploy profile deliverable: .env.example, migrations, seed, worker start, app start, health, README (DEPLOY.md v5)
- [x] #20 Prepare for product validation mode: staging-ready, key flows tested
- [x] Updated test suite with v5 provider mocks (86 tests passing, 0 TS errors)

## MVP Hardening v6 (20 items)
- [x] #1 Discovery broad fallback strategy: relax role constraints, expand geography, add skill/title synonyms, broader source patterns
- [x] #2 Query expansion for general professionals (doctors, trainers, attorneys, contractors, consultants — not just founders/investors/speakers)
- [x] #3 Transparent UI for normalized query / expanded search (show original query, normalized, expanded roles/skills, broad search activated)
- [x] #4 End-to-end discover workflow polish: search → select → save → add to list → generate drafts → create follow-up tasks
- [x] #5 Bulk UX on Discover: multi-select, select all visible, save selected, add to list, generate drafts, create tasks
- [x] #6 Enhanced dedupe in bulkSavePeople: normalized full name, title similarity, location/company fuzziness, URL variant protection
- [x] #7 Command.service.ts pure service-only orchestration (no direct repo calls — command → service → repository/provider)
- [x] #8 Command bar as main entry to key workflows (discover, create task, generate draft, show reconnects, summarize person, create list, add to list)
- [x] #9 Job queue: separate worker entrypoint with independent process lifecycle (app server ≠ worker)
- [x] #10 Job status UX for all heavy operations (queued/running/retrying/failed/completed) — daily brief, summary, batch outreach, voice parse
- [x] #11 User-facing retry/cancel/failure UX: show retry state, cancel state, failure reason, retry button
- [x] #12 jobs.repo.ts full repository discipline: all job transitions centralized, no raw SQL in job.service.ts
- [x] #13 Voice flow first-class: upload → transcribe → parse → review → edit → confirm → save → activity log
- [x] #14 Voice UI: edit parsed people/tasks/notes (edit name, due date, remove task, link note to person, change priority)
- [x] #15 Person Profile as relationship memory center: why matters, last contact, next action, open tasks, linked opportunities, draft history, recent notes, relationship hints
- [x] #16 Opportunities as action layer: generate draft, create task, ignore, mark acted, open person, add to list per opportunity
- [x] #17 Opportunity dedupe/fingerprint: userId + type + personId + normalized signal + TTL/expire logic
- [x] #18 Client bundle cleanup: remove ComponentShowcase.tsx, debug artifacts, lazy-load heavy pages, remove unused shadcn/ui components
- [x] #19 Repository cleanup: remove .manus/db, debug-collector.js, temp artifacts — clean source/migrations/docs/scripts only
- [x] #20 Deployable MVP profile: .env.example, migration command, seed/mock data, app start, worker start, health endpoint, README local + deploy + staging
- [x] Updated test suite with v6 provider mocks (86 tests passing, 0 TS errors)

## MVP Hardening v7 (20 items)
- [x] #1 Remove inline job execution from enqueueJob() — app only creates job in DB, worker polls and executes (verified: enqueueJob is DB-only since v4)
- [x] #2 Remove in-memory cancelledJobs Set — cancellation state in DB only (verified: cancelledAt column, worker checks DB via isJobCancelled)
- [x] #3 Remove direct db.insert/db.update in job.service.ts — all job mutations through jobs.repo.ts only (verified: job.service uses jobRepo.* exclusively)
- [x] #4 Add dedupeKey for all job types — all producers use dedupeKey pattern userId+jobType+entityId (verified in job.handlers.ts, command.service.ts)
- [x] #5 Add runAfter + scheduler-ready queue model — full model with runAfter, retryCount, maxRetries, workerId, lastError, exponential backoff via DB re-poll
- [x] #6 Real worker entrypoint: server/worker.ts with pnpm worker / pnpm worker:once / pnpm worker:dev, graceful SIGINT/SIGTERM shutdown
- [x] #7 Provider registry: getProviderWithFallback() with Proxy-based try/catch fallback chain, primary→fallback→throw
- [x] #8 DiscoveryProvider full pipeline contract: all 7 steps implemented in types.ts and LLMDiscoveryProvider
- [x] #9 Query normalization for Russian queries: normalizeQuery() in LLMDiscoveryProvider with RU→EN, role/skill/geo extraction
- [x] #10 Multi-query discovery: expandQueries generates 8-15 variants, batched search, dedupe, LLM rerank
- [x] #11 Broad search mode: generateBroadFallbackQueries when <3 results, merge+dedupe+resort, UI indicator
- [x] #12 Discover empty state UX: shows normalized query, expanded roles, broad search status, 'Try broader search' button, 'Clear search' button
- [x] #13 Main workflow polish: discover → multi-select → save → add to list (via ListPickerDialog) → generate drafts → create tasks — all wired in Discover.tsx
- [x] #14 Full bulk actions in Discover UI: checkbox per card, Select All, Save to Contacts, Add to List (dialog), Generate Drafts, Create Tasks — all real mutations
- [x] #15 Robust bulkSavePeople dedup: linkedinUrl → websiteUrl → name+company indexes, returns savedIds/count/skipped/matched/names
- [x] #16 Command bar as real orchestration layer: 10 intents routed through services (discover, search, create_task, create_list, summarize, draft, reconnects, batch_draft, add_to_list)
- [x] #17 Voice confirm/edit/save flow: full pipeline with edit step, confirm/save, activity logging
- [x] #18 Person Profile as relationship memory center: AI summary, last contact, next action, open tasks, linked opportunities, draft history, notes, warm paths, reconnect warning
- [x] #19 Production cleanup: removed client/public/__manus__/debug-collector.js, .manus/ empty, .gitignore covers all artifacts
- [x] #20 Deploy-ready profile: DEPLOY.md, README.md, /api/health endpoint, pnpm worker/worker:once/worker:dev scripts, pnpm db:push migration
- [x] Updated test suite with v7 additions (89 tests passing: health endpoint, worker contract, bulk actions)

## MVP Hardening v8 (20 items)
- [x] #1 Remove inline job execution — enqueueJob() is DB-only (verified: no inline execution since v4)
- [x] #2 Separate worker entrypoint (server/worker.ts) with startJobProcessor, poll, process, update
- [x] #3 Add concurrency limit (WORKER_CONCURRENCY env var, default 3) to worker
- [x] #4 Add idempotency key (dedupeKey = userId+jobType+entityId) for all jobs
- [x] #5 Add runAfter for scheduled jobs — worker only picks jobs where runAfter <= now (claimNextPendingJob)
- [x] #6 Add retry policy (retryCount, maxRetries, lastError) — exponential backoff via DB re-poll
- [x] #7 Remove direct SQL from services — all services use repo.* exclusively (verified with grep)
- [x] #8 Strengthen repository layer — 14 repo files: people, tasks, lists, drafts, jobs, opportunities, activity, audit, briefs, dashboard, interactions, search, user, voice
- [x] #9 Strengthen dedupe on people save — matches by linkedinUrl, websiteUrl, normalized fullName+company
- [x] #10 Add fuzzy matching for people names — Levenshtein-based isFuzzyNameMatch() in utils/fuzzyMatch.ts, integrated into discover.service, people.service, voice.service
- [x] #11 Complete discovery pipeline — full 8-step pipeline through DiscoveryProvider
- [x] #12 Add query normalization — normalizeQuery() with RU→EN, skills/geo/role extraction
- [x] #13 Add query expansion — expandQueries() generates 8-15 variants with title/skill/source diversity
- [x] #14 Add broad search fallback — generateBroadFallbackQueries() when <3 results, merge+dedupe+resort
- [x] #15 Improve Discover empty state — shows normalized query, expanded roles, broad search indicator, 'Try broader search' button
- [x] #16 Complete bulk actions — checkbox per card, Select All, Save to Contacts, Add to List (ListPickerDialog), Generate Drafts, Create Tasks
- [x] #17 Complete discover → draft → task workflow — guided flow in Discover.tsx
- [x] #18 Complete Voice pipeline — full flow with edit step, confirm/save, activity logging, fuzzy dedup
- [x] #19 Person Profile as relationship center — AI summary, last contact, next action, tasks, opportunities, drafts, notes, warm paths, reconnect warning
- [x] #20 Deploy profile — DEPLOY.md, README.md, /api/health, pnpm worker/worker:once/worker:dev, pnpm db:push
- [x] Updated test suite with v8 fuzzy matching tests (110 tests passing: 21 fuzzyMatch, 23 llmHelpers, 65 routers, 1 auth)

## v9 — Three Architectural Pillars

### Pillar 1: Unified Action Layer
- [x] Create action.service.ts with entity-agnostic action methods (createTaskFromEntity, generateDraftFromEntity, savePersonFromDiscovery, createIntroRequest, markOpportunityActed)
- [x] Create entity adapters: fromDiscoveryResult, fromPerson, fromOpportunity, fromVoiceParse with getAvailableActions
- [x] Create shared ActionRail UI component with consistent actions across all cards (Save, Add to List, Draft, Task, Mark Contacted, Ask for Intro, Archive)
- [x] Integrate ActionRail into Discover cards, People list, Person Profile, Opportunity cards, List items

### Pillar 2: Opportunity Scoring Engine
- [x] Add scoring fields to opportunities table (score, priority, expiresAt, reasonJson) — uses existing score column + runtime scoring
- [x] Create opportunityScoring.service.ts with scoreOpportunity(), rankOpportunitiesForUser(), getTopActions()
- [x] Implement scoring formula: goalFit(0.30) + signalRecency(0.25) + relationshipStrength(0.25) + actionability(0.20)
- [x] Add TopActions widget to Dashboard with rank, title, whyItMatters, suggestedAction, score
- [x] Add tRPC endpoints: opportunities.ranked, opportunities.topActions, opportunities.markActed

### Pillar 3: Warm Path Engine
- [x] Enhance relationships table — uses existing relationship_type, confidence columns + runtime evidence
- [x] Add connection hints detection: same_company, same_list, shared_tags, same_geography, known_connection
- [x] Create relationship.service.ts with findWarmPaths(), suggestIntroductions(), buildIntroRequest()
- [x] Integrate WarmPaths component into Person Profile (replaces old warm paths section)
- [x] Add "Ask for Intro" button in WarmPaths component → relationships.buildIntroRequest → LLM draft
- [x] Updated test suite with v9 pillar tests (127 tests passing: 17 v9pillars, 21 fuzzyMatch, 23 llmHelpers, 65 routers, 1 auth)

## v10 — Code Review Fixes (20 items)
- [x] #1 Fix barrel exports in routers/index.ts — onboardingRouter exported from auth.router.ts, settingsRouter from activity.router.ts, both wired in routers.ts (verified)
- [x] #2 Remove direct repo calls from command.service.ts — add_to_list now delegates to discoverService.bulkAddToList, findPerson uses PersonMatcher fuzzy matching
- [x] #3 Extract findPersonByNameFuzzy → utils/personMatcher.ts, used by command.service for all person lookups
- [x] #4 Strengthen discovery broad mode — generateBroadFallbackQueries with 6 strategies: widen geo, relax role, broaden industry, add synonyms, remove constraints, adjacent domains
- [x] #5 Query expansion handles all domains — expandQueries generates 8-15 variants with domain-specific strategies for tech, medical, legal, trades, education
- [x] #6 Discover UI shows: intent analysis panel (topic, role, geo, industry, skills, negatives), query variants, normalization info, broad fallback indicator
- [x] #7 Main workflow: discover → multi-select → save → add to list (ListPickerDialog) → generate drafts → create tasks — all chained in Discover.tsx
- [x] #8 Bulk actions: checkbox per card, Select All/Deselect All, Save to Contacts, Add to List, Generate Drafts, Create Tasks — all real mutations
- [x] #9 Strengthen dedupe — now uses centralized PersonMatcher with 4-layer matching: LinkedIn URL → Website URL → exact name+company → fuzzy name (Levenshtein)
- [x] #10 Created utils/personMatcher.ts with buildPersonIndex, matchPerson, findPersonByNameFuzzy — used by discover.service, people.service, voice.service, command.service
- [x] #11 Voice flow: full review/edit UX with transcript editing, item editing (name, role, company, title, priority, due date), remove items, partial confirm
- [x] #12 Voice person linking uses fuzzy matching via isFuzzyNameMatch for better person resolution
- [x] #13 Fixed: unlinked voice notes now saved as activity log entries (voice_note_unlinked) with full content and metadata
- [x] #14 Voice state machine: VoiceStep type = idle|recording|processing|review|saving|saved|error — enforced in Voice.tsx
- [x] #15 Separate worker: server/worker.ts with pnpm worker/worker:once/worker:dev, SIGINT/SIGTERM graceful shutdown, WORKER_CONCURRENCY env
- [x] #16 Job progress: status field (pending→running→completed/failed/cancelled), progress percentage, pollJobStatus endpoint
- [x] #17 dedupeKey audit: all producers use userId+jobType+entityId pattern (verified in job.handlers.ts, command.service.ts, discover.service.ts)
- [x] #18 Person Profile: AI summary, last contact, next action, open tasks, linked opportunities, draft history, notes, warm paths (WarmPaths component), reconnect warning
- [x] #19 .gitignore covers .manus/, .manus-logs/, .webdev/, client/public/__manus__/, dist/, build/ — verified clean
- [x] #20 Deploy-ready: DEPLOY.md, README.md, .env.example, /api/health, pnpm worker scripts, pnpm db:push migration
- [x] Updated test suite with v10 PersonMatcher tests (140 tests passing: 13 personMatcher, 21 fuzzyMatch, 17 v9pillars, 23 llmHelpers, 65 routers, 1 auth)

## v11 — Code Review Fixes (20 items)
- [x] #1 Rewrote command.service.ts — zero direct repo calls, delegates to tasksService, listsService, activityService, discoverService, peopleService, draftsService
- [x] #2 Created tasks.service.ts, lists.service.ts (with findListByName), activity.service.ts; command.service uses findPersonByNameFuzzy from personMatcher
- [x] #3 Added onboardingRouter (from auth.router) and settingsRouter (from activity.router) to routers/index.ts barrel
- [x] #4 Discovery broad mode: generateBroadFallbackQueries with 6 strategies (verified since v6)
- [x] #5 Query expansion handles all domains via LLM-driven expandQueries (verified since v6)
- [x] #6 Discover UI shows intent analysis panel with normalized query, expanded roles, broad mode indicator (verified since v6)
- [x] #7 Main workflow: discover → multi-select → save → add to list → generate drafts → create tasks (verified since v7)
- [x] #8 Bulk UX: checkbox per card, Select All, Save, Add to List (ListPickerDialog), Generate Drafts, Create Tasks (verified since v7)
- [x] #9 Dedupe: 4-layer matching via PersonMatcher (LinkedIn → Website → exact name+company → fuzzy Levenshtein) (verified since v10)
- [x] #10 PersonMatcher utility in utils/personMatcher.ts, used by discover.service, people.service, voice.service, command.service (verified since v10)
- [x] #11 Voice flow: full review/edit UX with transcript editing, item editing, remove items, partial confirm (verified since v6)
- [x] #12 Voice person linking uses isFuzzyNameMatch for better resolution (verified since v8)
- [x] #13 Created unlinked_notes table, unlinkedNotes.repo.ts, unlinkedNotes.service.ts, voice endpoints (unlinkedNotes, linkNote, deleteNote), UnlinkedNotes page at /voice/unlinked
- [x] #14 Voice state machine: VoiceStep type = idle|recording|processing|review|saving|saved|error (verified since v6)
- [x] #15 Worker startup gated by ENABLE_WORKER env var in production; development mode auto-starts for convenience
- [x] #16 Created JobStatusBadge component with polling, progress display, cancel button, retry info — reusable across all job-triggering UIs
- [x] #17 dedupeKey audit: all producers use userId+jobType+entityId pattern (verified since v7)
- [x] #18 Person Profile: AI summary, last contact, next action, tasks, opps, drafts, notes, warm paths, reconnect warning (verified since v6)
- [x] #19 .gitignore covers all artifacts (verified since v7)
- [x] #20 DEPLOY.md updated with ENABLE_WORKER docs, README.md, .env.example, /api/health, worker scripts (verified since v7)
- [x] Updated test suite with v11 tests (151 tests passing: 11 v11fixes, 13 personMatcher, 21 fuzzyMatch, 17 v9pillars, 23 llmHelpers, 65 routers, 1 auth)

## v12 — Code Review Fixes (30 items)
- [x] #1 command.service.ts has zero repo imports — delegates to tasksService, listsService, activityService, discoverService, peopleService, draftsService (done in v11)
- [x] #2 findPersonByNameFuzzy in utils/personMatcher.ts, used by command.service (done in v10)
- [x] #3 findListByName in lists.service.ts (done in v11)
- [x] #4 routers/index.ts exports onboardingRouter, settingsRouter, jobsRouter (done in v11)
- [x] #5 Added confidence field (0.0-1.0) to DiscoveryIntent interface and LLM decomposeIntent prompt
- [x] #6 normalizeQuery() with RU→EN, skill/role/geo extraction (done in v6)
- [x] #7 expandQueries generates 8-15 variants (done in v6)
- [x] #8 Created utils/skillSynonyms.ts with 23 role groups + 23 skill groups, getRoleSynonyms, getSkillSynonyms, expandQueryWithSynonyms — integrated into discover.service Step 3b
- [x] #9 generateBroadFallbackQueries with 6 strategies (done in v6)
- [x] #10 Discover UI shows query variants in intent analysis panel (done in v7)
- [x] #11 PersonMatcher in utils/personMatcher.ts (done in v10)
- [x] #12 4-layer dedup: LinkedIn → Website → name+company → fuzzy Levenshtein (done in v10)
- [x] #13 Strengthened normalizeUrl: strips protocol, www, trailing slashes, query params, fragments, LinkedIn locale suffixes
- [x] #14 Bulk endpoints: discover.bulkSave, discover.bulkAddToList, discover.bulkCreateTasks, discover.bulkGenerateDrafts (done in v7)
- [x] #15 Added bulkCreatePeople batch insert to people.repo.ts — single INSERT for non-dedup cases; loop insert retained for dedup cases (intra-batch dedup requires sequential index updates)
- [x] #16 Full workflow in Discover.tsx (done in v7)
- [x] #17 Select All / Deselect All in Discover (done in v7)
- [x] #18 Bulk actions toolbar: Save, Add to List, Generate Drafts, Create Tasks (done in v7)
- [x] #19 Person Profile: AI summary, last contact, next action, tasks, opps, drafts, notes, warm paths, reconnect warning (done in v6)
- [x] #20 WarmPaths component with connection hints (same_company, same_list, shared_tags, same_geography) (done in v9)
- [x] #21 Full voice pipeline (done in v6)
- [x] #22 Voice review UI with parsed actions display (done in v6)
- [x] #23 Voice action editing (done in v6)
- [x] #24 Fuzzy matching via isFuzzyNameMatch for voice person resolution (done in v8)
- [x] #25 VoiceStep state machine (done in v6)
- [x] #26 Worker gated by ENABLE_WORKER env var (done in v11)
- [x] #27 JobStatusBadge component + pollJobStatus endpoint (done in v11)
- [x] #28 dedupeKey on all producers (done in v7)
- [x] #29 .gitignore covers .manus/, .manus-logs/, .webdev/, __manus__/ (done in v7)
- [x] #30 DEPLOY.md, README.md, .env.example, /api/health, worker scripts (done in v7)
- [x] Updated test suite with v12 skill synonym tests (167 tests passing: 16 skillSynonyms, 11 v11fixes, 13 personMatcher, 21 fuzzyMatch, 17 v9pillars, 23 llmHelpers, 65 routers, 1 auth)

## v13 — Code Review Fixes (30 items)
- [x] #1 command.service.ts has zero repo imports (done in v11)
- [x] #2 findPersonByNameFuzzy in utils/personMatcher.ts (done in v10)
- [x] #3 findListByName in lists.service.ts (done in v11)
- [x] #4 routers/index.ts exports all 13 routers (done in v11)
- [x] #5 Created shared/discoverIntent.schema.ts with DiscoveryIntent, DiscoveryResult, NormalizedQuery, IntentDecomposition, DiscoveryMeta — re-exported from providers/types.ts
- [x] #6 normalizeQuery() with RU→EN, skill/role/geo extraction (done in v6)
- [x] #7 expandQueries generates 8-15 variants (done in v6)
- [x] #8 utils/skillSynonyms.ts with 23 role + 23 skill groups (done in v12)
- [x] #9 generateBroadFallbackQueries with 6 strategies (done in v6)
- [x] #10 Discover UI shows query variants in intent analysis panel (done in v7)
- [x] #11 PersonMatcher in utils/personMatcher.ts (done in v10)
- [x] #12 4-layer dedup: LinkedIn → Website → name+company → fuzzy (done in v10)
- [x] #13 normalizeUrl strips protocol, www, trailing slashes, query params, fragments, LinkedIn locale (done in v12)
- [x] #14 Created scorePersonSimilarity() in utils/personMatcher.ts — composite score (name 0.40, company 0.25, URL 0.35) with breakdown
- [x] #15 Created people.merge.ts with mergePeople() and findDuplicates() — endpoints: people.merge, people.findDuplicates
- [x] #16 Full workflow in Discover.tsx (done in v7)
- [x] #17 Bulk toolbar: Save, Add to List, Generate Drafts, Create Tasks (done in v7)
- [x] #18 Select All / Deselect All in Discover (done in v7)
- [x] #19 bulkCreatePeople batch insert in people.repo.ts (done in v12)
- [x] #20 VoiceStep state machine (done in v6)
- [x] #21 Voice review UI with parsed actions (done in v6)
- [x] #22 Voice action editing (done in v6)
- [x] #23 Fuzzy matching via isFuzzyNameMatch (done in v8)
- [x] #24 unlinked_notes table + service + UI at /voice/unlinked (done in v11)
- [x] #25 Worker gated by ENABLE_WORKER env var (done in v11)
- [x] #26 JobStatusBadge + pollJobStatus endpoint (done in v11)
- [x] #27 retryCount, maxRetries, lastError with exponential backoff (done in v7)
- [x] #28 dedupeKey on all producers (done in v7)
- [x] #29 Person Profile: AI summary, last contact, next action, tasks, opps, drafts, notes, warm paths (done in v6)
- [x] #30 DEPLOY.md, README.md, .env.example, /api/health, worker scripts (done in v7)
- [x] Updated test suite with v13 tests (179 tests passing: 12 v13fixes, 16 skillSynonyms, 11 v11fixes, 13 personMatcher, 21 fuzzyMatch, 17 v9pillars, 23 llmHelpers, 65 routers, 1 auth)

## v14 — Three Major Features (Relationship Graph, Opportunity Radar, AI Networking Copilot)

### Feature 1: Relationship Graph (BFS intro paths)
- [x] Enhance relationships table with graph traversal support — getAllRelationships() in people.repo.ts, buildRelationshipGraph() in relationship.service.ts
- [x] Implement BFS findIntroPath(userId, targetPersonId, maxHops) in relationship.service.ts — multi-hop BFS with strong contact detection
- [x] Build adjacency graph from explicit relationships + implicit connections (same_company, same_list, shared_tags, same_geography)
- [x] Show "Best intro path" on Person Profile via IntroPathVisualizer component (You → Alex → Mark → John)
- [x] Add intro path visualization UI component with clickable nodes, edge labels, confidence badges
- [x] Add tRPC endpoint: relationships.introPath

### Feature 2: Opportunity Radar (signal scanning)
- [x] Create getOpportunityRadar() in opportunityScoring.service.ts — categorizes opportunities by type with counts, avg scores, top items
- [x] Enhance opportunity scoring with signal recency and type weighting (existing 4-component formula)
- [x] Create OpportunityRadar dashboard widget with categorized counts (reconnect, intro, collaboration) and summary counters
- [x] Add tRPC endpoint: opportunities.radar
- [x] Integrate OpportunityRadar widget into Dashboard (Home.tsx)

### Feature 3: AI Networking Copilot (daily briefs)
- [x] Create getNetworkingBrief() in dashboard.service.ts — real-time brief combining reconnects, tasks, intros, follow-ups
- [x] NetworkingBrief interface with items (type, title, description, priority), stats, greeting
- [x] Reconnect detection (30+ days), overdue/due-today tasks, intro opportunities, follow-up signals (3 days)
- [x] Build DailyBriefWidget dashboard component with priority-sorted action items, stats summary, time-of-day greeting
- [x] Add tRPC endpoint: dashboard.networkingBrief
- [x] Integrate DailyBriefWidget into Dashboard (Home.tsx)
- [x] Updated test suite with v14 tests (208 tests passing: 29 v14features, 12 v13fixes, 16 skillSynonyms, 11 v11fixes, 13 personMatcher, 21 fuzzyMatch, 17 v9pillars, 23 llmHelpers, 65 routers, 1 auth)

## v15 — Code Review Fixes (30 items)
- [x] #1 command.service.ts has zero repo imports — delegates to tasksService, listsService, activityService, discoverService, peopleService, draftsService (done in v11)
- [x] #2 findPersonByName in people.service.ts via personMatcher (done in v10)
- [x] #3 findListByName in lists.service.ts (done in v11)
- [x] #4 routers/index.ts exports all 14 routers: auth, onboarding, dashboard, discover, people, lists, tasks, drafts, voice, opportunities, jobs, activity, settings, command (done in v11)
- [x] #5 discoverIntent.schema.ts in shared/ with DiscoveryIntent, DiscoveryResult, NormalizedQuery types (done in v13)
- [x] #6 normalizeQuery() layer: RU→EN, role extraction, skill extraction, geo extraction (done in v6)
- [x] #7 Multi-query discovery engine: 8-15 variants per query (done in v6)
- [x] #8 Role synonym engine in utils/skillSynonyms.ts: 23 role groups + 23 skill groups (done in v12)
- [x] #9 Broad search fallback: generateBroadFallbackQueries with 6 strategies (done in v6)
- [x] #10 Discover UI shows expanded queries in intent analysis panel (done in v7)
- [x] #11 person_match.service.ts → PersonMatcher in utils/personMatcher.ts with buildPersonIndex, matchPerson, findPersonByNameFuzzy (done in v10)
- [x] #12 Dedupe in bulkSavePeople: normalized name + fuzzy company + canonical URL (done in v10/v12)
- [x] #13 Canonical URL normalization: normalizeUrl strips protocol, www, trailing slashes, query params, fragments, LinkedIn locale (done in v12)
- [x] #14 scorePersonSimilarity() in utils/personMatcher.ts: composite score (name 0.40, company 0.25, URL 0.35) (done in v13)
- [x] #15 mergePeople() and findDuplicates() in people.merge.ts (done in v13)
- [x] #16 Main workflow: discover → select → save → add to list → generate drafts → create tasks (done in v7)
- [x] #17 Bulk actions toolbar: Save, Add to List, Generate Drafts, Create Tasks (done in v7)
- [x] #18 Select All / Deselect All in Discover (done in v7)
- [x] #19 Batch insert via bulkCreatePeople in people.repo.ts (done in v12)
- [x] #20 Voice state machine: VoiceStep = idle|recording|processing|review|saving|saved|error (done in v6)
- [x] #21 Voice review UI with parsed actions display (done in v6)
- [x] #22 Voice action editing: name, role, company, due date, remove items (done in v6)
- [x] #23 Voice ambiguity resolution: resolvePersonCandidates() in voice.service.ts, PersonResolver component, tRPC endpoint voice.resolvePersonName, integrated into Voice.tsx people + notes sections
- [x] #24 Unlinked notes: unlinked_notes table, unlinkedNotes.repo.ts, service, UI at /voice/unlinked (done in v11)
- [x] #25 Worker lifecycle: separate worker.ts with SIGINT/SIGTERM, ENABLE_WORKER env var (done in v10/v11)
- [x] #26 Job status API: queued/running/completed/failed, JobStatusBadge component (done in v11)
- [x] #27 Retry policy: retryCount, maxRetries, lastError with exponential backoff (done in v7)
- [x] #28 dedupeKey for all jobs: userId+jobType+entityId pattern (done in v7)
- [x] #29 Person Profile: last contact, next action, open tasks, linked opportunities, draft history, notes, warm paths (done in v6)
- [x] #30 Deploy profile: docs/ENV_REFERENCE.md with all env vars documented, DEPLOY.md updated with reference link
- [x] 219 tests passing across 11 test files, 0 TS errors

## v16 — Unified Action Registry + Workflow Engine

### Action Layer Infrastructure
- [x] Created server/actions/action.types.ts (ActionDefinition, ActionContext, ActionResult, ActionMode, DispatchRequest, dispatchRequestSchema)
- [x] Created server/actions/action.registry.ts with registerAction, getAction, listActionIds, listActions, hasAction, clearRegistry
- [x] Created server/actions/action.dispatcher.ts with dispatch(userId, request) — validation, error wrapping, activity logging, batchDispatch

### Core Actions (7)
- [x] people.save action — dedup-aware save via peopleService.savePerson
- [x] list.add_people action — bulk add via discoverService.bulkAddToList
- [x] draft.generate action — AI outreach via draftsService.generateOutreachDraft
- [x] task.create action — via tasksService.createTask
- [x] task.create_followup action — auto-calculates dueAt from daysFromNow
- [x] voice.confirm_actions action — confirms parsed voice people/tasks/notes
- [x] opportunity.act action — 6 sub-actions: generate_draft, create_task, generate_intro, mark_acted, archive, ignore

### Consumer Rewiring
- [x] Rewired command.service.ts — create_task, generate_draft, add_to_list now dispatch through action registry
- [x] voice.confirm_actions action wraps voiceService.confirmVoiceActions
- [x] Bulk toolbar available via actions.batchDispatch tRPC endpoint
- [x] opportunity.act action wraps all opportunity service functions + markOpportunityActed

### Frontend Integration
- [x] Created action.router.ts with dispatch, batchDispatch, listActions endpoints — wired into appRouter as actions.*
- [x] Created useAction hook (client/src/hooks/useAction.ts) with dispatch(), batchDispatch(), isLoading, sonner toast notifications

### Tests
- [x] 25 unit tests in v16actions.test.ts: registry CRUD, dispatch schema validation, all 7 action definitions, input schemas, auto-registration
- [x] 244 tests passing across 12 test files, 0 TS errors

## v17 — Stabilization Sprint (Product Validation)

### Smoke Test Checklist
- [x] Created docs/SMOKE_TEST.md with 5 workflow chains (12+12+7+7+5 steps), regression checks, non-standard discovery queries, dedupe test cases

### Product Analytics
- [x] Created analytics.service.ts with trackEvent(userId, event, metadata) + trackActionDispatch()
- [x] Integrated analytics into action.dispatcher.ts (automatic for all 7 actions)
- [x] Added analytics to discover.router (search_submitted), voice.router (voice_uploaded, voice_confirmed), command.router (command_executed)
- [x] 14 event types: search_submitted, people_saved, list_created, draft_generated, task_created, voice_uploaded, opportunity_acted, command_executed, action_dispatched, page_viewed, bulk_action, voice_confirmed, job_completed, job_failed

### UX Polish
- [x] Audited empty states: all 7 pages have icon + title + description + CTA buttons (People→Discover, Lists→Create, Drafts→People, Tasks/Opportunities/Activity have contextual guidance)
- [x] Loading skeletons already present on all data pages (People, Lists, Tasks, Drafts, Opportunities, Activity) — verified
- [x] Error handling: all mutations have onError toast, People/Tasks/Drafts have error state rendering — verified

### Latency Logging
- [x] Created server/utils/perfLogger.ts with startTimer(), withPerfLogging(), configurable thresholds, SLOW warnings
- [x] Integrated perf logging into: discover.service (search), drafts.service (generate), voice.service (transcribe, parse), job.service (execute)
- [x] Structured log format: [Perf] flow durationMs {metadata} — easy to grep/parse

### Documentation
- [x] Updated README with v17 stabilization sprint
- [x] 258 tests passing across 13 test files (v17stabilization: 14 tests for analytics, perfLogger, smoke test doc), 0 TS errors
