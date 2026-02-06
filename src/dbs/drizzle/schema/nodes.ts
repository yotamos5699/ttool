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
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { executionModeEnum, nodeTypeEnum } from "./enums";
import { planEdges } from "./plan-edges";
import { tenants } from "./tenants";
import { jobNodes, stageNodes } from "./subnodes";
import { plans } from "./plan-nodes";

// lets do a refactor
// we asume large data handling optimizations is a priority
// we need to remove stageNodes, jobNodes
// we will handle a seperate tree like schema 'context_nodes' with sub nodes like:
// rule_nodes, skill_nodes, input_nodes and output_nodes for now
// when we fetch plans fetch from plans table, plan is not a node, it is a plan, and it has a root node which is the entry point of the plan tree
// after we are getting the plan we can import all active nodes of the plan and then we can construct the tree in memory, this way we can optimize the number of queries and also we can handle large data better, we can also implement pagination for nodes if needed, but for now we will fetch all active nodes of the plan and then construct the tree in memory, this way we can optimize the number of queries and also we can handle large data better, we can also implement pagination for nodes if needed, but for now we will fetch all active nodes of the plan and then construct the tree in memory,
// this way we can optimize the number of queries and also we can handle large data better
// also we will keep a short stat summary of the context nodes in the node table for quick access and filtering, this way we can avoid joining with the context nodes table when we just need to filter by context, this will improve performance and also we can handle large data better, we can also implement pagination for nodes if needed, but for now we will fetch all active nodes of the plan and then construct the tree in memory, this way we can optimize the number of queries and also we can handle large data better
// detailPanel will be fetched after we click on the node, this way we can optimize the number of queries and also we can handle large data better, we can also implement pagination for nodes if needed, but for now we will fetch all active nodes of the plan and then construct the tree in memory, this way we can optimize the number
// of queries and also we can handle large data better, we will use useQuery
//  to fetch the detailPanel data when we click on the node, for query caching we will use ["contextNodes", nodeId] as the query key,
// this way we can cache the context nodes data for each node
// we will also use reactCache for the query function passing nodeId and lastUpdatedAt as the key, lastUpdatedAt will be used to invalidate the cache when the node is updated, we will need to store the lastUpdatedAt in the node table and update it whenever  context nodes are updated,
// this way we can ensure that we always have the latest data in the detail panel and we can optimize the number of queries and also we can handle large data better,
// use persitent zustand store for lond cache

// remove all execution related things we are handling planning for now,
// infer table related types from drizzle:
// nodes.$inferInsert
// nodes.$inferSelect
// use drizzle query syntex for all queries
export const nodes = pgTable(
  "plan_nodes",
  {
    id: serial().primaryKey(),
    type: nodeTypeEnum().notNull(),
    name: varchar({ length: 256 }).notNull(),
    path: varchar({ length: 1024 }).notNull(), // ltree-compatible string
    contextStats: varchar({ length: 512 }), // Summary of associated context nodes for quick access
    contextNodeId: integer().references(() => contextNodes.id, {
      onDelete: "set null",
    }), // Optional reference to a context node
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
  stageNode: one(stageNodes, {
    fields: [nodes.id],
    references: [stageNodes.nodeId],
  }),
  jobNode: one(jobNodes, {
    fields: [nodes.id],
    references: [jobNodes.nodeId],
  }),
}));

/* ----------------------------------
 * TypeScript Types
 * ---------------------------------- */

