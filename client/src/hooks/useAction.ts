/**
 * useAction Hook (v16)
 *
 * Unified hook for dispatching any registered action through the Action Registry.
 * Wraps trpc.actions.dispatch with toast notifications and loading state.
 *
 * Usage:
 *   const { dispatch, isLoading } = useAction();
 *   await dispatch("task.create", { title: "Follow up" }, { source: "ui" });
 */
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ActionSource = "command" | "voice" | "bulk" | "ui" | "opportunity" | "worker" | "api";

interface DispatchOptions {
  source?: ActionSource;
  meta?: Record<string, unknown>;
  /** Suppress toast on success */
  silent?: boolean;
  /** Custom success message (overrides action result message) */
  successMessage?: string;
}

export function useAction() {
  const dispatchMutation = trpc.actions.dispatch.useMutation();
  const batchMutation = trpc.actions.batchDispatch.useMutation();

  async function dispatch(
    actionId: string,
    input: Record<string, unknown>,
    options?: DispatchOptions
  ) {
    try {
      const result = await dispatchMutation.mutateAsync({
        actionId,
        input,
        source: options?.source ?? "ui",
        meta: options?.meta,
      });

      if (result.success && !options?.silent) {
        toast.success(options?.successMessage ?? result.message);
      }

      if (!result.success) {
        toast.error(result.message);
      }

      if (result.warnings?.length) {
        for (const w of result.warnings) {
          toast.warning(w);
        }
      }

      return result;
    } catch (err) {
      toast.error((err as Error).message);
      return { success: false, message: (err as Error).message };
    }
  }

  async function batchDispatch(
    actionId: string,
    inputs: Record<string, unknown>[],
    options?: DispatchOptions
  ) {
    try {
      const result = await batchMutation.mutateAsync({
        actionId,
        inputs,
        source: options?.source ?? "bulk",
      });

      if (!options?.silent) {
        if (result.failCount > 0) {
          toast.error(`Batch: ${result.successCount} succeeded, ${result.failCount} failed`);
        } else {
          toast.success(`Batch complete: ${result.successCount} succeeded`);
        }
      }

      return result;
    } catch (err) {
      toast.error((err as Error).message);
      return { results: [], successCount: 0, failCount: inputs.length };
    }
  }

  return {
    dispatch,
    batchDispatch,
    isLoading: dispatchMutation.isPending || batchMutation.isPending,
  };
}
