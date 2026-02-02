import {
  pgTable,
  serial,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "./nodes";
import { replanScopeTypeEnum, replanStatusEnum, actorTypeEnum } from "./enums";

/* ----------------------------------
 * Replan Sessions
 * Tracks replanning operations on nodes
 * ---------------------------------- */

export const replanSessions = pgTable(
  "replan_sessions",
  {
    id: serial().primaryKey(),
    planNodeId: integer()
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    scopeType: replanScopeTypeEnum().notNull(),
    scopeNodeIds: integer().array().notNull(), // Node IDs being replanned
    blastRadius: jsonb().notNull(), // { upstream: number[], downstream: number[], affected: number[] }
    status: replanStatusEnum().notNull().default("draft"),
    createdBy: actorTypeEnum().notNull(),
    originalSnapshot: jsonb(), // snapshot of original state for diff
    proposedChanges: jsonb(), // proposed modifications
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("replan_sessions_plan_node_id_idx").on(t.planNodeId),
    index("replan_sessions_status_idx").on(t.status),
  ]
);

/* ----------------------------------
 * Replan Relations
 * ---------------------------------- */

export const replanSessionsRelations = relations(replanSessions, ({ one }) => ({
  planNode: one(nodes, {
    fields: [replanSessions.planNodeId],
    references: [nodes.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type ReplanSession = typeof replanSessions.$inferSelect;
export type ReplanSessionInsert = typeof replanSessions.$inferInsert;
