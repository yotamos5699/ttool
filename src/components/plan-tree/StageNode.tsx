"use client";

import {
  ChevronRight,
  ChevronDown,
  Layers,
  Play,
  Pause,
  Plus,
  Copy,
  Trash2,
  Link,
  FileText,
  Settings,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { InlineText } from "@/components/inline-edit/InlineText";
import { JobNode } from "./JobNode";
import { cn } from "@/lib/utils";
import { usePlanDataStore, useUIStore, PlanNode } from "@/stores/plan";
import { usePlanMutations } from "@/hooks/usePlanMutations";
import { handlePointerDown } from "./helper";
import { toggleExpandNode } from "@/stores/plan/uiStore";
import { useIsOpen } from "@/hooks/useIsOpen";

type StageNodeProps = {
  stage: PlanNode;
  depth: number;
};

export function StageNode({ stage, depth }: StageNodeProps) {
  // Get state from store

  const { updateStage } = usePlanMutations();

  const childStages = stage.childNodes?.filter((node) => node.type === "stage") ?? [];
  const childJobs = stage.childNodes?.filter((node) => node.type === "job") ?? [];
  const hasChildren = childStages.length > 0 || childJobs.length > 0;

  // Filter to root jobs only (no parent)
  const rootJobs = childJobs;

  const isOpen = useIsOpen(stage.id);
  console.log("Rendering StageNode:", { stageId: stage.id, isOpen });
  return (
    <Collapsible open={isOpen} onOpenChange={() => toggleExpandNode(stage.id)}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={
              " relative flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group transition-colors"
            }
            style={{ marginLeft: depth * 20 }}
            onPointerDown={(event) => {
              handlePointerDown(event, stage.id);
            }}
          >
            {/* Expand/Collapse */}
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-5 w-5 opacity-70"
                onClick={(e) => e.stopPropagation()}
              >
                {hasChildren ? (
                  isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )
                ) : (
                  <span className="w-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>

            {/* Icon */}
            <Layers className="h-4 w-4 text-stage shrink-0" />

            {/* Title */}
            <InlineText
              value={stage.title}
              onChange={(title) => updateStage.mutate({ id: stage.id, data: { title } })}
              className="flex-1 font-medium"
            />

            {/* Execution Mode Badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                stage.executionMode === "parallel" &&
                  "border-green-500/50 text-green-600",
              )}
            >
              {stage.executionMode === "parallel" ? (
                <Play className="h-2.5 w-2.5 mr-0.5" />
              ) : (
                <Pause className="h-2.5 w-2.5 mr-0.5" />
              )}
              {stage.executionMode === "parallel" ? "par" : "seq"}
            </Badge>

            {/* Other Badges */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {stage.dependencies.includeDependencyIds.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  <Link className="h-2.5 w-2.5 mr-0.5" />
                  {stage.dependencies.includeDependencyIds.length}
                </Badge>
              )}
              {(stage.contextNodes?.length || 0) > 0 && (
                <Badge variant="context" className="text-[10px] px-1 py-0">
                  <FileText className="h-2.5 w-2.5 mr-0.5" />
                  {stage.contextNodes?.length}
                </Badge>
              )}
            </div>
          </div>
        </ContextMenuTrigger>

        <StageContextMenu stage={stage} />
      </ContextMenu>

      {/* Children */}
      <CollapsibleContent>
        {/* Child Stages */}
        {childStages.map((childStage) => (
          <StageNode key={childStage.id} stage={childStage} depth={depth + 1} />
        ))}

        {/* Jobs */}
        {rootJobs.map((job) => (
          <JobNode key={job.id} job={job} depth={depth + 1} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function StageContextMenu({ stage }: { stage: PlanNode }) {
  const plan = usePlanDataStore((s) => s.plan);
  const selectNode = useUIStore((s) => s.selectNode);

  const {
    createStage,
    updateStage,
    deleteStage,
    duplicateStage,
    createJob,
    createContext,
  } = usePlanMutations();

  const handleAddChildStage = () => {
    createStage.mutate({ parentStageId: stage.id, title: "New Part" });
  };

  const handleAddJob = () => {
    createJob.mutate({ parentStageId: stage.id, title: "New Job" });
  };

  const handleAddContext = () => {
    createContext.mutate({
      targetType: "stage",
      targetId: stage.id,
      title: "New Context",
      type: "rule",
    });
  };

  const handleConfigureIO = () => {
    console.log("[WS] Configure IO for stage:", stage.id);
  };

  const handleDuplicate = () => {
    duplicateStage.mutate(stage.id);
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this stage?")) return;
    deleteStage.mutate(stage.id);
  };

  const handleReplanFromHere = () => {
    console.log("[WS] Replan from stage:", stage.id);
    if (plan) selectNode({ id: stage.id, mode: "focus" });
  };

  const handleExecutionModeChange = (mode: "sequential" | "parallel") => {
    updateStage.mutate({ id: stage.id, data: { executionMode: mode } });
  };

  return (
    <ContextMenuContent className="w-52">
      <ContextMenuItem onClick={handleAddChildStage}>
        <Plus className="h-4 w-4 mr-2" />
        Add Child Part
      </ContextMenuItem>
      <ContextMenuItem onClick={handleAddJob}>
        <Plus className="h-4 w-4 mr-2" />
        Add Job
      </ContextMenuItem>
      <ContextMenuItem onClick={handleAddContext}>
        <FileText className="h-4 w-4 mr-2" />
        Add Context
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleConfigureIO}>
        <Settings className="h-4 w-4 mr-2" />
        Configure IO Envelope
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>Execution Mode</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onClick={() => handleExecutionModeChange("sequential")}>
            <Pause className="h-4 w-4 mr-2" />
            Sequential
            {stage.executionMode === "sequential" && " ✓"}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleExecutionModeChange("parallel")}>
            <Play className="h-4 w-4 mr-2" />
            Parallel
            {stage.executionMode === "parallel" && " ✓"}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleDuplicate}>
        <Copy className="h-4 w-4 mr-2" />
        Duplicate
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem className="text-warning" onClick={handleReplanFromHere}>
        Replan from here
      </ContextMenuItem>
      <ContextMenuItem className="text-destructive" onClick={handleDelete}>
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
