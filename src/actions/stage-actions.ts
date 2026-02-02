"use server";

import { db } from "@/dbs/drizzle";
import {
  nodes,
  stageNodes,
  type Node,
  type StageNode,
  type ExecutionMode,
} from "@/dbs/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
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
  dependsOnNodeIds?: number[];
}

export interface StageUpdateInput {
  name?: string;
  description?: string;
  executionMode?: ExecutionMode;
  dependsOnNodeIds?: number[];
  active?: boolean;
  isFrozen?: boolean;
}

export interface StageWithDetails extends Node {
  stageData: StageNode | null;
}

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

  // Insert stage-specific data
  const [stageData] = await db
    .insert(stageNodes)
    .values({
      nodeId: node.id,
      description: data.description ?? null,
      executionMode: data.executionMode ?? "sequential",
      dependsOnNodeIds: data.dependsOnNodeIds ?? [],
    })
    .returning();

  revalidatePath("/plans");
  return { ...updated, stageData };
}

/* ----------------------------------
 * Get Stage by ID
 * ---------------------------------- */

export async function getStage(id: number): Promise<StageWithDetails | null> {
  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, id), eq(nodes.type, "stage")),
  });

  if (!node) return null;

  const stageData = await db.query.stageNodes.findFirst({
    where: eq(stageNodes.nodeId, id),
  });

  return { ...node, stageData: stageData ?? null };
}

/* ----------------------------------
 * Get Stages for Plan
 * ---------------------------------- */

export async function getStagesForPlan(
  planId: number,
  options?: { activeOnly?: boolean }
): Promise<StageWithDetails[]> {
  const conditions = [eq(nodes.planId, planId), eq(nodes.type, "stage")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const stageNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (stageNodesList.length === 0) return [];

  // Batch fetch stage data
  const stageIds = stageNodesList.map((n) => n.id);
  const stageDataList = await db.query.stageNodes.findMany({
    where: inArray(stageNodes.nodeId, stageIds),
  });

  const stageDataMap = new Map<number, StageNode>();
  for (const sd of stageDataList) {
    stageDataMap.set(sd.nodeId, sd);
  }

  return stageNodesList.map((n) => ({
    ...n,
    stageData: stageDataMap.get(n.id) ?? null,
  }));
}

/* ----------------------------------
 * Update Stage
 * ---------------------------------- */

export async function updateStage(
  id: number,
  data: StageUpdateInput
): Promise<StageWithDetails | null> {
  const existing = await getStage(id);
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

  // Update stage-specific data
  const stageUpdates: Partial<StageNode> = {};
  if (data.description !== undefined) stageUpdates.description = data.description;
  if (data.executionMode !== undefined) stageUpdates.executionMode = data.executionMode;
  if (data.dependsOnNodeIds !== undefined) stageUpdates.dependsOnNodeIds = data.dependsOnNodeIds;

  let stageData = existing.stageData;
  if (Object.keys(stageUpdates).length > 0) {
    const [updated] = await db
      .update(stageNodes)
      .set(stageUpdates)
      .where(eq(stageNodes.nodeId, id))
      .returning();
    stageData = updated;
  }

  revalidatePath("/plans");
  return { ...updatedNode, stageData };
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
  options?: { activeOnly?: boolean }
): Promise<StageWithDetails[]> {
  const conditions = [eq(nodes.parentId, parentId), eq(nodes.type, "stage")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const stageNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (stageNodesList.length === 0) return [];

  const stageIds = stageNodesList.map((n) => n.id);
  const stageDataList = await db.query.stageNodes.findMany({
    where: inArray(stageNodes.nodeId, stageIds),
  });

  const stageDataMap = new Map<number, StageNode>();
  for (const sd of stageDataList) {
    stageDataMap.set(sd.nodeId, sd);
  }

  return stageNodesList.map((n) => ({
    ...n,
    stageData: stageDataMap.get(n.id) ?? null,
  }));
}
