"use server";

import { db } from "@/dbs/drizzle";
import { nodes, planNodes, type Node, type NodeType } from "@/dbs/drizzle/schema";
import { eq, and, like, sql } from "drizzle-orm";
import { getAncestorPaths, isDescendantOf } from "@/lib/ltree";
import { nodesToPlan } from "@/lib/node-utils";
import type { Plan } from "@/stores/planStore";

/* ----------------------------------
 * Get Subtree
 * Returns all nodes under a given path (including the node itself)
 * ---------------------------------- */

export async function getSubtree(
  path: string,
  tenantId: number,
  options?: { activeOnly?: boolean; types?: NodeType[] }
): Promise<Node[]> {
  // Use LIKE for ltree descendant matching: path starts with prefix.
  const pathPrefix = `${path}.%`;

  const allNodes = await db.query.nodes.findMany({
    where: eq(nodes.tenantId, tenantId),
    orderBy: (n, { asc }) => [asc(n.depth), asc(n.path)],
  });

  // Filter to descendants
  let result = allNodes.filter(
    (n) => n.path === path || n.path.startsWith(path + ".")
  );

  if (options?.activeOnly) {
    result = result.filter((n) => n.active);
  }

  if (options?.types && options.types.length > 0) {
    const typeSet = new Set(options.types);
    result = result.filter((n) => typeSet.has(n.type));
  }

  return result;
}

/* ----------------------------------
 * Get Ancestors
 * Returns all ancestor nodes of a given path
 * ---------------------------------- */

export async function getAncestors(
  path: string,
  tenantId: number
): Promise<Node[]> {
  const ancestorPaths = getAncestorPaths(path);
  if (ancestorPaths.length === 0) return [];

  const allNodes = await db.query.nodes.findMany({
    where: eq(nodes.tenantId, tenantId),
    orderBy: (n, { asc }) => [asc(n.depth)],
  });

  // Filter to ancestors
  const pathSet = new Set(ancestorPaths);
  return allNodes.filter((n) => pathSet.has(n.path));
}

/* ----------------------------------
 * Get Direct Children
 * Returns only immediate children of a node
 * ---------------------------------- */

export async function getDirectChildren(
  parentId: number,
  options?: { activeOnly?: boolean; types?: NodeType[] }
): Promise<Node[]> {
  const conditions = [eq(nodes.parentId, parentId)];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  let result = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (options?.types && options.types.length > 0) {
    const typeSet = new Set(options.types);
    result = result.filter((n) => typeSet.has(n.type));
  }

  return result;
}

/* ----------------------------------
 * Get Siblings
 * Returns nodes with the same parent
 * ---------------------------------- */

export async function getSiblings(
  nodeId: number,
  options?: { includeSelf?: boolean; activeOnly?: boolean }
): Promise<Node[]> {
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
  });
  if (!node) return [];

  const conditions = node.parentId
    ? [eq(nodes.parentId, node.parentId)]
    : [eq(nodes.parentId, sql`NULL`)];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  let result = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (!options?.includeSelf) {
    result = result.filter((n) => n.id !== nodeId);
  }

  return result;
}

/* ----------------------------------
 * Get Nodes by Type in Plan
 * ---------------------------------- */

export async function getNodesByTypeInPlan(
  planId: number,
  type: NodeType,
  options?: { activeOnly?: boolean }
): Promise<Node[]> {
  const conditions = [eq(nodes.planId, planId), eq(nodes.type, type)];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  return db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });
}

/* ----------------------------------
 * Get Context and IO Nodes in Subtree
 * Useful for dependency resolution
 * ---------------------------------- */

export async function getContextAndIOInSubtree(
  path: string,
  tenantId: number,
  options?: { activeOnly?: boolean }
): Promise<Node[]> {
  return getSubtree(path, tenantId, {
    ...options,
    types: ["context", "io"],
  });
}

/* ----------------------------------
 * Get Plan Tree
 * Returns the complete plan with all descendants
 * ---------------------------------- */

export async function getPlanTree(planId: number): Promise<{
  plan: Node | undefined;
  nodes: Node[];
}> {
  const plan = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, planId), eq(nodes.type, "plan")),
  });

  if (!plan) {
    return { plan: undefined, nodes: [] };
  }

  const allNodes = await getSubtree(plan.path, plan.tenantId, {
    activeOnly: true,
  });

  return { plan, nodes: allNodes };
}

/* ----------------------------------
 * Get Plan as Store Type
 * Returns the plan formatted for the Zustand store
 * ---------------------------------- */

export async function getPlanForStore(planId: number): Promise<Plan | null> {
  const { plan, nodes: allNodes } = await getPlanTree(planId);

  if (!plan) {
    return null;
  }

  // Get plan-specific data
  const planData = await db.query.planNodes.findFirst({
    where: eq(planNodes.nodeId, planId),
  });

  return nodesToPlan(plan, allNodes, planData ?? undefined);
}

/* ----------------------------------
 * Find Nodes by Path Pattern
 * ---------------------------------- */

export async function findNodesByPathPattern(
  pattern: string,
  tenantId: number
): Promise<Node[]> {
  return db.query.nodes.findMany({
    where: and(eq(nodes.tenantId, tenantId), like(nodes.path, pattern)),
    orderBy: (n, { asc }) => [asc(n.path)],
  });
}

/* ----------------------------------
 * Get Node with Ancestors
 * Returns a node along with all its ancestors
 * ---------------------------------- */

export async function getNodeWithAncestors(nodeId: number): Promise<{
  node: Node | undefined;
  ancestors: Node[];
}> {
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
  });

  if (!node) {
    return { node: undefined, ancestors: [] };
  }

  const ancestors = await getAncestors(node.path, node.tenantId);
  return { node, ancestors };
}

/* ----------------------------------
 * Get Node Depth Statistics
 * Returns max depth and node count per depth
 * ---------------------------------- */

export async function getDepthStats(planId: number): Promise<{
  maxDepth: number;
  depthCounts: Record<number, number>;
}> {
  const allNodes = await db.query.nodes.findMany({
    where: and(eq(nodes.planId, planId), eq(nodes.active, true)),
  });

  const depthCounts: Record<number, number> = {};
  let maxDepth = 0;

  for (const node of allNodes) {
    depthCounts[node.depth] = (depthCounts[node.depth] || 0) + 1;
    maxDepth = Math.max(maxDepth, node.depth);
  }

  return { maxDepth, depthCounts };
}
