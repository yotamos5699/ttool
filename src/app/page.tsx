import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
// lets remodel this app and update the plan
// new plan is to create a hierarchical node structure
// to base on a general TtoolNode structure
// export const nodeTypeEnum = pgEnum("node_type", [
//   "stage",
//   "job",
//   "context",
//   "io",
//
//
// ]);
// no need for ioEnvelopes its better to use io seprate in/out nodes
// export const ttoolNodes = pgTable(
//   "nodes",
//   {
// disable_dependency_inheritance: boolean().default(false).notNull(),
// include_dependency_ids: integer().array().default([]),// context or io ids to include
// exclude_dependency_ids: integer().array().default([]),// context or io ids to include
// id: integer().primaryKey().generatedAlwaysAsIdentity(),
//   active: boolean().default(true).notNull(),
//   tenantId: integer(),
//   createdAt: timestamp({ withTimezone: true })
//       .default(sql`CURRENT_TIMESTAMP`)
//       .notNull(),
//     updatedAt: timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
//     .references((): PgColumn => tenants.id, { onDelete: "cascade" })
//     .notNull(),
// //     name: varchar({ length: 12 }).notNull(),
//     type: nodeTypeEnum().notNull(),
//     path: text().notNull(),
//     depth: integer().notNull(),

//     stageId: integer()
//       .notNull()
//       .references(() => stageNodes.id, { onDelete: "cascade" }),
//     planId: integer()
//       .references(() => plans.id, { onDelete: "cascade" })
//       .notNull(),
//     parentId: integer(),
//     isFrozen: boolean().notNull().default(false),
//   },
//   (table) => [
//     foreignKey({
//       columns: [table.parentId],
//       foreignColumns: [table.id],
//     })
//       .onDelete("cascade") // Deleting a folder deletes its children
//       .onUpdate("no action"),
//     foreignKey({
//       columns: [table.parentId],
//       foreignColumns: [table.id],
//     })
//       .onDelete("cascade")
//       .onUpdate("no action"),
//     index("nodes_flow_path_idx").on(table.planId, sql`${table.path} text_pattern_ops`),
//     index("nodes_flow_tenant_index").on(table.tenantId, table.active),
//     index("nodes_flow_depth_idx").on(table.planId, table.depth),
//   ],
// );
// for optimizing cache and query sizes context and io should be queried ones based on path prefixes
// example for context/io nodes access in a stage/job tree
// plan 1
//  stage 1
//   job 1
//     context/io nodes with path: /plan_1/stage_1/job_1([context1,context2,io1])
//   job 2 exclude_dependency_ids: [context1]
//     context/io nodes with path: /plan_1/stage_1/job_2([context2,io1])
//     job 3 include_dependency_ids: [contex3]
//       context/io nodes with path: /plan_1/stage_1/job_3([context2,context3,io1])
//  stage 2
//   job 4
// we need a better indexing strategy for path based queries
// use ltree implementation

// also create a StyleConfig component for managing styles:
// includes themes, fonts, colors, spacing, etc.
// code aesthetics:
// file should be kept under 200 lines if possible
// and also update the PLAN.md file with new plan, schema design and rationale
// if in build mode create a updates.md file to track changes and updates to the codebase

/*
Goal:
Remodel the app around a hierarchical node system based on a single generic ToolNode model.

High-level design:
- Use a single `nodes` table to represent stages, jobs, context, and IO
- Hierarchy is represented via a path-based structure (use PostgreSQL ltree)
- Context and IO are modeled as nodes (no ioEnvelopes)
- IO is split into explicit input/output nodes

Node types:
- stage
- job
- context
- io

Key behavior:
- Dependency inheritance is enabled by default
- A node can opt out of inheritance using `disableDependencyInheritance`
- Nodes may explicitly include or exclude dependencies via ID lists

Base node general ref, u can modify if needed, using ltree prefered (Drizzle ORM, Postgres):
- nodes table with:
  - id (identity PK)
  - type (enum)
  - name
  - path (ltree-compatible string)
  - depth
  - parentId (self-referencing FK)
  - planId (FK)
  - stageId (FK, required for jobs)
  - tenantId (FK)
  - active (boolean)
  - isFrozen (boolean)
  - disableDependencyInheritance (boolean, default false)
  - includeDependencyIds (int[])
  - excludeDependencyIds (int[])
  - createdAt / updatedAt

Constraints & indexes:
- Use ltree for path queries
- Index path using GiST
- Optimize queries for:
  - subtree resolution
  - dependency resolution via path prefixes
  - tenant + active filtering
  - depth-based filtering

then we can use a subnode structure for specific node types if needed, e.g.:
- stageNodes
- jobNodes
- contextNodes
- ioNodes

Query model:
- Context and IO nodes are resolved by querying once per subtree using path prefixes
- Example hierarchy:
 plan 1
  stage 1
   job 1
     context/io nodes with path: /plan_1/stage_1/job_1([context1,context2,io1])
   job 2 exclude_dependency_ids: [context1]
     context/io nodes with path: /plan_1/stage_1/job_2([context2,io1])
     job 3 include_dependency_ids: [contex3]
       context/io nodes with path: /plan_1/stage_1/job_3([context2,context3,io1]) 
  stage 2
   job 4

Additional tasks:
- Propose a better indexing strategy for path-based queries
- Implement ltree-based schema and queries
- Create a StyleConfig component to manage:
  - themes
  - fonts
  - colors
  - spacing
- Keep files under ~200 lines when possible

Documentation:
- Update PLAN.md with:
  - new architecture
  - schema design
  - rationale
- If running in build mode, generate an UPDATES.md file to track changes
*/
