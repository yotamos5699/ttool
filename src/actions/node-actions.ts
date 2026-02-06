"use server";

import { db } from "@/dbs/drizzle";
import { nodes, type Node, type NodeType } from "@/dbs/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPath, getPathDepth } from "@/lib/ltree";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export type NodeCreateInput = {
  type: NodeType;
  name: string;
  parentId?: number | null;
  planId: number;
  tenantId: number;
  disableDependencyInheritance?: boolean;
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
};

export type NodeUpdateInput = Partial<{
  name: string;
  active: boolean;
  isFrozen: boolean;
  disableDependencyInheritance: boolean;
  includeDependencyIds: number[];
  excludeDependencyIds: number[];
}>;

/* ----------------------------------
 * Create Node
 * ---------------------------------- */

export async function createNode(data: NodeCreateInput): Promise<Node> {
  // Get parent path if parentId provided
  let parentPath: string | null = null;
  if (data.parentId) {
    const parent = await db.query.nodes.findFirst({
      where: eq(nodes.id, data.parentId),
    });
    if (!parent) throw new Error("Parent node not found");
    parentPath = parent.path;
  }

  // Insert with temporary path (will update after getting ID)
  const [node] = await db
    .insert(nodes)
    .values({
      type: data.type,
      name: data.name,
      path: "temp", // Will be updated
      depth: 0, // Will be updated
      parentId: data.parentId || null,
      planId: data.planId,
      tenantId: data.tenantId,
      disableDependencyInheritance: data.disableDependencyInheritance ?? false,
      includeDependencyIds: data.includeDependencyIds ?? [],
      excludeDependencyIds: data.excludeDependencyIds ?? [],
    })
    .returning();

  // Update path and depth with actual ID
  const path = buildPath(parentPath, data.type, node.id);
  const depth = getPathDepth(path);

  const [updated] = await db
    .update(nodes)
    .set({
      path,
      depth,
      planId: data.planId,
    })
    .where(eq(nodes.id, node.id))
    .returning();

  revalidatePath("/plans");
  return updated;
}

/* ----------------------------------
 * Get Node by ID
 * ---------------------------------- */

export async function getNode(id: number): Promise<Node | undefined> {
  return db.query.nodes.findFirst({
    where: eq(nodes.id, id),
  });
}

/* ----------------------------------
 * Get Nodes by IDs
 * ---------------------------------- */

export async function getNodesByIds(ids: number[]): Promise<Node[]> {
  if (ids.length === 0) return [];
  return db.query.nodes.findMany({
    where: inArray(nodes.id, ids),
  });
}

/* ----------------------------------
 * Update Node
 * ---------------------------------- */

export async function updateNode(
  id: number,
  data: NodeUpdateInput,
): Promise<Node | undefined> {
  const [node] = await db
    .update(nodes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(nodes.id, id))
    .returning();

  if (node) {
    revalidatePath("/plans");
  }
  return node;
}

/* ----------------------------------
 * Delete Node
 * Cascade deletes children via FK constraint
 * ---------------------------------- */

export async function deleteNode(id: number): Promise<Node | undefined> {
  const node = await getNode(id);
  if (!node) return undefined;

  await db.delete(nodes).where(eq(nodes.id, id));
  revalidatePath("/plans");
  return node;
}

/* ----------------------------------
 * Soft Delete (set active = false)
 * ---------------------------------- */

export async function softDeleteNode(id: number): Promise<Node | undefined> {
  return updateNode(id, { active: false });
}

/* ----------------------------------
 * Freeze/Unfreeze Node
 * ---------------------------------- */

export async function freezeNode(id: number): Promise<Node | undefined> {
  return updateNode(id, { isFrozen: true });
}

export async function unfreezeNode(id: number): Promise<Node | undefined> {
  return updateNode(id, { isFrozen: false });
}

/* ----------------------------------
 * Get Nodes for Tenant
 * ---------------------------------- */

export async function getNodesForTenant(
  tenantId: number,
  options?: { activeOnly?: boolean; types?: NodeType[] },
): Promise<Node[]> {
  const conditions = [eq(nodes.tenantId, tenantId)];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  if (options?.types && options.types.length > 0) {
    conditions.push(inArray(nodes.type, options.types));
  }

  return db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });
}

/* ----------------------------------
 * Get Nodes for Plan
 * ---------------------------------- */

export async function getNodesForPlan(
  planId: number,
  options?: { activeOnly?: boolean; types?: NodeType[] },
): Promise<Node[]> {
  const conditions = [eq(nodes.planId, planId)];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  if (options?.types && options.types.length > 0) {
    conditions.push(inArray(nodes.type, options.types));
  }

  return db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });
}

/* ----------------------------------
 * Move Node to New Parent
 * Updates path for node and all descendants
 * ---------------------------------- */

export async function moveNode(
  nodeId: number,
  newParentId: number | null,
): Promise<Node | undefined> {
  const node = await getNode(nodeId);
  if (!node) throw new Error("Node not found");

  // Get new parent path
  let newParentPath: string | null = null;
  if (newParentId) {
    const newParent = await getNode(newParentId);
    if (!newParent) throw new Error("New parent node not found");
    newParentPath = newParent.path;
  }

  // Calculate new path for this node
  const newPath = buildPath(newParentPath, node.type, node.id);
  const newDepth = getPathDepth(newPath);
  const oldPath = node.path;

  // Update this node
  const [updated] = await db
    .update(nodes)
    .set({
      parentId: newParentId,
      path: newPath,
      depth: newDepth,
      updatedAt: new Date(),
    })
    .where(eq(nodes.id, nodeId))
    .returning();

  // Update all descendants' paths
  // Get all nodes that start with oldPath.
  const descendants = await db.query.nodes.findMany({
    where: and(
      eq(nodes.tenantId, node.tenantId),
      // Path starts with oldPath.
      // This is a workaround since we can't use ltree operators directly in Drizzle
      // In production, use raw SQL with ltree operators
    ),
  });

  // Filter to actual descendants
  const actualDescendants = descendants.filter(
    (d) => d.path.startsWith(oldPath + ".") && d.id !== nodeId,
  );

  // Update each descendant's path
  for (const desc of actualDescendants) {
    const relativePath = desc.path.slice(oldPath.length + 1); // Remove old prefix
    const descNewPath = `${newPath}.${relativePath}`;
    const descNewDepth = getPathDepth(descNewPath);

    await db
      .update(nodes)
      .set({
        path: descNewPath,
        depth: descNewDepth,
        updatedAt: new Date(),
      })
      .where(eq(nodes.id, desc.id));
  }

  revalidatePath("/plans");
  return updated;
}