export type Node = typeof nodes.$inferSelect;
export type NodeInsert = typeof nodes.$inferInsert;
const objs = {
  id: 1,
  name: "AI Code Review Pipeline",
  goal: "Automated code review with context-aware analysis, security scanning, and improvement suggestions",
  version: 1,
  parentVersion: null,
  parts: [
    {
      id: 2,
      type: "context",
      title: "Code Quality Standards",
      description: null,
      contextNodes: [],
      dataNodeIds: [],
      dependencies: {
        includeDependencyIds: [],
        excludeDependencyIds: [],
        disableDependencyInheritance: false,
      },
      childNodes: [],
    },
    {
      id: 3,
      type: "context",
      title: "Resource Limits",
      description: null,
      contextNodes: [],
      dataNodeIds: [],
      dependencies: {
        includeDependencyIds: [],
        excludeDependencyIds: [],
        disableDependencyInheritance: false,
      },
      childNodes: [],
    },
    {
      id: 4,
      type: "stage",
      title: "Code Ingestion",
      description: "Fetch and prepare code for analysis",
      executionMode: "sequential",
      contextNodes: [
        {
          id: 5,
          level: "context",
          type: "note",
          title: "Supported VCS",
          payload: "GitHub, GitLab, Bitbucket, local git repos",
        },
      ],
      dataNodeIds: [15, 16],
      dependencies: {
        includeDependencyIds: [],
        excludeDependencyIds: [],
        disableDependencyInheritance: false,
      },
      childNodes: [
        {
          id: 5,
          type: "context",
          title: "Supported VCS",
          description: null,
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
        {
          id: 15,
          type: "data",
          title: "Repository URL Input",
          description: null,
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
        {
          id: 16,
          type: "data",
          title: "AST Artifacts Output",
          description: null,
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
        {
          id: 6,
          type: "job",
          title: "Clone Repository",
          description: "Clone or fetch the target repository",
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [],
            excludeDependencyIds: [],
            disableDependencyInheritance: true,
          },
          childNodes: [],
        },
        {
          id: 7,
          type: "job",
          title: "Detect Languages",
          description: "Analyze file extensions and detect programming languages",
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [6],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
        {
          id: 8,
          type: "job",
          title: "Parse AST",
          description: "Generate Abstract Syntax Trees for each file",
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [7],
            excludeDependencyIds: [6],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
      ],
    },
    {
      id: 9,
      type: "stage",
      title: "AI-Powered Analysis",
      description: "Use LLMs for deep code understanding",
      executionMode: "sequential",
      contextNodes: [
        {
          id: 10,
          level: "context",
          type: "code",
          title: "Analysis Prompt Template",
          payload:
            "You are a senior code reviewer. Analyze the following code for:\n1. Code quality and maintainability\n2. Potential bugs and edge cases\n3. Performance optimizations\n4. Best practices adherence\n\nProvide specific, actionable feedback with code examples where appropriate.",
        },
      ],
      dataNodeIds: [17, 18],
      dependencies: {
        includeDependencyIds: [4],
        excludeDependencyIds: [],
        disableDependencyInheritance: false,
      },
      childNodes: [
        {
          id: 10,
          type: "context",
          title: "Analysis Prompt Template",
          description: null,
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
        {
          id: 17,
          type: "data",
          title: "Code Chunks Input",
          description: null,
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
        {
          id: 18,
          type: "data",
          title: "AI Findings Output",
          description: null,
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
        {
          id: 11,
          type: "job",
          title: "Code Quality Assessment",
          description: "Analyze code quality using AI",
          contextNodes: [
            {
              id: 12,
              level: "context",
              type: "constraint",
              title: "Model Configuration",
              payload: '{"model":"claude-3-5-sonnet","temperature":0.3,"maxTokens":4096}',
            },
          ],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [8],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [
            {
              id: 12,
              type: "context",
              title: "Model Configuration",
              description: null,
              contextNodes: [],
              dataNodeIds: [],
              dependencies: {
                includeDependencyIds: [],
                excludeDependencyIds: [],
                disableDependencyInheritance: false,
              },
              childNodes: [],
            },
          ],
        },
        {
          id: 13,
          type: "job",
          title: "Bug Detection",
          description: "Identify potential bugs and issues",
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [11],
            excludeDependencyIds: [],
            disableDependencyInheritance: false,
          },
          childNodes: [],
        },
        {
          id: 14,
          type: "job",
          title: "Improvement Suggestions",
          description: "Generate refactoring and optimization suggestions",
          contextNodes: [],
          dataNodeIds: [],
          dependencies: {
            includeDependencyIds: [13],
            excludeDependencyIds: [],
            disableDependencyInheritance: true,
          },
          childNodes: [],
        },
      ],
    },
  ],
  contextNodes: [
    {
      id: 2,
      level: "context",
      type: "requirement",
      title: "Code Quality Standards",
      payload:
        '{"minCoverage":80,"maxComplexity":10,"languages":["typescript","python","go"],"lintRules":"strict"}',
    },
    {
      id: 3,
      level: "context",
      type: "constraint",
      title: "Resource Limits",
      payload: '{"maxExecutionTime":"5m","maxMemory":"2GB","parallelWorkers":4}',
    },
  ],
  dependencies: {
    includeDependencyIds: [],
    excludeDependencyIds: [],
    disableDependencyInheritance: false,
  },
  dataNodeIds: [],
  edges: [
    {
      id: 1,
      fromNodeId: 6,
      toNodeId: 7,
      kind: "data",
      role: "required",
    },
    {
      id: 2,
      fromNodeId: 7,
      toNodeId: 8,
      kind: "data",
      role: "required",
    },
    {
      id: 3,
      fromNodeId: 8,
      toNodeId: 11,
      kind: "data",
      role: "required",
    },
    {
      id: 4,
      fromNodeId: 11,
      toNodeId: 13,
      kind: "data",
      role: "optional",
    },
  ],
  nodesByType: {
    plan: [1],
    context: [2, 3, 5, 10, 12],
    stage: [4, 9],
    data: [15, 16, 17, 18],
    job: [6, 7, 8, 11, 13, 14],
  },
};
