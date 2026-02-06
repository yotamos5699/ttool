"use server";

import { cache } from "react";
import { db } from "@/dbs/drizzle";
import {
  nodes,
  contextNodes,
  type ContextNode,
  type ContextType,
} from "@/dbs/drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface ContextCreateInput {
  nodeId: number;
  parentId?: number | null;
  title: string;
  contextType: ContextType;
  payload: string;
}

export interface ContextUpdateInput {
  title?: string;
  contextType?: ContextType;
  payload?: string;
  parentId?: number | null;
}

export type ContextWithDetails = ContextNode;

const contextStatsOrder: ContextType[] = ["rule", "skill", "input", "output"];

const getContextSubtreeCached = cache(
  async (nodeId: number, lastUpdatedAtIso: string): Promise<ContextNode[]> => {
    void lastUpdatedAtIso;
    return db.query.contextNodes.findMany({
      where: eq(contextNodes.nodeId, nodeId),
      orderBy: (c, { asc }) => [asc(c.parentId), asc(c.id)],
    });
  },
);

async function updateNodeContextMetadata(nodeId: number): Promise<void> {
  const rows = await db
    .select({
      contextType: contextNodes.contextType,
      count: sql<number>`count(*)`,
    })
    .from(contextNodes)
    .where(eq(contextNodes.nodeId, nodeId))
    .groupBy(contextNodes.contextType);

  const counts = new Map<ContextType, number>();
  for (const row of rows) {
    counts.set(row.contextType, Number(row.count));
  }

  const summary = contextStatsOrder
    .map((type) => `${type}:${counts.get(type) ?? 0}`)
    .join("|");

  await db
    .update(nodes)
    .set({
      contextStats: summary,
      lastUpdatedAt: new Date(),
    })
    .where(eq(nodes.id, nodeId));
}

/* ----------------------------------
 * Create Context Node
 * ---------------------------------- */

export async function createContext(
  data: ContextCreateInput,
): Promise<ContextWithDetails> {
  const [contextData] = await db
    .insert(contextNodes)
    .values({
      nodeId: data.nodeId,
      parentId: data.parentId ?? null,
      contextType: data.contextType,
      title: data.title,
      payload: data.payload,
    })
    .returning();

  await updateNodeContextMetadata(data.nodeId);
  revalidatePath("/plans");
  return contextData;
}

/* ----------------------------------
 * Get Context by ID
 * ---------------------------------- */

export async function getContext(id: number): Promise<ContextWithDetails | null> {
  const contextData = await db.query.contextNodes.findFirst({
    where: eq(contextNodes.id, id),
  });

  return contextData ?? null;
}

/* ----------------------------------
 * Get Context Nodes for Parent
 * ---------------------------------- */

export async function getContextForNode(
  nodeId: number,
  options?: { contextType?: ContextType },
): Promise<ContextWithDetails[]> {
  const conditions = [eq(contextNodes.nodeId, nodeId)];

  if (options?.contextType) {
    conditions.push(eq(contextNodes.contextType, options.contextType));
  }

  return db.query.contextNodes.findMany({
    where: and(...conditions),
    orderBy: (c, { asc }) => [asc(c.parentId), asc(c.id)],
  });
}

/* ----------------------------------
 * Get All Context for Plan
 * ---------------------------------- */

export async function getContextForPlan(
  nodeIds: number[],
  options?: { contextType?: ContextType },
): Promise<ContextWithDetails[]> {
  if (nodeIds.length === 0) return [];

  const conditions = [inArray(contextNodes.nodeId, nodeIds)];

  if (options?.contextType) {
    conditions.push(eq(contextNodes.contextType, options.contextType));
  }

  return db.query.contextNodes.findMany({
    where: and(...conditions),
    orderBy: (c, { asc }) => [asc(c.nodeId), asc(c.parentId), asc(c.id)],
  });
}

export async function getContextSubtree(
  nodeId: number,
  lastUpdatedAt: Date | string,
): Promise<ContextWithDetails[]> {
  const lastUpdatedAtIso =
    typeof lastUpdatedAt === "string"
      ? new Date(lastUpdatedAt).toISOString()
      : lastUpdatedAt.toISOString();
  return getContextSubtreeCached(nodeId, lastUpdatedAtIso);
}

/* ----------------------------------
 * Update Context
 * ---------------------------------- */

export async function updateContext(
  id: number,
  data: ContextUpdateInput,
): Promise<ContextWithDetails | null> {
  const existing = await getContext(id);
  if (!existing) return null;

  const contextUpdates: Partial<ContextNode> = {};
  if (data.contextType !== undefined) contextUpdates.contextType = data.contextType;
  if (data.payload !== undefined) contextUpdates.payload = data.payload;
  if (data.title !== undefined) contextUpdates.title = data.title;
  if (data.parentId !== undefined) contextUpdates.parentId = data.parentId;

  let contextData = existing;
  if (Object.keys(contextUpdates).length > 0) {
    const [updated] = await db
      .update(contextNodes)
      .set(contextUpdates)
      .where(eq(contextNodes.id, id))
      .returning();
    contextData = updated;
  }

  await updateNodeContextMetadata(contextData.nodeId);
  revalidatePath("/plans");
  return contextData;
}

/* ----------------------------------
 * Delete Context
 * ---------------------------------- */

export async function deleteContext(id: number): Promise<boolean> {
  const existing = await getContext(id);
  if (!existing) return false;

  await db.delete(contextNodes).where(eq(contextNodes.id, id));
  await updateNodeContextMetadata(existing.nodeId);
  revalidatePath("/plans");
  return true;
}
