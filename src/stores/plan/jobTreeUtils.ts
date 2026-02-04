import type { Stage, Job } from "./types";

/* ----------------------------------
 * Job Tree Operations
 * ---------------------------------- */

export function updateJobRecursive(
  job: Job,
  targetId: number,
  data: Partial<Job>,
): Job {
  if (job.id === targetId) {
    return { ...job, ...data };
  }
  if (job.childJobs) {
    return {
      ...job,
      childJobs: job.childJobs.map((child) =>
        updateJobRecursive(child, targetId, data),
      ),
    };
  }
  return job;
}

export function updateJobInStages(
  stages: Stage[],
  jobId: number,
  data: Partial<Job>,
): Stage[] {
  return stages.map((stage) => {
    const updatedJobs = stage.jobs?.map((job) =>
      updateJobRecursive(job, jobId, data),
    );
    const updatedChildStages = stage.childStages
      ? updateJobInStages(stage.childStages, jobId, data)
      : undefined;

    return {
      ...stage,
      jobs: updatedJobs,
      childStages: updatedChildStages,
    };
  });
}

export function deleteJobRecursive(job: Job, targetId: number): Job | null {
  if (job.id === targetId) {
    return null;
  }
  if (job.childJobs) {
    return {
      ...job,
      childJobs: job.childJobs
        .map((child) => deleteJobRecursive(child, targetId))
        .filter((child): child is Job => child !== null),
    };
  }
  return job;
}

export function deleteJobFromStages(stages: Stage[], jobId: number): Stage[] {
  return stages.map((stage) => {
    const filteredJobs = stage.jobs
      ?.map((job) => deleteJobRecursive(job, jobId))
      .filter((job): job is Job => job !== null);

    const updatedChildStages = stage.childStages
      ? deleteJobFromStages(stage.childStages, jobId)
      : undefined;

    return {
      ...stage,
      jobs: filteredJobs,
      childStages: updatedChildStages,
    };
  });
}

function addJobToParent(job: Job, newJob: Job, parentId: number): Job {
  if (job.id === parentId) {
    return {
      ...job,
      childJobs: [...(job.childJobs || []), newJob],
    };
  }
  if (job.childJobs) {
    return {
      ...job,
      childJobs: job.childJobs.map((child) =>
        addJobToParent(child, newJob, parentId),
      ),
    };
  }
  return job;
}

export function addJobToStages(
  stages: Stage[],
  job: Job,
  stageId: number,
  parentJobId: number | null,
): Stage[] {
  return stages.map((stage) => {
    if (stage.id === stageId) {
      if (!parentJobId) {
        return {
          ...stage,
          jobs: [...(stage.jobs || []), job],
        };
      }
      return {
        ...stage,
        jobs: stage.jobs?.map((j) => addJobToParent(j, job, parentJobId)),
      };
    }
    if (stage.childStages) {
      return {
        ...stage,
        childStages: addJobToStages(
          stage.childStages,
          job,
          stageId,
          parentJobId,
        ),
      };
    }
    return stage;
  });
}
