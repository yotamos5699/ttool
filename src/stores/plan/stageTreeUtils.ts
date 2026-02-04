import type { Stage } from "./types";

/* ----------------------------------
 * Stage Tree Operations
 * ---------------------------------- */

export function updateStageInTree(
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

export function deleteStageFromTree(stages: Stage[], id: number): Stage[] {
  return stages
    .filter((stage) => stage.id !== id)
    .map((stage) => ({
      ...stage,
      childStages: stage.childStages
        ? deleteStageFromTree(stage.childStages, id)
        : undefined,
    }));
}

export function addStageToTree(
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
