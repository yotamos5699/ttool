import type { Plan, Stage, Job, NodeKey, NodeType } from "./types";
import {
  toNodeKey,
  findStage,
  findJob,
  getAllStages,
  getAllJobs,
} from "./planSelectors";

// Re-export for convenience
export { toNodeKey, parseNodeKey } from "./planSelectors";
export { findStage, findJob, getAllStages, getAllJobs, getAllJobsFromList } from "./planSelectors";

/* ----------------------------------
 * Selection Key Collection
 * ---------------------------------- */

function collectJobSelectionKeys(job: Job): NodeKey[] {
  const keys: NodeKey[] = [toNodeKey("job", job.id)];
  if (job.childJobs) {
    for (const child of job.childJobs) {
      keys.push(...collectJobSelectionKeys(child));
    }
  }
  return keys;
}

function collectStageSelectionKeys(stage: Stage): NodeKey[] {
  const keys: NodeKey[] = [toNodeKey("stage", stage.id)];
  if (stage.childStages) {
    for (const child of stage.childStages) {
      keys.push(...collectStageSelectionKeys(child));
    }
  }
  if (stage.jobs) {
    for (const job of stage.jobs) {
      keys.push(...collectJobSelectionKeys(job));
    }
  }
  return keys;
}

export function getSelectionKeys(
  plan: Plan,
  type: NodeType,
  id: number,
): NodeKey[] {
  if (type === "stage") {
    const stage = findStage(plan.stages, id);
    if (stage) return collectStageSelectionKeys(stage);
    return [toNodeKey("stage", id)];
  }
  const job = findJob(plan.stages, id);
  if (job) return collectJobSelectionKeys(job);
  return [toNodeKey("job", id)];
}

/* ----------------------------------
 * Blast Radius Computation
 * ---------------------------------- */

export function computeBlastRadiusForSelection(
  plan: Plan,
  selectedNodes: NodeKey[],
): NodeKey[] {
  if (selectedNodes.length === 0) return [];

  const adjacency = new Map<NodeKey, Set<NodeKey>>();

  const addEdge = (a: NodeKey, b: NodeKey) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  const allStages = getAllStages(plan.stages);
  const allJobs = getAllJobs(plan.stages);

  // Build stage adjacency
  for (const stage of allStages) {
    const stageKey = toNodeKey("stage", stage.id);
    if (!adjacency.has(stageKey)) adjacency.set(stageKey, new Set());

    if (stage.parentStageId) {
      addEdge(stageKey, toNodeKey("stage", stage.parentStageId));
    }

    if (stage.childStages) {
      for (const child of stage.childStages) {
        addEdge(stageKey, toNodeKey("stage", child.id));
      }
    }

    for (const depId of stage.dependsOnStages) {
      addEdge(stageKey, toNodeKey("stage", depId));
    }
  }

  // Build job adjacency
  for (const job of allJobs) {
    const jobKey = toNodeKey("job", job.id);
    if (!adjacency.has(jobKey)) adjacency.set(jobKey, new Set());

    if (job.parentJobId) {
      addEdge(jobKey, toNodeKey("job", job.parentJobId));
    }

    for (const depId of job.dependsOnJobs) {
      addEdge(jobKey, toNodeKey("job", depId));
    }
  }

  // BFS to find all connected nodes (within same type)
  const visited = new Set<NodeKey>();
  const queue = [...selectedNodes];

  for (const key of queue) {
    visited.add(key);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;

      const [currentType] = current.split(":");
      const [neighborType] = neighbor.split(":");

      // Only traverse within same type
      if (currentType !== neighborType) continue;

      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return Array.from(visited);
}
