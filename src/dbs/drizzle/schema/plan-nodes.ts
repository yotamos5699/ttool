import {
  pgTable,
  integer,
  text,
  index,
  serial,
  boolean,
  timestamp,
  PgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "./nodes";
import { tenants } from "./tenants";

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
    name: text().notNull(),
    goal: text().notNull(),
    version: integer().notNull().default(1),
    parentVersion: integer(), // For forking/versioning
    tenantId: integer()
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    rootNodeId: integer().references((): PgColumn => nodes.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("plan_nodes_version_idx").on(t.version),
    index("plan_nodes_parent_version_idx").on(t.parentVersion),
    index("plan_nodes_root_node_idx").on(t.rootNodeId),
    index("plan_nodes_tenant_idx").on(t.tenantId),
  ],
);

/* ----------------------------------
 * Plan Node Relations
 * ---------------------------------- */

export const planNodesRelations = relations(plans, ({ many, one }) => ({
  nodes: many(nodes),
  rootNode: one(nodes, {
    fields: [plans.rootNodeId],
    references: [nodes.id],
  }),
  tenant: one(tenants, {
    fields: [plans.tenantId],
    references: [tenants.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type PlanSelect = typeof plans.$inferSelect;
export type PlanInsert = typeof plans.$inferInsert;
