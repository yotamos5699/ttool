"use server";

import { db } from "@/dbs/drizzle";
import { nodes, type Node } from "@/dbs/drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { getAncestors, getSubtree, getContextAndIOInSubtree } from "./query-actions";
import { getAncestorPaths } from "@/lib/ltree";
import { deduplicateNodes } from "@/lib/node-utils";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface ResolvedDependencies {
  /** All resolved dependency nodes */
  dependencies: Node[];
  /** Nodes inherited from ancestors */
  inherited: Node[];
  /** Nodes explicitly included */
  included: Node[];
  /** Node IDs that were excluded */
  excludedIds: number[];
  /** Whether inheritance was disabled */
  inheritanceDisabled: boolean;
}

/* ----------------------------------
 * Resolve Dependencies for Node
 * 
 * Algorithm:
 * 1. If disableDependencyInheritance is true:
 *    - Only return explicit includes
 * 2. Otherwise:
 *    - Get all context/io nodes from ancestor subtrees
 *    - Apply excludeDependencyIds filter
 *    - Add includeDependencyIds
 * ---------------------------------- */

export async function resolveDependencies(
  nodeId: number
): Promise<ResolvedDependencies> {
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
  });

  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const excludeSet = new Set(node.excludeDependencyIds ?? []);
  const includeIds = node.includeDependencyIds ?? [];

  // If inheritance is disabled, only return explicit includes
  if (node.disableDependencyInheritance) {
    const included = includeIds.length > 0
      ? await db.query.nodes.findMany({
          where: inArray(nodes.id, includeIds),
        })
      : [];

    // Filter out excluded from includes
    const filtered = included.filter((n) => !excludeSet.has(n.id));

    return {
      dependencies: filtered,
      inherited: [],
      included: filtered,
      excludedIds: [...excludeSet],
      inheritanceDisabled: true,
    };
  }

  // Get all ancestors
  const ancestors = await getAncestors(node.path, node.tenantId);

  // Collect context/io from each ancestor's subtree
  // This includes the ancestor itself and its direct children
  let inherited: Node[] = [];

  for (const ancestor of ancestors) {
    // Get context/io that are direct children of this ancestor
    const subtreeContextIO = await getContextAndIOInSubtree(
      ancestor.path,
      node.tenantId,
      { activeOnly: true }
    );

    // Only include context/io that are direct children of the ancestor
    // (not nested deeper in sibling subtrees)
    const directContextIO = subtreeContextIO.filter((n: Node) => {
      // Check if this node is a direct child of the ancestor
      const expectedPrefix = ancestor.path + ".";
      if (!n.path.startsWith(expectedPrefix)) return false;
      const remainder = n.path.slice(expectedPrefix.length);
      // Direct child has no more dots
      return !remainder.includes(".");
    });

    inherited.push(...directContextIO);
  }

  // Also include context/io that are direct children of the node itself
  const ownContextIO = await getContextAndIOInSubtree(
    node.path,
    node.tenantId,
    { activeOnly: true }
  );

  const directOwn = ownContextIO.filter((n: Node) => {
    const expectedPrefix = node.path + ".";
    if (!n.path.startsWith(expectedPrefix)) return false;
    const remainder = n.path.slice(expectedPrefix.length);
    return !remainder.includes(".");
  });

  inherited.push(...directOwn);

  // Deduplicate inherited
  inherited = deduplicateNodes(inherited);

  // Apply excludes
  const afterExclude = inherited.filter((n) => !excludeSet.has(n.id));

  // Add explicit includes
  let included: Node[] = [];
  if (includeIds.length > 0) {
    included = await db.query.nodes.findMany({
      where: inArray(nodes.id, includeIds),
    });
    // Filter out excluded from includes too
    included = included.filter((n) => !excludeSet.has(n.id));
  }

  // Combine and deduplicate
  const allDependencies = deduplicateNodes([...afterExclude, ...included]);

  return {
    dependencies: allDependencies,
    inherited: afterExclude,
    included,
    excludedIds: [...excludeSet],
    inheritanceDisabled: false,
  };
}

/* ----------------------------------
 * Get Effective Context for Execution
 * Resolves all context nodes for a job/stage execution
 * ---------------------------------- */

export async function getEffectiveContext(
  nodeId: number
): Promise<Node[]> {
  const resolved = await resolveDependencies(nodeId);
  return resolved.dependencies.filter((n) => n.type === "context");
}

