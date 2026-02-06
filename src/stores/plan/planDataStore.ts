"use client";

import { create } from "zustand";
import type { Plan, ContextNode, PlanNode, PlanEdge } from "./types";
import {
  addContextToTarget,
  updateContextInPlan,
  deleteContextFromPlan,
} from "./contextTreeUtils";
import { flattenPlanNodes } from "./planTreeUtils";

/* ----------------------------------
 * State Types
 * ---------------------------------- */

type PlanDataState = {
  plan: Plan | null;
};

type PlanDataActions = {
  nodesById: Map<number, PlanNode>;
  edgesByNodeId: Map<number, PlanEdge[]>;
  setPlan: (plan: Plan) => void;
  clearPlan: () => void;
  updatePlan: (data: Partial<Plan>) => void;
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
export const setEdgesByNodeId = (plan: Plan) => {
  const edgesByNodeId = new Map<number, PlanEdge[]>();
  for (const edge of plan.edges) {
    if (!edgesByNodeId.has(edge.fromNodeId)) {
      edgesByNodeId.set(edge.fromNodeId, []);
    }
    if (!edgesByNodeId.has(edge.toNodeId)) {
      edgesByNodeId.set(edge.toNodeId, []);
    }
    edgesByNodeId.get(edge.fromNodeId)!.push(edge);
    edgesByNodeId.get(edge.toNodeId)!.push(edge);
  }
  usePlanDataStore.setState({ edgesByNodeId });
};

export const useEdgesByNodeId = (id: number) =>
  usePlanDataStore((s) => s.edgesByNodeId).get(id);
export const setNodesById = (plan: Plan) => {
  const nodesById = new Map<number, PlanNode>();
  for (const item of flattenPlanNodes(plan.parts)) {
    nodesById.set(item.id, item);
  }
  usePlanDataStore.setState({ nodesById });
};
export const useNodesById = () => usePlanDataStore((s) => s.nodesById);
export const useNodeById = (id: number) => usePlanDataStore((s) => s.nodesById).get(id);
export const getNodeById = (id: number) => usePlanDataStore.getState().nodesById.get(id);
export const usePlanDataStore = create<PlanDataStore>()((set) => ({
  plan: null,
  nodesById: new Map(),
  edgesByNodeId: new Map(),
  setPlan: (plan) => set({ plan }),

  clearPlan: () => set({ plan: null }),

  updatePlan: (data) =>
    set((state) => ({
      plan: state.plan ? { ...state.plan, ...data } : null,
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
