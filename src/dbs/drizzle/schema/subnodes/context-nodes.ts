import { pgTable, integer, text, index, serial, PgColumn } from "drizzle-orm/pg-core";
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
    id: serial().primaryKey(),
    nodeId: integer()
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    parentId: integer().references((): PgColumn => contextNodes.id, {
      onDelete: "set null",
    }),
    contextType: contextTypeEnum().notNull(),
    title: text().notNull(),
    payload: text().notNull(),
  },
  (t) => [
    index("context_nodes_type_idx").on(t.contextType),
    index("context_nodes_node_idx").on(t.nodeId),
    index("context_nodes_parent_idx").on(t.parentId),
  ],
);

/* ----------------------------------
 * Context Node Relations
 * ---------------------------------- */

export const contextNodesRelations = relations(contextNodes, ({ one, many }) => ({
  node: one(nodes, {
    fields: [contextNodes.nodeId],
    references: [nodes.id],
  }),
  parent: one(contextNodes, {
    fields: [contextNodes.parentId],
    references: [contextNodes.id],
    relationName: "contextHierarchy",
  }),
  children: many(contextNodes, {
    relationName: "contextHierarchy",
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type ContextNode = typeof contextNodes.$inferSelect;
export type ContextNodeInsert = typeof contextNodes.$inferInsert;
