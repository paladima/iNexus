# iNexus — Project TODO

## Database & Backend
- [x] Database schema (users, user_goals, people, person_notes, interactions, lists, list_people, tasks, opportunities, drafts, search_queries, search_results, voice_captures, daily_briefs, activity_log)
- [x] DB query helpers for all tables
- [x] tRPC routers: auth, onboarding, dashboard, discover, people, lists, tasks, opportunities, drafts, voice, activity, daily brief, settings, AI command

## Core Layout & Auth
- [x] Dark theme with CSS variables (deep navy/dark palette)
- [x] DashboardLayout with sidebar navigation (Dashboard, Discover, People, Lists, Opportunities, Tasks, Drafts, Activity, Voice, Settings)
- [x] Auth flow (Manus OAuth login/logout)
- [x] Onboarding flow (goals, industries, geography saved via settings)

## Screens
- [x] Dashboard (stats cards, daily brief with AI generation, recent contacts, discover CTA)
- [x] Discover (search input, AI-powered results, save person, generate draft, create task)
- [x] People list (search, filter by status, person cards with edit/delete)
- [x] Person Profile (header, AI summary generation, notes, interactions timeline, drafts, tasks)
- [x] Lists (create/view/delete lists, add/remove people)
- [x] List Detail (view people in list, remove from list)
- [x] Opportunities (create/view opportunities, status management, signal summaries)
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

## Polish
- [x] Loading states and skeletons
- [x] Empty states for all screens
- [x] Error handling and toast notifications
- [x] Vitest tests for backend procedures (45 tests passing)
- [ ] Responsive design improvements for mobile
- [ ] Onboarding wizard (multi-step flow for first-time users)
