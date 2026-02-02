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
then we can use a subnode structure for specific node types if needed, e.g.:
- stageNodes
- jobNodes
- contextNodes
- ioNodes
Key behavior:
- Dependency inheritance is enabled by default
- A node can opt out of inheritance using `disableDependencyInheritance`
- Nodes may explicitly include or exclude dependencies via ID lists

Example base node schema, u can modify if needed (Drizzle ORM, Postgres):
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

Query model:
- Context and IO nodes are resolved by querying once per subtree using path prefixes
- Example hierarchy:
  plan_1
    stage_1
      job_1
        context/io: /plan_1/stage_1/job_1
      job_2 (exclude context_1)
        context/io: /plan_1/stage_1/job_2
      job_3 (include context_3)
        context/io: /plan_1/stage_1/job_3
    stage_2
      job_4



Additional tasks:
- create tenants table
- when updating a .md file add a time stemp and version
- create new seed data(db push), dont nigrate 
- delete actions file and insted create a table spesific action files like "job-actions.ts"
- Propose a better indexing strategy for path-based queries
- Implement ltree-based schema and queries
- Create a StyleConfig component to manage:
  - themes
  - fonts
  - colors
  - spacing
- Keep files under ~200 lines when possible
- we will handle excacution in a latter task later 
Documentation:
- Update PLAN.md with:
  - new architecture
  - schema design
  - rationale
- If running in build mode, generate an UPDATES.md file to track changes
*/
