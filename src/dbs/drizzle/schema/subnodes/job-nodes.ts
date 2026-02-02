import { pgTable, integer, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "../nodes";

/* ----------------------------------
 * Job Nodes Table
 * Job-specific attributes
 * ---------------------------------- */

export const jobNodes = pgTable("job_nodes", {
  nodeId: integer()
    .primaryKey()
    .references(() => nodes.id, { onDelete: "cascade" }),

  description: text(),

  // Dependencies on other job or stage nodes
  dependsOnNodeIds: integer().array().default([]),
});

/* ----------------------------------
 * Job Node Relations
 * ---------------------------------- */

export const jobNodesRelations = relations(jobNodes, ({ one }) => ({
  node: one(nodes, {
    fields: [jobNodes.nodeId],
    references: [nodes.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type JobNode = typeof jobNodes.$inferSelect;
export type JobNodeInsert = typeof jobNodes.$inferInsert;
