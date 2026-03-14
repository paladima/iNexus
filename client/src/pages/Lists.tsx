import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ListChecks, Plus, Users, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Lists() {
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: lists, isLoading } = trpc.lists.list.useQuery();
  const createMutation = trpc.lists.create.useMutation({
    onSuccess: () => {
      utils.lists.list.invalidate();
      setDialogOpen(false);
      setName("");
      setDescription("");
      toast.success("List created!");
    },
  });
  const deleteMutation = trpc.lists.delete.useMutation({
    onSuccess: () => {
      utils.lists.list.invalidate();
      toast.success("List deleted");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lists</h1>
          <p className="text-muted-foreground mt-1">
            Organize your contacts into groups.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New List</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., VC Partners" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({ name, description: description || undefined })}
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create List"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : lists && lists.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list: any) => (
            <Card
              key={list.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setLocation(`/lists/${list.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{list.name}</h3>
                    {list.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {list.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{list.personCount} people</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ id: list.id });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <ListChecks className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No lists yet</h3>
          <p className="text-sm text-muted-foreground">
            Create lists to organize your contacts by category.
          </p>
        </div>
      )}
    </div>
  );
}
