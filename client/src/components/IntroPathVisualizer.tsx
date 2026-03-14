/**
 * IntroPathVisualizer — v14 Multi-hop Intro Path Visualization
 *
 * Shows the BFS-discovered intro chain on Person Profile:
 *   You → Alex (colleague) → Mark (friend) → John
 *
 * Each node in the chain is clickable, edges show connection type and confidence.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Route,
  ArrowRight,
  User,
  Building2,
  ListChecks,
  Tags,
  MapPin,
  Link2,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";

const EDGE_ICONS: Record<string, typeof Link2> = {
  known_connection: Link2,
  same_company: Building2,
  same_list: ListChecks,
  shared_tags: Tags,
  same_geography: MapPin,
};

const EDGE_COLORS: Record<string, string> = {
  known_connection: "text-blue-400",
  same_company: "text-emerald-400",
  same_list: "text-violet-400",
  shared_tags: "text-amber-400",
  same_geography: "text-rose-400",
};

interface IntroPathVisualizerProps {
  personId: number;
  personName: string;
}

export default function IntroPathVisualizer({ personId, personName }: IntroPathVisualizerProps) {
  const [, setLocation] = useLocation();

  const { data: introPath, isLoading } = trpc.relationships.introPath.useQuery(
    { personId },
    { enabled: !!personId }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Route className="h-4 w-4 text-indigo-500" />
            Intro Path
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!introPath) {
    return null; // Don't show anything if no multi-hop path exists
  }

  const confidencePercent = Math.round(introPath.pathConfidence * 100);

  return (
    <Card className="border-indigo-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Route className="h-4 w-4 text-indigo-500" />
            Intro Path to {personName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {introPath.hops} hop{introPath.hops > 1 ? "s" : ""}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                confidencePercent >= 50
                  ? "border-green-500/30 text-green-400"
                  : confidencePercent >= 25
                    ? "border-yellow-500/30 text-yellow-400"
                    : "border-red-500/30 text-red-400"
              }`}
            >
              {confidencePercent}% confidence
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Visual chain */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 pt-2">
          {/* "You" node */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex flex-col items-center">
              <div className="h-9 w-9 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[10px] font-medium mt-1">You</span>
            </div>
          </div>

          {/* Chain nodes */}
          {introPath.chain.map((node: any, idx: number) => {
            const edge = introPath.edges[idx];
            const isTarget = idx === introPath.chain.length - 1;
            const EdgeIcon = edge ? (EDGE_ICONS[edge.connectionType] ?? Link2) : Link2;
            const edgeColor = edge ? (EDGE_COLORS[edge.connectionType] ?? "text-muted-foreground") : "text-muted-foreground";

            return (
              <div key={node.personId} className="flex items-center gap-1 shrink-0">
                {/* Edge arrow with label */}
                <div className="flex flex-col items-center mx-1">
                  <div className="flex items-center gap-0.5">
                    <div className="w-6 h-px bg-border" />
                    <EdgeIcon className={`h-3 w-3 ${edgeColor}`} />
                    <div className="w-6 h-px bg-border" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                  {edge && (
                    <span className={`text-[8px] ${edgeColor} whitespace-nowrap mt-0.5`}>
                      {edge.connectionType.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                {/* Person node */}
                <div className="flex flex-col items-center">
                  <button
                    className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isTarget
                        ? "bg-indigo-500/10 border-indigo-500 hover:bg-indigo-500/20"
                        : "bg-muted/50 border-border hover:border-primary/50"
                    }`}
                    onClick={() => setLocation(`/people/${node.personId}`)}
                    title={`${node.fullName}${node.title ? ` — ${node.title}` : ""}${node.company ? ` at ${node.company}` : ""}`}
                  >
                    {isTarget ? (
                      <Zap className="h-4 w-4 text-indigo-500" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <span className={`text-[10px] font-medium mt-1 max-w-[60px] truncate text-center ${isTarget ? "text-indigo-400" : ""}`}>
                    {node.fullName.split(" ")[0]}
                  </span>
                  {node.company && (
                    <span className="text-[8px] text-muted-foreground max-w-[60px] truncate text-center">
                      {node.company}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Path description */}
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
          <Route className="h-3 w-3 shrink-0" />
          {introPath.description}
        </p>
      </CardContent>
    </Card>
  );
}
