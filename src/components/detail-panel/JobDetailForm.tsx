"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanDataStore, type Job, type Stage } from "@/stores/plan";
import { usePlanMutations } from "@/hooks/usePlanMutations";

type JobDetailFormProps = {
  job: Job;
  stageJobs: Job[];
  allStages: Stage[];
};

export function JobDetailForm({ job, stageJobs, allStages }: JobDetailFormProps) {
  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description || "");
  const [dependsOnJobs, setDependsOnJobs] = useState<number[]>(
    job.dependsOnJobs,
  );
  const [dependsOnStages, setDependsOnStages] = useState<number[]>(
    job.dependsOnStages,
  );

  const planId = usePlanDataStore((s) => s.plan?.id ?? 0);
  const { updateJob } = usePlanMutations(planId);

  // Get available jobs for dependencies (exclude self and children)
  const availableDependencies = stageJobs.filter((j) => {
    if (j.id === job.id) return false;
    if (j.parentJobId === job.id) return false;
    return true;
  });

  const availableStageDependencies = allStages.filter(
    (stage) => stage.id !== job.stageId,
  );

  const hasChanges =
    title !== job.title ||
    description !== (job.description || "") ||
    JSON.stringify([...dependsOnJobs].sort()) !==
      JSON.stringify([...job.dependsOnJobs].sort()) ||
    JSON.stringify([...dependsOnStages].sort()) !==
      JSON.stringify([...job.dependsOnStages].sort());

  const handleDependencyToggle = (jobId: number) => {
    const newDeps = dependsOnJobs.includes(jobId)
      ? dependsOnJobs.filter((id) => id !== jobId)
      : [...dependsOnJobs, jobId];
    setDependsOnJobs(newDeps);
  };

  const handleStageDependencyToggle = (stageId: number) => {
    const newDeps = dependsOnStages.includes(stageId)
      ? dependsOnStages.filter((id) => id !== stageId)
      : [...dependsOnStages, stageId];
    setDependsOnStages(newDeps);
  };

  const handleSave = () => {
    updateJob.mutate({
      id: job.id,
      data: {
        title,
        description: description || null,
        dependsOnJobs,
        dependsOnStages,
      },
    });
  };

  const handleReset = () => {
    setTitle(job.title);
    setDescription(job.description || "");
    setDependsOnJobs(job.dependsOnJobs);
    setDependsOnStages(job.dependsOnStages);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Job Details</h2>
        {job.parentJobId && <Badge variant="outline">Sub-job</Badge>}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="job-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="job-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Job title"
            disabled={updateJob.isPending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="job-description" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="job-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this job..."
            rows={3}
            disabled={updateJob.isPending}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Job Dependencies</label>
          {availableDependencies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableDependencies.map((dep) => (
                <Badge
                  key={dep.id}
                  variant={dependsOnJobs.includes(dep.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleDependencyToggle(dep.id)}
                >
                  {dep.title}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No other jobs available for dependencies
            </p>
          )}
          {dependsOnJobs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              This job will wait for {dependsOnJobs.length} job(s) to complete
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Stage Dependencies</label>
          {availableStageDependencies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableStageDependencies.map((dep) => (
                <Badge
                  key={dep.id}
                  variant={dependsOnStages.includes(dep.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleStageDependencyToggle(dep.id)}
                >
                  {dep.title}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No stages available for dependencies
            </p>
          )}
          {dependsOnStages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              This job will wait for {dependsOnStages.length} stage(s) to complete
            </p>
          )}
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={updateJob.isPending} size="sm">
              {updateJob.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              disabled={updateJob.isPending}
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2">
        Job ID: {job.id} | Stage ID: {job.stageId}
        {job.parentJobId && ` | Parent Job: ${job.parentJobId}`}
      </div>
    </div>
  );
}
