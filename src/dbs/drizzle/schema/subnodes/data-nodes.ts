import { pgTable, integer, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "../nodes";

/* ----------------------------------
 * Data Nodes Table
 * Planning-only payloads for data nodes
 * ---------------------------------- */

export const dataNodes = pgTable(
  "data_nodes",
  {
    nodeId: integer()
      .primaryKey()
      .references(() => nodes.id, { onDelete: "cascade" }),

    payload: jsonb().notNull(),
  },
  (t) => [index("data_nodes_node_id_idx").on(t.nodeId)]
);

/* ----------------------------------
 * Data Node Relations
 * ---------------------------------- */

export const dataNodesRelations = relations(dataNodes, ({ one }) => ({
  node: one(nodes, {
    fields: [dataNodes.nodeId],
    references: [nodes.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type DataNode = typeof dataNodes.$inferSelect;
export type DataNodeInsert = typeof dataNodes.$inferInsert;
