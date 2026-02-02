import { pgEnum } from "drizzle-orm/pg-core";

/* ----------------------------------
 * Node Type Enum
 * Defines the type of node in the hierarchy
 * ---------------------------------- */

export const nodeTypeEnum = pgEnum("node_type", [
  "plan",
  "stage",
  "job",
  "context",
  "io",
]);

/* ----------------------------------
 * Execution Mode Enum
 * How child nodes should be executed
 * ---------------------------------- */

export const executionModeEnum = pgEnum("execution_mode", [
  "sequential",
  "parallel",
]);

/* ----------------------------------
 * Context Type Enum
 * Classification of context nodes
 * ---------------------------------- */

export const contextTypeEnum = pgEnum("context_type", [
  "requirement",
  "constraint",
  "decision",
  "code",
  "note",
]);

/* ----------------------------------
 * IO Direction Enum
 * Whether IO node is input or output
 * ---------------------------------- */

export const ioDirectionEnum = pgEnum("io_direction", ["input", "output"]);

/* ----------------------------------
 * IO Type Enum
 * Classification of IO data
 * ---------------------------------- */

export const ioTypeEnum = pgEnum("io_type", [
  "data",
  "generator",
  "artifact",
  "model",
  "dataset",
  "url",
]);

/* ----------------------------------
 * Execution Status Enum (for execution tables)
 * ---------------------------------- */

export const executionStatusEnum = pgEnum("execution_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

/* ----------------------------------
 * Actor Type Enum (for execution/replan)
 * ---------------------------------- */

export const actorTypeEnum = pgEnum("actor_type", ["agent", "human"]);

/* ----------------------------------
 * Replan Scope Type Enum
 * ---------------------------------- */

export const replanScopeTypeEnum = pgEnum("replan_scope_type", [
  "stage",
  "job",
  "context",
]);

/* ----------------------------------
 * Replan Status Enum
 * ---------------------------------- */

export const replanStatusEnum = pgEnum("replan_status", [
  "draft",
  "in_progress",
  "committed",
  "aborted",
]);

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type NodeType = (typeof nodeTypeEnum.enumValues)[number];
export type ExecutionMode = (typeof executionModeEnum.enumValues)[number];
export type ContextType = (typeof contextTypeEnum.enumValues)[number];
export type IoDirection = (typeof ioDirectionEnum.enumValues)[number];
export type IoType = (typeof ioTypeEnum.enumValues)[number];
export type ExecutionStatus = (typeof executionStatusEnum.enumValues)[number];
export type ActorType = (typeof actorTypeEnum.enumValues)[number];
export type ReplanScopeType = (typeof replanScopeTypeEnum.enumValues)[number];
export type ReplanStatus = (typeof replanStatusEnum.enumValues)[number];
