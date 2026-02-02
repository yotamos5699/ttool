"use server";

import { db } from "@/dbs/drizzle";
import {
  nodes,
  planNodes,
  type Node,
  type PlanNode,
} from "@/dbs/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPath, getPathDepth } from "@/lib/ltree";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface PlanCreateInput {
  name: string;
  goal: string;
  tenantId: number;
  version?: number;
  parentVersion?: number;
}

export interface PlanUpdateInput {
  name?: string;
  goal?: string;
  version?: number;
  active?: boolean;
  isFrozen?: boolean;
}

export interface PlanWithDetails extends Node {
  planData: PlanNode | null;
}

/* ----------------------------------
 * Create Plan
 * Plans are root nodes (no parent)
 * ---------------------------------- */

export async function createPlan(data: PlanCreateInput): Promise<PlanWithDetails> {
  // Insert base node with temporary path
  const [node] = await db
    .insert(nodes)
    .values({
      type: "plan",
      name: data.name,
      path: "temp",
      depth: 0,
      parentId: null,
      planId: null, // Will be set to self
      tenantId: data.tenantId,
    })
    .returning();

  // Update path with actual ID and set planId to self
  const path = buildPath(null, "plan", node.id);
  const [updated] = await db
    .update(nodes)
    .set({ path, planId: node.id })
    .where(eq(nodes.id, node.id))
    .returning();

  // Insert plan-specific data
  const [planData] = await db
    .insert(planNodes)
    .values({
      nodeId: node.id,
      goal: data.goal,
      version: data.version ?? 1,
      parentVersion: data.parentVersion ?? null,
    })
    .returning();

  revalidatePath("/plans");
  return { ...updated, planData };
}

/* ----------------------------------
 * Get Plan by ID
 * ---------------------------------- */

export async function getPlan(id: number): Promise<PlanWithDetails | null> {
  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, id), eq(nodes.type, "plan")),
  });

  if (!node) return null;

  const planData = await db.query.planNodes.findFirst({
    where: eq(planNodes.nodeId, id),
  });

  return { ...node, planData: planData ?? null };
}

/* ----------------------------------
 * Get All Plans for Tenant
 * ---------------------------------- */

export async function getPlans(
  options?: { tenantId?: number; activeOnly?: boolean }
): Promise<PlanWithDetails[]> {
  const conditions = [eq(nodes.type, "plan")];
  
  // If tenantId provided, filter by it
  if (options?.tenantId) {
    conditions.push(eq(nodes.tenantId, options.tenantId));
  }

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const planNodesResult = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
  });

  // Fetch plan-specific data for all plans
  const planDataMap = new Map<number, PlanNode>();
  if (planNodesResult.length > 0) {
    const planIds = planNodesResult.map((n) => n.id);
    const planDataList = await db.query.planNodes.findMany({
      // Note: Drizzle doesn't have built-in inArray for query API
      // We'll filter manually for now
    });
    for (const pd of planDataList) {
      if (planIds.includes(pd.nodeId)) {
        planDataMap.set(pd.nodeId, pd);
      }
    }
  }

  return planNodesResult.map((n) => ({
    ...n,
    planData: planDataMap.get(n.id) ?? null,
  }));
}

/* ----------------------------------
 * Update Plan
 * ---------------------------------- */

export async function updatePlan(
  id: number,
  data: PlanUpdateInput
): Promise<PlanWithDetails | null> {
  const existing = await getPlan(id);
  if (!existing) return null;

  // Update base node
  const nodeUpdates: Partial<Node> = { updatedAt: new Date() };
  if (data.name !== undefined) nodeUpdates.name = data.name;
  if (data.active !== undefined) nodeUpdates.active = data.active;
  if (data.isFrozen !== undefined) nodeUpdates.isFrozen = data.isFrozen;

  const [updatedNode] = await db
    .update(nodes)
    .set(nodeUpdates)
    .where(eq(nodes.id, id))
    .returning();

  // Update plan-specific data
  const planUpdates: Partial<PlanNode> = {};
  if (data.goal !== undefined) planUpdates.goal = data.goal;
  if (data.version !== undefined) planUpdates.version = data.version;

  let planData = existing.planData;
  if (Object.keys(planUpdates).length > 0) {
    const [updated] = await db
      .update(planNodes)
      .set(planUpdates)
      .where(eq(planNodes.nodeId, id))
      .returning();
    planData = updated;
  }

  revalidatePath("/plans");
  return { ...updatedNode, planData };
}

/* ----------------------------------
 * Delete Plan
 * Cascades to all children via FK
 * ---------------------------------- */

export async function deletePlan(id: number): Promise<boolean> {
  const existing = await getPlan(id);
  if (!existing) return false;

  await db.delete(nodes).where(eq(nodes.id, id));
  revalidatePath("/plans");
  return true;
}

/* ----------------------------------
 * Fork Plan
 * Creates a new version of a plan
 * ---------------------------------- */

export async function forkPlan(
  planId: number,
  options?: { name?: string; tenantId?: number }
): Promise<PlanWithDetails | null> {
  const original = await getPlan(planId);
  if (!original || !original.planData) return null;

  const newPlan = await createPlan({
    name: options?.name ?? `${original.name} (Fork)`,
    goal: original.planData.goal,
    tenantId: options?.tenantId ?? original.tenantId,
    version: original.planData.version + 1,
    parentVersion: original.planData.version,
  });

  // TODO: Deep copy all child nodes (stages, jobs, context, io)

  return newPlan;
}
