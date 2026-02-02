"use client";

import {
  FolderTree,
  Plus,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { StageNode } from "./StageNode";
import { cn } from "@/lib/utils";
import { usePlanStore } from "@/stores/planStore";
import { SelectionStats } from "@/components/plan-tree/SelectionStats";

export function PlanTree() {
  const plan = usePlanStore((s) => s.plan);
  const selection = usePlanStore((s) => s.selection);
  const setSelection = usePlanStore((s) => s.setSelection);
  const selectedNodesByPlan = usePlanStore((s) => s.selectedNodesByPlan);
  const blastRadiusByPlan = usePlanStore((s) => s.blastRadiusByPlan);
  const clearSelections = usePlanStore((s) => s.clearSelections);

  if (!plan) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  // Filter to root stages only (no parent)
  const rootStages = plan.stages.filter((s) => !s.parentStageId);

  const handleSelectPlan = () => {
    setSelection({ id: plan.id, type: "plan" });
  };

  const selectedNodes = selectedNodesByPlan[plan.id] || [];
  const blastRadius = blastRadiusByPlan[plan.id] || [];

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Plan Info */}
        <div
          className={cn(
            "px-4 py-2 border-b cursor-pointer hover:bg-muted/50 transition-colors",
            selection?.type === "plan" && "bg-primary/10 border-l-2 border-l-primary",
          )}
          onClick={handleSelectPlan}
        >
          <div className="font-medium truncate">{plan.name}</div>
          <div className="text-xs text-muted-foreground truncate">{plan.goal}</div>
          {plan.contextNodes.length > 0 && (
            <Badge variant="context" className="text-[10px] mt-1">
              {plan.contextNodes.length} context nodes
            </Badge>
          )}
        </div>

        <Separator />

        {/* Tree */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {rootStages.length === 0 ? (
              <EmptyState />
            ) : (
              rootStages.map((stage) => (
                <StageNode key={stage.id} stage={stage} depth={0} />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Blast Radius Indicator */}
      {(blastRadius.length > 0 || selectedNodes.length > 0) && (
        <BlastRadiusBar
          blastCount={blastRadius.length}
          selectedCount={selectedNodes.length}
          onClearSelections={() => clearSelections(plan.id)}
        />
      )}
      </div>
      <SelectionStats
        selectedCount={selectedNodes.length}
        blastCount={blastRadius.length}
        onClearSelections={() => clearSelections(plan.id)}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <FolderTree className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">No stages yet</p>
      <Button variant="outline" size="sm" className="mt-2">
        <Plus className="h-4 w-4 mr-1" />
        Add Stage
      </Button>
    </div>
  );
}

function BlastRadiusBar({
  blastCount,
  selectedCount,
  onClearSelections,
}: {
  blastCount: number;
  selectedCount: number;
  onClearSelections: () => void;
}) {
  return (
    <div className="px-4 py-2 border-t bg-card text-xs flex items-center justify-between">
      <div className="flex items-center gap-2 text-warning">
        <RefreshCw className="h-4 w-4" />
        <span>Blast radius: {blastCount} nodes</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">
          Selected: {selectedCount}
        </span>
        <Button variant="outline" size="sm" onClick={onClearSelections}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}

export function ConnectionHeader() {
  const plan = usePlanStore((s) => s.plan);
  const allExpanded = usePlanStore((s) => s.allExpanded);
  const toggleAllExpanded = usePlanStore((s) => s.toggleAllExpanded);
  const wsState = usePlanStore((s) => s.wsState);
  const roomSize = usePlanStore((s) => s.roomSize);

  const isConnected = wsState === "OPEN";

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div className="flex items-center gap-2">
        <FolderTree className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-semibold">Plan Tree</h2>
        {plan && (
          <Badge variant="outline" className="text-xs">
            v{plan.version}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-gray-400",
            )}
          />
          {roomSize > 0 && (
            <>
              <Users className="h-3 w-3" />
              {roomSize}
            </>
          )}
        </div>
        {/* Actions */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleAllExpanded}
          title={allExpanded ? "Collapse all" : "Expand all"}
        >
          {allExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon-sm" title="Add root stage">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
