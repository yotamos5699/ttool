"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlanStore, type Plan, type Stage, type Job, type ContextNode } from "@/stores/planStore";

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
export function usePlanMutations(planId: number) {
  const queryClient = useQueryClient();
  const store = usePlanStore.getState();
  const plan = usePlanStore((s) => s.plan);

  // Helper to invalidate plan query after mutation
  const invalidatePlan = () => {
    queryClient.invalidateQueries({ queryKey: ["plan", String(planId)] });
  };

  // Plan mutations
  const updatePlan = useMutation({
    mutationFn: (data: Partial<Plan>) => updatePlanAction(planId, {
      name: data.name,
      goal: data.goal,
      version: data.version,
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
      };
      return createStageAction(input);
    },
    onMutate: (data) => {
      // Optimistic update with temp ID
      const tempStage: Stage = {
        id: -Date.now(), // Negative temp ID
        planId,
        parentStageId: data.parentStageId || null,
        title: data.title,
        description: null,
        executionMode: "sequential",
        dependsOn: [],
        dependsOnStages: [],
        childStages: [],
        jobs: [],
        contextNodes: [],
      };
      store.addStage(tempStage);
      return { tempId: tempStage.id };
    },
    onSuccess: (newStage, _data, context) => {
      // Replace temp stage with real one
      if (context?.tempId && newStage) {
        store.deleteStage(context.tempId);
        const stage: Stage = {
          id: newStage.id,
          planId: newStage.planId ?? planId,
          parentStageId: newStage.parentId && newStage.parentId !== planId ? newStage.parentId : null,
          title: newStage.name,
          description: newStage.stageData?.description ?? null,
          executionMode: newStage.stageData?.executionMode ?? "sequential",
          dependsOn: [],
          dependsOnStages: newStage.stageData?.dependsOnNodeIds ?? [],
          childStages: [],
          jobs: [],
          contextNodes: [],
        };
        store.addStage(stage);
      }
    },
    onError: (_err, _data, context) => {
      // Remove optimistic stage
      if (context?.tempId) {
        store.deleteStage(context.tempId);
      }
      console.error("Failed to create stage");
    },
    onSettled: invalidatePlan,
  });

  const updateStage = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Stage> }) => {
      const updateData: StageUpdateInput = {};
      if (data.title !== undefined) updateData.name = data.title;
      if (data.description !== undefined) updateData.description = data.description ?? undefined;
      if (data.executionMode !== undefined) updateData.executionMode = data.executionMode;
      return updateStageAction(id, updateData);
    },
    onMutate: ({ id, data }) => {
      const previous = store.plan;
      store.updateStage(id, data);
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
      store.deleteStage(id);
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
      
      // Find the stage to duplicate
      const findStage = (stages: Stage[]): Stage | undefined => {
        for (const s of stages) {
          if (s.id === id) return s;
          const found = findStage(s.childStages || []);
          if (found) return found;
        }
        return undefined;
      };
      
      const stageToDuplicate = findStage(plan.stages);
      if (!stageToDuplicate) throw new Error("Stage not found");
      
      const input: StageCreateInput = {
        name: `${stageToDuplicate.title} (copy)`,
        planId,
        parentId: stageToDuplicate.parentStageId ?? planId,
        tenantId: plan.id,
        executionMode: stageToDuplicate.executionMode,
        description: stageToDuplicate.description ?? undefined,
      };
      return createStageAction(input);
    },
    onMutate: (id) => {
      // Optimistic update - add a temp duplicate
      const findStage = (stages: Stage[]): Stage | undefined => {
        for (const s of stages) {
          if (s.id === id) return s;
          const found = findStage(s.childStages || []);
          if (found) return found;
        }
        return undefined;
      };
      
      const stageToDuplicate = plan ? findStage(plan.stages) : undefined;
      if (!stageToDuplicate) return { tempId: undefined };
      
      const tempStage: Stage = {
        id: -Date.now(),
        planId,
        parentStageId: stageToDuplicate.parentStageId,
        title: `${stageToDuplicate.title} (copy)`,
        description: stageToDuplicate.description,
        executionMode: stageToDuplicate.executionMode,
        dependsOn: [],
        dependsOnStages: [],
        childStages: [],
        jobs: [],
        contextNodes: [],
      };
      store.addStage(tempStage);
      return { tempId: tempStage.id };
    },
    onSuccess: (newStage, _data, context) => {
      if (context?.tempId && newStage) {
        store.deleteStage(context.tempId);
        const stage: Stage = {
          id: newStage.id,
          planId: newStage.planId ?? planId,
          parentStageId: newStage.parentId && newStage.parentId !== planId ? newStage.parentId : null,
          title: newStage.name,
          description: newStage.stageData?.description ?? null,
          executionMode: newStage.stageData?.executionMode ?? "sequential",
          dependsOn: [],
          dependsOnStages: newStage.stageData?.dependsOnNodeIds ?? [],
          childStages: [],
          jobs: [],
          contextNodes: [],
        };
        store.addStage(stage);
      }
    },
    onError: (_err, _data, context) => {
      if (context?.tempId) {
        store.deleteStage(context.tempId);
      }
      console.error("Failed to duplicate stage");
    },
    onSettled: invalidatePlan,
  });

  // Job mutations
  const createJob = useMutation({
    mutationFn: (data: { stageId: number; parentJobId?: number | null; title: string }) => {
      if (!plan) throw new Error("No plan loaded");
      
      const input: JobCreateInput = {
        name: data.title,
        planId,
        stageId: data.stageId,
        parentId: data.parentJobId ?? data.stageId, // If no parent job, parent is the stage
        tenantId: plan.id, // Using plan id as tenant for now
      };
      return createJobAction(input);
    },
    onMutate: (data) => {
      const tempJob: Job = {
        id: -Date.now(),
        stageId: data.stageId,
        parentJobId: data.parentJobId || null,
        title: data.title,
        description: null,
        dependsOn: [],
        dependsOnStages: [],
        dependsOnJobs: [],
        childJobs: [],
        contextNodes: [],
      };
      store.addJob(tempJob);
      return { tempId: tempJob.id };
    },
    onSuccess: (newJob, _data, context) => {
      if (context?.tempId && newJob) {
        store.deleteJob(context.tempId);
        const job: Job = {
          id: newJob.id,
          stageId: newJob.stageId ?? 0,
          parentJobId: newJob.parentId && newJob.parentId !== newJob.stageId ? newJob.parentId : null,
          title: newJob.name,
          description: newJob.jobData?.description ?? null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: newJob.jobData?.dependsOnNodeIds ?? [],
          childJobs: [],
          contextNodes: [],
        };
        store.addJob(job);
      }
    },
    onError: (_err, _data, context) => {
      if (context?.tempId) {
        store.deleteJob(context.tempId);
      }
      console.error("Failed to create job");
    },
    onSettled: invalidatePlan,
  });

  const updateJob = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Job> }) => {
      const updateData: JobUpdateInput = {};
      if (data.title !== undefined) updateData.name = data.title;
      if (data.description !== undefined) updateData.description = data.description ?? undefined;
      return updateJobAction(id, updateData);
    },
    onMutate: ({ id, data }) => {
      const updateData: Partial<Job> = { ...data };
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description ?? undefined;
      const previous = store.plan;
      store.updateJob(id, updateData);
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
      store.deleteJob(id);
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
      
      // Find the job to duplicate
      const findJob = (stages: Stage[]): Job | undefined => {
        for (const s of stages) {
          for (const j of s.jobs || []) {
            if (j.id === id) return j;
            const found = findJobInChildren(j.childJobs || []);
            if (found) return found;
          }
          const foundInChild = findJob(s.childStages || []);
          if (foundInChild) return foundInChild;
        }
        return undefined;
      };
      
      const findJobInChildren = (jobs: Job[]): Job | undefined => {
        for (const j of jobs) {
          if (j.id === id) return j;
          const found = findJobInChildren(j.childJobs || []);
          if (found) return found;
        }
        return undefined;
      };
      
      const jobToDuplicate = findJob(plan.stages);
      if (!jobToDuplicate) throw new Error("Job not found");
      
      const input: JobCreateInput = {
        name: `${jobToDuplicate.title} (copy)`,
        planId,
        stageId: jobToDuplicate.stageId,
        parentId: jobToDuplicate.parentJobId ?? jobToDuplicate.stageId,
        tenantId: plan.id,
        description: jobToDuplicate.description ?? undefined,
      };
      return createJobAction(input);
    },
    onMutate: (id) => {
      // Optimistic update - add a temp duplicate
      const findJob = (stages: Stage[]): Job | undefined => {
        for (const s of stages) {
          for (const j of s.jobs || []) {
            if (j.id === id) return j;
            const found = findJobInChildren(j.childJobs || []);
            if (found) return found;
          }
          const foundInChild = findJob(s.childStages || []);
          if (foundInChild) return foundInChild;
        }
        return undefined;
      };
      
      const findJobInChildren = (jobs: Job[]): Job | undefined => {
        for (const j of jobs) {
          if (j.id === id) return j;
          const found = findJobInChildren(j.childJobs || []);
          if (found) return found;
        }
        return undefined;
      };
      
      const jobToDuplicate = plan ? findJob(plan.stages) : undefined;
      if (!jobToDuplicate) return { tempId: undefined };
      
      const tempJob: Job = {
        id: -Date.now(),
        stageId: jobToDuplicate.stageId,
        parentJobId: jobToDuplicate.parentJobId,
        title: `${jobToDuplicate.title} (copy)`,
        description: jobToDuplicate.description,
        dependsOn: [],
        dependsOnStages: [],
        dependsOnJobs: [],
        childJobs: [],
        contextNodes: [],
      };
      store.addJob(tempJob);
      return { tempId: tempJob.id };
    },
    onSuccess: (newJob, _data, context) => {
      if (context?.tempId && newJob) {
        store.deleteJob(context.tempId);
        const job: Job = {
          id: newJob.id,
          stageId: newJob.stageId ?? 0,
          parentJobId: newJob.parentId && newJob.parentId !== newJob.stageId ? newJob.parentId : null,
          title: newJob.name,
          description: newJob.jobData?.description ?? null,
          dependsOn: [],
          dependsOnStages: [],
          dependsOnJobs: newJob.jobData?.dependsOnNodeIds ?? [],
          childJobs: [],
          contextNodes: [],
        };
        store.addJob(job);
      }
    },
    onError: (_err, _data, context) => {
      if (context?.tempId) {
        store.deleteJob(context.tempId);
      }
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
      return { tempId: tempContext.id, targetType: data.targetType, targetId: data.targetId };
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
    mutationFn: ({ id, data }: { id: number; data: { title?: string; type?: ContextType; payload?: string } }) => {
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
