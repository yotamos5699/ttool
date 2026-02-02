import { pgTable, integer, text, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "../nodes";
import { contextTypeEnum } from "../enums";

/* ----------------------------------
 * Context Nodes Table
 * Context-specific attributes
 * ---------------------------------- */

export const contextNodes = pgTable(
  "context_nodes",
  {
    nodeId: integer()
      .primaryKey()
      .references(() => nodes.id, { onDelete: "cascade" }),

    contextType: contextTypeEnum().notNull(),
    payload: text().notNull(),
  },
  (t) => [index("context_nodes_type_idx").on(t.contextType)]
);

/* ----------------------------------
 * Context Node Relations
 * ---------------------------------- */

export const contextNodesRelations = relations(contextNodes, ({ one }) => ({
  node: one(nodes, {
    fields: [contextNodes.nodeId],
    references: [nodes.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type ContextNode = typeof contextNodes.$inferSelect;
export type ContextNodeInsert = typeof contextNodes.$inferInsert;
