import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target,
  FileText,
  CheckSquare,
  Users,
  Sparkles,
  ArrowRight,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";
import TopActions from "@/components/TopActions";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: briefData } = trpc.dashboard.dailyBrief.useQuery();
  const brief = briefData?.status === "ready" ? briefData.brief : null;
  const generateBrief = trpc.dashboard.generateBrief.useMutation({
    onSuccess: () => {
      // #13: Brief generates in background; poll for result
      const poll = setInterval(() => {
        utils.dashboard.dailyBrief.invalidate().then(() => {
          // Stop polling after 30s max
        });
      }, 3000);
      setTimeout(() => clearInterval(poll), 30000);
    },
  });

  const statCards = [
    {
      label: "Open Opportunities",
      value: stats?.openOpportunities ?? 0,
      icon: Target,
      color: "text-chart-1",
      path: "/opportunities",
    },
    {
      label: "Pending Drafts",
      value: stats?.pendingDrafts ?? 0,
      icon: FileText,
      color: "text-chart-2",
      path: "/drafts",
    },
    {
      label: "Open Tasks",
      value: stats?.openTasks ?? 0,
      icon: CheckSquare,
      color: "text-chart-3",
      path: "/tasks",
    },
    {
      label: "Total People",
      value: stats?.totalPeople ?? 0,
      icon: Users,
      color: "text-chart-4",
      path: "/people",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s your networking overview for today.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/discover")}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Discover People
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => setLocation(stat.path)}
          >
            <CardContent className="p-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-5 w-5 ${stat.color} opacity-70`} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Actions Today — v9 Pillar 2 */}
      <TopActions />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Brief */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Daily Brief
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateBrief.mutate()}
              disabled={generateBrief.isPending}
              className="text-xs"
            >
              {generateBrief.isPending ? "Generating..." : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent>
            {brief?.briefJson ? (
              <div className="space-y-3">
                {(brief.briefJson as any).greeting && (
                  <p className="text-sm text-muted-foreground">
                    {(brief.briefJson as any).greeting}
                  </p>
                )}
                {((brief.briefJson as any).items ?? []).map(
                  (item: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
                    >
                      <div
                        className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                          item.priority === "high"
                            ? "bg-destructive"
                            : item.priority === "medium"
                              ? "bg-chart-4"
                              : "bg-chart-2"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  )
                )}
                {((brief.briefJson as any).summary) && (
                  <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
                    {(brief.briefJson as any).summary}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No brief yet for today.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => generateBrief.mutate()}
                  disabled={generateBrief.isPending}
                >
                  Generate Brief
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent People */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Recent Contacts
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/people")}
              className="text-xs gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : stats?.recentPeople && stats.recentPeople.length > 0 ? (
              <div className="space-y-2">
                {stats.recentPeople.map((person: any) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/people/${person.id}`)}
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-primary">
                        {person.fullName?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {person.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[person.title, person.company]
                          .filter(Boolean)
                          .join(" at ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No contacts yet. Start by discovering people.
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
