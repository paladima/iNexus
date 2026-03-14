/**
 * ActionRail — Shared action button strip for any entity card (v9 Pillar 1)
 *
 * Provides consistent actions across Discover cards, People list, Person Profile,
 * Opportunity cards, and List items. Actions adapt based on entity context.
 */
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  UserPlus,
  ListPlus,
  FileText,
  CheckSquare,
  Phone,
  Users,
  Archive,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ActionRailProps {
  /** Is the person already saved in contacts? */
  isSaved?: boolean;
  /** Available actions based on entity context */
  actions?: string[];
  /** Callbacks */
  onSave?: () => void;
  onAddToList?: () => void;
  onGenerateDraft?: () => void;
  onCreateTask?: () => void;
  onMarkContacted?: () => void;
  onAskForIntro?: () => void;
  onArchive?: () => void;
  /** Loading states */
  savePending?: boolean;
  draftPending?: boolean;
  taskPending?: boolean;
  contactPending?: boolean;
  introPending?: boolean;
  /** Compact mode for list items */
  compact?: boolean;
}

const ACTION_CONFIG = {
  save_person: { icon: UserPlus, label: "Save", color: "text-green-500" },
  add_to_list: { icon: ListPlus, label: "Add to List", color: "text-blue-500" },
  generate_draft: { icon: FileText, label: "Draft", color: "text-purple-500" },
  create_task: { icon: CheckSquare, label: "Task", color: "text-orange-500" },
  mark_contacted: { icon: Phone, label: "Contacted", color: "text-teal-500" },
  ask_for_intro: { icon: Users, label: "Ask Intro", color: "text-pink-500" },
  archive_opportunity: { icon: Archive, label: "Archive", color: "text-muted-foreground" },
  mark_opportunity_acted: { icon: CheckSquare, label: "Mark Done", color: "text-green-500" },
};

export default function ActionRail({
  isSaved = false,
  actions = ["save_person", "add_to_list", "generate_draft", "create_task"],
  onSave,
  onAddToList,
  onGenerateDraft,
  onCreateTask,
  onMarkContacted,
  onAskForIntro,
  onArchive,
  savePending,
  draftPending,
  taskPending,
  contactPending,
  introPending,
  compact = false,
}: ActionRailProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    save_person: onSave,
    add_to_list: onAddToList,
    generate_draft: onGenerateDraft,
    create_task: onCreateTask,
    mark_contacted: onMarkContacted,
    ask_for_intro: onAskForIntro,
    archive_opportunity: onArchive,
    mark_opportunity_acted: onArchive,
  };

  const pendingStates: Record<string, boolean | undefined> = {
    save_person: savePending,
    generate_draft: draftPending,
    create_task: taskPending,
    mark_contacted: contactPending,
    ask_for_intro: introPending,
  };

  // Filter out save_person if already saved
  const visibleActions = actions.filter((a) => {
    if (a === "save_person" && isSaved) return false;
    return true;
  });

  // In compact mode, show first 3 actions inline + overflow menu
  const inlineActions = compact ? visibleActions.slice(0, 3) : visibleActions.slice(0, 5);
  const overflowActions = compact ? visibleActions.slice(3) : visibleActions.slice(5);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1">
        {inlineActions.map((actionKey) => {
          const config = ACTION_CONFIG[actionKey as keyof typeof ACTION_CONFIG];
          if (!config) return null;
          const Icon = config.icon;
          const handler = handlers[actionKey];
          const isPending = pendingStates[actionKey];

          return (
            <Tooltip key={actionKey}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${config.color} hover:bg-secondary`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handler?.();
                  }}
                  disabled={isPending || !handler}
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {config.label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {overflowActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflowActions.map((actionKey) => {
                const config = ACTION_CONFIG[actionKey as keyof typeof ACTION_CONFIG];
                if (!config) return null;
                const Icon = config.icon;
                const handler = handlers[actionKey];

                return (
                  <DropdownMenuItem
                    key={actionKey}
                    onClick={() => handler?.()}
                    disabled={!handler}
                  >
                    <Icon className={`h-4 w-4 mr-2 ${config.color}`} />
                    {config.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </TooltipProvider>
  );
}
