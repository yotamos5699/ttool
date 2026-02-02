import { pgTable, integer, text, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "../nodes";
import { ioDirectionEnum, ioTypeEnum } from "../enums";

/* ----------------------------------
 * IO Nodes Table
 * IO-specific attributes with direction
 * ---------------------------------- */

export const ioNodes = pgTable(
  "io_nodes",
  {
    nodeId: integer()
      .primaryKey()
      .references(() => nodes.id, { onDelete: "cascade" }),

    direction: ioDirectionEnum().notNull(),
    ioType: ioTypeEnum().notNull(),
    data: text().notNull(),
  },
  (t) => [
    index("io_nodes_direction_idx").on(t.direction),
    index("io_nodes_type_idx").on(t.ioType),
  ]
);

/* ----------------------------------
 * IO Node Relations
 * ---------------------------------- */

export const ioNodesRelations = relations(ioNodes, ({ one }) => ({
  node: one(nodes, {
    fields: [ioNodes.nodeId],
    references: [nodes.id],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type IoNode = typeof ioNodes.$inferSelect;
export type IoNodeInsert = typeof ioNodes.$inferInsert;
