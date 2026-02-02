"use server";

import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/dbs/drizzle";
import {
  executionRuns,
  nodeExecutions,
  nodes,
  type ExecutionRun,
  type ExecutionRunInsert,
  type NodeExecution,
  type NodeExecutionInsert,
} from "@/dbs/drizzle/schema";

/* ----------------------------------
 * Execution Runs CRUD
 * ---------------------------------- */

/**
 * Create a new execution run for a plan
 */
export async function createExecutionRun(
  data: Omit<ExecutionRunInsert, "id" | "createdAt">
): Promise<ExecutionRun> {
  const [run] = await db.insert(executionRuns).values(data).returning();
  return run;
}

/**
 * Get an execution run by ID
 */
export async function getExecutionRun(id: number): Promise<ExecutionRun | null> {
  const [run] = await db
    .select()
    .from(executionRuns)
    .where(eq(executionRuns.id, id));
  return run ?? null;
}

/**
 * Get all execution runs for a plan
 */
export async function getExecutionRunsForPlan(
  planNodeId: number
): Promise<ExecutionRun[]> {
  return db
    .select()
    .from(executionRuns)
    .where(eq(executionRuns.planNodeId, planNodeId))
    .orderBy(desc(executionRuns.createdAt));
}

/**
 * Update execution run status
 */
export async function updateExecutionRunStatus(
  id: number,
  status: ExecutionRun["status"],
  timestamps?: { startedAt?: Date; completedAt?: Date }
): Promise<ExecutionRun> {
  const [run] = await db
    .update(executionRuns)
    .set({
      status,
      ...(timestamps?.startedAt && { startedAt: timestamps.startedAt }),
      ...(timestamps?.completedAt && { completedAt: timestamps.completedAt }),
    })
    .where(eq(executionRuns.id, id))
    .returning();
  return run;
}

/**
 * Start an execution run
 */
export async function startExecutionRun(id: number): Promise<ExecutionRun> {
  return updateExecutionRunStatus(id, "running", { startedAt: new Date() });
}

/**
 * Complete an execution run
 */
export async function completeExecutionRun(
  id: number,
  status: "completed" | "failed" | "cancelled" = "completed"
): Promise<ExecutionRun> {
  return updateExecutionRunStatus(id, status, { completedAt: new Date() });
}

/**
 * Delete an execution run
 */
export async function deleteExecutionRun(id: number): Promise<void> {
  await db.delete(executionRuns).where(eq(executionRuns.id, id));
}

/* ----------------------------------
 * Node Executions CRUD
 * ---------------------------------- */

/**
 * Create a node execution record
 */
export async function createNodeExecution(
  data: Omit<NodeExecutionInsert, "id">
): Promise<NodeExecution> {
  const [execution] = await db.insert(nodeExecutions).values(data).returning();
  return execution;
}

/**
 * Create multiple node executions (batch)
 */
export async function createNodeExecutions(
  data: Omit<NodeExecutionInsert, "id">[]
): Promise<NodeExecution[]> {
  if (data.length === 0) return [];
  return db.insert(nodeExecutions).values(data).returning();
}

/**
 * Get a node execution by ID
 */
export async function getNodeExecution(id: number): Promise<NodeExecution | null> {
  const [execution] = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, id));
  return execution ?? null;
}

/**
 * Get all node executions for a run
 */
export async function getNodeExecutionsForRun(
  runId: number
): Promise<NodeExecution[]> {
  return db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.runId, runId))
    .orderBy(asc(nodeExecutions.id));
}

/**
 * Get node executions for a specific node across all runs
 */
export async function getNodeExecutionHistory(
  nodeId: number
): Promise<NodeExecution[]> {
  return db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.nodeId, nodeId))
    .orderBy(desc(nodeExecutions.startedAt));
}

/**
 * Get child executions (for nested nodes)
 */
export async function getChildNodeExecutions(
  parentExecutionId: number
): Promise<NodeExecution[]> {
  return db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.parentExecutionId, parentExecutionId))
    .orderBy(asc(nodeExecutions.id));
}

/**
 * Update node execution status
 */
export async function updateNodeExecutionStatus(
  id: number,
  status: NodeExecution["status"],
  options?: {
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
  }
): Promise<NodeExecution> {
  const [execution] = await db
    .update(nodeExecutions)
    .set({
      status,
      ...(options?.startedAt && { startedAt: options.startedAt }),
      ...(options?.completedAt && { completedAt: options.completedAt }),
      ...(options?.error !== undefined && { error: options.error }),
    })
    .where(eq(nodeExecutions.id, id))
    .returning();
  return execution;
}

/**
 * Start a node execution
 */
export async function startNodeExecution(id: number): Promise<NodeExecution> {
  return updateNodeExecutionStatus(id, "running", { startedAt: new Date() });
}

/**
 * Complete a node execution successfully
 */
export async function completeNodeExecution(id: number): Promise<NodeExecution> {
  return updateNodeExecutionStatus(id, "completed", { completedAt: new Date() });
}

/**
 * Fail a node execution
 */
export async function failNodeExecution(
  id: number,
  error: string
): Promise<NodeExecution> {
  return updateNodeExecutionStatus(id, "failed", {
    completedAt: new Date(),
    error,
  });
}

/**
 * Cancel a node execution
 */
export async function cancelNodeExecution(
  id: number,
  reason?: string
): Promise<NodeExecution> {
  return updateNodeExecutionStatus(id, "cancelled", {
    error: reason,
  });
}

/**
 * Delete a node execution
 */
export async function deleteNodeExecution(id: number): Promise<void> {
  await db.delete(nodeExecutions).where(eq(nodeExecutions.id, id));
}

/* ----------------------------------
 * Execution Queries
 * ---------------------------------- */

/**
 * Get execution run with all node executions
 */
export async function getExecutionRunWithNodes(runId: number): Promise<{
  run: ExecutionRun;
  nodeExecutions: NodeExecution[];
} | null> {
  const run = await getExecutionRun(runId);
  if (!run) return null;

  const executions = await getNodeExecutionsForRun(runId);
  return { run, nodeExecutions: executions };
}

/**
 * Get the latest execution run for a plan
 */
export async function getLatestExecutionRun(
  planNodeId: number
): Promise<ExecutionRun | null> {
  const [run] = await db
    .select()
    .from(executionRuns)
    .where(eq(executionRuns.planNodeId, planNodeId))
    .orderBy(desc(executionRuns.createdAt))
    .limit(1);
  return run ?? null;
}

/**
 * Count pending/running executions for a node
 */
export async function countActiveExecutionsForNode(
  nodeId: number
): Promise<number> {
  const result = await db
    .select()
    .from(nodeExecutions)
    .where(
      and(
        eq(nodeExecutions.nodeId, nodeId),
        eq(nodeExecutions.status, "running")
      )
    );
  return result.length;
}

/**
 * Get execution statistics for a plan
 */
export async function getExecutionStats(planNodeId: number): Promise<{
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  lastRunAt: Date | null;
}> {
  const runs = await getExecutionRunsForPlan(planNodeId);

  return {
    totalRuns: runs.length,
    completedRuns: runs.filter((r) => r.status === "completed").length,
    failedRuns: runs.filter((r) => r.status === "failed").length,
    lastRunAt: runs[0]?.createdAt ?? null,
  };
}
