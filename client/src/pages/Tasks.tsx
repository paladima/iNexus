import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, Plus, Trash2, Calendar, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Tasks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState("upcoming");
  const [form, setForm] = useState({ title: "", description: "", dueAt: "", priority: "medium" });

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.tasks.list.useQuery({
    view: tab as "today" | "upcoming" | "completed",
  });

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      setDialogOpen(false);
      setForm({ title: "", description: "", dueAt: "", priority: "medium" });
      toast.success("Task created!");
    },
    onError: (err) => {
      toast.error(`Failed to create task: ${err.message}`);
    },
  });

  // #19: Optimistic update for task completion toggle
  const updateMutation = trpc.tasks.update.useMutation({
    onMutate: async (input) => {
      await utils.tasks.list.cancel();
      const prevData = utils.tasks.list.getData({ view: tab as "today" | "upcoming" | "completed" });
      utils.tasks.list.setData({ view: tab as "today" | "upcoming" | "completed" }, (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((t: any) =>
            t.id === input.id ? { ...t, ...input } : t
          ),
        };
      });
      return { prevData };
    },
    onError: (_err, _input, context) => {
      if (context?.prevData) {
        utils.tasks.list.setData({ view: tab as "today" | "upcoming" | "completed" }, context.prevData);
      }
      toast.error("Failed to update task. Reverted.");
    },
    onSettled: () => {
      utils.tasks.list.invalidate();
    },
  });

  // #19: Optimistic delete
  const deleteMutation = trpc.tasks.delete.useMutation({
    onMutate: async (input) => {
      await utils.tasks.list.cancel();
      const prevData = utils.tasks.list.getData({ view: tab as "today" | "upcoming" | "completed" });
      utils.tasks.list.setData({ view: tab as "today" | "upcoming" | "completed" }, (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.filter((t: any) => t.id !== input.id),
        };
      });
      return { prevData };
    },
    onError: (_err, _input, context) => {
      if (context?.prevData) {
        utils.tasks.list.setData({ view: tab as "today" | "upcoming" | "completed" }, context.prevData);
      }
      toast.error("Failed to delete task. Reverted.");
    },
    onSettled: () => {
      utils.tasks.list.invalidate();
      toast.success("Task deleted");
    },
  });

  const priorityColor = (p: string | null) => {
    if (p === "high") return "bg-destructive/20 text-destructive";
    if (p === "medium") return "bg-chart-4/20 text-chart-4";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Manage your networking tasks and follow-ups.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Follow up with..." />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Due Date</Label>
                  <Input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({
                  title: form.title,
                  description: form.description || undefined,
                  dueDate: form.dueAt || undefined,
                  priority: form.priority as "low" | "medium" | "high",
                })}
                disabled={!form.title.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {/* #19: Error state */}
          {error ? (
            <div className="text-center py-16">
              <AlertCircle className="h-12 w-12 text-destructive/40 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Failed to load tasks</h3>
              <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
              <Button variant="outline" size="sm" onClick={() => utils.tasks.list.invalidate()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data?.items && data.items.length > 0 ? (
            <div className="space-y-2">
              {data.items.map((task: any) => (
                <Card key={task.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={task.status === "completed"}
                        onCheckedChange={(checked) => {
                          updateMutation.mutate({
                            id: task.id,
                            status: checked ? "done" : "open",
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.priority && (
                          <Badge className={`text-xs ${priorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                        )}
                        {task.dueAt && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueAt).toLocaleDateString()}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: task.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <CheckSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">
                {tab === "completed" ? "No completed tasks" : "No tasks"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {tab === "completed"
                  ? "Complete tasks to see them here."
                  : "Create a task to get started."}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
