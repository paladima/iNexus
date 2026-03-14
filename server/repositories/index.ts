// Repository layer barrel export
// Each repo handles DB queries for a single domain entity

export { getDb, requireDb } from "./base";

export * from "./user.repo";
export * from "./people.repo";
export * from "./lists.repo";
export * from "./tasks.repo";
export * from "./opportunities.repo";
export * from "./drafts.repo";
export * from "./voice.repo";
export * from "./activity.repo";
export * from "./search.repo";
export * from "./briefs.repo";
export * from "./interactions.repo";
export * from "./dashboard.repo";
export * from "./jobs.repo";
export * from "./audit.repo";
