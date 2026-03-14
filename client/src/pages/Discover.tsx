import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, UserPlus, Loader2, Sparkles, Globe, Brain,
  ChevronDown, ChevronUp, BarChart3, Languages, AlertTriangle,
  ListPlus, FileText, CheckSquare, Users,
} from "lucide-react";
import { useState, useMemo } from "react";
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
  const [normalization, setNormalization] = useState<any>(null);
  const [usedBroadFallback, setUsedBroadFallback] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [showIntent, setShowIntent] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const searchMutation = trpc.discover.search.useMutation({
    onSuccess: (data) => {
      setResults(data.results ?? []);
      setIntent(data.intent ?? null);
      setQueryVariants(data.queryVariants ?? []);
      setNormalization((data as any).normalization ?? null);
      setUsedBroadFallback((data as any).usedBroadFallback ?? false);
      setHasSearched(true);
      setExpandedCards(new Set());
      setSelectedIndices(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkSaveMutation = trpc.discover.bulkSave.useMutation({
    onSuccess: (data) => {
      toast.success(`Saved ${data.count} people (${data.skipped + data.matched} skipped as duplicates)`);
      setSelectedIndices(new Set());
    },
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

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIndices.size === results.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(results.map((_, i) => i)));
    }
  };

  const selectedPeople = useMemo(
    () => Array.from(selectedIndices).map((i) => results[i]).filter(Boolean),
    [selectedIndices, results]
  );

  const handleBulkSave = () => {
    if (selectedPeople.length === 0) return;
    bulkSaveMutation.mutate({
      people: selectedPeople.map((p: any) => ({
        fullName: p.fullName,
        title: p.title,
        company: p.company,
        location: p.location,
        linkedinUrl: p.linkedinUrl,
        websiteUrl: p.websiteUrl,
        sourceType: p.sourceType ?? "discovery",
        relevanceScore: p.relevanceScore?.toString(),
      })),
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
          Find relevant professionals using AI-powered multi-query discovery with intent decomposition and role-aware ranking.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="e.g., welding instructors in Florida, patent attorneys in NYC, AI startup founders..."
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

      {/* Normalization Info (#3) */}
      {normalization && normalization.language !== "en" && hasSearched && !searchMutation.isPending && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-3 flex items-center gap-2">
            <Languages className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="text-sm text-blue-300">
              Translated from <strong>{normalization.language.toUpperCase()}</strong>: &quot;{normalization.original}&quot; → &quot;{normalization.normalized}&quot;
            </span>
          </CardContent>
        </Card>
      )}

      {/* Broad Fallback Indicator (#1) */}
      {usedBroadFallback && hasSearched && !searchMutation.isPending && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="text-sm text-yellow-300">
              Narrow search returned few results. Showing broader matches with relaxed constraints.
            </span>
          </CardContent>
        </Card>
      )}

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
              <Badge variant="secondary" className="text-xs ml-2">
                {queryVariants.length} query variants
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {results.length} results
              </Badge>
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
                  {intent.skills?.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Skills: {intent.skills.join(", ")}
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
            Normalizing query, expanding variants, and ranking candidates...
          </p>
        </div>
      )}

      {/* No Results */}
      {!searchMutation.isPending && hasSearched && results.length === 0 && (
        <div className="text-center py-16">
          <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            No results found. Try a different search query or broader terms.
          </p>
        </div>
      )}

      {/* Bulk Actions Bar (#5-6) */}
      {results.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={selectAll} className="gap-1.5 text-xs">
              <CheckSquare className="h-3.5 w-3.5" />
              {selectedIndices.size === results.length ? "Deselect All" : "Select All"}
            </Button>
            <span className="text-sm text-muted-foreground">
              Found {results.length} people{selectedIndices.size > 0 ? `, ${selectedIndices.size} selected` : ""}
            </span>
          </div>
          {selectedIndices.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleBulkSave}
                disabled={bulkSaveMutation.isPending}
                className="gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                Save {selectedIndices.size} to Contacts
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast("Feature coming soon", { description: "Bulk add to list from discovery" })}
                className="gap-1.5"
              >
                <ListPlus className="h-3.5 w-3.5" />
                Add to List
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast("Feature coming soon", { description: "Bulk generate drafts from discovery" })}
                className="gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Generate Drafts
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((person: any, index: number) => {
            const scoring: ScoringBreakdown = person.scoring ?? {};
            const matchReasons: string[] = person.matchReasons ?? [];
            const isExpanded = expandedCards.has(index);
            const isSelected = selectedIndices.has(index);

            return (
              <Card
                key={index}
                className={`hover:border-primary/30 transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Selection Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(index)}
                        className="mt-1.5 shrink-0"
                      />
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
                          {person.sourceQuery && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              via: {person.sourceQuery.length > 30 ? person.sourceQuery.slice(0, 30) + "..." : person.sourceQuery}
                            </Badge>
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
                            {matchReasons.slice(0, isExpanded ? matchReasons.length : 3).map((reason, i) => (
                              <Badge key={i} variant="outline" className="text-xs text-primary/80 border-primary/30">
                                {reason}
                              </Badge>
                            ))}
                            {!isExpanded && matchReasons.length > 3 && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                +{matchReasons.length - 3} more
                              </Badge>
                            )}
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
                          bulkSaveMutation.mutate({
                            people: [{
                              fullName: person.fullName,
                              title: person.title,
                              company: person.company,
                              location: person.location,
                              linkedinUrl: person.linkedinUrl,
                              websiteUrl: person.websiteUrl,
                              sourceType: person.sourceType ?? "discovery",
                              relevanceScore: person.relevanceScore?.toString(),
                            }],
                          })
                        }
                        disabled={bulkSaveMutation.isPending}
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
            Describe who you&apos;re looking for in any language. Our AI normalizes your query,
            generates 8-15 search variants, and ranks candidates across 6 scoring axes.
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {[
              "AI startup founders in SF",
              "Patent attorneys in New York",
              "Welding instructors in Florida",
              "VC partners focused on SaaS",
              "Cardiologists in Boston",
            ].map((example) => (
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
