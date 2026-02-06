


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
- introduce dependency lists on stages or jobs


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
- do not migrate, use db push with updated schema, and reseed, existing data is not importent
{/*lets replace plan "stages" with "parts" and inside we will add a type to each node 
    childStages/childJobs/jobs exc.. colomms with 
    
        disableDependencyInheritance: boolean().default(false).notNull(),
        includeDependencyIds: integer().array().default([]),
        excludeDependencyIds: integer().array().default([]),
    at each node level
    ,
    also we need to add edges for later impl data flow between nodes
    table exists but no data seeded into it yet
  seems also like we dont need stageId in nodes table anymore, we are using path for indexing and hierarchy
  so now im expecting plan structure to be like this:
{
  "id": 1,
    "name": "AI Code Review Pipeline",
    "goal": "Automated code review with context-aware analysis, security scanning, and improvement suggestions",
    "version": 1,
    "parentVersion": null,
    "parts": [
        {
            "id": 21,
              "type": "stage", 
            "planId": 1,
            "parentStageId": null,
            "title": "AI-Powered Analysis",
            "description": "Use LLMs for deep code understanding",
            "executionMode": "sequential",}
            "childNodes": [... other nodes like jobs, stages etc with type field to distinguish
            ...all other stage fields , 
   
   
            now lets do db push and seed with this new structure
            make a minimum viable plan with 2 stages and few jobs inside, with cascading stages/jobs 
            and context nodes at different levels
            also add dependency fields at some node level(includeDependencyIds)

            also remove dependency using  excludeDependencyIds on some nodes
            and disableDependencyInheritance on some nodes
            also add edges between nodes to represent data flow
            and represent the existing relation in node existing DetailPanel view
            */}
  
<!-- /*
Goal:
Remodel the app around a hierarchical node system based on a single generic ToolNode model.

High-level design:
- Use a single `nodes` table to represent stages, jobs, context, and data
- Hierarchy is represented via a path-based structure (use PostgreSQL ltree)
- Context and data are modeled as nodes

Node types:
- stage
- job
- context
- data
then we can use a subnode structure for specific node types if needed, e.g.:
- stageNodes
- jobNodes
- contextNodes
- dataNodes
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
