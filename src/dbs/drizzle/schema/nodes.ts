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
import { nodeTypeEnum } from "./enums";
import { tenants } from "./tenants";

export const nodes = pgTable(
  "nodes",
  {
    id: serial().primaryKey(),
    type: nodeTypeEnum().notNull(),
    name: varchar({ length: 256 }).notNull(),
    path: varchar({ length: 1024 }).notNull(), // ltree-compatible string
    depth: integer().notNull().default(0),
    parentId: integer().references((): PgColumn => nodes.id, {
      onDelete: "cascade",
    }),
    planId: integer(), // Root plan node (self-referencing for plans)
    stageId: integer().references((): PgColumn => nodes.id, {
      onDelete: "cascade",
    }), // Required for jobs - direct stage parent
    tenantId: integer()
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    active: boolean().default(true).notNull(),
    isFrozen: boolean().default(false).notNull(),

    disableDependencyInheritance: boolean().default(false).notNull(),
    includeDependencyIds: integer().array().default([]),
    excludeDependencyIds: integer().array().default([]),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("nodes_path_tenant_unique_idx").on(t.path, t.tenantId),
    index("nodes_path_pattern_idx").on(t.path),
    index("nodes_tenant_active_idx").on(t.tenantId, t.active),
    index("nodes_type_tenant_active_idx").on(t.type, t.tenantId, t.active),
    index("nodes_depth_idx").on(t.depth),
    index("nodes_plan_id_idx").on(t.planId),
    index("nodes_stage_id_idx").on(t.stageId),
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

  // Self-reference for planId (plan nodes reference themselves)
  plan: one(nodes, {
    fields: [nodes.planId],
    references: [nodes.id],
    relationName: "planMembership",
  }),

  planMembers: many(nodes, {
    relationName: "planMembership",
  }),

  // Stage reference for jobs
  stage: one(nodes, {
    fields: [nodes.stageId],
    references: [nodes.id],
    relationName: "stageMembership",
  }),

  stageMembers: many(nodes, {
    relationName: "stageMembership",
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type Node = typeof nodes.$inferSelect;
export type NodeInsert = typeof nodes.$inferInsert;
