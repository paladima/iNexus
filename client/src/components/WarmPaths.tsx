/**
 * WarmPaths — Person Profile widget (v9 Pillar 3)
 *
 * Shows warm paths to reach a person through existing connections.
 * Includes "Ask for Intro" action that generates an intro request draft.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  ArrowRight,
  Building2,
  ListChecks,
  Tags,
  MapPin,
  Link2,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

const CONNECTION_ICONS: Record<string, typeof Users> = {
  known_connection: Link2,
  same_company: Building2,
  same_list: ListChecks,
  shared_tags: Tags,
  same_geography: MapPin,
};

interface WarmPathsProps {
  personId: number;
  personName: string;
}

export default function WarmPaths({ personId, personName }: WarmPathsProps) {
  const [, setLocation] = useLocation();

  const [requestingIntroFor, setRequestingIntroFor] = useState<number | null>(null);

  const { data: paths, isLoading } = trpc.relationships.warmPaths.useQuery(
    { personId },
    { enabled: !!personId }
  );

  const buildIntro = trpc.relationships.buildIntroRequest.useMutation({
    onSuccess: (data) => {
      setRequestingIntroFor(null);
      toast.success(`Intro request drafted for ${personName}`);
    },
    onError: () => {
      setRequestingIntroFor(null);
      toast.error("Could not generate intro request");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-pink-500" />
            Warm Paths
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!paths || paths.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-pink-500" />
            Warm Paths
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">
            No warm paths found yet. Add more contacts to discover connections.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-pink-500" />
          Warm Paths to {personName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {paths.slice(0, 5).map((path: any, i: number) => {
          const Icon = CONNECTION_ICONS[path.connectionType] ?? Users;
          const confidencePercent = Math.round((path.confidence ?? 0.5) * 100);

          return (
            <div
              key={`${path.connector.id}-${i}`}
              className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/20 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-pink-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-sm font-medium text-primary cursor-pointer hover:underline truncate"
                    onClick={() => setLocation(`/people/${path.connector.id}`)}
                  >
                    {path.connector.fullName}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {confidencePercent}%
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-1">
                  {path.evidence}
                </p>

                <p className="text-[10px] text-primary/70 mt-0.5 line-clamp-1">
                  {path.suggestedApproach}
                </p>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] mt-1 gap-1 text-pink-500 hover:text-pink-600 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRequestingIntroFor(path.connector.id);
                    buildIntro.mutate({
                      connectorPersonId: path.connector.id,
                      targetPersonId: personId,
                    });
                  }}
                  disabled={requestingIntroFor === path.connector.id}
                >
                  {requestingIntroFor === path.connector.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      Ask for Intro <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
