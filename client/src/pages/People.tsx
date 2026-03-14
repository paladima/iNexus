import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Search, Trash2, AlertCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function People() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    title: "",
    company: "",
    email: "",
    location: "",
    linkedinUrl: "",
  });

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.people.list.useQuery({ search: search || undefined });
  const createMutation = trpc.people.create.useMutation({
    onSuccess: () => {
      utils.people.list.invalidate();
      setDialogOpen(false);
      setForm({ fullName: "", title: "", company: "", email: "", location: "", linkedinUrl: "" });
      toast.success("Contact added!");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.people.delete.useMutation({
    onMutate: async (input) => {
      await utils.people.list.cancel();
      const prevData = utils.people.list.getData({ search: search || undefined });
      utils.people.list.setData({ search: search || undefined }, (old: any) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.filter((p: any) => p.id !== input.id), total: (old.total ?? 1) - 1 };
      });
      return { prevData };
    },
    onError: (_err, _input, context) => {
      if (context?.prevData) {
        utils.people.list.setData({ search: search || undefined }, context.prevData);
      }
      toast.error("Failed to delete contact. Reverted.");
    },
    onSettled: () => {
      utils.people.list.invalidate();
      toast.success("Contact removed");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People</h1>
          <p className="text-muted-foreground mt-1">
            {data?.total ?? 0} contacts in your network
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Person
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="CEO" />
                </div>
                <div>
                  <Label>Company</Label>
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Inc" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="San Francisco" />
                </div>
              </div>
              <div>
                <Label>LinkedIn URL</Label>
                <Input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({
                  fullName: form.fullName,
                  title: form.title || undefined,
                  company: form.company || undefined,
                  email: form.email || undefined,
                  location: form.location || undefined,
                  linkedinUrl: form.linkedinUrl || undefined,
                })}
                disabled={!form.fullName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Adding..." : "Add Contact"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {error ? (
        <div className="text-center py-16">
          <AlertCircle className="h-12 w-12 text-destructive/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Failed to load contacts</h3>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => utils.people.list.invalidate()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-2">
          {data.items.map((person: any) => (
            <Card
              key={person.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setLocation(`/people/${person.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {person.fullName?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {person.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[person.title, person.company].filter(Boolean).join(" at ")}
                      </p>
                      {person.location && (
                        <p className="text-xs text-muted-foreground">{person.location}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {person.status && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {person.status}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate({ id: person.id });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No contacts yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add people manually or discover them with AI.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setLocation("/discover")}>
              <Sparkles className="h-4 w-4 mr-1" />
              Discover People
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
