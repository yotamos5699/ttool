"use server";

import { db } from "@/dbs/drizzle";
import { nodes, type Node } from "@/dbs/drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { getAncestors } from "./query-actions";
import { getAncestorPaths } from "@/lib/ltree";

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
 *    - Inherit includeDependencyIds from ancestors
 *    - Apply excludeDependencyIds to inherited only
 *    - Add includeDependencyIds from the node
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

    return {
      dependencies: included,
      inherited: [],
      included,
      excludedIds: [],
      inheritanceDisabled: true,
    };
  }

  // Get all ancestors
  const ancestors = await getAncestors(node.path, node.tenantId);

  const inheritedIds: number[] = [];
  for (const ancestor of ancestors) {
    const ancestorIncludes = ancestor.includeDependencyIds ?? [];
    if (ancestorIncludes.length > 0) {
      inheritedIds.push(...ancestorIncludes);
    }
  }

  const inheritedFilteredIds = inheritedIds.filter((id) => !excludeSet.has(id));
  const effectiveIds = Array.from(
    new Set([...inheritedFilteredIds, ...includeIds])
  );

  const [inherited, included, dependencies] = await Promise.all([
    inheritedFilteredIds.length > 0
      ? db.query.nodes.findMany({
          where: inArray(nodes.id, inheritedFilteredIds),
        })
      : Promise.resolve([]),
    includeIds.length > 0
      ? db.query.nodes.findMany({
          where: inArray(nodes.id, includeIds),
        })
      : Promise.resolve([]),
    effectiveIds.length > 0
      ? db.query.nodes.findMany({
          where: inArray(nodes.id, effectiveIds),
        })
      : Promise.resolve([]),
  ]);

  return {
    dependencies,
    inherited,
    included,
    excludedIds: [...excludeSet],
    inheritanceDisabled: false,
  };
}

/* ----------------------------------
 * Get Effective Context for Planning
 * Resolves all context nodes for a job/stage plan
 * ---------------------------------- */

export async function getEffectiveContext(
  nodeId: number
): Promise<Node[]> {
  const resolved = await resolveDependencies(nodeId);
  return resolved.dependencies.filter((n) => n.type === "context");
}

/* ----------------------------------
 * Get Effective Data for Planning
 * Resolves all Data nodes for a job/stage plan
 * ---------------------------------- */

export async function getEffectiveData(
  nodeId: number
): Promise<Node[]> {
  const resolved = await resolveDependencies(nodeId);
  return resolved.dependencies.filter((n) => n.type === "data");
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
