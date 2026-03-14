import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Check, Trash2, Edit3, Copy, AlertCircle, Users } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Drafts() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editDraft, setEditDraft] = useState<any>(null);
  const [editBody, setEditBody] = useState("");

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.drafts.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : {}
  );

  const updateMutation = trpc.drafts.update.useMutation({
    onSuccess: () => {
      utils.drafts.list.invalidate();
      setEditDraft(null);
      toast.success("Draft updated");
    },
    onError: (err) => {
      toast.error(`Failed to update draft: ${err.message}`);
    },
  });

  const deleteMutation = trpc.drafts.delete.useMutation({
    onMutate: async (input) => {
      await utils.drafts.list.cancel();
      const prevData = utils.drafts.list.getData(statusFilter !== "all" ? { status: statusFilter } : {});
      utils.drafts.list.setData(statusFilter !== "all" ? { status: statusFilter } : {}, (old: any) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.filter((d: any) => d.id !== input.id) };
      });
      return { prevData };
    },
    onError: (_err, _input, context) => {
      if (context?.prevData) {
        utils.drafts.list.setData(statusFilter !== "all" ? { status: statusFilter } : {}, context.prevData);
      }
      toast.error("Failed to delete draft. Reverted.");
    },
    onSettled: () => {
      utils.drafts.list.invalidate();
      toast.success("Draft deleted");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drafts</h1>
          <p className="text-muted-foreground mt-1">
            AI-generated message drafts for review and approval.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drafts</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="text-center py-16">
          <AlertCircle className="h-12 w-12 text-destructive/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Failed to load drafts</h3>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => utils.drafts.list.invalidate()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((draft: any) => (
            <Card key={draft.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {draft.draftType}
                      </Badge>
                      {draft.tone && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {draft.tone}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${
                          draft.status === "pending_review"
                            ? "border-yellow-500/30 text-yellow-400"
                            : draft.status === "approved"
                              ? "border-green-500/30 text-green-400"
                              : draft.status === "sent"
                                ? "border-blue-500/30 text-blue-400"
                                : ""
                        }`}
                      >
                        {draft.status?.replace("_", " ")}
                      </Badge>
                    </div>
                    {draft.subject && (
                      <p className="font-medium text-sm mb-1">{draft.subject}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {draft.body}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(draft.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {draft.status === "pending_review" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => updateMutation.mutate({ id: draft.id, status: "approved" })}
                      >
                        <Check className="h-3 w-3" /> Approve
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => copyToClipboard(draft.body)}
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setEditDraft(draft);
                        setEditBody(draft.body);
                      }}
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: draft.id })}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No drafts yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate drafts from a person&apos;s profile page or use Discover to bulk-generate.
          </p>
          <Button variant="outline" onClick={() => setLocation("/people")}>
            <Users className="h-4 w-4 mr-1" />
            Go to People
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDraft} onOpenChange={() => setEditDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Draft</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className="min-h-[200px]"
          />
          <Button
            onClick={() =>
              updateMutation.mutate({ id: editDraft?.id, body: editBody })
            }
            disabled={updateMutation.isPending}
          >
            Save Changes
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
