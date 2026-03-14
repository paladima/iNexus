# iNexus Smoke Test Checklist

Run through these 5 workflow chains before every deployment. Each chain tests a critical end-to-end path through the system. Mark each step pass/fail and note any issues.

## Chain 1: Discover → Save → List → Draft → Task

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Navigate to /discover | Page loads with search input |
| 1.2 | Search "AI researchers in Boston" | Intent analysis panel shows, results appear within 15s |
| 1.3 | Verify query variants are displayed | Intent panel shows 8+ expanded queries |
| 1.4 | Select 3 people with checkboxes | Bulk toolbar appears with action buttons |
| 1.5 | Click "Save to Contacts" | Toast confirms save, people appear in /people |
| 1.6 | Click "Add to List" | List picker dialog opens |
| 1.7 | Create new list "AI Researchers" | List created, people added, toast confirms |
| 1.8 | Navigate to /lists, open "AI Researchers" | List shows 3 people with correct data |
| 1.9 | Click "Generate Draft" on one person | Draft generation starts, navigates to /drafts |
| 1.10 | Verify draft content | Draft has personalized content, correct tone |
| 1.11 | Navigate to person profile | Profile shows tasks, drafts, notes sections |
| 1.12 | Create a follow-up task from profile | Task appears in /tasks with correct due date |

## Chain 2: Voice → Parse → Review → Save

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Navigate to /voice | Voice page loads in "idle" state |
| 2.2 | Click record button | Recording starts, timer visible |
| 2.3 | Speak: "Met John Smith from Google, CTO. Follow up next week about AI partnership" | Recording captures audio |
| 2.4 | Stop recording | State transitions to "processing" with spinner |
| 2.5 | Wait for parsing | State transitions to "review" with parsed actions |
| 2.6 | Verify parsed people section | Shows "John Smith" with role "CTO", company "Google" |
| 2.7 | Verify parsed tasks section | Shows follow-up task with approximate due date |
| 2.8 | Verify parsed notes section | Shows note about AI partnership |
| 2.9 | Edit a parsed item (change priority) | Item updates in review UI |
| 2.10 | Remove one item (uncheck save) | Item marked for skip |
| 2.11 | Click "Save All" | State transitions to "saved", toast confirms counts |
| 2.12 | Navigate to /people | John Smith appears in contacts |

## Chain 3: Opportunity → Action

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | Navigate to /opportunities | Opportunity list loads with scored items |
| 3.2 | Verify opportunity cards | Each shows score badge, person name, suggested action |
| 3.3 | Click "Generate Draft" on an opportunity | Draft generation starts, success toast |
| 3.4 | Click "Create Task" on another opportunity | Task created, success toast |
| 3.5 | Click "Mark Acted" on another | Opportunity status updates |
| 3.6 | Check dashboard Opportunity Radar widget | Shows categorized counts (reconnect, intro, collaboration) |
| 3.7 | Check dashboard Daily Brief widget | Shows priority-sorted action items |

## Chain 4: Command Bar → Action Dispatch

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | Open command bar (Ctrl+K or click) | Command input appears |
| 4.2 | Type "find investors in AI" | Intent classified as "discover", results shown |
| 4.3 | Type "create task follow up with John" | Task created via action dispatcher, toast confirms |
| 4.4 | Type "draft message to Sarah" | Person found (or not-found message), draft generated |
| 4.5 | Type "show reconnects" | Stale contacts listed with last contact dates |
| 4.6 | Type "add John to AI Researchers list" | Person resolved, added to list via action dispatcher |
| 4.7 | Type "create list Hot Leads" | New list created, toast confirms |

## Chain 5: Jobs → Status → Retry

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | Trigger a batch operation (e.g., batch draft for a list) | Job enqueued, status shows "queued" |
| 5.2 | Check job status badge | Badge shows queued → running → completed |
| 5.3 | Verify job result | Drafts generated for all list members |
| 5.4 | Check activity log | Job execution logged with metadata |
| 5.5 | Verify dedupeKey prevents duplicate jobs | Re-triggering same job returns existing job ID |

## Quick Regression Checks

| Area | Check | Expected |
|------|-------|----------|
| Auth | Login/logout cycle | Session persists, logout clears state |
| Empty states | Visit /people with no contacts | Helpful empty state with CTA |
| Empty states | Visit /lists with no lists | Helpful empty state with create button |
| Empty states | Visit /tasks with no tasks | Helpful empty state |
| Navigation | All sidebar links work | No 404s, correct page loads |
| Mobile | Resize to 375px width | Sidebar collapses, content readable |
| Search | Search with empty query | Graceful handling, no crash |
| Voice | Navigate to /voice/unlinked | Unlinked notes page loads |
| Settings | Open settings page | User profile and preferences load |

## Non-Standard Discovery Queries to Test

These queries test the query expansion engine and skill synonym dictionaries beyond typical tech/business searches:

| Query | Expected Behavior |
|-------|-------------------|
| welding instructors in Florida | Expands to: welding trainer, vocational welding instructor, certified welding instructor |
| pediatric dentists in Miami | Expands to: children's dentist, pediatric dental specialist |
| immigration attorneys in New York | Expands to: immigration lawyer, visa attorney, immigration counsel |
| roofing contractors in Texas | Expands to: roofing company, roof repair contractor, commercial roofer |
| AI ethics researchers in Boston | Expands to: responsible AI researcher, AI safety researcher, AI governance |

## Dedupe Test Cases

| Scenario | Input | Expected |
|----------|-------|----------|
| Same LinkedIn URL | `linkedin.com/in/john` and `linkedin.com/in/john/` | Detected as duplicate |
| Different URL, same profile | `linkedin.com/in/john-smith` and `linkedin.com/in/johnsmith` | May not match (different slugs) |
| Same name, different company | "John Smith at Google" and "John Smith at Apple" | Separate contacts |
| Same name, same company | "John Smith, CTO, Google" and "John Smith, Google" | Detected as duplicate |
| Near-identical company | "Google" and "Google Inc." | Should match on company similarity |
