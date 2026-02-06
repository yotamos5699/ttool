"use server";

import { db } from "@/dbs/drizzle";
import {
  nodes,
  jobNodes,
  type Node,
  type JobNode,
} from "@/dbs/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPath, getPathDepth } from "@/lib/ltree";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface JobCreateInput {
  name: string;
  description?: string;
  planId: number;
  parentId: number; // Parent node (stage or job for nesting)
  tenantId: number;
  disableDependencyInheritance?: boolean;
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
  config?: Record<string, unknown> | null;
}

export interface JobUpdateInput {
  name?: string;
  description?: string;
  active?: boolean;
  isFrozen?: boolean;
  disableDependencyInheritance?: boolean;
  includeDependencyIds?: number[];
  excludeDependencyIds?: number[];
  config?: Record<string, unknown> | null;
}

export interface JobWithDetails extends Node {
  jobData: JobNode | null;
}

/* ----------------------------------
 * Create Job
 * ---------------------------------- */

export async function createJob(data: JobCreateInput): Promise<JobWithDetails> {
  // Get parent node for path construction
  const parent = await db.query.nodes.findFirst({
    where: eq(nodes.id, data.parentId),
  });
  if (!parent) throw new Error("Parent node not found");

  // Insert base node
  const [node] = await db
    .insert(nodes)
    .values({
      type: "job",
      name: data.name,
      path: "temp",
      depth: 0,
      parentId: data.parentId,
      planId: data.planId,
      tenantId: data.tenantId,
      disableDependencyInheritance: data.disableDependencyInheritance ?? false,
      includeDependencyIds: data.includeDependencyIds ?? [],
      excludeDependencyIds: data.excludeDependencyIds ?? [],
      config: data.config ?? null,
    })
    .returning();

  // Update path with actual ID
  const path = buildPath(parent.path, "job", node.id);
  const depth = getPathDepth(path);

  const [updated] = await db
    .update(nodes)
    .set({ path, depth })
    .where(eq(nodes.id, node.id))
    .returning();

  // Insert job-specific data
  const [jobData] = await db
    .insert(jobNodes)
    .values({
      nodeId: node.id,
      description: data.description ?? null,
    })
    .returning();

  revalidatePath("/plans");
  return { ...updated, jobData };
}

/* ----------------------------------
 * Get Job by ID
 * ---------------------------------- */

export async function getJob(id: number): Promise<JobWithDetails | null> {
  const node = await db.query.nodes.findFirst({
    where: and(eq(nodes.id, id), eq(nodes.type, "job")),
  });

  if (!node) return null;

  const jobData = await db.query.jobNodes.findFirst({
    where: eq(jobNodes.nodeId, id),
  });

  return { ...node, jobData: jobData ?? null };
}

/* ----------------------------------
 * Get Jobs for Plan
 * ---------------------------------- */

export async function getJobsForPlan(
  planId: number,
  options?: { activeOnly?: boolean }
): Promise<JobWithDetails[]> {
  const conditions = [eq(nodes.planId, planId), eq(nodes.type, "job")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const jobNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (jobNodesList.length === 0) return [];

  const jobIds = jobNodesList.map((n) => n.id);
  const jobDataList = await db.query.jobNodes.findMany({
    where: inArray(jobNodes.nodeId, jobIds),
  });

  const jobDataMap = new Map<number, JobNode>();
  for (const jd of jobDataList) {
    jobDataMap.set(jd.nodeId, jd);
  }

  return jobNodesList.map((n) => ({
    ...n,
    jobData: jobDataMap.get(n.id) ?? null,
  }));
}

/* ----------------------------------
 * Update Job
 * ---------------------------------- */

export async function updateJob(
  id: number,
  data: JobUpdateInput
): Promise<JobWithDetails | null> {
  const existing = await getJob(id);
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
  if (data.config !== undefined) nodeUpdates.config = data.config;

  const [updatedNode] = await db
    .update(nodes)
    .set(nodeUpdates)
    .where(eq(nodes.id, id))
    .returning();

  // Update job-specific data
  const jobUpdates: Partial<JobNode> = {};
  if (data.description !== undefined) jobUpdates.description = data.description;

  let jobData = existing.jobData;
  if (Object.keys(jobUpdates).length > 0) {
    const [updated] = await db
      .update(jobNodes)
      .set(jobUpdates)
      .where(eq(jobNodes.nodeId, id))
      .returning();
    jobData = updated;
  }

  revalidatePath("/plans");
  return { ...updatedNode, jobData };
}

/* ----------------------------------
 * Delete Job
 * ---------------------------------- */

export async function deleteJob(id: number): Promise<boolean> {
  const existing = await getJob(id);
  if (!existing) return false;

  await db.delete(nodes).where(eq(nodes.id, id));
  revalidatePath("/plans");
  return true;
}

/* ----------------------------------
 * Get Direct Child Jobs (for nested jobs)
 * ---------------------------------- */

export async function getChildJobs(
  parentId: number,
  options?: { activeOnly?: boolean }
): Promise<JobWithDetails[]> {
  const conditions = [eq(nodes.parentId, parentId), eq(nodes.type, "job")];

  if (options?.activeOnly) {
    conditions.push(eq(nodes.active, true));
  }

  const jobNodesList = await db.query.nodes.findMany({
    where: and(...conditions),
    orderBy: (n, { asc }) => [asc(n.path)],
  });

  if (jobNodesList.length === 0) return [];

  const jobIds = jobNodesList.map((n) => n.id);
  const jobDataList = await db.query.jobNodes.findMany({
    where: inArray(jobNodes.nodeId, jobIds),
  });

  const jobDataMap = new Map<number, JobNode>();
  for (const jd of jobDataList) {
    jobDataMap.set(jd.nodeId, jd);
  }

  return jobNodesList.map((n) => ({
    ...n,
    jobData: jobDataMap.get(n.id) ?? null,
  }));
}
