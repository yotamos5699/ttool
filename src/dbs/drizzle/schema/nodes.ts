import {
  pgTable,
  serial,
  integer,
  varchar,
  boolean,
  timestamp,
  index,
  PgColumn,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { executionModeEnum, nodeTypeEnum } from "./enums";
import { planEdges } from "./plan-edges";
import { tenants } from "./tenants";
import { plans } from "./plan-nodes";

export const nodes = pgTable(
  "plan_nodes",
  {
    id: serial().primaryKey(),
    type: nodeTypeEnum().notNull(),
    name: varchar({ length: 256 }).notNull(),
    path: varchar({ length: 1024 }).notNull(), // ltree-compatible string
    contextStats: varchar({ length: 512 }), // Summary of associated context nodes for quick access
    depth: integer().notNull().default(0),
    parentId: integer().references((): PgColumn => nodes.id, {
      onDelete: "cascade",
    }),
    snippet: varchar({ length: 512 }),
    description: varchar({ length: 512 }),
    executionMode: executionModeEnum().notNull().default("sequential"),
    planId: integer().references(() => plans.id, {
      onDelete: "cascade",
    }), // Root plan node (self-referencing for plans)
    tenantId: integer()
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    isFrozen: boolean().default(false).notNull(),

    disableDependencyInheritance: boolean().default(false).notNull(),
    includeDependencyIds: integer().array().default([]),
    excludeDependencyIds: integer().array().default([]),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lastUpdatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("nodes_path_tenant_unique_idx").on(t.path, t.tenantId),
    index("nodes_path_pattern_idx").on(t.path),
    index("nodes_tenant_active_idx").on(t.tenantId, t.active),
    index("nodes_type_tenant_active_idx").on(t.type, t.tenantId, t.active),
    index("nodes_depth_idx").on(t.depth),
    index("nodes_plan_id_idx").on(t.planId),
    index("nodes_parent_id_idx").on(t.parentId),
    index("nodes_plan_type_active_idx").on(t.planId, t.type, t.active),
  ],
);

/* ----------------------------------
 * Node Relations
 * ---------------------------------- */

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [nodes.tenantId],
    references: [tenants.id],
  }),

  parent: one(nodes, {
    fields: [nodes.parentId],
    references: [nodes.id],
    relationName: "nodeHierarchy",
  }),

  children: many(nodes, {
    relationName: "nodeHierarchy",
  }),

  outgoingEdges: many(planEdges, {
    relationName: "planEdgeFromNode",
  }),

  incomingEdges: many(planEdges, {
    relationName: "planEdgeToNode",
  }),

  // Self-reference for planId (plan nodes reference themselves)
  plan: one(plans, {
    fields: [nodes.planId],
    references: [plans.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type Node = typeof nodes.$inferSelect;
export type NodeInsert = typeof nodes.$inferInsert;
