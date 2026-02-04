"use client";

import { useMemo } from "react";
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
import { usePlanDataStore, useUIStore, Job } from "@/stores/plan";
import { usePlanMutations } from "@/hooks/usePlanMutations";
import { handlePointerDown, useNodeStyle } from "./helper";
import { NodeStyleMarker } from "./NodeStyleMarker";

type JobNodeProps = {
  job: Job;
  depth: number;
};

export function JobNode({ job, depth }: JobNodeProps) {
  // Get state from store

  const planId = usePlanDataStore((s) => s.plan?.id ?? 0);
  const allExpanded = useUIStore((s) => s.allExpanded);
  const openJobsByPlan = useUIStore((s) => s.openJobsByPlan);
  const setJobOpen = useUIStore((s) => s.setJobOpen);

  const { updateJob } = usePlanMutations(planId);

  const hasChildren = (job.childJobs?.length || 0) > 0;

  const isOpen = useMemo(() => {
    if (allExpanded) return true;
    const planOpenStates = openJobsByPlan[planId];
    return planOpenStates?.[job.id] ?? true;
  }, [allExpanded, openJobsByPlan, planId, job.id]);
  // const style = useNodeStyle(planId, job.id, "job");
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(nextOpen) => setJobOpen(planId, job.id, nextOpen)}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={
              " relative flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group transition-colors"
            }
            style={{ marginLeft: depth * 20 }}
            onPointerDown={(event) => {
              handlePointerDown(event, planId, job.id, "job");
            }}
          >
            <NodeStyleMarker nodeId={job.id} planId={planId} type="job" />
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
              {job.dependsOnJobs.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  <Link className="h-2.5 w-2.5 mr-0.5" />
                  {job.dependsOnJobs.length}
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
        {job.childJobs?.map((childJob) => (
          <JobNode key={childJob.id} job={childJob} depth={depth + 1} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function JobContextMenu({ job }: { job: Job }) {
  const plan = usePlanDataStore((s) => s.plan);
  const planId = plan?.id ?? 0;
  const selectNode = useUIStore((s) => s.selectNode);

  const { createJob, deleteJob, duplicateJob, createContext } = usePlanMutations(planId);

  const handleAddChildJob = () => {
    createJob.mutate({
      stageId: job.stageId,
      parentJobId: job.id,
      title: "New Sub-Job",
    });
  };

  const handleAddContext = () => {
    createContext.mutate({
      targetType: "job",
      targetId: job.id,
      title: "New Context",
      type: "note",
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
    if (plan) selectNode({ plan, type: "job", id: job.id, mode: "replace" });
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
