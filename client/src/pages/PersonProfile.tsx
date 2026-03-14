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
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function PersonProfile() {
  const params = useParams<{ id: string }>();
  const personId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const [noteContent, setNoteContent] = useState("");

  const utils = trpc.useUtils();
  const { data: person, isLoading } = trpc.people.getById.useQuery({ id: personId });
  const { data: relationships } = trpc.relationships.forPerson.useQuery({ personId });
  const { data: warmPaths } = trpc.relationships.warmPaths.useQuery({ targetPersonId: personId });

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

          {/* AI Summary */}
          {person.aiSummary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{person.aiSummary}</p>
              </CardContent>
            </Card>
          )}

          {/* Warm Paths */}
          {warmPaths && warmPaths.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Route className="h-4 w-4 text-primary" /> Warm Paths
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {warmPaths.map((path: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">via</span>
                    <button
                      className="text-primary hover:underline font-medium"
                      onClick={() => setLocation(`/people/${path.intermediary.id}`)}
                    >
                      {path.intermediary.fullName}
                    </button>
                    <Badge variant="outline" className="text-xs capitalize">
                      {path.relationshipType}
                    </Badge>
                    {path.confidence && (
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(parseFloat(path.confidence) * 100)}%)
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Relationships */}
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
