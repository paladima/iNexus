/**
 * UnlinkedNotes Page (#13 v11)
 * View and link orphaned voice notes to people.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Link2, Trash2, Search, User } from "lucide-react";
import { toast } from "sonner";

export default function UnlinkedNotes() {
  const { data: notes, isLoading, refetch } = trpc.voice.unlinkedNotes.useQuery({});
  const linkMutation = trpc.voice.linkNote.useMutation({
    onSuccess: () => {
      toast.success("Note linked to person");
      refetch();
    },
  });
  const deleteMutation = trpc.voice.deleteNote.useMutation({
    onSuccess: () => {
      toast.success("Note deleted");
      refetch();
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [linkingNoteId, setLinkingNoteId] = useState<number | null>(null);
  const { data: searchResults } = trpc.people.list.useQuery(
    { search: searchQuery, limit: 5 },
    { enabled: searchQuery.length > 1 && linkingNoteId !== null }
  );

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const notesList = notes ?? [];

  return (
    <div className="container py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Unlinked Notes</h1>
          <p className="text-muted-foreground mt-1">
            Voice notes that couldn't be matched to a contact. Link them manually or delete.
          </p>
        </div>
        <Badge variant="outline">{notesList.length} notes</Badge>
      </div>

      {notesList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No unlinked notes. All voice notes have been matched!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notesList.map((note: any) => (
            <Card key={note.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {note.personNameHint && (
                      <Badge variant="secondary" className="mb-2">
                        <User className="h-3 w-3 mr-1" />
                        Hint: {note.personNameHint}
                      </Badge>
                    )}
                    <p className="text-sm">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(note.createdAt).toLocaleDateString()} via {note.source}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLinkingNoteId(linkingNoteId === note.id ? null : note.id);
                        setSearchQuery(note.personNameHint ?? "");
                      }}
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate({ noteId: note.id })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {linkingNoteId === note.id && (
                <CardContent className="pt-0">
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex gap-2">
                      <Search className="h-4 w-4 mt-2.5 text-muted-foreground" />
                      <Input
                        placeholder="Search contacts to link..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    {searchResults?.items && searchResults.items.length > 0 && (
                      <div className="space-y-1">
                        {searchResults.items.map((person: any) => (
                          <Button
                            key={person.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              linkMutation.mutate({ noteId: note.id, personId: person.id });
                              setLinkingNoteId(null);
                            }}
                          >
                            <User className="h-3 w-3 mr-2" />
                            {person.fullName}
                            {person.company && (
                              <span className="text-muted-foreground ml-1">@ {person.company}</span>
                            )}
                          </Button>
                        ))}
                      </div>
                    )}
                    {searchQuery.length > 1 && searchResults?.items?.length === 0 && (
                      <p className="text-xs text-muted-foreground pl-6">No contacts found</p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
