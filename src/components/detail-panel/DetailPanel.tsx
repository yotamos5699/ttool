"use client";

import { PlanDetailForm } from "./PlanDetailForm";
import { StageDetailForm } from "./StageDetailForm";
import { JobDetailForm } from "./JobDetailForm";
import { ContextNodeList } from "./ContextNodeList";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  usePlanStore,
  findStage,
  findJob,
  getAllStages,
  getAllJobsFromList,
} from "@/stores/planStore";

export function DetailPanel() {
  const plan = usePlanStore((s) => s.plan);
  const selection = usePlanStore((s) => s.selection);
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

  if (!selection) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select a node from the tree to view details
      </div>
    );
  }

  const selectedNodes = selectedNodesByPlan[plan.id] || [];
  const blastRadius = blastRadiusByPlan[plan.id] || [];

  const allStages = getAllStages(plan.stages);

  // Render plan detail
  if (selection.type === "plan") {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <PlanDetailForm />
          <Separator />
          <ContextNodeList
            contextNodes={plan.contextNodes}
            targetId={plan.id}
            targetType="plan"
          />
          <BlastRadiusClearButton
            count={blastRadius.length}
            selectedCount={selectedNodes.length}
            onClear={() => clearSelections(plan.id)}
          />
        </div>
      </ScrollArea>
    );
  }

  // Render stage detail
  if (selection.type === "stage") {
    const stage = findStage(plan.stages, selection.id);
    if (!stage) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Stage not found
        </div>
      );
    }

    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <StageDetailForm stage={stage} allStages={allStages} />
          <Separator />
          <ContextNodeList
            contextNodes={stage.contextNodes || []}
            targetId={stage.id}
            targetType="stage"
          />
          <BlastRadiusClearButton
            count={blastRadius.length}
            selectedCount={selectedNodes.length}
            onClear={() => clearSelections(plan.id)}
          />
        </div>
      </ScrollArea>
    );
  }

  // Render job detail
  if (selection.type === "job") {
    const job = findJob(plan.stages, selection.id);
    if (!job) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Job not found
        </div>
      );
    }

    // Get jobs from same stage for dependency selection
    const stage = allStages.find((s) => s.id === job.stageId);
    const stageJobs = stage?.jobs ? getAllJobsFromList(stage.jobs) : [];

    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <JobDetailForm job={job} stageJobs={stageJobs} allStages={allStages} />
          <Separator />
          <ContextNodeList
            contextNodes={job.contextNodes || []}
            targetId={job.id}
            targetType="job"
          />
          <BlastRadiusClearButton
            count={blastRadius.length}
            selectedCount={selectedNodes.length}
            onClear={() => clearSelections(plan.id)}
          />
        </div>
      </ScrollArea>
    );
  }

  return null;
}

function BlastRadiusClearButton({
  count,
  selectedCount,
  onClear,
}: {
  count: number;
  selectedCount: number;
  onClear: () => void;
}) {
  if (count === 0 && selectedCount === 0) return null;

  return (
    <div className="pt-4">
      <button
        onClick={onClear}
        className="text-sm text-orange-500 hover:underline"
      >
        Clear selection ({selectedCount} selected, {count} affected)
      </button>
    </div>
  );
}
