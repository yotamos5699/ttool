"use server";

import { db } from "@/dbs/drizzle";
import { nodes, type Node, type ExecutionMode } from "@/dbs/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPath, getPathDepth } from "@/lib/ltree";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface StageCreateInput {
  name: string;
  description?: string;
  planId: number;
  parentId: number; // Parent node (plan or stage)
  tenantId: number;
  executionMode?: ExecutionMode;
  disableDependencyInheritance?: boolean;
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
}

export interface StageUpdateInput {
  name?: string;
  description?: string;
  executionMode?: ExecutionMode;
  active?: boolean;
  isFrozen?: boolean;
  disableDependencyInheritance?: boolean;
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
}

export type StageWithDetails = Node;

/* ----------------------------------
 * Create Stage
 * ---------------------------------- */

export async function createStage(data: StageCreateInput): Promise<StageWithDetails> {
  // Get parent node for path construction
  const parent = await db.query.nodes.findFirst({
    where: eq(nodes.id, data.parentId),
  });
  if (!parent) throw new Error("Parent node not found");

  // Insert base node
  const [node] = await db
    .insert(nodes)
    .values({
      type: "stage",
      name: data.name,
      path: "temp",
      depth: 0,
      parentId: data.parentId,
      planId: data.planId,
      tenantId: data.tenantId,
      disableDependencyInheritance: data.disableDependencyInheritance ?? false,
      includeDependencyIds: data.includeDependencyIds ?? [],
      excludeDependencyIds: data.excludeDependencyIds ?? [],
      description: data.description ?? null,
      executionMode: data.executionMode ?? "sequential",
    })
    .returning();

  // Update path with actual ID
  const path = buildPath(parent.path, "stage", node.id);
  const depth = getPathDepth(path);

  const [updated] = await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id))
    .returning();

  revalidatePath("/plans");
  return updated;
}

/* ----------------------------------
 * Get Stage by ID
 * ---------------------------------- */

export async function getStage(id: number): Promise<StageWithDetails | null> {
  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, id), eq(nodes.type, "stage")),
  });

  if (!node) return null;
  return node;
}

/* ----------------------------------
 * Get Stages for Plan
 * ---------------------------------- */

export async function getStagesForPlan(
  planId: number,
  options?: { activeOnly?: boolean },
): Promise<StageWithDetails[]> {
  const conditions = [eq(nodes.planId, planId), eq(nodes.type, "stage")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const stageNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  return stageNodesList;
}

/* ----------------------------------
 * Update Stage
 * ---------------------------------- */

export async function updateStage(
  id: number,
  data: StageUpdateInput,
): Promise<StageWithDetails | null> {
  const existing = await getStage(id);
  if (!existing) return null;

  // Update base node
  const nodeUpdates: Partial<Node> = { updatedAt: new Date() };
  if (data.name !== undefined) nodeUpdates.name = data.name;
  if (data.active !== undefined) nodeUpdates.active = data.active;
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
  if (data.description !== undefined) nodeUpdates.description = data.description;
  if (data.executionMode !== undefined) nodeUpdates.executionMode = data.executionMode;

  const [updatedNode] = await db
    .update(nodes)
    .set(nodeUpdates)
    .where(eq(nodes.id, id))
    .returning();

  revalidatePath("/plans");
  return updatedNode;
}

/* ----------------------------------
 * Delete Stage
 * ---------------------------------- */

export async function deleteStage(id: number): Promise<boolean> {
  const existing = await getStage(id);
  if (!existing) return false;

  await db.delete(nodes).where(eq(nodes.id, id));
  revalidatePath("/plans");
  return true;
}

/* ----------------------------------
 * Get Direct Child Stages
 * ---------------------------------- */

export async function getChildStages(
  parentId: number,
  options?: { activeOnly?: boolean },
): Promise<StageWithDetails[]> {
  const conditions = [eq(nodes.parentId, parentId), eq(nodes.type, "stage")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const stageNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  return stageNodesList;
}
