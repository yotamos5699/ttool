"use client";
import {
  ChevronRight,
  ChevronDown,
  Briefcase,
  Plus,
  Copy,
  Trash2,
  Link,
  FileText,
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
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { InlineText } from "@/components/inline-edit/InlineText";
import { usePlanDataStore, useUIStore, PlanNode } from "@/stores/plan";
import { usePlanMutations } from "@/hooks/usePlanMutations";
import { handlePointerDown } from "./helper";
import { toggleExpandNode } from "@/stores/plan/uiStore";
import { useIsOpen } from "@/hooks/useIsOpen";

type JobNodeProps = {
  job: PlanNode;
  depth: number;
};

export function JobNode({ job, depth }: JobNodeProps) {
  // Get state from store

  const { updateJob } = usePlanMutations();

  const childJobs = job.childNodes?.filter((node) => node.type === "job") ?? [];
  const hasChildren = childJobs.length > 0;

  const isOpen = useIsOpen(job.id);
  return (
    <Collapsible open={isOpen} onOpenChange={() => toggleExpandNode(job.id)}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={
              " relative flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group transition-colors"
            }
            style={{ marginLeft: depth * 20 }}
            onPointerDown={(event) => {
              handlePointerDown(event, job.id);
            }}
          >
            {/* Expand/Collapse */}
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-5 w-5 opacity-70"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {hasChildren ? (
                  isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )
                ) : (
                  <span className="w-3" />
                )}
              </Button>
            </CollapsibleTrigger>

            {/* Icon */}
            <Briefcase className="h-4 w-4 text-job shrink-0" />

            {/* Title */}
            <InlineText
              value={job.title}
              onChange={(title) => updateJob.mutate({ id: job.id, data: { title } })}
              className="flex-1 text-sm"
            />

            {/* Badges */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {job.dependencies.includeDependencyIds.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  <Link className="h-2.5 w-2.5 mr-0.5" />
                  {job.dependencies.includeDependencyIds.length}
                </Badge>
              )}
              {(job.contextNodes?.length || 0) > 0 && (
                <Badge variant="context" className="text-[10px] px-1 py-0">
                  <FileText className="h-2.5 w-2.5 mr-0.5" />
                  {job.contextNodes?.length}
                </Badge>
              )}
            </div>
          </div>
        </ContextMenuTrigger>

        <JobContextMenu job={job} />
      </ContextMenu>

      {/* Child Jobs */}
      <CollapsibleContent>
        {childJobs.map((childJob) => (
          <JobNode key={childJob.id} job={childJob} depth={depth + 1} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function JobContextMenu({ job }: { job: PlanNode }) {
  const plan = usePlanDataStore((s) => s.plan);
  const selectNode = useUIStore((s) => s.selectNode);
  const parentStage = usePlanDataStore((s) => {
    const parts = s.plan?.parts ?? [];
    const findParentStage = (
      nodes: PlanNode[],
      targetId: number,
      stageAncestor: PlanNode | null,
    ): PlanNode | null => {
      for (const node of nodes) {
        const nextStage = node.type === "stage" ? node : stageAncestor;
        if (node.childNodes?.some((child) => child.id === targetId)) {
          return nextStage;
        }
        if (node.childNodes) {
          const found = findParentStage(node.childNodes, targetId, nextStage);
          if (found) return found;
        }
      }
      return null;
    };
    return findParentStage(parts, job.id, null);
  });

  const { createJob, deleteJob, duplicateJob, createContext } = usePlanMutations();

  const handleAddChildJob = () => {
    if (!parentStage) return;
    createJob.mutate({
      parentStageId: parentStage.id,
      parentJobId: job.id,
      title: "New Sub-Job",
    });
  };

  const handleAddContext = () => {
    createContext.mutate({
      targetType: "job",
      targetId: job.id,
      title: "New Context",
      type: "rule",
    });
  };

  const handleDuplicate = () => {
    duplicateJob.mutate(job.id);
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    deleteJob.mutate(job.id);
  };

  const handleReplanFromHere = () => {
    console.log("[WS] Replan from job:", job.id);
    if (plan) selectNode({ id: job.id, mode: "focus" });
  };

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={handleAddChildJob}>
        <Plus className="h-4 w-4 mr-2" />
        Add Sub-Job
      </ContextMenuItem>
      <ContextMenuItem onClick={handleAddContext}>
        <FileText className="h-4 w-4 mr-2" />
        Add Context
      </ContextMenuItem>
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
