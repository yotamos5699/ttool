import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ----------------------------------
 * Tenants Table
 * Multi-tenant isolation for all nodes
 * ---------------------------------- */

export const tenants = pgTable(
  "tenants",
  {
    id: serial().primaryKey(),
    name: varchar({ length: 256 }).notNull(),
    slug: varchar({ length: 64 }).notNull().unique(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tenants_slug_idx").on(t.slug),
    index("tenants_active_idx").on(t.active),
  ]
);

/* ----------------------------------
 * Tenant Relations
 * ---------------------------------- */

export const tenantsRelations = relations(tenants, ({ many }) => ({
  // nodes relation defined in nodes.ts to avoid circular import
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type Tenant = typeof tenants.$inferSelect;
export type TenantInsert = typeof tenants.$inferInsert;
