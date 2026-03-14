import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, UserPlus, Loader2, Sparkles, Globe, Brain, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ScoringBreakdown {
  roleMatch?: number;
  industryMatch?: number;
  geoMatch?: number;
  seniorityMatch?: number;
  goalAlignment?: number;
  signalStrength?: number;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-muted-foreground">{pct}%</span>
    </div>
  );
}

export default function Discover() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [intent, setIntent] = useState<any>(null);
  const [queryVariants, setQueryVariants] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [showIntent, setShowIntent] = useState(false);

  const searchMutation = trpc.discover.search.useMutation({
    onSuccess: (data) => {
      setResults(data.results ?? []);
      setIntent(data.intent ?? null);
      setQueryVariants(data.queryVariants ?? []);
      setHasSearched(true);
      setExpandedCards(new Set());
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

  const toggleExpand = (index: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const scoreLabel = (key: string) => {
    const labels: Record<string, string> = {
      roleMatch: "Role Match",
      industryMatch: "Industry",
      geoMatch: "Geography",
      seniorityMatch: "Seniority",
      goalAlignment: "Goal Fit",
      signalStrength: "Signal",
    };
    return labels[key] ?? key;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Discover People
        </h1>
        <p className="text-muted-foreground mt-1">
          Find relevant people using AI-powered intent decomposition and role-aware ranking.
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

      {/* Intent Decomposition Display */}
      {intent && hasSearched && !searchMutation.isPending && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <button
              onClick={() => setShowIntent(!showIntent)}
              className="flex items-center gap-2 w-full text-left"
            >
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Search Intent Analysis</span>
              {showIntent ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
              )}
            </button>
            {showIntent && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {intent.topic && (
                    <Badge variant="secondary" className="text-xs">
                      Topic: {intent.topic}
                    </Badge>
                  )}
                  {intent.role && (
                    <Badge variant="secondary" className="text-xs">
                      Role: {intent.role}
                    </Badge>
                  )}
                  {intent.geo && (
                    <Badge variant="secondary" className="text-xs">
                      Geo: {intent.geo}
                    </Badge>
                  )}
                  {intent.industry && (
                    <Badge variant="secondary" className="text-xs">
                      Industry: {intent.industry}
                    </Badge>
                  )}
                  {intent.speaker && (
                    <Badge variant="secondary" className="text-xs">
                      Speaker: Yes
                    </Badge>
                  )}
                </div>
                {intent.negatives?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground">Excluded:</span>
                    {intent.negatives.map((neg: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs text-red-400 border-red-500/30">
                        {neg}
                      </Badge>
                    ))}
                  </div>
                )}
                {queryVariants.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground">Query variants:</span>
                    {queryVariants.map((v, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {searchMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            Decomposing intent and ranking candidates...
          </p>
        </div>
      )}

      {/* No Results */}
      {!searchMutation.isPending && hasSearched && results.length === 0 && (
        <div className="text-center py-16">
          <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            No results found. Try a different search query.
          </p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Found {results.length} relevant people, ranked by composite score
          </p>
          {results.map((person: any, index: number) => {
            const scoring: ScoringBreakdown = person.scoring ?? {};
            const matchReasons: string[] = person.matchReasons ?? [];
            const isExpanded = expandedCards.has(index);

            return (
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
                          {person.relevanceScore != null && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge
                                  variant="secondary"
                                  className={`text-xs cursor-help ${
                                    person.relevanceScore >= 0.7
                                      ? "bg-green-500/20 text-green-400"
                                      : person.relevanceScore >= 0.4
                                        ? "bg-yellow-500/20 text-yellow-400"
                                        : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {Math.round(person.relevanceScore * 100)}% match
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Weighted composite score across 6 axes</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <span className="text-xs text-muted-foreground">#{index + 1}</span>
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
                        {/* Match Reasons */}
                        {matchReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {matchReasons.map((reason, i) => (
                              <Badge key={i} variant="outline" className="text-xs text-primary/80 border-primary/30">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Expandable Scoring Breakdown */}
                        {isExpanded && Object.keys(scoring).length > 0 && (
                          <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-1.5">
                            <div className="flex items-center gap-1 mb-2">
                              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">Scoring Breakdown</span>
                            </div>
                            {Object.entries(scoring).map(([key, value]) => (
                              <ScoreBar key={key} label={scoreLabel(key)} value={value ?? 0} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
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
                        className="gap-1.5"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(index)}
                        className="gap-1 text-xs"
                      >
                        <BarChart3 className="h-3 w-3" />
                        {isExpanded ? "Less" : "Scores"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!hasSearched && !searchMutation.isPending && (
        <div className="text-center py-16">
          <Sparkles className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">
            AI-Powered People Discovery
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Describe who you&apos;re looking for. Our AI decomposes your intent,
            generates query variants, and ranks candidates across 6 scoring axes.
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {["AI startup founders in SF", "VC partners focused on SaaS", "CTO at fintech companies"].map((example) => (
              <Button
                key={example}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setQuery(example);
                  searchMutation.mutate({ query: example });
                }}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
