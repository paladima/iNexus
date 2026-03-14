/**
 * JobStatusBadge (#16 v11)
 * Reusable component that polls job status and shows progress/state.
 * Use anywhere a background job is triggered (batch drafts, summaries, scans).
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RotateCcw, Ban } from "lucide-react";

interface JobStatusBadgeProps {
  jobId: number | null | undefined;
  onComplete?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  compact?: boolean;
}

export function JobStatusBadge({
  jobId,
  onComplete,
  onCancel,
  showCancel = true,
  compact = false,
}: JobStatusBadgeProps) {
  const [completed, setCompleted] = useState(false);

  const { data: status, isLoading } = trpc.jobs.status.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId && !completed,
      refetchInterval: (query) => {
        const d = query.state.data;
        if (!d) return 2000;
        if (d.status === "completed" || d.status === "failed" || d.status === "cancelled") {
          return false;
        }
        return 2000;
      },
    }
  );

  const cancelMutation = trpc.jobs.cancel.useMutation({
    onSuccess: () => onCancel?.(),
  });

  useEffect(() => {
    if (status?.status === "completed" && !completed) {
      setCompleted(true);
      onComplete?.();
    }
  }, [status?.status, completed, onComplete]);

  if (!jobId) return null;
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {!compact && "Loading..."}
      </Badge>
    );
  }
  if (!status) return null;

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: status.isRetrying ? `Retrying (${status.retryCount}/${status.maxRetries})` : "Queued",
      variant: "outline",
    },
    running: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: status.progress ? `Running ${status.progress}%` : "Running...",
      variant: "default",
    },
    completed: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Done",
      variant: "secondary",
    },
    failed: {
      icon: <XCircle className="h-3 w-3" />,
      label: status.canRetry ? `Failed (${status.retriesRemaining} retries left)` : "Failed",
      variant: "destructive",
    },
    cancelled: {
      icon: <Ban className="h-3 w-3" />,
      label: "Cancelled",
      variant: "outline",
    },
  };

  const config = statusConfig[status.status] ?? statusConfig.pending;

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {!compact && config.label}
      </Badge>
      {showCancel && (status.status === "pending" || status.status === "running") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => cancelMutation.mutate({ jobId: jobId! })}
          disabled={cancelMutation.isPending}
        >
          <Ban className="h-3 w-3" />
        </Button>
      )}
    </span>
  );
}
