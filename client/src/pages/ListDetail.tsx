import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Users, UserMinus, Send, Loader2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function ListDetail() {
  const params = useParams<{ id: string }>();
  const listId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.lists.getById.useQuery({ id: listId });

  const removeMutation = trpc.lists.removePerson.useMutation({
    onSuccess: () => {
      utils.lists.getById.invalidate({ id: listId });
      toast.success("Person removed from list");
    },
  });

  const batchOutreachMutation = trpc.lists.batchOutreach.useMutation({
    onSuccess: (result) => {
      utils.drafts.list.invalidate();
      toast.success(`Generated ${result.total} drafts for this list`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">List not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/lists")}>
          Back to Lists
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/lists")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
            {data.description && (
              <p className="text-muted-foreground text-sm">{data.description}</p>
            )}
          </div>
        </div>
        {data.people && data.people.length > 0 && (
          <Button
            onClick={() => batchOutreachMutation.mutate({ listId })}
            disabled={batchOutreachMutation.isPending}
            className="gap-2"
          >
            {batchOutreachMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Batch Outreach
          </Button>
        )}
      </div>

      {data.people && data.people.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {data.people.length} people in this list
          </p>
          {data.people.map((item: any) => (
            <Card
              key={item.person.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setLocation(`/people/${item.person.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {item.person.fullName?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.person.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[item.person.title, item.person.company].filter(Boolean).join(" at ")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMutation.mutate({ listId, personId: item.person.id });
                    }}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No people in this list</h3>
          <p className="text-sm text-muted-foreground">
            Add people from their profile page.
          </p>
        </div>
      )}
    </div>
  );
}
