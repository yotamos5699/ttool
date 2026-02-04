"use client";

import { create } from "zustand";
import type { Plan, Stage, Job, ContextNode } from "./types";
import {
  updateStageInTree,
  deleteStageFromTree,
  addStageToTree,
} from "./stageTreeUtils";
import {
  updateJobInStages,
  deleteJobFromStages,
  addJobToStages,
} from "./jobTreeUtils";
import {
  addContextToTarget,
  updateContextInPlan,
  deleteContextFromPlan,
} from "./contextTreeUtils";

/* ----------------------------------
 * State Types
 * ---------------------------------- */

type PlanDataState = {
  plan: Plan | null;
};

type PlanDataActions = {
  setPlan: (plan: Plan) => void;
  clearPlan: () => void;
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

type PlanDataStore = PlanDataState & PlanDataActions;

/* ----------------------------------
 * Store
 * ---------------------------------- */

export const usePlanDataStore = create<PlanDataStore>()((set) => ({
  plan: null,

  setPlan: (plan) => set({ plan }),

  clearPlan: () => set({ plan: null }),

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
      plan: state.plan ? updateContextInPlan(state.plan, id, data) : null,
    })),

  deleteContext: (id) =>
    set((state) => ({
      plan: state.plan ? deleteContextFromPlan(state.plan, id) : null,
    })),
}));
