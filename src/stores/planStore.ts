"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export type ContextNode = {
  id: number;
  level: string;
  type: string;
  title: string;
  payload: string;
};

export type Job = {
  id: number;
  stageId: number;
  parentJobId: number | null;
  title: string;
  description: string | null;
  dependsOn: number[];
  dependsOnStages: number[];
  dependsOnJobs: number[];
  childJobs?: Job[];
  contextNodes?: ContextNode[];
};

export type IOEnvelope = {
  id: number;
  inputNode: { id: number; type: string; data: string };
  outputNode: { id: number; type: string; data: string };
};

export type Stage = {
  id: number;
  planId: number;
  parentStageId: number | null;
  title: string;
  description: string | null;
  executionMode: "sequential" | "parallel";
  dependsOn: number[];
  dependsOnStages: number[];
  childStages?: Stage[];
  jobs?: Job[];
  contextNodes?: ContextNode[];
  ioEnvelopes?: IOEnvelope[];
};

export type Plan = {
  id: number;
  name: string;
  goal: string;
  version: number;
  parentVersion: number | null;
  stages: Stage[];
  contextNodes: ContextNode[];
};

export type Selection = {
  id: number;
  type: "plan" | "stage" | "job" | "context";
} | null;

export type NodeType = "stage" | "job";
export type NodeKey = `${NodeType}:${number}`;

export type WSMessageType =
  | "joined"
  | "user:joined"
  | "user:left"
  | "cursor"
  | "node:updated"
  | "node:created"
  | "node:deleted"
  | "replan:started"
  | "replan:updated"
  | "replan:committed"
  | "replan:aborted"
  | "error";

export type WSMessage = {
  type: WSMessageType;
  [key: string]: unknown;
};

export const WebSocketReadyStateMap = {
  0: "CONNECTING",
  1: "OPEN",
  2: "CLOSING",
  3: "CLOSED",
} as const;

export type WsState =
  | (typeof WebSocketReadyStateMap)[keyof typeof WebSocketReadyStateMap]
  | "IDLE";

/* ----------------------------------
 * Store State Types
 * ---------------------------------- */

type PlanState = {
  // Plan data
  plan: Plan | null;

  // UI state
  selection: Selection;
  selectedNodesByPlan: Record<number, NodeKey[]>;
  blastRadiusByPlan: Record<number, NodeKey[]>;
  allExpanded: boolean;
  openStagesByPlan: Record<number, Record<number, boolean>>;
  openJobsByPlan: Record<number, Record<number, boolean>>;

  // WebSocket state
  ws: WebSocket | null;
  wsState: WsState;
  lastWsError: { ts: number; error: string } | null;
  roomSize: number;
};

type PlanActions = {
  // Plan actions
  setPlan: (plan: Plan) => void;
  clearPlan: () => void;

  // Selection actions
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  selectNode: (params: {
    planId: number;
    type: NodeType;
    id: number;
    mode: "replace" | "toggle" | "add";
    setPrimary?: boolean;
  }) => void;
  clearSelections: (planId?: number) => void;

  // Blast radius actions
  clearBlastRadius: () => void;

  // UI actions
  toggleAllExpanded: () => void;
  setStageOpen: (planId: number, stageId: number, isOpen: boolean) => void;
  setJobOpen: (planId: number, jobId: number, isOpen: boolean) => void;

  // WebSocket actions
  setWs: (ws: WebSocket | null) => void;
  setWsState: (state: number) => void;
  setWsError: (error: string) => void;
  setRoomSize: (size: number) => void;

  // Plan mutation actions (optimistic updates)
  updatePlan: (data: Partial<Plan>) => void;
  updateStage: (id: number, data: Partial<Stage>) => void;
  updateJob: (id: number, data: Partial<Job>) => void;
  addStage: (stage: Stage) => void;
  addJob: (job: Job) => void;
  deleteStage: (id: number) => void;
  deleteJob: (id: number) => void;
  addContext: (
    context: ContextNode,
    targetType: "plan" | "stage" | "job",
    targetId: number,
  ) => void;
  updateContext: (id: number, data: Partial<ContextNode>) => void;
  deleteContext: (id: number) => void;
};

type PlanStore = PlanState & PlanActions;

/* ----------------------------------
 * Helper Functions
 * ---------------------------------- */

function updateStageInTree(
  stages: Stage[],
  id: number,
  data: Partial<Stage>,
): Stage[] {
  return stages.map((stage) => {
    if (stage.id === id) {
      return { ...stage, ...data };
    }
    if (stage.childStages) {
      return {
        ...stage,
        childStages: updateStageInTree(stage.childStages, id, data),
      };
    }
    return stage;
  });
}

