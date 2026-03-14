# Alpha Launch Checklist

Pre-launch verification for iNexus alpha release.

## Infrastructure

- [ ] Database migrations applied and verified
- [ ] Environment variables set (see docs/ENV_REFERENCE.md)
- [ ] Worker process running (`ENABLE_WORKER=true`)
- [ ] Health endpoint responding (`GET /api/health`)
- [ ] SSL/TLS configured for production domain
- [ ] Backup strategy for database documented

## Core Workflows (see docs/SMOKE_TEST.md)

- [ ] Chain 1: Discovery → Save → List → Draft → Task (12 steps)
- [ ] Chain 2: Voice → Review → Edit → Confirm → Verify (12 steps)
- [ ] Chain 3: Opportunity Scan → Score → Act → Follow-up (7 steps)
- [ ] Chain 4: Command Bar → Natural Language → Execute (7 steps)
- [ ] Chain 5: Onboarding → Goals → Dashboard Brief (5 steps)

## Security

- [ ] All mutations use `protectedProcedure`
- [ ] Rate limits active on discover, voice, drafts, bulk operations
- [ ] No API keys exposed in client-side code
- [ ] CORS configured for production domain only
- [ ] Session cookies use `httpOnly`, `secure`, `sameSite`

## Data Integrity

- [ ] Person dedup working (name + company + LinkedIn URL matching)
- [ ] Job deduplication via `dedupeKey` prevents duplicate work
- [ ] Bulk operations handle partial failures gracefully
- [ ] Activity logging captures all user actions

## Performance

- [ ] Discover search completes in < 15s for standard queries
- [ ] Draft generation completes in < 10s
- [ ] Voice transcription completes in < 30s
- [ ] Dashboard loads in < 2s
- [ ] Performance logging active (`[Perf]` markers in logs)

## UX Quality

- [ ] All pages have empty states with CTAs
- [ ] All pages have loading skeletons
- [ ] Optimistic UI on People, Tasks, Drafts mutations
- [ ] Error toasts on all mutation failures
- [ ] Mobile-responsive layout (sidebar collapses)

## Analytics & Monitoring

- [ ] Product analytics events firing (14 event types)
- [ ] Performance logging with SLOW warnings
- [ ] Job status tracking (queued/running/completed/failed)
- [ ] Activity timeline recording all actions

## Documentation

- [ ] README.md up to date with architecture overview
- [ ] DEPLOY.md with deployment instructions
- [ ] ENV_REFERENCE.md with all environment variables
- [ ] SMOKE_TEST.md with 5 workflow chains
- [ ] DISCOVER_QUALITY_AUDIT.md with 50 test queries

## Known Limitations

- Rate limiter is in-memory (resets on server restart)
- Worker runs in-process by default (set ENABLE_WORKER for separate process)
- Voice transcription has 16MB file size limit
- Discover results depend on LLM provider availability
