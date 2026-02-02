"use server";

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/dbs/drizzle";
import {
  replanSessions,
  nodes,
  stageNodes,
  jobNodes,
  type ReplanSession,
  type ReplanSessionInsert,
} from "@/dbs/drizzle/schema";
import { getSubtree, getAncestors } from "./query-actions";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface BlastRadius {
  upstream: number[]; // Nodes that depend on the affected nodes
  downstream: number[]; // Nodes the affected nodes depend on
  affected: number[]; // All affected nodes (includes scope nodes)
}

/* ----------------------------------
 * Replan Sessions CRUD
 * ---------------------------------- */

/**
 * Create a new replan session
 */
export async function createReplanSession(
  data: Omit<ReplanSessionInsert, "id" | "createdAt" | "updatedAt">
): Promise<ReplanSession> {
  const [session] = await db.insert(replanSessions).values(data).returning();
  return session;
}

/**
 * Get a replan session by ID
 */
export async function getReplanSession(id: number): Promise<ReplanSession | null> {
  const [session] = await db
    .select()
    .from(replanSessions)
    .where(eq(replanSessions.id, id));
  return session ?? null;
}

/**
 * Get all replan sessions for a plan
 */
export async function getReplanSessionsForPlan(
  planNodeId: number
): Promise<ReplanSession[]> {
  return db
    .select()
    .from(replanSessions)
    .where(eq(replanSessions.planNodeId, planNodeId))
    .orderBy(desc(replanSessions.createdAt));
}

/**
 * Get active replan sessions for a plan (draft or in_progress)
 */
export async function getActiveReplanSessions(
  planNodeId: number
): Promise<ReplanSession[]> {
  return db
    .select()
    .from(replanSessions)
    .where(
      and(
        eq(replanSessions.planNodeId, planNodeId),
        eq(replanSessions.status, "draft")
      )
    )
    .orderBy(desc(replanSessions.createdAt));
}

/**
 * Update a replan session
 */
export async function updateReplanSession(
  id: number,
  data: Partial<Omit<ReplanSessionInsert, "id" | "createdAt">>
): Promise<ReplanSession> {
  const [session] = await db
    .update(replanSessions)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(replanSessions.id, id))
    .returning();
  return session;
}

/**
 * Update replan session status
 */
export async function updateReplanSessionStatus(
  id: number,
  status: ReplanSession["status"]
): Promise<ReplanSession> {
  return updateReplanSession(id, { status });
}

/**
 * Start a replan session (move from draft to in_progress)
 */
export async function startReplanSession(id: number): Promise<ReplanSession> {
  return updateReplanSessionStatus(id, "in_progress");
}

/**
 * Commit a replan session (finalize changes)
 */
export async function commitReplanSession(id: number): Promise<ReplanSession> {
  return updateReplanSessionStatus(id, "committed");
}

/**
 * Abort a replan session (cancel without applying changes)
 */
export async function abortReplanSession(id: number): Promise<ReplanSession> {
  return updateReplanSessionStatus(id, "aborted");
}

/**
 * Delete a replan session
 */
export async function deleteReplanSession(id: number): Promise<void> {
  await db.delete(replanSessions).where(eq(replanSessions.id, id));
}

/* ----------------------------------
 * Blast Radius Calculations
 * ---------------------------------- */

/**
 * Calculate the blast radius for a set of node IDs
 * Uses dependency relationships to find upstream/downstream affected nodes
 */
