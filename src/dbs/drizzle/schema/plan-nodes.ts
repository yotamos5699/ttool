import { pgTable, integer, text, index, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "./nodes";

/* ----------------------------------
 * Plan Nodes Table
 * Plan-specific attributes
 * ---------------------------------- */

export const plans = pgTable(
  "plans",
  {
    id: serial().primaryKey(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    goal: text().notNull(),
    version: integer().notNull().default(1),
    parentVersion: integer(), // For forking/versioning
  },
  (t) => [
    index("plan_nodes_version_idx").on(t.version),
    index("plan_nodes_parent_version_idx").on(t.parentVersion),
  ],
);

/* ----------------------------------
 * Plan Node Relations
 * ---------------------------------- */

export const planNodesRelations = relations(plans, ({ many }) => ({
  nodes: many(nodes),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type PlanSelect = typeof plans.$inferSelect;
export type PlanInsert = typeof plans.$inferInsert;