function updateJobInStages(
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

function updateJobRecursive(
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

function deleteStageFromTree(stages: Stage[], id: number): Stage[] {
  return stages
    .filter((stage) => stage.id !== id)
    .map((stage) => ({
      ...stage,
      childStages: stage.childStages
        ? deleteStageFromTree(stage.childStages, id)
        : undefined,
    }));
}

function deleteJobFromStages(stages: Stage[], jobId: number): Stage[] {
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

function deleteJobRecursive(job: Job, targetId: number): Job | null {
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

function addStageToTree(
  stages: Stage[],
  stage: Stage,
  parentId: number | null,
): Stage[] {
  if (!parentId) {
    return [...stages, stage];
  }

  return stages.map((s) => {
    if (s.id === parentId) {
      return {
        ...s,
        childStages: [...(s.childStages || []), stage],
      };
    }
    if (s.childStages) {
      return {
        ...s,
        childStages: addStageToTree(s.childStages, stage, parentId),
      };
    }
    return s;
  });
}

function addJobToStages(
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

function addContextToTarget(
  plan: Plan,
  context: ContextNode,
  targetType: "plan" | "stage" | "job",
  targetId: number,
): Plan {
  if (targetType === "plan") {
    return {
      ...plan,
      contextNodes: [...plan.contextNodes, context],
    };
  }

  if (targetType === "stage") {
    return {
      ...plan,
      stages: addContextToStage(plan.stages, context, targetId),
    };
  }

  if (targetType === "job") {
    return {
      ...plan,
      stages: addContextToJobInStages(plan.stages, context, targetId),
    };
  }

  return plan;
}

function addContextToStage(
  stages: Stage[],
  context: ContextNode,
  stageId: number,
): Stage[] {
  return stages.map((stage) => {
    if (stage.id === stageId) {
      return {
        ...stage,
        contextNodes: [...(stage.contextNodes || []), context],
      };
    }
    if (stage.childStages) {
      return {
        ...stage,
        childStages: addContextToStage(stage.childStages, context, stageId),
      };
    }
    return stage;
  });
}

function addContextToJobInStages(
  stages: Stage[],
  context: ContextNode,
  jobId: number,
): Stage[] {
  return stages.map((stage) => {
    const updatedJobs = stage.jobs?.map((job) =>
      addContextToJob(job, context, jobId),
    );
    const updatedChildStages = stage.childStages
      ? addContextToJobInStages(stage.childStages, context, jobId)
      : undefined;

    return {
      ...stage,
      jobs: updatedJobs,
      childStages: updatedChildStages,
    };
  });
}

function addContextToJob(
  job: Job,
  context: ContextNode,
  targetId: number,
): Job {
  if (job.id === targetId) {
    return {
      ...job,
      contextNodes: [...(job.contextNodes || []), context],
    };
  }
  if (job.childJobs) {
    return {
      ...job,
      childJobs: job.childJobs.map((child) =>
        addContextToJob(child, context, targetId),
      ),
    };
  }
  return job;
}

function updateContextInPlan(
  plan: Plan,
  contextId: number,
  data: Partial<ContextNode>,
): Plan {
  // Check plan-level context
  const planContextIndex = plan.contextNodes.findIndex(
    (c) => c.id === contextId,
  );
  if (planContextIndex !== -1) {
    const updatedContextNodes = [...plan.contextNodes];
    updatedContextNodes[planContextIndex] = {
      ...updatedContextNodes[planContextIndex],
      ...data,
    };
    return { ...plan, contextNodes: updatedContextNodes };
  }

  // Check stages and jobs
  return {
    ...plan,
    stages: updateContextInStages(plan.stages, contextId, data),
  };
}

function updateContextInStages(
  stages: Stage[],
  contextId: number,
  data: Partial<ContextNode>,
): Stage[] {
  return stages.map((stage) => {
    const updatedContextNodes = stage.contextNodes?.map((c) =>
      c.id === contextId ? { ...c, ...data } : c,
    );

    const updatedJobs = stage.jobs?.map((job) =>
      updateContextInJob(job, contextId, data),
    );

    const updatedChildStages = stage.childStages
      ? updateContextInStages(stage.childStages, contextId, data)
      : undefined;

    return {
      ...stage,
      contextNodes: updatedContextNodes,
      jobs: updatedJobs,
      childStages: updatedChildStages,
    };
  });
}

function updateContextInJob(
  job: Job,
  contextId: number,
  data: Partial<ContextNode>,
): Job {
  const updatedContextNodes = job.contextNodes?.map((c) =>
    c.id === contextId ? { ...c, ...data } : c,
  );

  const updatedChildJobs = job.childJobs?.map((child) =>
    updateContextInJob(child, contextId, data),
  );

  return {
    ...job,
    contextNodes: updatedContextNodes,
    childJobs: updatedChildJobs,
  };
}

function deleteContextFromPlan(plan: Plan, contextId: number): Plan {
  // Check plan-level context
  if (plan.contextNodes.some((c) => c.id === contextId)) {
    return {
      ...plan,
      contextNodes: plan.contextNodes.filter((c) => c.id !== contextId),
    };
  }

  // Check stages and jobs
  return {
    ...plan,
    stages: deleteContextFromStages(plan.stages, contextId),
  };
}

function deleteContextFromStages(
  stages: Stage[],
  contextId: number,
): Stage[] {
  return stages.map((stage) => {
    const filteredContextNodes = stage.contextNodes?.filter(
      (c) => c.id !== contextId,
    );

    const updatedJobs = stage.jobs?.map((job) =>
      deleteContextFromJob(job, contextId),
    );

    const updatedChildStages = stage.childStages
      ? deleteContextFromStages(stage.childStages, contextId)
      : undefined;

    return {
      ...stage,
      contextNodes: filteredContextNodes,
      jobs: updatedJobs,
      childStages: updatedChildStages,
    };
  });
}

function deleteContextFromJob(job: Job, contextId: number): Job {
  const filteredContextNodes = job.contextNodes?.filter(
    (c) => c.id !== contextId,
  );

  const updatedChildJobs = job.childJobs?.map((child) =>
    deleteContextFromJob(child, contextId),
  );

  return {
    ...job,
    contextNodes: filteredContextNodes,
    childJobs: updatedChildJobs,
  };
}

function toNodeKey(type: NodeType, id: number): NodeKey {
  return `${type}:${id}`;
}

function parseNodeKey(key: NodeKey): { type: NodeType; id: number } {
  const [type, id] = key.split(":");
  return { type: type as NodeType, id: Number(id) };
}

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

function getSelectionKeys(plan: Plan, type: NodeType, id: number): NodeKey[] {
  if (type === "stage") {
    const stage = findStage(plan.stages, id);
    if (stage) return collectStageSelectionKeys(stage);
    return [toNodeKey("stage", id)];
  }
  const job = findJob(plan.stages, id);
  if (job) return collectJobSelectionKeys(job);
  return [toNodeKey("job", id)];
}

function computeBlastRadiusForSelection(
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

      if (currentType !== neighborType) continue;

      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return Array.from(visited);
}

/* ----------------------------------
 * Selectors (helper functions)
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

/* ----------------------------------
 * Store
 * ---------------------------------- */

export const usePlanStore = create<PlanStore>()(
  persist(
    (set) => ({
      // Initial state
      plan: null,
      selection: null,
      selectedNodesByPlan: {},
      blastRadiusByPlan: {},
      allExpanded: false,
      openStagesByPlan: {},
      openJobsByPlan: {},
      ws: null,
      wsState: "IDLE",
      lastWsError: null,
      roomSize: 0,

      // Plan actions
      setPlan: (plan) => set({ plan }),
      clearPlan: () => set({ plan: null }),

      // Selection actions
      setSelection: (selection) => set({ selection }),
      clearSelection: () => set({ selection: null }),
      selectNode: ({ planId, type, id, mode, setPrimary = true }) =>
        set((state) => {
          if (!state.plan || state.plan.id !== planId) return state;

          const selectionKeys = getSelectionKeys(state.plan, type, id);
          const current = state.selectedNodesByPlan[planId] || [];
          const selectionKeySet = new Set(selectionKeys);
          let next: NodeKey[] = [];

          if (mode === "replace") {
            next = selectionKeys;
          } else if (mode === "add") {
            next = Array.from(new Set([...current, ...selectionKeys]));
          } else {
            const currentSet = new Set(current);
            const allIncluded = selectionKeys.every((key) => currentSet.has(key));
            if (allIncluded) {
              next = current.filter((key) => !selectionKeySet.has(key));
            } else {
              next = Array.from(new Set([...current, ...selectionKeys]));
            }
          }

          const nextBlastRadius = computeBlastRadiusForSelection(state.plan, next);

          let nextSelection = state.selection;
          if (next.length === 0) {
            nextSelection = null;
          } else if (setPrimary || mode !== "toggle") {
            nextSelection = { id, type };
          } else if (state.selection?.id === id && state.selection?.type === type) {
            const fallback = next[0];
            nextSelection = fallback ? parseNodeKey(fallback) : null;
          }

          return {
            selection: nextSelection,
            selectedNodesByPlan: {
              ...state.selectedNodesByPlan,
              [planId]: next,
            },
            blastRadiusByPlan: {
              ...state.blastRadiusByPlan,
              [planId]: nextBlastRadius,
            },
          };
        }),
      clearSelections: (planId) =>
        set((state) => {
          const targetPlanId = planId ?? state.plan?.id;
          if (!targetPlanId) return state;

          const nextSelection =
            state.selection?.type === "stage" || state.selection?.type === "job"
              ? null
              : state.selection;

          return {
            selection: nextSelection,
            selectedNodesByPlan: {
              ...state.selectedNodesByPlan,
              [targetPlanId]: [],
            },
            blastRadiusByPlan: {
              ...state.blastRadiusByPlan,
              [targetPlanId]: [],
            },
          };
        }),

      // Blast radius actions
      clearBlastRadius: () =>
        set((state) => {
          const targetPlanId = state.plan?.id;
          if (!targetPlanId) return state;

          return {
            selection:
              state.selection?.type === "stage" || state.selection?.type === "job"
                ? null
                : state.selection,
            selectedNodesByPlan: {
              ...state.selectedNodesByPlan,
              [targetPlanId]: [],
            },
            blastRadiusByPlan: {
              ...state.blastRadiusByPlan,
              [targetPlanId]: [],
            },
          };
        }),

      // UI actions
      toggleAllExpanded: () =>
        set((state) => ({ allExpanded: !state.allExpanded })),
      setStageOpen: (planId, stageId, isOpen) =>
        set((state) => ({
          openStagesByPlan: {
            ...state.openStagesByPlan,
            [planId]: {
              ...state.openStagesByPlan[planId],
              [stageId]: isOpen,
            },
          },
        })),
      setJobOpen: (planId, jobId, isOpen) =>
        set((state) => ({
          openJobsByPlan: {
            ...state.openJobsByPlan,
            [planId]: {
              ...state.openJobsByPlan[planId],
              [jobId]: isOpen,
            },
          },
        })),

      // WebSocket actions
      setWs: (ws) => set({ ws }),
      setWsState: (state) => {
        const wsState =
          WebSocketReadyStateMap[
            state as keyof typeof WebSocketReadyStateMap
          ] || "IDLE";
        set({ wsState });
      },
      setWsError: (error) =>
        set({ lastWsError: { ts: Date.now(), error } }),
      setRoomSize: (roomSize) => set({ roomSize }),

      // Plan mutation actions
      updatePlan: (data) =>
        set((state) => ({
          plan: state.plan ? { ...state.plan, ...data } : null,
        })),

      updateStage: (id, data) =>
        set((state) => ({
          plan: state.plan
            ? {
                ...state.plan,
                stages: updateStageInTree(state.plan.stages, id, data),
              }
            : null,
        })),

      updateJob: (id, data) =>
        set((state) => ({
          plan: state.plan
            ? {
                ...state.plan,
                stages: updateJobInStages(state.plan.stages, id, data),
              }
            : null,
        })),

      addStage: (stage) =>
        set((state) => ({
          plan: state.plan
            ? {
                ...state.plan,
                stages: addStageToTree(
                  state.plan.stages,
                  stage,
                  stage.parentStageId,
                ),
              }
            : null,
        })),

      addJob: (job) =>
        set((state) => ({
          plan: state.plan
            ? {
                ...state.plan,
                stages: addJobToStages(
                  state.plan.stages,
                  job,
                  job.stageId,
                  job.parentJobId,
                ),
              }
            : null,
        })),

      deleteStage: (id) =>
        set((state) => ({
          plan: state.plan
            ? {
                ...state.plan,
                stages: deleteStageFromTree(state.plan.stages, id),
              }
            : null,
        })),

      deleteJob: (id) =>
        set((state) => ({
          plan: state.plan
            ? {
                ...state.plan,
                stages: deleteJobFromStages(state.plan.stages, id),
              }
            : null,
        })),

      addContext: (context, targetType, targetId) =>
        set((state) => ({
          plan: state.plan
            ? addContextToTarget(state.plan, context, targetType, targetId)
            : null,
        })),

      updateContext: (id, data) =>
        set((state) => ({
          plan: state.plan
            ? updateContextInPlan(state.plan, id, data)
            : null,
        })),

      deleteContext: (id) =>
        set((state) => ({
          plan: state.plan
            ? deleteContextFromPlan(state.plan, id)
            : null,
        })),
    }),
    {
      name: "plan-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist UI state, not runtime state
        selection: state.selection,
        selectedNodesByPlan: state.selectedNodesByPlan,
        blastRadiusByPlan: state.blastRadiusByPlan,
        allExpanded: state.allExpanded,
        openStagesByPlan: state.openStagesByPlan,
        openJobsByPlan: state.openJobsByPlan,
      }),
    },
  ),
);
