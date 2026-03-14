/**
 * ListPickerDialog — reusable dialog for selecting or creating a list.
 * Used by Discover bulk actions and other flows.
 */
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListChecks, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ListPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (listId: number, listName: string) => void;
  title?: string;
  description?: string;
}

export function ListPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Select a List",
  description = "Choose an existing list or create a new one.",
}: ListPickerDialogProps) {
  const [newListName, setNewListName] = useState("");
  const { data: lists, isLoading } = trpc.lists.list.useQuery(undefined, {
    enabled: open,
  });
  const utils = trpc.useUtils();

  const createList = trpc.lists.create.useMutation({
    onSuccess: (data) => {
      toast.success(`List "${newListName}" created`);
      utils.lists.list.invalidate();
      if (data.id) {
        onSelect(data.id, newListName);
        onOpenChange(false);
        setNewListName("");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreateAndSelect = () => {
    if (!newListName.trim()) return;
    createList.mutate({ name: newListName.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Create new list */}
        <div className="flex gap-2">
          <Input
            placeholder="New list name..."
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateAndSelect()}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleCreateAndSelect}
            disabled={!newListName.trim() || createList.isPending}
            className="gap-1"
          >
            {createList.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Create
          </Button>
        </div>

        {/* Existing lists */}
        <ScrollArea className="max-h-60">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : lists && lists.length > 0 ? (
            <div className="space-y-1">
              {(lists as any[]).map((list: any) => (
                <button
                  key={list.id}
                  onClick={() => {
                    onSelect(list.id, list.name);
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{list.name}</p>
                    {list.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {list.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {list._count?.people ?? list.peopleCount ?? ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                No lists yet. Create one above.
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