export async function calculateBlastRadius(
  planNodeId: number,
  nodeIds: number[],
  tenantId: number
): Promise<BlastRadius> {
  // Get the plan node first
  const planNode = await db.query.nodes.findFirst({
    where: eq(nodes.id, planNodeId),
  });

  if (!planNode) {
    return { upstream: [], downstream: [], affected: nodeIds };
  }

  // Get all nodes in the plan
  const allNodes = await getSubtree(planNode.path, tenantId);

  // Get all stage and job nodes for dependency analysis
  const stageNodesData = await db
    .select()
    .from(stageNodes)
    .where(
      eq(
        stageNodes.nodeId,
        db.select({ id: nodes.id }).from(nodes).where(eq(nodes.planId, planNodeId))
      )
    );

  const jobNodesData = await db
    .select()
    .from(jobNodes)
    .where(
      eq(
        jobNodes.nodeId,
        db.select({ id: nodes.id }).from(nodes).where(eq(nodes.planId, planNodeId))
      )
    );

  // Build dependency maps
  const dependsOnMap = new Map<number, number[]>(); // nodeId -> nodes it depends on
  const dependedByMap = new Map<number, number[]>(); // nodeId -> nodes that depend on it

  for (const stage of stageNodesData) {
    if (stage.dependsOnNodeIds && stage.dependsOnNodeIds.length > 0) {
      dependsOnMap.set(stage.nodeId, stage.dependsOnNodeIds);
      for (const depId of stage.dependsOnNodeIds) {
        const existing = dependedByMap.get(depId) || [];
        dependedByMap.set(depId, [...existing, stage.nodeId]);
      }
    }
  }

  for (const job of jobNodesData) {
    if (job.dependsOnNodeIds && job.dependsOnNodeIds.length > 0) {
      dependsOnMap.set(job.nodeId, job.dependsOnNodeIds);
      for (const depId of job.dependsOnNodeIds) {
        const existing = dependedByMap.get(depId) || [];
        dependedByMap.set(depId, [...existing, job.nodeId]);
      }
    }
  }

  // Find downstream (what the affected nodes depend on)
  const downstream = new Set<number>();
  const downstreamQueue = [...nodeIds];
  while (downstreamQueue.length > 0) {
    const current = downstreamQueue.shift()!;
    const deps = dependsOnMap.get(current) || [];
    for (const dep of deps) {
      if (!downstream.has(dep) && !nodeIds.includes(dep)) {
        downstream.add(dep);
        downstreamQueue.push(dep);
      }
    }
  }

  // Find upstream (what depends on the affected nodes)
  const upstream = new Set<number>();
  const upstreamQueue = [...nodeIds];
  while (upstreamQueue.length > 0) {
    const current = upstreamQueue.shift()!;
    const dependents = dependedByMap.get(current) || [];
    for (const dep of dependents) {
      if (!upstream.has(dep) && !nodeIds.includes(dep)) {
        upstream.add(dep);
        upstreamQueue.push(dep);
      }
    }
  }

  // Also include children of affected nodes in affected set
  const affected = new Set<number>(nodeIds);
  for (const nodeId of nodeIds) {
    const children = allNodes.filter((n) => n.parentId === nodeId);
    for (const child of children) {
      affected.add(child.id);
    }
  }

  return {
    upstream: Array.from(upstream),
    downstream: Array.from(downstream),
    affected: Array.from(affected),
  };
}

/**
 * Initiate a replan session for specific nodes
 * Calculates blast radius and creates the session
 */
export async function initiateReplan(params: {
  planNodeId: number;
  tenantId: number;
  scopeType: ReplanSession["scopeType"];
  scopeNodeIds: number[];
  createdBy: ReplanSession["createdBy"];
  proposedChanges?: unknown;
}): Promise<ReplanSession> {
  // Calculate blast radius
  const blastRadius = await calculateBlastRadius(
    params.planNodeId,
    params.scopeNodeIds,
    params.tenantId
  );

  // Get original snapshot of affected nodes
  const originalNodes = await db
    .select()
    .from(nodes)
    .where(eq(nodes.planId, params.planNodeId));

  const affectedOriginals = originalNodes.filter((n) =>
    blastRadius.affected.includes(n.id)
  );

  return createReplanSession({
    planNodeId: params.planNodeId,
    scopeType: params.scopeType,
    scopeNodeIds: params.scopeNodeIds,
    blastRadius,
    createdBy: params.createdBy,
    originalSnapshot: affectedOriginals,
    proposedChanges: params.proposedChanges,
    status: "draft",
  });
}

/**
 * Get affected nodes for a replan session
 */
export async function getAffectedNodes(
  sessionId: number
): Promise<typeof nodes.$inferSelect[]> {
  const session = await getReplanSession(sessionId);
  if (!session) return [];

  const blastRadius = session.blastRadius as BlastRadius;
  const allAffectedIds = [
    ...blastRadius.affected,
    ...blastRadius.upstream,
    ...blastRadius.downstream,
  ];

  if (allAffectedIds.length === 0) return [];

  return db
    .select()
    .from(nodes)
    .where(eq(nodes.planId, session.planNodeId));
}
