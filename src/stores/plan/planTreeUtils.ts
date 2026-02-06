import type { PlanNode } from "./types";

/* ----------------------------------
 * Plan Tree Operations
 * ---------------------------------- */

export function flattenPlanNodes(nodes: PlanNode[]): PlanNode[] {
  const result: PlanNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.childNodes) {
      result.push(...flattenPlanNodes(node.childNodes));
    }
  }
  return result;
}

export function findPlanNode(nodes: PlanNode[], id: number): PlanNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.childNodes) {
      const found = findPlanNode(node.childNodes, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function updatePlanNode(
  nodes: PlanNode[],
  id: number,
  data: Partial<PlanNode>,
): PlanNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, ...data };
    }
    if (node.childNodes) {
      return {
        ...node,
        childNodes: updatePlanNode(node.childNodes, id, data),
      };
    }
    return node;
  });
}
