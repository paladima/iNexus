import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Loader2, Sparkles, Globe } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Discover() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = trpc.discover.search.useMutation({
    onSuccess: (data) => {
      setResults(data.results ?? []);
      setHasSearched(true);
    },
    onError: (err) => toast.error(err.message),
  });

  const saveMutation = trpc.discover.savePerson.useMutation({
    onSuccess: () => toast.success("Person saved to your contacts!"),
    onError: (err) => toast.error(err.message),
  });

  const handleSearch = () => {
    if (!query.trim()) return;
    searchMutation.mutate({ query: query.trim() });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Discover People
        </h1>
        <p className="text-muted-foreground mt-1">
          Find relevant people for your networking goals using AI-powered search.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="e.g., AI startup founders in San Francisco, VC partners focused on SaaS..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 h-11"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={searchMutation.isPending || !query.trim()}
          className="h-11 px-6"
        >
          {searchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {/* Results */}
      {searchMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            Searching for relevant people...
          </p>
        </div>
      )}

      {!searchMutation.isPending && hasSearched && results.length === 0 && (
        <div className="text-center py-16">
          <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            No results found. Try a different search query.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Found {results.length} relevant people
          </p>
          {results.map((person: any, index: number) => (
            <Card
              key={index}
              className="hover:border-primary/30 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm font-semibold text-primary">
                        {person.fullName?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">
                          {person.fullName}
                        </h3>
                        {person.relevanceScore && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(person.relevanceScore * 100)}% match
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[person.title, person.company]
                          .filter(Boolean)
                          .join(" at ")}
                      </p>
                      {person.location && (
                        <p className="text-xs text-muted-foreground">
                          {person.location}
                        </p>
                      )}
                      {person.whyRelevant && (
                        <p className="text-sm text-foreground/80 mt-2">
                          {person.whyRelevant}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      saveMutation.mutate({
                        fullName: person.fullName,
                        title: person.title,
                        company: person.company,
                        location: person.location,
                        linkedinUrl: person.linkedinUrl,
                        sourceType: person.sourceType ?? "discovery",
                        relevanceScore: person.relevanceScore?.toString(),
                      })
                    }
                    disabled={saveMutation.isPending}
                    className="shrink-0 gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!hasSearched && !searchMutation.isPending && (
        <div className="text-center py-16">
          <Sparkles className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">
            AI-Powered People Discovery
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Describe who you&apos;re looking for and our AI will find the most
            relevant people based on your networking goals.
          </p>
        </div>
      )}
    </div>
  );
}
