import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, RefreshCw, RotateCcw, XCircle, Clock,
  CheckCircle2, AlertTriangle, Cog, Activity,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  running: { icon: Cog, color: "text-blue-500", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Completed" },
  failed: { icon: AlertTriangle, color: "text-red-500", label: "Failed" },
  cancelled: { icon: XCircle, color: "text-muted-foreground", label: "Cancelled" },
};

export default function Jobs() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: jobs, isLoading, refetch } = trpc.jobs.list.useQuery(
    statusFilter === "all" ? {} : { status: statusFilter },
    { refetchInterval: 5000 }
  );

  const retryMutation = trpc.jobs.retry.useMutation({
    onSuccess: (data) => {
      toast.success(`Job re-queued as #${data.jobId}`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = trpc.jobs.cancel.useMutation({
    onSuccess: () => {
      toast.success("Job cancelled");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const formatDuration = (start: Date | string | null | undefined, end: Date | string | null | undefined) => {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const statusCounts = (jobs ?? []).reduce((acc: Record<string, number>, j: any) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Job Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor background jobs: opportunity scans, reconnect detection, brief generation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon;
          const count = statusCounts[status] ?? 0;
          return (
            <Card
              key={status}
              className={`cursor-pointer transition-colors ${statusFilter === status ? "border-primary" : ""}`}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                <span className="text-sm font-medium">{config.label}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{count}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {jobs?.length ?? 0} jobs
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!jobs || jobs.length === 0) && (
        <div className="text-center py-16">
          <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Jobs Found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {statusFilter === "all"
              ? "Background jobs will appear here when you trigger scans, generate briefs, or run bulk operations."
              : `No ${statusFilter} jobs. Try a different filter.`}
          </p>
        </div>
      )}

      {/* Job List */}
      {!isLoading && jobs && jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job: any) => {
            const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
            const Icon = config.icon;
            const duration = formatDuration(job.startedAt, job.finishedAt);
            const canRetry = job.status === "failed";
            const canCancel = job.status === "pending" || job.status === "running";

            return (
              <Card key={job.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon className={`h-5 w-5 shrink-0 ${config.color} ${job.status === "running" ? "animate-spin" : ""}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{job.jobType.replace(/_/g, " ")}</span>
                          <Badge variant="outline" className="text-xs">#{job.id}</Badge>
                          {job.retryCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Retry {job.retryCount}/{job.maxRetries}
                            </Badge>
                          )}
                          {duration && (
                            <span className="text-xs text-muted-foreground">{duration}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Created: {formatDate(job.createdAt)}</span>
                          {job.startedAt && <span>Started: {formatDate(job.startedAt)}</span>}
                          {job.finishedAt && <span>Finished: {formatDate(job.finishedAt)}</span>}
                        </div>
                        {job.error && (
                          <p className="text-xs text-red-400 mt-1 truncate max-w-md">
                            Error: {job.error}
                          </p>
                        )}
                        {job.progress != null && job.progress > 0 && job.status === "running" && (
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden max-w-xs">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryMutation.mutate({ jobId: job.id })}
                          disabled={retryMutation.isPending}
                          className="gap-1 text-xs"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Retry
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelMutation.mutate({ jobId: job.id })}
                          disabled={cancelMutation.isPending}
                          className="gap-1 text-xs text-red-400"
                        >
                          <XCircle className="h-3 w-3" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
