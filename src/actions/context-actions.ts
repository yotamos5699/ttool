"use server";

import { db } from "@/dbs/drizzle";
import {
  nodes,
  contextNodes,
  type Node,
  type ContextNode,
  type ContextType,
} from "@/dbs/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPath, getPathDepth } from "@/lib/ltree";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface ContextCreateInput {
  name: string;
  contextType: ContextType;
  payload: string;
  planId: number;
  parentId: number; // Parent node (plan, stage, or job)
  tenantId: number;
}

export interface ContextUpdateInput {
  name?: string;
  contextType?: ContextType;
  payload?: string;
  active?: boolean;
}

export interface ContextWithDetails extends Node {
  contextData: ContextNode | null;
}

/* ----------------------------------
 * Create Context Node
 * ---------------------------------- */

export async function createContext(data: ContextCreateInput): Promise<ContextWithDetails> {
  // Get parent node for path construction
  const parent = await db.query.nodes.findFirst({
    where: eq(nodes.id, data.parentId),
  });
  if (!parent) throw new Error("Parent node not found");

  // Insert base node
  const [node] = await db
    .insert(nodes)
    .values({
      type: "context",
      name: data.name,
      path: "temp",
      depth: 0,
      parentId: data.parentId,
      planId: data.planId,
      tenantId: data.tenantId,
    })
    .returning();

  // Update path with actual ID
  const path = buildPath(parent.path, "context", node.id);
  const depth = getPathDepth(path);

  const [updated] = await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id))
    .returning();

  // Insert context-specific data
  const [contextData] = await db
    .insert(contextNodes)
    .values({
      nodeId: node.id,
      contextType: data.contextType,
      payload: data.payload,
    })
    .returning();

  revalidatePath("/plans");
  return { ...updated, contextData };
}

/* ----------------------------------
 * Get Context by ID
 * ---------------------------------- */

export async function getContext(id: number): Promise<ContextWithDetails | null> {
  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, id), eq(nodes.type, "context")),
  });

  if (!node) return null;

  const contextData = await db.query.contextNodes.findFirst({
    where: eq(contextNodes.nodeId, id),
  });

  return { ...node, contextData: contextData ?? null };
}

/* ----------------------------------
 * Get Context Nodes for Parent
 * ---------------------------------- */

export async function getContextForParent(
  parentId: number,
  options?: { activeOnly?: boolean; contextType?: ContextType }
): Promise<ContextWithDetails[]> {
  const conditions = [eq(nodes.parentId, parentId), eq(nodes.type, "context")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const contextNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (contextNodesList.length === 0) return [];

  // Batch fetch context data
  const contextIds = contextNodesList.map((n) => n.id);
  const contextDataList = await db.query.contextNodes.findMany({
    where: inArray(contextNodes.nodeId, contextIds),
  });

  const contextDataMap = new Map<number, ContextNode>();
  for (const cd of contextDataList) {
    contextDataMap.set(cd.nodeId, cd);
  }

  let result = contextNodesList.map((n) => ({
    ...n,
    contextData: contextDataMap.get(n.id) ?? null,
  }));

  // Filter by context type if specified
  if (options?.contextType) {
    result = result.filter((c) => c.contextData?.contextType === options.contextType);
  }

  return result;
}

/* ----------------------------------
 * Get All Context for Plan
 * ---------------------------------- */

export async function getContextForPlan(
  planId: number,
  options?: { activeOnly?: boolean; contextType?: ContextType }
): Promise<ContextWithDetails[]> {
  const conditions = [eq(nodes.planId, planId), eq(nodes.type, "context")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const contextNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (contextNodesList.length === 0) return [];

  const contextIds = contextNodesList.map((n) => n.id);
  const contextDataList = await db.query.contextNodes.findMany({
    where: inArray(contextNodes.nodeId, contextIds),
  });

  const contextDataMap = new Map<number, ContextNode>();
  for (const cd of contextDataList) {
    contextDataMap.set(cd.nodeId, cd);
  }

  let result = contextNodesList.map((n) => ({
    ...n,
    contextData: contextDataMap.get(n.id) ?? null,
  }));

  if (options?.contextType) {
    result = result.filter((c) => c.contextData?.contextType === options.contextType);
  }

  return result;
}

/* ----------------------------------
 * Update Context
 * ---------------------------------- */

export async function updateContext(
  id: number,
  data: ContextUpdateInput
): Promise<ContextWithDetails | null> {
  const existing = await getContext(id);
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

  // Update context-specific data
  const contextUpdates: Partial<ContextNode> = {};
  if (data.contextType !== undefined) contextUpdates.contextType = data.contextType;
  if (data.payload !== undefined) contextUpdates.payload = data.payload;

  let contextData = existing.contextData;
  if (Object.keys(contextUpdates).length > 0) {
    const [updated] = await db
      .update(contextNodes)
      .set(contextUpdates)
      .where(eq(contextNodes.nodeId, id))
      .returning();
    contextData = updated;
  }

  revalidatePath("/plans");
  return { ...updatedNode, contextData };
}

/* ----------------------------------
 * Delete Context
 * ---------------------------------- */

export async function deleteContext(id: number): Promise<boolean> {
  const existing = await getContext(id);
  if (!existing) return false;

  await db.delete(nodes).where(eq(nodes.id, id));
  revalidatePath("/plans");
  return true;
}
