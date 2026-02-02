import { pgTable, integer, text, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "../nodes";
import { executionModeEnum } from "../enums";

/* ----------------------------------
 * Stage Nodes Table
 * Stage-specific attributes
 * ---------------------------------- */

export const stageNodes = pgTable(
  "stage_nodes",
  {
    nodeId: integer()
      .primaryKey()
      .references(() => nodes.id, { onDelete: "cascade" }),

    description: text(),
    executionMode: executionModeEnum().notNull().default("sequential"),

    // Dependencies on other stage nodes
    dependsOnNodeIds: integer().array().default([]),
  },
  (t) => [index("stage_nodes_execution_mode_idx").on(t.executionMode)]
);

/* ----------------------------------
 * Stage Node Relations
 * ---------------------------------- */

export const stageNodesRelations = relations(stageNodes, ({ one }) => ({
  node: one(nodes, {
    fields: [stageNodes.nodeId],
    references: [nodes.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type StageNode = typeof stageNodes.$inferSelect;
export type StageNodeInsert = typeof stageNodes.$inferInsert;
