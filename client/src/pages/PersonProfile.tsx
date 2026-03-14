import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Sparkles,
  FileText,
  MessageSquare,
  StickyNote,
  Loader2,
  Mail,
  Globe,
  MapPin,
  Briefcase,
  Linkedin,
  GitBranch,
  Route,
  Target,
  CheckSquare,
  Clock,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import WarmPaths from "@/components/WarmPaths";

export default function PersonProfile() {
  const params = useParams<{ id: string }>();
  const personId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const [noteContent, setNoteContent] = useState("");

  const utils = trpc.useUtils();
  const { data: person, isLoading } = trpc.people.getById.useQuery({ id: personId });
  const { data: relationships } = trpc.relationships.list.useQuery({ personId });
  const { data: opportunities } = trpc.opportunities.list.useQuery({ personId });
  const { data: tasks } = trpc.tasks.list.useQuery({});
  const { data: drafts } = trpc.drafts.list.useQuery({});

  const addNoteMutation = trpc.people.addNote.useMutation({
    onSuccess: () => {
      utils.people.getById.invalidate({ id: personId });
      setNoteContent("");
      toast.success("Note added");
    },
  });

  const generateSummary = trpc.people.generateSummary.useMutation({
    onSuccess: () => {
      utils.people.getById.invalidate({ id: personId });
      toast.success("Summary generated");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateDraft = trpc.drafts.generate.useMutation({
    onSuccess: () => {
      toast.success("Draft generated! Check your Drafts page.");
    },
    onError: (err) => toast.error(err.message),
  });

  // Derived data for this person
  const personTasks = useMemo(() => {
    if (!tasks?.items) return [];
    return tasks.items.filter((t: any) => t.personId === personId);
  }, [tasks, personId]);

  const personDrafts = useMemo(() => {
    if (!drafts?.items) return [];
    return drafts.items.filter((d: any) => d.personId === personId);
  }, [drafts, personId]);

  const personOpportunities = useMemo(() => {
    if (!opportunities?.items) return [];
    return opportunities.items;
  }, [opportunities]);

  // Last contact date
  const lastContact = useMemo(() => {
    const dates: number[] = [];
    if (person?.interactions?.length) {
      person.interactions.forEach((i: any) => {
        if (i.occurredAt) dates.push(new Date(i.occurredAt).getTime());
      });
    }
    if (person?.notes?.length) {
      person.notes.forEach((n: any) => {
        if (n.createdAt) dates.push(new Date(n.createdAt).getTime());
      });
    }
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates));
  }, [person]);

  // Days since last contact
  const daysSinceContact = useMemo(() => {
    if (!lastContact) return null;
    return Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
  }, [lastContact]);

  // Next action (first open task)
  const nextAction = useMemo(() => {
    const open = personTasks.filter((t: any) => t.status !== "done");
    if (open.length === 0) return null;
    return open.sort((a: any, b: any) => {
      if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (a.dueAt) return -1;
      return 1;
    })[0];
  }, [personTasks]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Person not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/people")}>
          Back to People
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/people")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{person.fullName}</h1>
          <p className="text-muted-foreground text-sm">
            {[person.title, person.company].filter(Boolean).join(" at ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => generateSummary.mutate({ personId })}
            disabled={generateSummary.isPending}
          >
            {generateSummary.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI Summary
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => generateDraft.mutate({ personId })}
            disabled={generateDraft.isPending}
          >
            {generateDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Draft Message
          </Button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last Contact</p>
              <p className="text-sm font-medium">
                {lastContact ? (
                  <>
                    {daysSinceContact === 0
                      ? "Today"
                      : daysSinceContact === 1
                        ? "Yesterday"
                        : `${daysSinceContact}d ago`}
                  </>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Open Tasks</p>
              <p className="text-sm font-medium">
                {personTasks.filter((t: any) => t.status !== "done").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Opportunities</p>
              <p className="text-sm font-medium">{personOpportunities.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Drafts</p>
              <p className="text-sm font-medium">{personDrafts.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Next Action Banner */}
      {nextAction && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Next Action</p>
              <p className="text-sm font-medium truncate">{nextAction.title}</p>
            </div>
            {nextAction.dueAt && (
              <Badge variant="outline" className="text-xs shrink-0">
                <CalendarDays className="h-3 w-3 mr-1" />
                {new Date(nextAction.dueAt).toLocaleDateString()}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reconnect Warning */}
      {daysSinceContact !== null && daysSinceContact > 30 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
            <p className="text-sm">
              <span className="font-medium text-yellow-500">Reconnect needed:</span>{" "}
              It has been {daysSinceContact} days since your last interaction.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => generateDraft.mutate({ personId })}
              disabled={generateDraft.isPending}
            >
              Draft Reconnect
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              {person.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{person.email}</span>
                </div>
              )}
              {person.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{person.location}</span>
                </div>
              )}
              {person.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{person.company}</span>
                </div>
              )}
              {person.linkedinUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <Linkedin className="h-4 w-4 text-muted-foreground" />
                  <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    LinkedIn Profile
                  </a>
                </div>
              )}
              {person.websiteUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a href={person.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    Website
                  </a>
                </div>
              )}
              {person.tags && (person.tags as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {(person.tags as string[]).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Summary — Why This Person Matters */}
          {person.aiSummary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Why This Person Matters
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{person.aiSummary}</p>
              </CardContent>
            </Card>
          )}

          {/* Warm Paths — v9 Pillar 3 */}
          <WarmPaths personId={personId} personName={person.fullName} />

          {/* Connections */}
          {relationships && relationships.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" /> Connections
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {relationships.map((rel: any) => {
                  const otherPerson = rel.personAId === personId ? rel.personB : rel.personA;
                  if (!otherPerson) return null;
                  return (
                    <div key={rel.id} className="flex items-center gap-2 text-sm">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setLocation(`/people/${otherPerson.id}`)}
                      >
                        {otherPerson.fullName}
                      </button>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {rel.relationshipType}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="notes">
            <TabsList>
              <TabsTrigger value="notes" className="gap-1.5">
                <StickyNote className="h-3.5 w-3.5" /> Notes
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" /> Tasks ({personTasks.length})
              </TabsTrigger>
              <TabsTrigger value="drafts" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Drafts ({personDrafts.length})
              </TabsTrigger>
              <TabsTrigger value="opportunities" className="gap-1.5">
                <Target className="h-3.5 w-3.5" /> Opportunities ({personOpportunities.length})
              </TabsTrigger>
              <TabsTrigger value="interactions" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Interactions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note about this person..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <Button
                size="sm"
                onClick={() => addNoteMutation.mutate({ personId, content: noteContent })}
                disabled={!noteContent.trim() || addNoteMutation.isPending}
              >
                Add Note
              </Button>

              {person.notes && person.notes.length > 0 ? (
                <div className="space-y-3">
                  {person.notes.map((note: any) => (
                    <Card key={note.id}>
                      <CardContent className="p-3">
                        <p className="text-sm">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(note.createdAt).toLocaleDateString()} &middot; {note.createdBy}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No notes yet. Add your first note above.
                </p>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              {personTasks.length > 0 ? (
                <div className="space-y-2">
                  {personTasks.map((task: any) => (
                    <Card key={task.id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.dueAt && (
                            <Badge variant="outline" className="text-xs">
                              {new Date(task.dueAt).toLocaleDateString()}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs capitalize">
                            {task.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${
                              task.priority === "high"
                                ? "border-red-500/30 text-red-400"
                                : task.priority === "medium"
                                  ? "border-yellow-500/30 text-yellow-400"
                                  : ""
                            }`}
                          >
                            {task.priority}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No tasks linked to this person.
                </p>
              )}
            </TabsContent>

            <TabsContent value="drafts" className="mt-4">
              {personDrafts.length > 0 ? (
                <div className="space-y-2">
                  {personDrafts.map((draft: any) => (
                    <Card key={draft.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {draft.draftType || "outreach"}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {draft.status}
                          </Badge>
                          {draft.tone && (
                            <Badge variant="outline" className="text-xs">{draft.tone}</Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1 line-clamp-3">{draft.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(draft.createdAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">No drafts for this person.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateDraft.mutate({ personId })}
                    disabled={generateDraft.isPending}
                  >
                    {generateDraft.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 mr-1" />
                    )}
                    Generate Draft
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="opportunities" className="mt-4">
              {personOpportunities.length > 0 ? (
                <div className="space-y-2">
                  {personOpportunities.map((opp: any) => (
                    <Card key={opp.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium">{opp.title}</h4>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {opp.opportunityType}
                          </Badge>
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
                        <p className="text-sm text-muted-foreground">{opp.signalSummary}</p>
                        {opp.recommendedAction && (
                          <p className="text-xs text-primary/80 mt-1">
                            <span className="font-medium">Action:</span> {opp.recommendedAction}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No opportunities linked to this person.
                </p>
              )}
            </TabsContent>

            <TabsContent value="interactions" className="mt-4">
              {person.interactions && person.interactions.length > 0 ? (
                <div className="space-y-3">
                  {person.interactions.map((interaction: any) => (
                    <Card key={interaction.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {interaction.interactionType}
                          </Badge>
                          {interaction.channel && (
                            <Badge variant="outline" className="text-xs">
                              {interaction.channel}
                            </Badge>
                          )}
                        </div>
                        {interaction.content && (
                          <p className="text-sm mt-1">{interaction.content}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(interaction.occurredAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No interactions recorded yet.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
