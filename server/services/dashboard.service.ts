/**
 * Dashboard Service (#12)
 * Orchestration layer for dashboard: stats, brief retrieval, brief generation, fallback.
 */
import * as repo from "../repositories";
import { enqueueJob, pollJobStatus } from "./job.service";

export async function getDashboardStats(userId: number) {
  return repo.getDashboardStats(userId);
}

export async function getDailyBrief(userId: number, date?: string) {
  const briefDate = date ?? new Date().toISOString().split("T")[0];
  const brief = await repo.getDailyBrief(userId, briefDate);

  if (brief) {
    return { status: "ready" as const, brief };
  }

  // Check if there's a pending/running generate_brief job
  const recentJobs = await repo.getJobsByUser(userId, {
    jobType: "generate_brief",
    limit: 1,
  });
  const latestJob = recentJobs[0];

  if (latestJob && (latestJob.status === "pending" || latestJob.status === "running")) {
    return {
      status: "generating" as const,
      jobId: latestJob.id,
      progress: latestJob.progress ?? 0,
    };
  }

  return { status: "empty" as const };
}

export async function generateBrief(userId: number) {
  // Dedupe: don't create a new job if one is already pending/running
  const recentJobs = await repo.getJobsByUser(userId, {
    jobType: "generate_brief",
    limit: 1,
  });
  const latestJob = recentJobs[0];

  if (latestJob && (latestJob.status === "pending" || latestJob.status === "running")) {
    return {
      status: "already_generating" as const,
      jobId: latestJob.id,
      progress: latestJob.progress ?? 0,
    };
  }

  const jobId = await enqueueJob(userId, "generate_brief", {}, {
    dedupeKey: `generate_brief:${userId}:${new Date().toISOString().split("T")[0]}`,
    priority: 2,
  });

  return {
    status: "queued" as const,
    jobId,
    message: "Daily brief generation started.",
  };
}

/**
 * Networking Brief (v14) — real-time daily brief for the dashboard widget.
 * Combines reconnect signals, intro opportunities, follow-ups, and top actions
 * into a single structured brief without requiring LLM generation.
 */
export interface NetworkingBriefItem {
  type: "reconnect" | "intro" | "follow_up" | "task";
  title: string;
  description: string;
  personId?: number;
  personName?: string;
  entityId?: number;
  entityType?: string;
  priority: "high" | "medium" | "low";
}

export interface NetworkingBrief {
  date: string;
  greeting: string;
  items: NetworkingBriefItem[];
  stats: {
    reconnectCount: number;
    introCount: number;
    followUpCount: number;
    taskCount: number;
  };
}

export async function getNetworkingBrief(userId: number): Promise<NetworkingBrief> {
  const today = new Date().toISOString().split("T")[0];
  const items: NetworkingBriefItem[] = [];

  // 1. Reconnect signals: people not contacted in 30+ days
  const { items: allPeople } = await repo.getPeople(userId, { limit: 200 });
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const reconnects: NetworkingBriefItem[] = [];
  for (const p of allPeople as any[]) {
    if (p.lastInteractionAt && new Date(p.lastInteractionAt).getTime() < thirtyDaysAgo && p.status !== "archived") {
      const daysSince = Math.round((Date.now() - new Date(p.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24));
      reconnects.push({
        type: "reconnect",
        title: `Reconnect with ${p.fullName}`,
        description: `Last contact ${daysSince} days ago${p.company ? ` — ${p.company}` : ""}`,
        personId: p.id,
        personName: p.fullName,
        priority: daysSince > 90 ? "high" : daysSince > 60 ? "medium" : "low",
      });
    }
  }
  // Sort by priority and take top 5
  reconnects.sort((a, b) => {
    const prio = { high: 3, medium: 2, low: 1 };
    return prio[b.priority] - prio[a.priority];
  });
  items.push(...reconnects.slice(0, 5));

  // 2. Overdue tasks
  const { items: tasks } = await repo.getTasks(userId, { status: "open", limit: 20 });
  const now = Date.now();
  for (const task of tasks as any[]) {
    if (task.dueAt && new Date(task.dueAt).getTime() < now) {
      items.push({
        type: "task",
        title: task.title,
        description: "This task is overdue — complete or reschedule",
        entityId: task.id,
        entityType: "task",
        priority: "high",
      });
    }
  }

  // 3. Today's tasks
  const todayStart = new Date(today).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;
  for (const task of tasks as any[]) {
    if (task.dueAt) {
      const dueTime = new Date(task.dueAt).getTime();
      if (dueTime >= todayStart && dueTime < todayEnd) {
        items.push({
          type: "task",
          title: task.title,
          description: "Due today",
          entityId: task.id,
          entityType: "task",
          priority: "medium",
        });
      }
    }
  }

  // 4. Open intro opportunities
  const { items: opps } = await repo.getOpportunities(userId, { status: "open", limit: 20 });
  const introOpps = (opps as any[]).filter(o => o.opportunityType === "intro");
  for (const opp of introOpps.slice(0, 3)) {
    items.push({
      type: "intro",
      title: opp.title,
      description: opp.signalSummary ?? "Intro opportunity detected",
      entityId: opp.id,
      entityType: "opportunity",
      personId: opp.personId ?? undefined,
      priority: "medium",
    });
  }

  // 5. Follow-up signals from recent interactions
  const interactions = await repo.getInteractions(userId, undefined, 50);
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const recentInteractions = (interactions as any[]).filter(
    i => i.interactedAt && new Date(i.interactedAt).getTime() > threeDaysAgo
  );
  const followUpPersonIds = new Set<number>();
  for (const int of recentInteractions) {
    if (int.personId && !followUpPersonIds.has(int.personId)) {
      followUpPersonIds.add(int.personId);
      const person = allPeople.find((p: any) => (p as any).id === int.personId) as any;
      if (person) {
        items.push({
          type: "follow_up",
          title: `Follow up with ${person.fullName}`,
          description: `Recent interaction — keep the momentum`,
          personId: person.id,
          personName: person.fullName,
          priority: "low",
        });
      }
    }
  }

  // Compute stats
  const stats = {
    reconnectCount: items.filter(i => i.type === "reconnect").length,
    introCount: items.filter(i => i.type === "intro").length,
    followUpCount: items.filter(i => i.type === "follow_up").length,
    taskCount: items.filter(i => i.type === "task").length,
  };

  // Sort: high → medium → low
  const prioOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority]);

  // Greeting
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const totalActions = items.length;
  const greeting = totalActions > 0
    ? `Good ${timeOfDay}! You have ${totalActions} networking actions for today.`
    : `Good ${timeOfDay}! Your network is in good shape — no urgent actions today.`;

  return { date: today, greeting, items, stats };
}

export async function getBriefJobStatus(userId: number, jobId: number) {
  const status = await pollJobStatus(jobId);
  if (!status) return null;
  return status;
}
