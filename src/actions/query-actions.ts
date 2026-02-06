"use server";

import { db } from "@/dbs/drizzle";
import {
  nodes,
  planNodes,
  stageNodes,
  jobNodes,
  contextNodes,
  dataNodes,
  planEdges,
  type Node,
  type NodeType,
} from "@/dbs/drizzle/schema";
import { eq, and, like, sql, inArray, or } from "drizzle-orm";
import { nodesToPlan } from "@/lib/node-utils";
import type { Plan } from "@/stores/plan";

/* ----------------------------------
 * Get Subtree
 * Returns all nodes under a given path (including the node itself)
 * ---------------------------------- */

export async function getSubtree(
  path: string,
  tenantId: number,
  options?: { activeOnly?: boolean; types?: NodeType[] },
): Promise<Node[]> {
  const conditions = [
    eq(nodes.tenantId, tenantId),
    sql`${nodes.path}::ltree <@ ${path}::ltree`,
  ];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  if (options?.types && options.types.length > 0) {
    conditions.push(inArray(nodes.type, options.types));
  }

  const result = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.depth), asc(n.path)],
  });
  return result;
}

/* ----------------------------------
 * Get Ancestors
 * Returns all ancestor nodes of a given path
 * ---------------------------------- */

export async function getAncestors(path: string, tenantId: number): Promise<Node[]> {
  return db.query.nodes.findMany({
    where: and(
      eq(nodes.tenantId, tenantId),
      sql`${nodes.path}::ltree @> ${path}::ltree`,
      sql`${nodes.path} <> ${path}`,
    ),
    orderBy: (n, { asc }) => [asc(n.depth)],
  });
}

/* ----------------------------------
 * Get Direct Children
 * Returns only immediate children of a node
 * ---------------------------------- */

export async function getDirectChildren(
  parentId: number,
  options?: { activeOnly?: boolean; types?: NodeType[] },
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
  options?: { includeSelf?: boolean; activeOnly?: boolean },
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
  options?: { activeOnly?: boolean },
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
 * Get Context and Data Nodes in Subtree
 * Useful for dependency resolution
 * ---------------------------------- */

export async function getContextAndDataInSubtree(
  path: string,
  tenantId: number,
  options?: { activeOnly?: boolean },
): Promise<Node[]> {
  return getSubtree(path, tenantId, {
    ...options,
    types: ["context", "data"],
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
  with:{plan:true,jobNode:true,stageNode:true}});

  
  if (!plan) {
    return { plan: undefined, nodes: [] };
  }

  const allNodes = await db.query.nodes.findMany({
    where: and(
      eq(nodes.planId, planId),
      eq(nodes.active, true),
      sql`${nodes.path}::ltree <@ ${plan.path}::ltree`,
    ),
    orderBy: (n, { asc }) => [asc(n.depth), asc(n.path)],
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

  const nodeIds = allNodes.map((node) => node.id);

  const nodeIdList = nodeIds.length > 0 ? nodeIds : [-1];

  const stageDataList = await db.query.stageNodes.findMany({
    where: inArray(stageNodes.nodeId, nodeIdList),
  });
  const jobDataList = await db.query.jobNodes.findMany({
    where: inArray(jobNodes.nodeId, nodeIdList),
  });
  const contextDataList = await db.query.contextNodes.findMany({
    where: inArray(contextNodes.nodeId, nodeIdList),
  });
  const dataDataList = await db.query.dataNodes.findMany({
    where: inArray(dataNodes.nodeId, nodeIdList),
  });
  const planEdgeList = await db.query.planEdges.findMany({
    where: or(
      inArray(planEdges.fromNodeId, nodeIdList),
      inArray(planEdges.toNodeId, nodeIdList),
    ),
  });

  const stageDataByNodeId = new Map(stageDataList.map((row) => [row.nodeId, row]));
  const jobDataByNodeId = new Map(jobDataList.map((row) => [row.nodeId, row]));
  const contextDataByNodeId = new Map(contextDataList.map((row) => [row.nodeId, row]));
  const dataDataByNodeId = new Map(dataDataList.map((row) => [row.nodeId, row]));

  return nodesToPlan({
    planNode: plan,
    nodes: allNodes,
    planData: planData ?? undefined,
    contextDataByNodeId,
    stageDataByNodeId,
    jobDataByNodeId,
    dataDataByNodeId,
    planEdges: planEdgeList,
  });
}

/* ----------------------------------
 * Find Nodes by Path Pattern
 * ---------------------------------- */

export async function findNodesByPathPattern(
  pattern: string,
  tenantId: number,
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
