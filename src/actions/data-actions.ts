"use server";

import { db } from "@/dbs/drizzle";
import {
  nodes,
  dataNodes,
  type Node,
} from "@/dbs/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPath, getPathDepth } from "@/lib/ltree";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface DataCreateInput {
  name: string;
  payload: unknown;
  planId: number;
  parentId: number; // Parent node (stage or job)
  tenantId: number;
}

export interface DataUpdateInput {
  name?: string;
  payload?: unknown;
  active?: boolean;
}

export interface DataWithDetails extends Node {
  dataData: { nodeId: number; payload: unknown } | null;
}

/* ----------------------------------
 * Create Data Node
 * ---------------------------------- */

export async function createDataNode(data: DataCreateInput): Promise<DataWithDetails> {
  // Get parent node for path construction
  const parent = await db.query.nodes.findFirst({
    where: eq(nodes.id, data.parentId),
  });
  if (!parent) throw new Error("Parent node not found");

  // Insert base node
  const [node] = await db
    .insert(nodes)
    .values({
      type: "data",
      name: data.name,
      path: "temp",
      depth: 0,
      parentId: data.parentId,
      planId: data.planId,
      tenantId: data.tenantId,
    })
    .returning();

  // Update path with actual ID
  const path = buildPath(parent.path, "data", node.id);
  const depth = getPathDepth(path);

  const [updated] = await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id))
    .returning();

  // Insert data-specific payload
  const [dataData] = await db
    .insert(dataNodes)
    .values({
      nodeId: node.id,
      payload: data.payload,
    })
    .returning();

  revalidatePath("/plans");
  return { ...updated, dataData };
}

/* ----------------------------------
 * Get Data Node by ID
 * ---------------------------------- */

export async function getDataNode(id: number): Promise<DataWithDetails | null> {
  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, id), eq(nodes.type, "data")),
  });

  if (!node) return null;

  const dataData = await db.query.dataNodes.findFirst({
    where: eq(dataNodes.nodeId, id),
  });

  return { ...node, dataData: dataData ?? null };
}

/* ----------------------------------
 * Get Data Nodes for Parent
 * ---------------------------------- */

export async function getDataForParent(
  parentId: number,
  options?: { activeOnly?: boolean }
): Promise<DataWithDetails[]> {
  const conditions = [eq(nodes.parentId, parentId), eq(nodes.type, "data")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const dataNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (dataNodesList.length === 0) return [];

  // Batch fetch data payloads
  const dataIds = dataNodesList.map((n) => n.id);
  const dataDataList = await db.query.dataNodes.findMany({
    where: inArray(dataNodes.nodeId, dataIds),
  });

  const dataDataMap = new Map<number, { nodeId: number; payload: unknown }>();
  for (const dataRow of dataDataList) {
    dataDataMap.set(dataRow.nodeId, {
      nodeId: dataRow.nodeId,
      payload: dataRow.payload,
    });
  }

  return dataNodesList.map((n) => ({
    ...n,
    dataData: dataDataMap.get(n.id) ?? null,
  }));
}

/* ----------------------------------
 * Get Inputs for Parent
 * ---------------------------------- */

export async function getDataForPlan(
  planId: number,
  options?: { activeOnly?: boolean }
): Promise<DataWithDetails[]> {
  const conditions = [eq(nodes.planId, planId), eq(nodes.type, "data")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const dataNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (dataNodesList.length === 0) return [];

  const dataIds = dataNodesList.map((n) => n.id);
  const dataDataList = await db.query.dataNodes.findMany({
    where: inArray(dataNodes.nodeId, dataIds),
  });

  const dataDataMap = new Map<number, { nodeId: number; payload: unknown }>();
  for (const dataRow of dataDataList) {
    dataDataMap.set(dataRow.nodeId, {
      nodeId: dataRow.nodeId,
      payload: dataRow.payload,
    });
  }

  return dataNodesList.map((n) => ({
    ...n,
    dataData: dataDataMap.get(n.id) ?? null,
  }));
}

/* ----------------------------------
 * Update Data Node
 * ---------------------------------- */

export async function updateDataNode(
  id: number,
  data: DataUpdateInput
): Promise<DataWithDetails | null> {
  const existing = await getDataNode(id);
  if (!existing) return null;

  // Update base node
  const nodeUpdates: Partial<Node> = { updatedAt: new Date() };
  if (data.name !== undefined) nodeUpdates.name = data.name;
  if (data.active !== undefined) nodeUpdates.active = data.active;

  const [updatedNode] = await db
    .update(nodes)
    .set(nodeUpdates)
    .where(eq(nodes.id, id))
    .returning();

  // Update data-specific payload
  const dataUpdates: { payload?: unknown } = {};
  if (data.payload !== undefined) dataUpdates.payload = data.payload;

  let dataData = existing.dataData;
  if (Object.keys(dataUpdates).length > 0) {
    const [updated] = await db
      .update(dataNodes)
      .set(dataUpdates)
      .where(eq(dataNodes.nodeId, id))
      .returning();
    dataData = { nodeId: updated.nodeId, payload: updated.payload };
  }

  revalidatePath("/plans");
  return { ...updatedNode, dataData };
}

/* ----------------------------------
 * Delete Data Node
 * ---------------------------------- */

export async function deleteDataNode(id: number): Promise<boolean> {
  const existing = await getDataNode(id);
  if (!existing) return false;

  await db.delete(nodes).where(eq(nodes.id, id));
  revalidatePath("/plans");
  return true;
}
