import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  UserPlus,
  Search,
  FileText,
  CheckSquare,
  Target,
  Mic,
  Sparkles,
  ListChecks,
} from "lucide-react";

const activityIcons: Record<string, any> = {
  person_added: UserPlus,
  person_saved_from_discovery: UserPlus,
  person_deleted: UserPlus,
  discovery_search: Search,
  draft_generated: FileText,
  draft_approved: FileText,
  task_created: CheckSquare,
  task_completed: CheckSquare,
  opportunity_created: Target,
  voice_capture: Mic,
  ai_command: Sparkles,
  list_created: ListChecks,
  onboarding_goals_saved: Sparkles,
  onboarding_completed: Sparkles,
};

export default function ActivityPage() {
  const { data, isLoading } = trpc.activity.list.useQuery({ limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground mt-1">
          Your recent networking activity and actions.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-2">
          {data.items.map((item: any) => {
            const Icon = activityIcons[item.activityType] ?? Activity;
            return (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {item.activityType.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No activity yet</h3>
          <p className="text-sm text-muted-foreground">
            Your actions will appear here as you use iNexus.
          </p>
        </div>
      )}
    </div>
  );
}
