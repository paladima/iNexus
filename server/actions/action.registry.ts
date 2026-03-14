/**
 * Action Registry (v16)
 *
 * Central registry of all business actions. Actions are registered at startup
 * and looked up by ID at dispatch time. Provides type-safe registration,
 * lookup, and listing.
 */
import type { ActionDefinition, ActionRegistryMap } from "./action.types";

const registry: ActionRegistryMap = {};

/** Register an action definition. Throws if ID is already taken. */
export function registerAction(action: ActionDefinition<any, any>): void {
  if (registry[action.id]) {
    throw new Error(`Action "${action.id}" is already registered`);
  }
  registry[action.id] = action;
}

/** Look up an action by ID. Returns undefined if not found. */
export function getAction(id: string): ActionDefinition<any, any> | undefined {
  return registry[id];
}

/** Get all registered action IDs. */
export function listActionIds(): string[] {
  return Object.keys(registry);
}

/** Get all registered actions as an array. */
export function listActions(): ActionDefinition<any, any>[] {
  return Object.values(registry);
}

/** Check if an action is registered. */
export function hasAction(id: string): boolean {
  return id in registry;
}

/** Clear registry (for testing only). */
export function clearRegistry(): void {
  for (const key of Object.keys(registry)) {
    delete registry[key];
  }
}
