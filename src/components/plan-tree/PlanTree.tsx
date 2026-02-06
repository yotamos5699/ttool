"use client";

import { FolderTree, Plus, ChevronDown, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { StageNode } from "./StageNode";
import { cn } from "@/lib/utils";
import { usePlanDataStore, useUIStore, useWSStore } from "@/stores/plan";
import { NodeStyleMarker } from "./NodeStyleMarker";

export function PlanTree() {
  const plan = usePlanDataStore((s) => s.plan);
  const setSelection = useUIStore((s) => s.selectNode);

  if (!plan) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const rootParts = plan.parts.filter((node) => node.type === "stage");

  const handleSelectPlan = () => {
    setSelection({ id: plan.id, mode: "focus" });
  };

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Plan Info */}
        <div
          className={cn(
            "px-4 relative py-2 border-b cursor-pointer hover:bg-muted/50 transition-colors",
            //  === "plan" && "bg-primary/10 border-l-2 border-l-primary",
          )}
          onPointerDown={handleSelectPlan}
        >
          <NodeStyleMarker nodeId={plan.id} type="plan" />

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
            {rootParts.length === 0 ? (
              <EmptyState />
            ) : (
              rootParts.map((stage) => (
                <StageNode key={stage.id} stage={stage} depth={0} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <FolderTree className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">No parts yet</p>
      <Button variant="outline" size="sm" className="mt-2">
        <Plus className="h-4 w-4 mr-1" />
        Add Part
      </Button>
    </div>
  );
}

export function ConnectionHeader() {
  const plan = usePlanDataStore((s) => s.plan);
  const allExpanded = useUIStore((s) => s.allExpanded);
  const toggleAllExpanded = useUIStore((s) => s.toggleAllExpanded);
  const wsState = useWSStore((s) => s.wsState);
  const roomSize = useWSStore((s) => s.roomSize);

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
