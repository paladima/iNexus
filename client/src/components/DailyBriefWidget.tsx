/**
 * DailyBriefWidget — Dashboard widget (v14)
 *
 * Real-time networking brief showing today's prioritized actions:
 * - Reconnects (people not contacted in 30+ days)
 * - Overdue/due-today tasks
 * - Intro opportunities
 * - Follow-ups from recent interactions
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Newspaper,
  RefreshCw,
  Handshake,
  CheckSquare,
  MessageSquare,
  ArrowRight,
  Sunrise,
  Sun,
  Moon,
} from "lucide-react";
import { useLocation } from "wouter";

const TYPE_CONFIG: Record<string, { icon: typeof RefreshCw; color: string; bg: string; label: string }> = {
  reconnect: { icon: RefreshCw, color: "text-amber-400", bg: "bg-amber-400/10", label: "Reconnect" },
  intro: { icon: Handshake, color: "text-blue-400", bg: "bg-blue-400/10", label: "Intro" },
  task: { icon: CheckSquare, color: "text-red-400", bg: "bg-red-400/10", label: "Task" },
  follow_up: { icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Follow Up" },
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-red-500/20 bg-red-500/5",
  medium: "border-yellow-500/20 bg-yellow-500/5",
  low: "border-border/50",
};

function TimeIcon() {
  const hour = new Date().getHours();
  if (hour < 12) return <Sunrise className="h-4 w-4 text-amber-400" />;
  if (hour < 17) return <Sun className="h-4 w-4 text-yellow-400" />;
  return <Moon className="h-4 w-4 text-indigo-400" />;
}

export default function DailyBriefWidget() {
  const [, setLocation] = useLocation();
  const { data: brief, isLoading, refetch } = trpc.dashboard.networkingBrief.useQuery(undefined, {
    refetchInterval: 300000, // 5 min
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            Networking Brief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!brief || brief.items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            Networking Brief
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <TimeIcon />
            <p className="text-sm text-muted-foreground mt-3">
              Your network is in good shape — no urgent actions today.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          Networking Brief
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="text-xs gap-1"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Greeting */}
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          <TimeIcon />
          <p className="text-sm text-muted-foreground">{brief.greeting}</p>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Reconnect", count: brief.stats.reconnectCount, color: "text-amber-400" },
            { label: "Intros", count: brief.stats.introCount, color: "text-blue-400" },
            { label: "Follow-up", count: brief.stats.followUpCount, color: "text-emerald-400" },
            { label: "Tasks", count: brief.stats.taskCount, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Action items */}
        <div className="space-y-2">
          {brief.items.slice(0, 8).map((item: any, idx: number) => {
            const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.follow_up;
            const Icon = config.icon;
            const priorityStyle = PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.low;

            return (
              <div
                key={`${item.type}-${idx}`}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:border-primary/30 ${priorityStyle}`}
                onClick={() => {
                  if (item.personId) setLocation(`/people/${item.personId}`);
                  else if (item.entityType === "task") setLocation("/tasks");
                  else if (item.entityType === "opportunity") setLocation("/opportunities");
                }}
              >
                <div className={`h-7 w-7 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${
                        item.priority === "high"
                          ? "border-red-500/30 text-red-400"
                          : item.priority === "medium"
                            ? "border-yellow-500/30 text-yellow-400"
                            : ""
                      }`}
                    >
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
