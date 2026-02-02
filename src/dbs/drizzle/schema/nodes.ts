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

/* ----------------------------------
 * Nodes Table
 * Core unified hierarchy table with ltree-compatible paths
 * 
 * Path format: {type}_{id}.{type}_{id}...
 * Example: plan_1.stage_2.job_3.context_4
 * 
 * Note: For production, enable ltree extension and add GiST index:
 *   CREATE EXTENSION IF NOT EXISTS ltree;
 *   CREATE INDEX nodes_path_gist_idx ON nodes USING GIST (path::ltree);
 * ---------------------------------- */

export const nodes = pgTable(
  "nodes",
  {
    id: serial().primaryKey(),

    // Type classification
    type: nodeTypeEnum().notNull(),

    // Hierarchy
    name: varchar({ length: 256 }).notNull(),
    path: varchar({ length: 1024 }).notNull(), // ltree-compatible string
    depth: integer().notNull().default(0),
    parentId: integer().references((): PgColumn => nodes.id, {
      onDelete: "cascade",
    }),

    // Ownership & Ancestry
    planId: integer(), // Root plan node (self-referencing for plans)
    stageId: integer().references((): PgColumn => nodes.id, {
      onDelete: "cascade",
    }), // Required for jobs - direct stage parent
    tenantId: integer()
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // State
    active: boolean().default(true).notNull(),
    isFrozen: boolean().default(false).notNull(),

    // Dependency inheritance control
    disableDependencyInheritance: boolean().default(false).notNull(),
    includeDependencyIds: integer().array().default([]),
    excludeDependencyIds: integer().array().default([]),

    // Timestamps
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Path uniqueness within tenant
    uniqueIndex("nodes_path_tenant_unique_idx").on(t.path, t.tenantId),

    // Path-based queries with prefix matching
    // For prefix queries like: WHERE path LIKE 'plan_1.stage_2.%'
    // text_pattern_ops enables efficient prefix matching
    index("nodes_path_pattern_idx").on(t.path),

    // Tenant + active filtering (most common filter)
    index("nodes_tenant_active_idx").on(t.tenantId, t.active),

    // Type + tenant + active (common type filtering)
    index("nodes_type_tenant_active_idx").on(t.type, t.tenantId, t.active),

    // Depth-based filtering for level queries
    index("nodes_depth_idx").on(t.depth),

    // Plan membership (all nodes in a plan)
    index("nodes_plan_id_idx").on(t.planId),

    // Stage membership (all jobs in a stage)
    index("nodes_stage_id_idx").on(t.stageId),

    // Parent relationship for direct children
    index("nodes_parent_id_idx").on(t.parentId),

    // Compound: plan + type + active (get all stages/jobs in a plan)
    index("nodes_plan_type_active_idx").on(t.planId, t.type, t.active),
  ]
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
