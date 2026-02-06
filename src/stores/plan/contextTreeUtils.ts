import type { ContextNode, Plan } from "./types";
import { findPlanNode, updatePlanNode } from "./planTreeUtils";

/* ----------------------------------
 * Context Operations
 * ---------------------------------- */

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

  const target = findPlanNode(plan.parts, targetId);
  if (!target) return plan;
  const nextContext = [...(target.contextNodes ?? []), context];
  return {
    ...plan,
    parts: updatePlanNode(plan.parts, targetId, { contextNodes: nextContext }),
  };
}

export function updateContextInPlan(
  plan: Plan,
  contextId: number,
  data: Partial<ContextNode>,
): Plan {
  const planContextIndex = plan.contextNodes.findIndex((c) => c.id === contextId);
  if (planContextIndex !== -1) {
    const updatedContextNodes = [...plan.contextNodes];
    updatedContextNodes[planContextIndex] = {
      ...updatedContextNodes[planContextIndex],
      ...data,
    };
    return { ...plan, contextNodes: updatedContextNodes };
  }

  const updateNodeContext = (nodeId: number) => {
    const node = findPlanNode(plan.parts, nodeId);
    if (!node?.contextNodes) return plan;
    const updatedContext = node.contextNodes.map((c) =>
      c.id === contextId ? { ...c, ...data } : c,
    );
    return {
      ...plan,
      parts: updatePlanNode(plan.parts, nodeId, { contextNodes: updatedContext }),
    };
  };

  for (const node of plan.parts) {
    if (node.contextNodes?.some((c) => c.id === contextId)) {
      return updateNodeContext(node.id);
    }
  }

  return plan;
}

export function deleteContextFromPlan(plan: Plan, contextId: number): Plan {
  if (plan.contextNodes.some((c) => c.id === contextId)) {
    return {
      ...plan,
      contextNodes: plan.contextNodes.filter((c) => c.id !== contextId),
    };
  }

  const target = plan.parts.find((node) =>
    node.contextNodes?.some((c) => c.id === contextId),
  );
  if (!target) return plan;
  const nextContext = target.contextNodes?.filter((c) => c.id !== contextId) ?? [];
  return {
    ...plan,
    parts: updatePlanNode(plan.parts, target.id, { contextNodes: nextContext }),
  };
}