/* ----------------------------------
 * Get Effective IO for Execution
 * Resolves all IO nodes for a job/stage execution
 * ---------------------------------- */

export async function getEffectiveIO(
  nodeId: number
): Promise<{ inputs: Node[]; outputs: Node[] }> {
  const resolved = await resolveDependencies(nodeId);
  const ioNodes = resolved.dependencies.filter((n) => n.type === "io");

  // To get direction, we need to join with io_nodes table
  // For now, return all IO nodes (caller should join with ioNodes subnode)
  return {
    inputs: ioNodes, // Would filter by direction = 'input'
    outputs: ioNodes, // Would filter by direction = 'output'
  };
}

/* ----------------------------------
 * Compute Blast Radius
 * Returns upstream and downstream affected nodes
 * ---------------------------------- */

export async function computeBlastRadius(nodeIds: number[]): Promise<{
  upstream: Node[];
  downstream: Node[];
  affected: Node[];
}> {
  if (nodeIds.length === 0) {
    return { upstream: [], downstream: [], affected: [] };
  }

  // Get all the nodes
  const targetNodes = await db.query.nodes.findMany({
    where: inArray(nodes.id, nodeIds),
  });

  if (targetNodes.length === 0) {
    return { upstream: [], downstream: [], affected: [] };
  }

  const tenantId = targetNodes[0].tenantId;
  const planId = targetNodes[0].planId;
  if (!planId) {
    return { upstream: [], downstream: [], affected: [] };
  }

  // Get all nodes in the plan
  const allPlanNodes = await db.query.nodes.findMany({
    where: eq(nodes.planId, planId),
  });

  const upstream: Node[] = [];
  const downstream: Node[] = [];

  for (const target of targetNodes) {
    // Upstream: ancestors of target
    const targetAncestorPaths = new Set(getAncestorPaths(target.path));
    for (const n of allPlanNodes) {
      if (targetAncestorPaths.has(n.path) && !upstream.find((u) => u.id === n.id)) {
        upstream.push(n);
      }
    }

    // Downstream: descendants of target
    for (const n of allPlanNodes) {
      if (
        n.path.startsWith(target.path + ".") &&
        !downstream.find((d) => d.id === n.id)
      ) {
        downstream.push(n);
      }
    }
  }

  // Affected = union of targets, upstream, downstream
  const affectedSet = new Map<number, Node>();
  for (const n of [...targetNodes, ...upstream, ...downstream]) {
    affectedSet.set(n.id, n);
  }

  return {
    upstream,
    downstream,
    affected: [...affectedSet.values()],
  };
}

/* ----------------------------------
 * Preview Dependency Changes
 * Shows what would change if inheritance settings are modified
 * ---------------------------------- */

export async function previewDependencyChanges(
  nodeId: number,
  changes: {
    disableDependencyInheritance?: boolean;
    includeDependencyIds?: number[];
    excludeDependencyIds?: number[];
  }
): Promise<{
  before: Node[];
  after: Node[];
  added: Node[];
  removed: Node[];
}> {
  // Get current dependencies
  const before = await resolveDependencies(nodeId);

  // Get the node and apply hypothetical changes
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
  });

  if (!node) {
    return { before: [], after: [], added: [], removed: [] };
  }

  // Create a modified version of resolution with the changes
  const modifiedNode = {
    ...node,
    disableDependencyInheritance:
      changes.disableDependencyInheritance ?? node.disableDependencyInheritance,
    includeDependencyIds:
      changes.includeDependencyIds ?? node.includeDependencyIds,
    excludeDependencyIds:
      changes.excludeDependencyIds ?? node.excludeDependencyIds,
  };

  // Temporarily update and resolve
  await db
    .update(nodes)
    .set(modifiedNode)
    .where(eq(nodes.id, nodeId));

  const after = await resolveDependencies(nodeId);

  // Restore original
  await db
    .update(nodes)
    .set({
      disableDependencyInheritance: node.disableDependencyInheritance,
      includeDependencyIds: node.includeDependencyIds,
      excludeDependencyIds: node.excludeDependencyIds,
    })
    .where(eq(nodes.id, nodeId));

  // Calculate diff
  const beforeIds = new Set(before.dependencies.map((n) => n.id));
  const afterIds = new Set(after.dependencies.map((n) => n.id));

  const added = after.dependencies.filter((n) => !beforeIds.has(n.id));
  const removed = before.dependencies.filter((n) => !afterIds.has(n.id));

  return {
    before: before.dependencies,
    after: after.dependencies,
    added,
    removed,
  };
}
