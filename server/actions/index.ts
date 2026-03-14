/**
 * Action Registry — Barrel Export (v16)
 *
 * Initializes the registry with all core actions on first import.
 */
export { registerAction, getAction, listActionIds, listActions, hasAction, clearRegistry } from "./action.registry";
export { dispatch, batchDispatch } from "./action.dispatcher";
export type { ActionDefinition, ActionContext, ActionResult, ActionMode, DispatchRequest } from "./action.types";
export { dispatchRequestSchema } from "./action.types";
export { allActions } from "./actions";

// ─── Auto-register all actions on import ────────────────────────
import { registerAction, hasAction } from "./action.registry";
import { allActions } from "./actions";

for (const action of allActions) {
  if (!hasAction(action.id)) {
    registerAction(action);
  }
}
