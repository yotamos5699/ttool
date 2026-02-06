"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  usePlanDataStore,
  type Plan,
  type PlanNode,
  type ContextNode,
} from "@/stores/plan";

// Server actions - New node-based action files
import { updatePlan as updatePlanAction } from "@/actions/plan-actions";
import {
  createStage as createStageAction,
  updateStage as updateStageAction,
  deleteStage as deleteStageAction,
  type StageCreateInput,
  type StageUpdateInput,
} from "@/actions/stage-actions";
import {
  createJob as createJobAction,
  updateJob as updateJobAction,
  deleteJob as deleteJobAction,
  type JobCreateInput,
  type JobUpdateInput,
} from "@/actions/job-actions";
import { findPlanNode, updatePlanNode } from "@/stores/plan";
import {
  createContext as createContextAction,
  updateContext as updateContextAction,
  deleteContext as deleteContextAction,
  type ContextCreateInput,
  type ContextUpdateInput,
} from "@/actions/context-actions";
import type { ContextType } from "@/dbs/drizzle/schema";

/**
 * Hook providing all plan mutations with optimistic updates
 * Uses Zustand store for immediate UI updates and React Query for server sync
 */
export function usePlanMutations() {
  const planId = usePlanDataStore((s) => s.plan?.id ?? 0);
  const queryClient = useQueryClient();
  const store = usePlanDataStore.getState();
  const plan = usePlanDataStore((s) => s.plan);

  // Helper to invalidate plan query after mutation
  const invalidatePlan = () => {
    queryClient.invalidateQueries({ queryKey: ["plan", String(planId)] });
  };

  // Plan mutations
  const updatePlan = useMutation({
    mutationFn: (data: Partial<Plan>) =>
      updatePlanAction(planId, {
        name: data.name,
        goal: data.goal,
        version: data.version,
        disableDependencyInheritance: data.dependencies?.disableDependencyInheritance,
        includeDependencyIds: data.dependencies?.includeDependencyIds,
        excludeDependencyIds: data.dependencies?.excludeDependencyIds,
      }),
    onMutate: (data) => {
      // Optimistic update
      const previous = store.plan;
      store.updatePlan(data);
      return { previous };
    },
    onError: (_err, _data, context) => {
      // Rollback on error
      if (context?.previous) {
        store.setPlan(context.previous);
      }
      console.error("Failed to update plan");
    },
    onSettled: invalidatePlan,
  });

  // Stage mutations
  const createStage = useMutation({
    mutationFn: (data: { parentStageId?: number | null; title: string }) => {
      if (!plan) throw new Error("No plan loaded");

      const input: StageCreateInput = {
        name: data.title,
        planId,
        parentId: data.parentStageId ?? planId, // If no parent stage, parent is the plan
        tenantId: plan.id, // Using plan id as tenant for now - should get from context
        executionMode: "sequential",
        disableDependencyInheritance: false,
        includeDependencyIds: [],
        excludeDependencyIds: [],
      };
      return createStageAction(input);
    },
    onMutate: (data) => {
      const tempStage: PlanNode = {
        id: -Date.now(),
        type: "stage",
        title: data.title,
        description: null,
        executionMode: "sequential",
        contextNodes: [],
        dataNodeIds: [],
        dependencies: {
          includeDependencyIds: [],
          excludeDependencyIds: [],
          disableDependencyInheritance: false,
        },
        childNodes: [],
      };
      if (data.parentStageId) {
        const targetNode = findPlanNode(store.plan?.parts ?? [], data.parentStageId);
        const nextChildren = [...(targetNode?.childNodes ?? []), tempStage];
        store.updatePlan({
          parts: updatePlanNode(store.plan?.parts ?? [], data.parentStageId, {
            childNodes: nextChildren,
          }),
        });
      } else {
        store.updatePlan({ parts: [...(store.plan?.parts ?? []), tempStage] });
      }
      return { tempId: tempStage.id };
    },
    onSuccess: () => {
      invalidatePlan();
    },
    onError: () => {
      console.error("Failed to create stage");
    },
    onSettled: invalidatePlan,
  });

  const updateStage = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlanNode> }) => {
      const updateData: StageUpdateInput = {};
      if (data.title !== undefined) updateData.name = data.title;
      if (data.description !== undefined)
        updateData.description = data.description ?? undefined;
      if (data.executionMode !== undefined) updateData.executionMode = data.executionMode;
      if (data.dependencies) {
        updateData.disableDependencyInheritance =
          data.dependencies.disableDependencyInheritance;
        updateData.includeDependencyIds = data.dependencies.includeDependencyIds;
        updateData.excludeDependencyIds = data.dependencies.excludeDependencyIds;
      }
      return updateStageAction(id, updateData);
    },
    onMutate: ({ id, data }) => {
      const previous = store.plan;
      if (store.plan) {
        store.updatePlan({
          parts: updatePlanNode(store.plan.parts, id, data as PlanNode),
        });
      }
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        store.setPlan(context.previous);
      }
      console.error("Failed to update stage");
    },
    onSettled: invalidatePlan,
  });

  const deleteStage = useMutation({
    mutationFn: (id: number) => deleteStageAction(id),
    onMutate: (id) => {
      const previous = store.plan;
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        store.setPlan(context.previous);
      }
      console.error("Failed to delete stage");
    },
    onSettled: invalidatePlan,
  });

  // Duplicate a stage (creates a copy with new ID)
  const duplicateStage = useMutation({
    mutationFn: async (id: number) => {
      if (!plan) throw new Error("No plan loaded");
      const stageToDuplicate = findPlanNode(plan.parts, id);
      if (!stageToDuplicate) throw new Error("Stage not found");
      const input: StageCreateInput = {
        name: `${stageToDuplicate.title} (copy)`,
        planId,
        parentId: stageToDuplicate.id,
        tenantId: plan.id,
        executionMode: stageToDuplicate.executionMode,
        description: stageToDuplicate.description ?? undefined,
        disableDependencyInheritance:
          stageToDuplicate.dependencies.disableDependencyInheritance,
        includeDependencyIds: stageToDuplicate.dependencies.includeDependencyIds,
        excludeDependencyIds: stageToDuplicate.dependencies.excludeDependencyIds,
      };
      return createStageAction(input);
    },
    onMutate: () => ({ tempId: undefined }),
    onSuccess: () => {
      invalidatePlan();
    },
    onError: () => {
      console.error("Failed to duplicate stage");
    },
    onSettled: invalidatePlan,
  });

  // Job mutations
  const createJob = useMutation({
    mutationFn: (data: {
      parentStageId: number;
      parentJobId?: number | null;
      title: string;
    }) => {
      if (!plan) throw new Error("No plan loaded");
      const stageNode = findPlanNode(plan.parts, data.parentStageId);
      if (!stageNode) throw new Error("Parent stage not found");

      const input: JobCreateInput = {
        name: data.title,
        planId,
        parentId: data.parentJobId ?? data.parentStageId, // If no parent job, parent is the stage
        tenantId: plan.id, // Using plan id as tenant for now
        disableDependencyInheritance: false,
        includeDependencyIds: [],
        excludeDependencyIds: [],
      };
      return createJobAction(input);
    },
    onMutate: (data) => {
      const tempJob: PlanNode = {
        id: -Date.now(),
        type: "job",
        title: data.title,
        description: null,
        contextNodes: [],
        dataNodeIds: [],
        dependencies: {
          includeDependencyIds: [],
          excludeDependencyIds: [],
          disableDependencyInheritance: false,
        },
        childNodes: [],
      };
      if (store.plan) {
        const targetId = data.parentJobId ?? data.parentStageId;
        const targetNode = findPlanNode(store.plan.parts, targetId);
        const nextChildren = [...(targetNode?.childNodes ?? []), tempJob];
        store.updatePlan({
          parts: updatePlanNode(store.plan.parts, targetId, { childNodes: nextChildren }),
        });
      }
      return { tempId: tempJob.id };
    },
    onSuccess: () => {
      invalidatePlan();
    },
    onError: (_err, _data, context) => {
      console.error("Failed to create job");
    },
    onSettled: invalidatePlan,
  });

  const updateJob = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlanNode> }) => {
      const updateData: JobUpdateInput = {};
      if (data.title !== undefined) updateData.name = data.title;
      if (data.description !== undefined)
        updateData.description = data.description ?? undefined;
      if (data.dependencies) {
        updateData.disableDependencyInheritance =
          data.dependencies.disableDependencyInheritance;
        updateData.includeDependencyIds = data.dependencies.includeDependencyIds;
        updateData.excludeDependencyIds = data.dependencies.excludeDependencyIds;
      }
      return updateJobAction(id, updateData);
    },
    onMutate: ({ id, data }) => {
      const previous = store.plan;
      if (store.plan) {
        store.updatePlan({
          parts: updatePlanNode(store.plan.parts, id, data as PlanNode),
        });
      }
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        store.setPlan(context.previous);
      }
      console.error("Failed to update job");
    },
    onSettled: invalidatePlan,
  });

  const deleteJob = useMutation({
    mutationFn: (id: number) => deleteJobAction(id),
    onMutate: (id) => {
      const previous = store.plan;
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        store.setPlan(context.previous);
      }
      console.error("Failed to delete job");
    },
    onSettled: invalidatePlan,
  });

  // Duplicate a job (creates a copy with new ID)
  const duplicateJob = useMutation({
    mutationFn: async (id: number) => {
      if (!plan) throw new Error("No plan loaded");
      const jobToDuplicate = findPlanNode(plan.parts, id);
      if (!jobToDuplicate) throw new Error("Job not found");
      const input: JobCreateInput = {
        name: `${jobToDuplicate.title} (copy)`,
        planId,
        parentId: jobToDuplicate.id,
        tenantId: plan.id,
        description: jobToDuplicate.description ?? undefined,
        disableDependencyInheritance:
          jobToDuplicate.dependencies.disableDependencyInheritance,
        includeDependencyIds: jobToDuplicate.dependencies.includeDependencyIds,
        excludeDependencyIds: jobToDuplicate.dependencies.excludeDependencyIds,
      };
      return createJobAction(input);
    },
    onMutate: () => ({ tempId: undefined }),
    onSuccess: () => {
      invalidatePlan();
    },
    onError: () => {
      console.error("Failed to duplicate job");
    },
    onSettled: invalidatePlan,
  });

  // Context mutations
  const createContext = useMutation({
    mutationFn: (data: {
      targetType: "plan" | "stage" | "job";
      targetId: number;
      title: string;
      type: ContextType;
      payload?: string;
    }) => {
      if (!plan) throw new Error("No plan loaded");

      const input: ContextCreateInput = {
        name: data.title,
        contextType: data.type,
        payload: data.payload || "",
        planId,
        parentId: data.targetId,
        tenantId: plan.id, // Using plan id as tenant for now
      };
      return createContextAction(input);
    },
    onMutate: (data) => {
      const tempContext: ContextNode = {
        id: -Date.now(),
        level: data.targetType,
        type: data.type,
        title: data.title,
        payload: data.payload || "",
      };
      store.addContext(tempContext, data.targetType, data.targetId);
      return {
        tempId: tempContext.id,
        targetType: data.targetType,
        targetId: data.targetId,
      };
    },
    onSuccess: (newContext, _data, context) => {
      if (context?.tempId && newContext) {
        store.deleteContext(context.tempId);
        const ctx: ContextNode = {
          id: newContext.id,
          level: context.targetType,
          type: newContext.contextData?.contextType ?? "note",
          title: newContext.name,
          payload: newContext.contextData?.payload ?? "",
        };
        store.addContext(ctx, context.targetType, context.targetId);
      }
    },
    onError: (_err, _data, context) => {
      if (context?.tempId) {
        store.deleteContext(context.tempId);
      }
      console.error("Failed to create context");
    },
    onSettled: invalidatePlan,
  });

  const updateContext = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { title?: string; type?: ContextType; payload?: string };
    }) => {
      const updateData: ContextUpdateInput = {};
      if (data.title !== undefined) updateData.name = data.title;
      if (data.type !== undefined) updateData.contextType = data.type;
      if (data.payload !== undefined) updateData.payload = data.payload;
      return updateContextAction(id, updateData);
    },
    onMutate: ({ id, data }) => {
      const previous = store.plan;
      store.updateContext(id, data);
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        store.setPlan(context.previous);
      }
      console.error("Failed to update context");
    },
    onSettled: invalidatePlan,
  });

  const deleteContext = useMutation({
    mutationFn: (id: number) => deleteContextAction(id),
    onMutate: (id) => {
      const previous = store.plan;
      store.deleteContext(id);
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        store.setPlan(context.previous);
      }
      console.error("Failed to delete context");
    },
    onSettled: invalidatePlan,
  });

  return {
    // Plan
    updatePlan,
    // Stages
    createStage,
    updateStage,
    deleteStage,
    duplicateStage,
    // Jobs
    createJob,
    updateJob,
    deleteJob,
    duplicateJob,
    // Context
    createContext,
    updateContext,
    deleteContext,
  };
}
