// import {
//   pgTable,
//   serial,
//   integer,
//   text,
//   timestamp,
//   jsonb,
//   index,
// } from "drizzle-orm/pg-core";
// import { relations } from "drizzle-orm";
// import { nodes } from "./nodes";
// import { executionStatusEnum, actorTypeEnum } from "./enums";

// /* ----------------------------------
//  * Execution Runs (Plan-level)
//  * Tracks execution of a plan
//  * ---------------------------------- */

// export const executionRuns = pgTable(
//   "execution_runs",
//   {
//     id: serial().primaryKey(),
//     planNodeId: integer()
//       .notNull()
//       .references(() => nodes.id, { onDelete: "cascade" }),
//     status: executionStatusEnum().notNull().default("pending"),
//     triggeredBy: actorTypeEnum().notNull(),
//     metadata: jsonb(), // agent session info, user id, etc.
//     startedAt: timestamp({ withTimezone: true }),
//     completedAt: timestamp({ withTimezone: true }),
//     createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
//   },
//   (t) => [
//     index("execution_runs_plan_node_id_idx").on(t.planNodeId),
//     index("execution_runs_status_idx").on(t.status),
//   ]
// );

// /* ----------------------------------
//  * Node Executions
//  * Tracks execution of individual nodes (parts/jobs)
//  * ---------------------------------- */

// export const nodeExecutions = pgTable(
//   "node_executions",
//   {
//     id: serial().primaryKey(),
//     runId: integer()
//       .notNull()
//       .references(() => executionRuns.id, { onDelete: "cascade" }),
//     nodeId: integer()
//       .notNull()
//       .references(() => nodes.id, { onDelete: "cascade" }),
//     parentExecutionId: integer(), // For nested executions
//     contextSnapshot: jsonb(), // Resolved dependencies at execution time
//     status: executionStatusEnum().notNull().default("pending"),
//     error: text(),
//     startedAt: timestamp({ withTimezone: true }),
//     completedAt: timestamp({ withTimezone: true }),
//   },
//   (t) => [
//     index("node_executions_run_id_idx").on(t.runId),
//     index("node_executions_node_id_idx").on(t.nodeId),
//     index("node_executions_parent_execution_id_idx").on(t.parentExecutionId),
//     index("node_executions_status_idx").on(t.status),
//   ]
// );

// /* ----------------------------------
//  * Execution Relations
//  * ---------------------------------- */

// export const executionRunsRelations = relations(executionRuns, ({ one, many }) => ({
//   planNode: one(nodes, {
//     fields: [executionRuns.planNodeId],
//     references: [nodes.id],
//   }),
//   nodeExecutions: many(nodeExecutions),
// }));

// export const nodeExecutionsRelations = relations(nodeExecutions, ({ one }) => ({
//   run: one(executionRuns, {
//     fields: [nodeExecutions.runId],
//     references: [executionRuns.id],
//   }),
//   node: one(nodes, {
//     fields: [nodeExecutions.nodeId],
//     references: [nodes.id],
//   }),
// }));

// /* ----------------------------------
//  * TypeScript Types
//  * ---------------------------------- */

// export type ExecutionRun = typeof executionRuns.$inferSelect;
// export type ExecutionRunInsert = typeof executionRuns.$inferInsert;
// export type NodeExecution = typeof nodeExecutions.$inferSelect;
// export type NodeExecutionInsert = typeof nodeExecutions.$inferInsert;
