


We are redesigning the PLAN STAGE ONLY.
This is NOT execution, scheduling, or runtime state.

Stack:
- Postgres
- ltree-based hierarchy (path column)
- Drizzle ORM (types must be inferred from DB schema, do NOT hardcode TS unions)

Existing base tables (already exist):
- nodes
- plan_nodes
- other tables in existing schema

Do NOT redesign or duplicate these tables.
Work with them and modify ONLY what is necessary.

====================
CORE MODEL RULES
====================

1) Nodes are the only structural entity.
   - plans, stages, jobs, data nodes, collectors are all nodes
   - node.type comes from the DB enum and must be inferred by Drizzle

2) Hierarchy (ltree path) is for:
   - ownership
   - scope
   - dependency inheritance

3) Flow is NOT inferred from hierarchy.
   Flow is explicit.

4) Planning is declarative:
   - no runtime state
   - no execution status
   - no retries, scheduling, or timing logic

====================
DEPENDENCIES (PLANNING)
====================

Dependencies are modeled ONLY on the nodes table using:
- includeDependencyIds   (direct dependencies only)
- excludeDependencyIds   (filters inherited deps)
- disableDependencyInheritance

Rules:
- Dependencies are inherited from ancestors via ltree path patterns
- Only direct dependencies are stored on the node
- Effective dependencies are NEVER materialized or stored
- Dependency data on a node must be empty arrays unless explicitly defined
- excludeDependencyIds filters inherited dependencies only
- Avoid generating large repeated JSON blobs

====================
FLOW (FAN-IN / FAN-OUT)
====================

Add a new table:

plan_edges
- id
- fromNodeId
- toNodeId
- kind: "control" | "data"
- role?: "required" | "optional"

Rules:
- Edges are binary (NO arrays, NO hyper-edges)
- Fan-out = one fromNodeId → many edges
- Fan-in  = many edges → one toNodeId
- Flow is explicit and never inferred

====================
COLLECTORS
====================

Collectors are NOT a separate table.
Collectors are nodes.

A collector is identified by node.type === "collector".

Collector coordination intent is stored on the node itself (config column):
- joinRule: "all" | "any" | "required" | "threshold"
- requiredThreshold?: number
- optionalThreshold?: number
- timeoutMs?: number   // planning intent only

Rules:
- Collectors interpret their incoming edges
- Required vs optional inputs are expressed via plan_edges.role
- No execution logic is implemented

====================
DATA NODES
====================

- Replace IO/input/output nodes with data nodes
- Data direction is inferred:
  - parent node produces data
  - child node consumes data
- Data flow is expressed via plan_edges.kind = "data"
- No explicit IO typing is required

====================
nodesToPlan REWRITE
====================

The existing nodesToPlan implementation is broken and must be rewritten.

The new implementation must:
- Query nodes by planId
- Use ltree path patterns to resolve ancestors
- Resolve inherited dependencies at query time
- Apply excludeDependencyIds correctly
- Respect disableDependencyInheritance
- Fetch plan_edges and attach flow explicitly
- Group nodes dynamically by type (no hardcoded enums)
- Let Drizzle ORM infer all types
- Avoid building large repeated JSON blobs
- Return a correct hierarchical + dependency-aware plan structure

====================
STRICT CONSTRAINTS
====================

DO NOT:
- add execution state (status, timestamps, retries)
- infer flow from node ordering or depth
- embed dependency graphs inside node config
- materialize effective dependencies
- hardcode node types in TypeScript
- introduce dependsOnStages or dependsOn* fields


====================
GOAL
====================

Produce:
- minimal schema additions
- clean Drizzle ORM mappings
- correct dependency inheritance via ltree
- explicit fan-in / fan-out via edges
- production-grade planning logic only

Esthetics:
- create tecnical depth "departed" marking and version,
- do not migrate, use db push with updated schema, and reseed, existing data is not importent

<!-- /*
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
*/ -->
