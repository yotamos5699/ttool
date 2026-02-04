import type { Stage, Job, ContextNode, Plan } from "./types";

/* ----------------------------------
 * Context Operations
 * ---------------------------------- */

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

export function addContextToTarget(
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

export function updateContextInPlan(
  plan: Plan,
  contextId: number,
  data: Partial<ContextNode>,
): Plan {
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

  return {
    ...plan,
    stages: updateContextInStages(plan.stages, contextId, data),
  };
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

export function deleteContextFromPlan(plan: Plan, contextId: number): Plan {
  if (plan.contextNodes.some((c) => c.id === contextId)) {
    return {
      ...plan,
      contextNodes: plan.contextNodes.filter((c) => c.id !== contextId),
    };
  }

  return {
    ...plan,
    stages: deleteContextFromStages(plan.stages, contextId),
  };
}
