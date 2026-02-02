import type { Node, NodeType } from "@/dbs/drizzle/schema";
import { buildPath, getPathDepth } from "./ltree";
import type { Plan, Stage, Job, ContextNode as StoreContextNode } from "@/stores/planStore";

/**
 * Node Utility Functions
 *
 * Helpers for working with the unified node model
 */

/**
 * Prepare a node for insertion
 * Computes path and depth from parent
 */
export function prepareNodeForInsert(params: {
  type: NodeType;
  name: string;
  parentPath: string | null;
  parentId: number | null;
  planId: number;
  tenantId: number;
  tempId: number; // Temporary ID for path construction (will be replaced)
}): {
  type: NodeType;
  name: string;
  path: string;
  depth: number;
  parentId: number | null;
  planId: number;
  tenantId: number;
} {
  const path = buildPath(params.parentPath, params.type, params.tempId);
  const depth = getPathDepth(path);

  return {
    type: params.type,
    name: params.name,
    path,
    depth,
    parentId: params.parentId,
    planId: params.planId,
    tenantId: params.tenantId,
  };
}

/**
 * Group nodes by type
 */
export function groupNodesByType(nodes: Node[]): Record<NodeType, Node[]> {
  const groups: Record<NodeType, Node[]> = {
    plan: [],
    stage: [],
    job: [],
    context: [],
    io: [],
  };

  for (const node of nodes) {
    groups[node.type].push(node);
  }

  return groups;
}

/**
 * Sort nodes by depth (ancestors first)
 */
export function sortNodesByDepth(nodes: Node[], ascending = true): Node[] {
  return [...nodes].sort((a, b) =>
    ascending ? a.depth - b.depth : b.depth - a.depth
  );
}

/**
 * Sort nodes by path (natural tree order)
 */
