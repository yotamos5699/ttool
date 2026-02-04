import type { Stage, Job, NodeType, NodeKey } from "./types";

/* ----------------------------------
 * Node Key Helpers
 * ---------------------------------- */

export function toNodeKey(type: NodeType, id: number): NodeKey {
  return `${type}:${id}`;
}

export function parseNodeKey(key: NodeKey): { type: NodeType; id: number } {
  const [type, id] = key.split(":");
  return { type: type as NodeType, id: Number(id) };
}

/* ----------------------------------
 * Tree Traversal Helpers
 * ---------------------------------- */

export function findStage(stages: Stage[], id: number): Stage | undefined {
  for (const stage of stages) {
    if (stage.id === id) return stage;
    if (stage.childStages) {
      const found = findStage(stage.childStages, id);
      if (found) return found;
    }
  }
  return undefined;
}

function findJobInChildren(
  jobs: Job[] | undefined,
  id: number,
): Job | undefined {
  if (!jobs) return undefined;
  for (const job of jobs) {
    if (job.id === id) return job;
    const found = findJobInChildren(job.childJobs, id);
    if (found) return found;
  }
  return undefined;
}

export function findJob(stages: Stage[], id: number): Job | undefined {
  for (const stage of stages) {
    if (stage.jobs) {
      for (const job of stage.jobs) {
        if (job.id === id) return job;
        const found = findJobInChildren(job.childJobs, id);
        if (found) return found;
      }
    }
    if (stage.childStages) {
      const found = findJob(stage.childStages, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function getAllStages(stages: Stage[]): Stage[] {
  const result: Stage[] = [];
  for (const stage of stages) {
    result.push(stage);
    if (stage.childStages) {
      result.push(...getAllStages(stage.childStages));
    }
  }
  return result;
}

export function getAllJobs(stages: Stage[]): Job[] {
  const result: Job[] = [];

  function collectJobs(jobs: Job[] | undefined) {
    if (!jobs) return;
    for (const job of jobs) {
      result.push(job);
      collectJobs(job.childJobs);
    }
  }

  for (const stage of stages) {
    collectJobs(stage.jobs);
    if (stage.childStages) {
      result.push(...getAllJobs(stage.childStages));
    }
  }
  return result;
}

export function getAllJobsFromList(jobs: Job[]): Job[] {
  const result: Job[] = [];
  for (const job of jobs) {
    result.push(job);
    if (job.childJobs) {
      result.push(...getAllJobsFromList(job.childJobs));
    }
  }
  return result;
}
