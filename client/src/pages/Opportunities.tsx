import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Opportunities() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.opportunities.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : {}
  );

  const updateMutation = trpc.opportunities.update.useMutation({
    onSuccess: () => {
      utils.opportunities.list.invalidate();
      toast.success("Opportunity updated");
    },
  });

  const scoreColor = (score: string | null) => {
    const s = parseFloat(score ?? "0");
    if (s >= 0.7) return "bg-green-500/20 text-green-400";
    if (s >= 0.4) return "bg-yellow-500/20 text-yellow-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opportunities</h1>
          <p className="text-muted-foreground mt-1">
            AI-detected signals and networking opportunities.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acted_on">Acted On</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((opp: any) => (
            <Card key={opp.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{opp.title}</h3>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {opp.opportunityType}
                      </Badge>
                      {opp.score && (
                        <Badge className={`text-xs ${scoreColor(opp.score)}`}>
                          {Math.round(parseFloat(opp.score) * 100)}%
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${
                          opp.status === "open"
                            ? "border-green-500/30 text-green-400"
                            : opp.status === "acted_on"
                              ? "border-blue-500/30 text-blue-400"
                              : ""
                        }`}
                      >
                        {opp.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {opp.signalSummary}
                    </p>
                    {opp.whyItMatters && (
                      <p className="text-xs text-foreground/70 mt-2">
                        <span className="font-medium">Why it matters:</span> {opp.whyItMatters}
                      </p>
                    )}
                    {opp.recommendedAction && (
                      <p className="text-xs text-primary/80 mt-1">
                        <span className="font-medium">Recommended:</span> {opp.recommendedAction}
                      </p>
                    )}
                  </div>
                  {opp.status === "open" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: opp.id, status: "acted_on" })}
                      >
                        Act
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: opp.id, status: "dismissed" })}
                        className="text-muted-foreground"
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Target className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No opportunities yet</h3>
          <p className="text-sm text-muted-foreground">
            Opportunities will appear as AI detects relevant signals.
          </p>
        </div>
      )}
    </div>
  );
}