export function sortNodesByPath(nodes: Node[]): Node[] {
  return [...nodes].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Build a tree structure from flat nodes
 */
export function buildNodeTree(nodes: Node[]): NodeTreeNode[] {
  const nodeMap = new Map<number, NodeTreeNode>();
  const roots: NodeTreeNode[] = [];

  // First pass: create all tree nodes
  for (const node of nodes) {
    nodeMap.set(node.id, { node, children: [] });
  }

  // Second pass: link parents and children
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  // Sort children by path
  const sortChildren = (treeNode: NodeTreeNode) => {
    treeNode.children.sort((a, b) => a.node.path.localeCompare(b.node.path));
    treeNode.children.forEach(sortChildren);
  };

  roots.forEach(sortChildren);
  roots.sort((a, b) => a.node.path.localeCompare(b.node.path));

  return roots;
}

export interface NodeTreeNode {
  node: Node;
  children: NodeTreeNode[];
}

/**
 * Flatten a tree back to array (depth-first)
 */
export function flattenNodeTree(tree: NodeTreeNode[]): Node[] {
  const result: Node[] = [];

  const traverse = (treeNodes: NodeTreeNode[]) => {
    for (const treeNode of treeNodes) {
      result.push(treeNode.node);
      traverse(treeNode.children);
    }
  };

  traverse(tree);
  return result;
}

/**
 * Filter nodes to only include specific types
 */
export function filterNodesByType(nodes: Node[], types: NodeType[]): Node[] {
  const typeSet = new Set(types);
  return nodes.filter((n) => typeSet.has(n.type));
}

/**
 * Find a node by ID in a flat array
 */
export function findNodeById(nodes: Node[], id: number): Node | undefined {
  return nodes.find((n) => n.id === id);
}

/**
 * Get all node IDs from an array
 */
export function getNodeIds(nodes: Node[]): number[] {
  return nodes.map((n) => n.id);
}

/**
 * Deduplicate nodes by ID
 */
export function deduplicateNodes(nodes: Node[]): Node[] {
  const seen = new Set<number>();
  return nodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

/**
 * Check if node has dependency inheritance enabled
 */
export function hasDependencyInheritance(node: Node): boolean {
  return !node.disableDependencyInheritance;
}

/**
 * Get effective dependencies for a node (respecting includes/excludes)
 */
export function applyDependencyFilters(
  allDependencies: Node[],
  excludeIds: number[],
  includeIds: number[]
): Node[] {
  const excludeSet = new Set(excludeIds);

  // Filter out excluded
  let result = allDependencies.filter((n) => !excludeSet.has(n.id));

  // Note: includeIds would add nodes that aren't in allDependencies
  // This function only filters the provided dependencies
  // Adding external includes should be done at the caller level

  return result;
}

/**
 * Convert flat node list to nested Plan structure for the store
 * This bridges the new flat node schema with the existing store/components
 */
export function nodesToPlan(planNode: Node, allNodes: Node[], planData?: { goal: string; version: number; parentVersion: number | null }): Plan {
  const nodeMap = new Map<number, Node>();
  for (const node of allNodes) {
    nodeMap.set(node.id, node);
  }

  // Group nodes by type
  const groups = groupNodesByType(allNodes);
  
  // Build context nodes lookup by parent
  const contextByParent = new Map<number, StoreContextNode[]>();
  for (const ctx of groups.context) {
    const parentId = ctx.parentId;
    if (parentId) {
      if (!contextByParent.has(parentId)) {
        contextByParent.set(parentId, []);
      }
      contextByParent.get(parentId)!.push({
        id: ctx.id,
        level: ctx.type, // context type
        type: ctx.name, // using name as type for now
        title: ctx.name,
        payload: "", // Would need to join with contextNodes table
      });
    }
  }

  // Build jobs map with children
  const jobMap = new Map<number, Job>();
  const jobsByStage = new Map<number, Job[]>();
  
  for (const jobNode of groups.job) {
    const job: Job = {
      id: jobNode.id,
      stageId: jobNode.stageId ?? 0,
      parentJobId: jobNode.parentId && nodeMap.get(jobNode.parentId)?.type === "job" ? jobNode.parentId : null,
      title: jobNode.name,
      description: null, // Description is in jobNodes subnode table
      dependsOn: [],
      dependsOnStages: [],
      dependsOnJobs: [],
      childJobs: [],
      contextNodes: contextByParent.get(jobNode.id) ?? [],
    };
    jobMap.set(jobNode.id, job);
  }

  // Link job children
  for (const job of jobMap.values()) {
    if (job.parentJobId && jobMap.has(job.parentJobId)) {
      jobMap.get(job.parentJobId)!.childJobs!.push(job);
    } else {
      // Root job - add to stage
      const stageId = job.stageId;
      if (!jobsByStage.has(stageId)) {
        jobsByStage.set(stageId, []);
      }
      jobsByStage.get(stageId)!.push(job);
    }
  }

  // Build stages map with children
  const stageMap = new Map<number, Stage>();
  const stagesByParent = new Map<number | null, Stage[]>();

  for (const stageNode of groups.stage) {
    const parentStageId = stageNode.parentId && nodeMap.get(stageNode.parentId)?.type === "stage" 
      ? stageNode.parentId 
      : null;
    
    const stage: Stage = {
      id: stageNode.id,
      planId: stageNode.planId ?? planNode.id,
      parentStageId,
      title: stageNode.name,
      description: null, // Description is in stageNodes subnode table
      executionMode: "sequential", // Would need to join with stageNodes table
      dependsOn: [],
      dependsOnStages: [],
      childStages: [],
      jobs: jobsByStage.get(stageNode.id) ?? [],
      contextNodes: contextByParent.get(stageNode.id) ?? [],
    };
    stageMap.set(stageNode.id, stage);
  }

  // Link stage children
  for (const stage of stageMap.values()) {
    if (stage.parentStageId && stageMap.has(stage.parentStageId)) {
      stageMap.get(stage.parentStageId)!.childStages!.push(stage);
    } else {
      // Root stage
      const key = stage.parentStageId;
      if (!stagesByParent.has(key)) {
        stagesByParent.set(key, []);
      }
      stagesByParent.get(key)!.push(stage);
    }
  }

  // Build plan
  const plan: Plan = {
    id: planNode.id,
    name: planNode.name,
    goal: planData?.goal ?? "",
    version: planData?.version ?? 1,
    parentVersion: planData?.parentVersion ?? null,
    stages: stagesByParent.get(null) ?? [],
    contextNodes: contextByParent.get(planNode.id) ?? [],
  };

  return plan;
}
