/**
 * App Router — compose layer only (#2)
 * All logic lives in server/routers/*.router.ts modules.
 */
import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";

// Split router modules
import { authRouter, onboardingRouter } from "./routers/auth.router";
import { dashboardRouter } from "./routers/dashboard.router";
import { discoverRouter } from "./routers/discover.router";
import { peopleRouter } from "./routers/people.router";
import { listsRouter } from "./routers/lists.router";
import { tasksRouter } from "./routers/tasks.router";
import { opportunitiesRouter } from "./routers/opportunities.router";
import { draftsRouter } from "./routers/drafts.router";
import { voiceRouter } from "./routers/voice.router";
import { activityRouter, settingsRouter } from "./routers/activity.router";
import { relationshipsRouter } from "./routers/relationships.router";
import { jobsRouter } from "./routers/jobs.router";
import { commandRouter } from "./routers/command.router";
import { actionRouter } from "./routers/action.router";

export const appRouter = router({
  system: systemRouter,
  actions: actionRouter,
  auth: authRouter,
  onboarding: onboardingRouter,
  dashboard: dashboardRouter,
  discover: discoverRouter,
  people: peopleRouter,
  lists: listsRouter,
  tasks: tasksRouter,
  opportunities: opportunitiesRouter,
  drafts: draftsRouter,
  voice: voiceRouter,
  activity: activityRouter,
  settings: settingsRouter,
  relationships: relationshipsRouter,
  jobs: jobsRouter,
  command: commandRouter,
});


export type AppRouter = typeof appRouter;
