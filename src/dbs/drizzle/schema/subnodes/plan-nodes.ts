import { pgTable, integer, text, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "../nodes";

/* ----------------------------------
 * Plan Nodes Table
 * Plan-specific attributes
 * ---------------------------------- */

export const planNodes = pgTable(
  "plan_nodes",
  {
    nodeId: integer()
      .primaryKey()
      .references(() => nodes.id, { onDelete: "cascade" }),

    goal: text().notNull(),
    version: integer().notNull().default(1),
    parentVersion: integer(), // For forking/versioning
  },
  (t) => [
    index("plan_nodes_version_idx").on(t.version),
    index("plan_nodes_parent_version_idx").on(t.parentVersion),
  ]
);

/* ----------------------------------
 * Plan Node Relations
 * ---------------------------------- */

export const planNodesRelations = relations(planNodes, ({ one }) => ({
  node: one(nodes, {
    fields: [planNodes.nodeId],
    references: [nodes.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type PlanNode = typeof planNodes.$inferSelect;
export type PlanNodeInsert = typeof planNodes.$inferInsert;
