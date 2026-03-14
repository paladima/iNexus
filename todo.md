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
- [x] Vitest tests for backend procedures (57 tests passing)
- [x] Tests for auth, onboarding, dashboard, people, lists, tasks, opportunities, drafts, discover, voice, activity, AI command, settings
- [x] Tests for relationships, warm paths, batch outreach, intro generation, workers

## Polish
- [x] Loading states and skeletons
- [x] Empty states for all screens
- [x] Error handling and toast notifications
- [ ] Responsive design improvements for mobile
- [ ] Onboarding wizard (multi-step flow for first-time users)
