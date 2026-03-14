/**
 * Top Actions Today — Dashboard widget (v9 Pillar 2)
 *
 * Shows the top N prioritized actions from the Opportunity Scoring Engine.
 * Each action shows: rank, title, why it matters, suggested next step, score.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Target,
  Users,
  CheckSquare,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";

const TYPE_CONFIG = {
  opportunity: { icon: Target, color: "text-chart-1", bg: "bg-chart-1/10", label: "Opportunity" },
  reconnect: { icon: Users, color: "text-chart-4", bg: "bg-chart-4/10", label: "Reconnect" },
  task: { icon: CheckSquare, color: "text-chart-3", bg: "bg-chart-3/10", label: "Task" },
};

export default function TopActions() {
  const [, setLocation] = useLocation();
  const { data: actions, isLoading } = trpc.opportunities.topActions.useQuery(
    { count: 3 },
    { refetchInterval: 60000 }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Top Actions Today
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Top Actions Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No prioritized actions yet. Add contacts and opportunities to get started.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setLocation("/discover")}
            >
              Discover People
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Top Actions Today
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/opportunities")}
          className="text-xs gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => {
          const config = TYPE_CONFIG[action.type] ?? TYPE_CONFIG.opportunity;
          const Icon = config.icon;

          return (
            <div
              key={`${action.entityType}-${action.entityId}-${action.rank}`}
              className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 cursor-pointer transition-colors"
              onClick={() => {
                if (action.entityType === "opportunity") setLocation(`/opportunities`);
                else if (action.entityType === "person") setLocation(`/people/${action.entityId}`);
                else if (action.entityType === "task") setLocation(`/tasks`);
              }}
            >
              {/* Rank badge */}
              <div className={`h-8 w-8 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate">{action.title}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {action.score}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {action.whyItMatters}
                </p>
                <p className="text-xs text-primary/80 mt-1 line-clamp-1">
                  {action.suggestedAction}
                </p>
                {action.personName && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {action.personName}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
