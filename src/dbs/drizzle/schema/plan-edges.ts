import { pgTable, serial, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "./nodes";
import { planEdgeKindEnum, planEdgeRoleEnum } from "./enums";

/* ----------------------------------
 * Plan Edges Table
 * Explicit flow between nodes
 * ---------------------------------- */

export const planEdges = pgTable(
  "plan_edges",
  {
    id: serial().primaryKey(),
    fromNodeId: integer()
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    toNodeId: integer()
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    kind: planEdgeKindEnum().notNull(),
    role: planEdgeRoleEnum(),
  },
  (t) => [
    index("plan_edges_from_node_idx").on(t.fromNodeId),
    index("plan_edges_to_node_idx").on(t.toNodeId),
    index("plan_edges_kind_idx").on(t.kind),
  ]
);

/* ----------------------------------
 * Plan Edge Relations
 * ---------------------------------- */

export const planEdgesRelations = relations(planEdges, ({ one }) => ({
  fromNode: one(nodes, {
    fields: [planEdges.fromNodeId],
    references: [nodes.id],
    relationName: "planEdgeFromNode",
  }),
  toNode: one(nodes, {
    fields: [planEdges.toNodeId],
    references: [nodes.id],
    relationName: "planEdgeToNode",
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type PlanEdge = typeof planEdges.$inferSelect;
export type PlanEdgeInsert = typeof planEdges.$inferInsert;
