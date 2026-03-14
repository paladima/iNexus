/**
 * PersonResolver — Ambiguity resolution component (#23 v15).
 * When voice parsing mentions a person name, this component queries
 * the backend for fuzzy matches and shows a selection dropdown
 * if multiple candidates are found.
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AlertCircle, Check, ChevronDown, User } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface PersonResolverProps {
  /** The name string from voice parsing */
  name: string;
  /** Called when user selects a resolved person (or null to keep original) */
  onResolve: (person: { id: number; fullName: string } | null) => void;
  /** Currently resolved person ID */
  resolvedPersonId?: number | null;
}

export function PersonResolver({ name, onResolve, resolvedPersonId }: PersonResolverProps) {
  const [open, setOpen] = useState(false);

  // Only query if we have a name
  const { data: candidates, isLoading } = trpc.voice.resolvePersonName.useQuery(
    { name },
    { enabled: !!name && name.trim().length > 0 }
  );

  const hasMultiple = (candidates?.length ?? 0) > 1;
  const bestMatch = candidates?.[0];
  const resolved = useMemo(() => {
    if (resolvedPersonId && candidates) {
      return candidates.find((c) => c.id === resolvedPersonId);
    }
    return null;
  }, [resolvedPersonId, candidates]);

  // Auto-resolve if there's exactly one strong match (similarity >= 0.85)
  useEffect(() => {
    if (!candidates || candidates.length === 0) return;
    if (resolvedPersonId) return; // already resolved
    const strong = candidates.filter((c) => c.similarity >= 0.85);
    if (strong.length === 1) {
      onResolve({ id: strong[0].id, fullName: strong[0].fullName });
    }
  }, [candidates, resolvedPersonId, onResolve]);

  if (isLoading) {
    return (
      <span className="text-xs text-muted-foreground ml-1">resolving...</span>
    );
  }

  // No matches found
  if (!candidates || candidates.length === 0) {
    return (
      <Badge variant="outline" className="ml-1 text-xs gap-1 text-amber-500 border-amber-500/30">
        <AlertCircle className="h-3 w-3" />
        New contact
      </Badge>
    );
  }

  // Single strong match — auto-resolved
  if (!hasMultiple && bestMatch && bestMatch.similarity >= 0.85) {
    return (
      <Badge variant="outline" className="ml-1 text-xs gap-1 text-green-500 border-green-500/30">
        <Check className="h-3 w-3" />
        Linked
      </Badge>
    );
  }

  // Multiple candidates or weak match — show selection
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs gap-1 ml-1 border-amber-500/30 text-amber-500 hover:text-amber-600"
        >
          <AlertCircle className="h-3 w-3" />
          {resolved ? resolved.fullName : `${candidates.length} matches`}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <p className="text-xs text-muted-foreground mb-2 px-1">
          Multiple contacts match &quot;{name}&quot;. Select the correct one:
        </p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onResolve({ id: c.id, fullName: c.fullName });
                setOpen(false);
              }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-accent transition-colors ${
                resolved?.id === c.id ? "bg-accent" : ""
              }`}
            >
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.fullName}</div>
                {(c.title || c.company) && (
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.title, c.company].filter(Boolean).join(" at ")}
                  </div>
                )}
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">
                {Math.round(c.similarity * 100)}%
              </Badge>
              {resolved?.id === c.id && (
                <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1 text-xs h-7"
          onClick={() => {
            onResolve(null);
            setOpen(false);
          }}
        >
          Keep as new contact
        </Button>
      </PopoverContent>
    </Popover>
  );
}
