import type {
  Node,
  NodeType,
  PlanEdge,
  ContextNode as DbContextNode,
  PlanSelect,
} from "@/dbs/drizzle/schema";
import { buildPath, getPathDepth } from "./ltree";
import type {
  Plan,
  PlanNode as StorePlanNode,
  ContextNode as StoreContextNode,
  PlanEdge as StorePlanEdge,
  NodeDependencies,
} from "@/stores/plan";

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
export function groupNodesByType(nodes: Node[]): Record<string, Node[]> {
  const groups: Record<string, Node[]> = {};

  for (const node of nodes) {
    if (!groups[node.type]) {
      groups[node.type] = [];
    }
    groups[node.type].push(node);
  }

  return groups;
}

/**
 * Sort nodes by depth (ancestors first)
 */
export function sortNodesByDepth(nodes: Node[], ascending = true): Node[] {
  return [...nodes].sort((a, b) => (ascending ? a.depth - b.depth : b.depth - a.depth));
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
  includeIds: number[],
): Node[] {
  const excludeSet = new Set(excludeIds);

  // Filter out excluded
  const result = allDependencies.filter((n) => !excludeSet.has(n.id));

  // Note: includeIds would add nodes that aren't in allDependencies
  // This function only filters the provided dependencies
  // Adding external includes should be done at the caller level

  return result;
}

/**
 * Convert flat node list to nested Plan structure for the store
 * This bridges the new flat node schema with the existing store/components
 */
export function nodesToPlan(params: {
  plan: PlanSelect;
  nodes: Node[];
  contextNodes: DbContextNode[];
  dataDataByNodeId: Map<number, { payload: unknown }>;
  planEdges: PlanEdge[];
}): Plan {
  const nodeMap = new Map<number, Node>();
  for (const node of params.nodes) {
    nodeMap.set(node.id, node);
  }

  const rootNode = params.plan.rootNodeId
    ? (nodeMap.get(params.plan.rootNodeId) ?? null)
    : null;

  const groups = groupNodesByType(params.nodes);
  const nodesByType: Record<string, number[]> = {};
  for (const [type, items] of Object.entries(groups)) {
    nodesByType[type] = items.map((node) => node.id);
  }

  const contextByNodeId = new Map<number, StoreContextNode[]>();
  for (const ctx of params.contextNodes) {
    const contextNode: StoreContextNode = {
      id: ctx.id,
      level: "context",
      type: ctx.contextType,
      title: ctx.title,
      payload: ctx.payload,
      parentId: ctx.parentId ?? null,
    };
    const list = contextByNodeId.get(ctx.nodeId) ?? [];
    list.push(contextNode);
    contextByNodeId.set(ctx.nodeId, list);
  }

  const dataNodesByParent = new Map<number, number[]>();
  for (const dataNode of groups.data ?? []) {
    if (!dataNode.parentId) continue;
    const list = dataNodesByParent.get(dataNode.parentId) ?? [];
    list.push(dataNode.id);
    dataNodesByParent.set(dataNode.parentId, list);
  }

  const dependenciesByNodeId = new Map<number, NodeDependencies>();
  for (const node of params.nodes) {
    dependenciesByNodeId.set(node.id, {
      includeDependencyIds: node.includeDependencyIds ?? [],
      excludeDependencyIds: node.excludeDependencyIds ?? [],
      disableDependencyInheritance: node.disableDependencyInheritance ?? false,
    });
  }

  const edges: StorePlanEdge[] = params.planEdges.map((edge) => ({
    id: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    kind: edge.kind,
    role: edge.role ?? undefined,
  }));

  const buildPlanNodeTree = (parentId: number | null): StorePlanNode[] => {
    const children = params.nodes.filter((node) => node.parentId === parentId);
    return children.map((child) => {
      const ctx = contextByNodeId.get(child.id) ?? [];
      const dataNodeIds = dataNodesByParent.get(child.id) ?? [];
      const deps = dependenciesByNodeId.get(child.id) ?? {
        includeDependencyIds: [],
        excludeDependencyIds: [],
        disableDependencyInheritance: false,
      };

      return {
        id: child.id,
        type: child.type as "stage" | "job" | "context" | "data",
        title: child.name,
        description: child.description ?? null,
        executionMode: child.executionMode ?? undefined,
        contextNodes: ctx,
        dataNodeIds,
        dependencies: deps,
        childNodes: buildPlanNodeTree(child.id),
        lastUpdatedAt: child.lastUpdatedAt,
      };
    });
  };

  const planDependencies = rootNode
    ? (dependenciesByNodeId.get(rootNode.id) ?? {
        includeDependencyIds: [],
        excludeDependencyIds: [],
        disableDependencyInheritance: false,
      })
    : {
        includeDependencyIds: [],
        excludeDependencyIds: [],
        disableDependencyInheritance: false,
      };

  return {
    id: params.plan.id,
    tenantId: params.plan.tenantId,
    name: params.plan.name,
    goal: params.plan.goal,
    version: params.plan.version,
    parentVersion: params.plan.parentVersion ?? null,
    rootNodeId: params.plan.rootNodeId ?? null,
    rootNodeLastUpdatedAt: rootNode?.lastUpdatedAt,
    parts: rootNode ? buildPlanNodeTree(rootNode.id) : buildPlanNodeTree(null),
    contextNodes: rootNode ? (contextByNodeId.get(rootNode.id) ?? []) : [],
    dependencies: planDependencies,
    dataNodeIds: rootNode ? (dataNodesByParent.get(rootNode.id) ?? []) : [],
    edges,
    nodesByType,
  };
}
