"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlanStore, type Stage } from "@/stores/planStore";
import { usePlanMutations } from "@/hooks/usePlanMutations";

type StageDetailFormProps = {
  stage: Stage;
  allStages: Stage[];
};

export function StageDetailForm({ stage, allStages }: StageDetailFormProps) {
  const [title, setTitle] = useState(stage.title);
  const [description, setDescription] = useState(stage.description || "");
  const [executionMode, setExecutionMode] = useState(stage.executionMode);
  const [dependsOnStages, setDependsOnStages] = useState<number[]>(
    stage.dependsOnStages,
  );

  const planId = usePlanStore((s) => s.plan?.id ?? 0);
  const { updateStage } = usePlanMutations(planId);

  // Get available stages for dependencies (exclude self and children)
  const availableDependencies = allStages.filter((s) => {
    if (s.id === stage.id) return false;
    if (s.parentStageId === stage.id) return false;
    return true;
  });

  const hasChanges =
    title !== stage.title ||
    description !== (stage.description || "") ||
    executionMode !== stage.executionMode ||
    JSON.stringify([...dependsOnStages].sort()) !==
      JSON.stringify([...stage.dependsOnStages].sort());

  const handleDependencyToggle = (stageId: number) => {
    const newDeps = dependsOnStages.includes(stageId)
      ? dependsOnStages.filter((id) => id !== stageId)
      : [...dependsOnStages, stageId];
    setDependsOnStages(newDeps);
  };

  const handleSave = () => {
    updateStage.mutate({
      id: stage.id,
      data: {
        title,
        description: description || null,
        executionMode,
        dependsOnStages,
      },
    });
  };

  const handleReset = () => {
    setTitle(stage.title);
    setDescription(stage.description || "");
    setExecutionMode(stage.executionMode);
    setDependsOnStages(stage.dependsOnStages);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Stage Details</h2>
        <Badge variant={executionMode === "parallel" ? "default" : "secondary"}>
          {executionMode}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="stage-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="stage-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Stage title"
            disabled={updateStage.isPending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="stage-description" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="stage-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this stage..."
            rows={3}
            disabled={updateStage.isPending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="execution-mode" className="text-sm font-medium">
            Execution Mode
          </label>
          <Select
            value={executionMode}
            onValueChange={(v) => setExecutionMode(v as "sequential" | "parallel")}
            disabled={updateStage.isPending}
          >
            <SelectTrigger id="execution-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">Sequential</SelectItem>
              <SelectItem value="parallel">Parallel</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {executionMode === "sequential"
              ? "Jobs run one after another"
              : "Jobs can run simultaneously"}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Dependencies</label>
          {availableDependencies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableDependencies.map((dep) => (
                <Badge
                  key={dep.id}
                  variant={dependsOnStages.includes(dep.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleDependencyToggle(dep.id)}
                >
                  {dep.title}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No other stages available for dependencies
            </p>
          )}
          {dependsOnStages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              This stage will wait for {dependsOnStages.length} stage(s) to complete
            </p>
          )}
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={updateStage.isPending} size="sm">
              {updateStage.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              disabled={updateStage.isPending}
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2">
        Stage ID: {stage.id}
        {stage.parentStageId && ` | Parent: ${stage.parentStageId}`}
      </div>
    </div>
  );
}
