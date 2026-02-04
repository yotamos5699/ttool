import { pgTable, integer, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nodes } from "../nodes";

export type PlanEdge = {
  id: string;
  from: string[];
  to: string[];
  styleConfig: object; // some style settings for visualisation
  rule: "await-all" | "await-first" | "skip-after-timeout" | "none";
  amountThereshold?: number; // optional threshold for rules that need it
  requiredNodes: string[]; // nodes that must be completed before this edge can be traversed
  collectorNodeId?: string; // optional collector node for gathering results
};

/* ----------------------------------
 * Job Nodes Table
 * Job-specific attributes
 * ---------------------------------- */
{
  /* 

  several connected paralel processes pointing to a collector node:

processNode1──|   
processNode2──|     
processNode3──| 
              ├──collectorNode  

several unconnected paralel processes:
processNode1──|   
processNode2──|─|     
processNode3──|─|─|
              | | |─| 
              | |───├──collectorNode  
              |─────|
- replace io nodes with dataNodes we do not need to distinguish them it is infered by parent node(data is a output of parent) 
 and by child nodes(input to child) 
-- remove dependsOnStages and dependsOn* related fields as they are infered from nodes table(includeDependencyIds and excludeDependencyIds ..)
when querying we can use ltree path patterns to get all dependencies including inherited ones, but we need to avoid json blob bloat 
we can get a gigantic json blob full of repeting data,
so we will query dependencies nodes data in the level they are created only, and use ltree path patterns to get inherited dependencies when needed,
other deps data will be empty arrays unless they have direct dependencies added on them, this will keep the json blob size manageable, 
for dep excludion we will use the excludeDependencyIds field in nodes table to filter them out when querying dependencies.
nodesToPlan is complitly broken, returning worng structure we need to rewrite it to use ltree path patterns to get dependencies, and all 
updated nodes data
type needs to be infered from db schema not hardcoded, we can group nodes by type when building the plan structure, prefere letting the 
drizzle orm handle the mapping,
also now we are ussing deps inheritance for cascading nodes by default so we need to ajust the logic 
accordingly.
*/
}
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
