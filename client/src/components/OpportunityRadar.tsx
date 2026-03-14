/**
 * OpportunityRadar — Dashboard widget (v14)
 *
 * Shows categorized opportunity counts with visual breakdown:
 * reconnect signals, intro opportunities, collaboration potential.
 * Each category is clickable and shows top items.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Radar,
  Users,
  Handshake,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Briefcase,
  Calendar,
  FileText,
  Share2,
  MoreHorizontal,
} from "lucide-react";
import { useLocation } from "wouter";

const CATEGORY_CONFIG: Record<string, { icon: typeof Users; color: string; bg: string }> = {
  reconnect: { icon: RefreshCw, color: "text-amber-400", bg: "bg-amber-400/10" },
  intro: { icon: Handshake, color: "text-blue-400", bg: "bg-blue-400/10" },
  collaboration: { icon: Lightbulb, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  job_change: { icon: Briefcase, color: "text-violet-400", bg: "bg-violet-400/10" },
  funding: { icon: Share2, color: "text-pink-400", bg: "bg-pink-400/10" },
  event: { icon: Calendar, color: "text-cyan-400", bg: "bg-cyan-400/10" },
  content: { icon: FileText, color: "text-orange-400", bg: "bg-orange-400/10" },
  referral: { icon: Users, color: "text-indigo-400", bg: "bg-indigo-400/10" },
  other: { icon: MoreHorizontal, color: "text-muted-foreground", bg: "bg-muted/50" },
};

export default function OpportunityRadar() {
  const [, setLocation] = useLocation();
  const { data: radar, isLoading } = trpc.opportunities.radar.useQuery(undefined, {
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            Opportunity Radar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!radar || (radar.totalOpen === 0 && radar.reconnectCount === 0)) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            Opportunity Radar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Radar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No opportunities detected yet. Add contacts to start scanning.
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
          <Radar className="h-4 w-4 text-primary" />
          Opportunity Radar
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
      <CardContent className="space-y-4">
        {/* Summary counters */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-amber-400/5 border border-amber-400/10">
            <p className="text-2xl font-bold text-amber-400">{radar.reconnectCount}</p>
            <p className="text-[10px] text-muted-foreground">Reconnects</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-400/5 border border-blue-400/10">
            <p className="text-2xl font-bold text-blue-400">{radar.introCount}</p>
            <p className="text-[10px] text-muted-foreground">Intros</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-emerald-400/5 border border-emerald-400/10">
            <p className="text-2xl font-bold text-emerald-400">{radar.collaborationCount}</p>
            <p className="text-[10px] text-muted-foreground">Collab</p>
          </div>
        </div>

        {/* Categories */}
        {radar.categories.map((cat: any) => {
          const config = CATEGORY_CONFIG[cat.type] ?? CATEGORY_CONFIG.other;
          const Icon = config.icon;

          return (
            <div
              key={cat.type}
              className="p-3 rounded-lg border border-border/50 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-7 w-7 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cat.label}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {cat.count}
                    </Badge>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    cat.avgScore >= 60
                      ? "border-green-500/30 text-green-400"
                      : cat.avgScore >= 40
                        ? "border-yellow-500/30 text-yellow-400"
                        : "border-muted text-muted-foreground"
                  }`}
                >
                  avg {cat.avgScore}
                </Badge>
              </div>

              {/* Top items in this category */}
              {cat.topItems.length > 0 && (
                <div className="space-y-1 ml-9">
                  {cat.topItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setLocation("/opportunities")}
                    >
                      <span className="truncate flex-1">{item.title}</span>
                      {item.personName && (
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {item.personName}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {item.compositeScore}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
