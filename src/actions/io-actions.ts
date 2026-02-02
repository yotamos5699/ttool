"use server";

import { db } from "@/dbs/drizzle";
import {
  nodes,
  ioNodes,
  type Node,
  type IoNode,
  type IoDirection,
  type IoType,
} from "@/dbs/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPath, getPathDepth } from "@/lib/ltree";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface IOCreateInput {
  name: string;
  direction: IoDirection;
  ioType: IoType;
  data: string;
  planId: number;
  parentId: number; // Parent node (stage or job)
  tenantId: number;
}

export interface IOUpdateInput {
  name?: string;
  direction?: IoDirection;
  ioType?: IoType;
  data?: string;
  active?: boolean;
}

export interface IOWithDetails extends Node {
  ioData: IoNode | null;
}

/* ----------------------------------
 * Create IO Node
 * ---------------------------------- */

export async function createIO(data: IOCreateInput): Promise<IOWithDetails> {
  // Get parent node for path construction
  const parent = await db.query.nodes.findFirst({
    where: eq(nodes.id, data.parentId),
  });
  if (!parent) throw new Error("Parent node not found");

  // Insert base node
  const [node] = await db
    .insert(nodes)
    .values({
      type: "io",
      name: data.name,
      path: "temp",
      depth: 0,
      parentId: data.parentId,
      planId: data.planId,
      tenantId: data.tenantId,
    })
    .returning();

  // Update path with actual ID
  const path = buildPath(parent.path, "io", node.id);
  const depth = getPathDepth(path);

  const [updated] = await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id))
    .returning();

  // Insert io-specific data
  const [ioData] = await db
    .insert(ioNodes)
    .values({
      nodeId: node.id,
      direction: data.direction,
      ioType: data.ioType,
      data: data.data,
    })
    .returning();

  revalidatePath("/plans");
  return { ...updated, ioData };
}

/* ----------------------------------
 * Get IO by ID
 * ---------------------------------- */

export async function getIO(id: number): Promise<IOWithDetails | null> {
  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, id), eq(nodes.type, "io")),
  });

  if (!node) return null;

  const ioData = await db.query.ioNodes.findFirst({
    where: eq(ioNodes.nodeId, id),
  });

  return { ...node, ioData: ioData ?? null };
}

/* ----------------------------------
 * Get IO Nodes for Parent
 * ---------------------------------- */

export async function getIOForParent(
  parentId: number,
  options?: { activeOnly?: boolean; direction?: IoDirection; ioType?: IoType }
): Promise<IOWithDetails[]> {
  const conditions = [eq(nodes.parentId, parentId), eq(nodes.type, "io")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const ioNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (ioNodesList.length === 0) return [];

  // Batch fetch io data
  const ioIds = ioNodesList.map((n) => n.id);
  const ioDataList = await db.query.ioNodes.findMany({
    where: inArray(ioNodes.nodeId, ioIds),
  });

  const ioDataMap = new Map<number, IoNode>();
  for (const io of ioDataList) {
    ioDataMap.set(io.nodeId, io);
  }

  let result = ioNodesList.map((n) => ({
    ...n,
    ioData: ioDataMap.get(n.id) ?? null,
  }));

  // Filter by direction if specified
  if (options?.direction) {
    result = result.filter((io) => io.ioData?.direction === options.direction);
  }

  // Filter by io type if specified
  if (options?.ioType) {
    result = result.filter((io) => io.ioData?.ioType === options.ioType);
  }

  return result;
}

/* ----------------------------------
 * Get Inputs for Parent
 * ---------------------------------- */

export async function getInputsForParent(
  parentId: number,
  options?: { activeOnly?: boolean }
): Promise<IOWithDetails[]> {
  return getIOForParent(parentId, { ...options, direction: "input" });
}

/* ----------------------------------
 * Get Outputs for Parent
 * ---------------------------------- */

export async function getOutputsForParent(
  parentId: number,
  options?: { activeOnly?: boolean }
): Promise<IOWithDetails[]> {
  return getIOForParent(parentId, { ...options, direction: "output" });
}

/* ----------------------------------
 * Get All IO for Plan
 * ---------------------------------- */

export async function getIOForPlan(
  planId: number,
  options?: { activeOnly?: boolean; direction?: IoDirection }
): Promise<IOWithDetails[]> {
  const conditions = [eq(nodes.planId, planId), eq(nodes.type, "io")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const ioNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (ioNodesList.length === 0) return [];

  const ioIds = ioNodesList.map((n) => n.id);
  const ioDataList = await db.query.ioNodes.findMany({
    where: inArray(ioNodes.nodeId, ioIds),
  });

  const ioDataMap = new Map<number, IoNode>();
  for (const io of ioDataList) {
    ioDataMap.set(io.nodeId, io);
  }

  let result = ioNodesList.map((n) => ({
    ...n,
    ioData: ioDataMap.get(n.id) ?? null,
  }));

  if (options?.direction) {
    result = result.filter((io) => io.ioData?.direction === options.direction);
  }

  return result;
}

/* ----------------------------------
 * Update IO
 * ---------------------------------- */

export async function updateIO(
  id: number,
  data: IOUpdateInput
): Promise<IOWithDetails | null> {
  const existing = await getIO(id);
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

  // Update io-specific data
  const ioUpdates: Partial<IoNode> = {};
  if (data.direction !== undefined) ioUpdates.direction = data.direction;
  if (data.ioType !== undefined) ioUpdates.ioType = data.ioType;
  if (data.data !== undefined) ioUpdates.data = data.data;

  let ioData = existing.ioData;
  if (Object.keys(ioUpdates).length > 0) {
    const [updated] = await db
      .update(ioNodes)
      .set(ioUpdates)
      .where(eq(ioNodes.nodeId, id))
      .returning();
    ioData = updated;
  }

  revalidatePath("/plans");
  return { ...updatedNode, ioData };
}

/* ----------------------------------
 * Delete IO
 * ---------------------------------- */

export async function deleteIO(id: number): Promise<boolean> {
  const existing = await getIO(id);
  if (!existing) return false;

  await db.delete(nodes).where(eq(nodes.id, id));
  revalidatePath("/plans");
  return true;
}
