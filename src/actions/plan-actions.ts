"use server";

import { db } from "@/dbs/drizzle";
import { nodes, plans, type Node, type PlanSelect } from "@/dbs/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPath } from "@/lib/ltree";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface PlanCreateInput {
  name: string;
  goal: string;
  tenantId: number;
  version?: number;
  parentVersion?: number;
  disableDependencyInheritance?: boolean;
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
}

export interface PlanUpdateInput {
  name?: string;
  goal?: string;
  version?: number;
  active?: boolean;
  isFrozen?: boolean;
  disableDependencyInheritance?: boolean;
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
}

export interface PlanWithDetails {
  plan: PlanSelect;
  rootNode: Node | null;
}

/* ----------------------------------
 * Create Plan
 * Plans are root nodes (no parent)
 * ---------------------------------- */

export async function createPlan(data: PlanCreateInput): Promise<PlanWithDetails> {
  const [plan] = await db
    .insert(plans)
    .values({
      name: data.name,
      goal: data.goal,
      version: data.version ?? 1,
      parentVersion: data.parentVersion ?? null,
      tenantId: data.tenantId,
      active: true,
    })
    .returning();

  const [rootNode] = await db
    .insert(nodes)
    .values({
      type: "stage",
      name: data.name,
      path: "temp",
      depth: 0,
      parentId: null,
      planId: plan.id,
      tenantId: data.tenantId,
      disableDependencyInheritance: data.disableDependencyInheritance ?? false,
      includeDependencyIds: data.includeDependencyIds ?? [],
      excludeDependencyIds: data.excludeDependencyIds ?? [],
    })
    .returning();

  const path = buildPath(null, rootNode.type, rootNode.id);
  const [updatedRoot] = await db
    .update(nodes)
    .set({ path })
    .where(eq(nodes.id, rootNode.id))
    .returning();

  const [updatedPlan] = await db
    .update(plans)
    .set({ rootNodeId: rootNode.id })
    .where(eq(plans.id, plan.id))
    .returning();

  revalidatePath("/plans");
  return { plan: updatedPlan, rootNode: updatedRoot ?? rootNode };
}

/* ----------------------------------
 * Get Plan by ID
 * ---------------------------------- */

export async function getPlan(id: number): Promise<PlanWithDetails | null> {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, id),
  });

  if (!plan) return null;

  const rootNode = plan.rootNodeId
    ? await db.query.nodes.findFirst({
        where: eq(nodes.id, plan.rootNodeId),
      })
    : null;

  return { plan, rootNode: rootNode ?? null };
}

/* ----------------------------------
 * Get All Plans for Tenant
 * ---------------------------------- */

export async function getPlans(options?: {
  tenantId?: number;
  activeOnly?: boolean;
}): Promise<PlanWithDetails[]> {
  const conditions = [] as ReturnType<typeof and>[];

  if (options?.tenantId) {
    conditions.push(eq(plans.tenantId, options.tenantId));
  }

  if (options?.activeOnly) {
    conditions.push(eq(plans.active, true));
  }

  const planList = await db.query.plans.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  const rootIds = planList.map((p) => p.rootNodeId).filter(Boolean) as number[];
  const rootNodes = rootIds.length
    ? await db.query.nodes.findMany({
        where: inArray(nodes.id, rootIds),
      })
    : [];
  const rootMap = new Map(rootNodes.map((node) => [node.id, node]));

  return planList.map((plan) => ({
    plan,
    rootNode: plan.rootNodeId ? (rootMap.get(plan.rootNodeId) ?? null) : null,
  }));
}

/* ----------------------------------
 * Update Plan
 * ---------------------------------- */

export async function updatePlan(
  id: number,
  data: PlanUpdateInput,
): Promise<PlanWithDetails | null> {
  const existing = await getPlan(id);
  if (!existing) return null;

  const planUpdates: Partial<PlanSelect> = { updatedAt: new Date() };
  if (data.name !== undefined) planUpdates.name = data.name;
  if (data.goal !== undefined) planUpdates.goal = data.goal;
  if (data.version !== undefined) planUpdates.version = data.version;
  if (data.active !== undefined) planUpdates.active = data.active;

  const [updatedPlan] = await db
    .update(plans)
    .set(planUpdates)
    .where(eq(plans.id, id))
    .returning();

  let updatedRoot = existing.rootNode;
  if (existing.rootNode) {
    const nodeUpdates: Partial<Node> = { updatedAt: new Date() };
    if (data.name !== undefined) nodeUpdates.name = data.name;
    if (data.isFrozen !== undefined) nodeUpdates.isFrozen = data.isFrozen;
    if (data.disableDependencyInheritance !== undefined) {
      nodeUpdates.disableDependencyInheritance = data.disableDependencyInheritance;
    }
    if (data.includeDependencyIds !== undefined) {
      nodeUpdates.includeDependencyIds = data.includeDependencyIds;
    }
    if (data.excludeDependencyIds !== undefined) {
      nodeUpdates.excludeDependencyIds = data.excludeDependencyIds;
    }

    if (Object.keys(nodeUpdates).length > 1) {
      const [updatedNode] = await db
        .update(nodes)
        .set(nodeUpdates)
        .where(eq(nodes.id, existing.rootNode.id))
        .returning();
      updatedRoot = updatedNode;
    }
  }

  revalidatePath("/plans");
  return { plan: updatedPlan, rootNode: updatedRoot ?? null };
}

/* ----------------------------------
 * Delete Plan
 * Cascades to all children via FK
 * ---------------------------------- */

export async function deletePlan(id: number): Promise<boolean> {
  const existing = await getPlan(id);
  if (!existing) return false;

  await db.delete(plans).where(eq(plans.id, id));
  revalidatePath("/plans");
  return true;
}

/* ----------------------------------
 * Fork Plan
 * Creates a new version of a plan
 * ---------------------------------- */

export async function forkPlan(
  planId: number,
  options?: { name?: string; tenantId?: number },
): Promise<PlanWithDetails | null> {
  const original = await getPlan(planId);
  if (!original) return null;

  const newPlan = await createPlan({
    name: options?.name ?? `${original.plan.name} (Fork)`,
    goal: original.plan.goal,
    tenantId: options?.tenantId ?? original.plan.tenantId,
    version: original.plan.version + 1,
    parentVersion: original.plan.version,
  });

  // TODO: Deep copy all child nodes (parts, jobs, context, data)

  return newPlan;
}
