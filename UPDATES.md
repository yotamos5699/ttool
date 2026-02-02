# UPDATES.md - Change Log

## [Unreleased] - Hierarchical Node System Remodel

### Overview

Remodeling the application around a unified hierarchical node system using PostgreSQL's `ltree` extension for path-based queries.

### Architecture Changes

#### New Unified Node Model

**Before:** Separate tables for `plans`, `stages`, `jobs`, `context_nodes`, `io_nodes`, `io_envelopes`

**After:** Single `nodes` table with type-specific subnode tables

```
nodes (core hierarchy)
├── tenants (multi-tenant isolation)
├── plan_nodes (plan-specific data)
├── stage_nodes (stage-specific data)
├── job_nodes (job-specific data)
├── context_nodes (context-specific data)
└── io_nodes (io-specific data with direction)
```

#### ltree Path Format

Paths use type-prefixed segments: `plan_1.stage_2.job_3.context_4`

Benefits:
- O(1) subtree/ancestor queries via GiST index
- Single table for hierarchy traversal
- Built-in tenant isolation
- Flexible per-node inheritance control

#### Dependency Inheritance

- Enabled by default for all nodes
- Nodes can opt out via `disableDependencyInheritance: true`
- Explicit control via `includeDependencyIds` and `excludeDependencyIds`

### Schema Changes

#### New Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Multi-tenant isolation |
| `nodes` | Unified hierarchy with ltree paths |
| `plan_nodes` | Plan-specific attributes (goal, version) |
| `stage_nodes` | Stage-specific attributes (executionMode, description) |
| `job_nodes` | Job-specific attributes (description, dependencies) |
| `context_nodes` | Context-specific attributes (contextType, payload) |
| `io_nodes` | IO-specific attributes (direction, ioType, data) |

#### New Enums

| Enum | Values |
|------|--------|
| `node_type` | plan, stage, job, context, io |
| `execution_mode` | sequential, parallel |
| `context_type` | requirement, constraint, decision, code, note |
| `io_direction` | input, output |
| `io_type` | data, generator, artifact, model, dataset, url |

#### Indexes

- `nodes_path_gist_idx` - GiST index for ltree path queries
- `nodes_tenant_active_idx` - Tenant + active filtering
- `nodes_type_tenant_idx` - Type + tenant filtering
- `nodes_composite_idx` - Compound index for common queries

### New Features

#### StyleConfig Component

Runtime theme management with:
- Light/Dark/System theme switching
- Color palette customization (primary, secondary, domain colors)
- Font selection (sans/mono)
- Spacing/density configuration
- Live preview

### Files Added

```
src/dbs/drizzle/schema/
├── enums.ts                    # All enum definitions
├── tenants.ts                  # Tenants table
├── nodes.ts                    # Core nodes table
└── subnodes/
    ├── index.ts               # Re-exports
    ├── plan-nodes.ts          # Plan-specific data
    ├── stage-nodes.ts         # Stage-specific data
    ├── job-nodes.ts           # Job-specific data
    ├── context-nodes.ts       # Context-specific data
    └── io-nodes.ts            # IO-specific data

src/lib/
├── ltree.ts                    # ltree path utilities
├── node-utils.ts               # Node helper functions
└── theme-utils.ts              # CSS variable manipulation

src/actions/
├── nodes.ts                    # Core node CRUD
├── node-queries.ts             # Subtree/ancestor queries
└── dependency-resolution.ts    # Inheritance logic

src/stores/
└── themeStore.ts               # Theme state persistence

src/components/style-config/
├── StyleConfig.tsx             # Main panel
├── ThemeSelector.tsx           # Theme switcher
├── ColorPalette.tsx            # Color customization
├── FontSelector.tsx            # Font options
├── SpacingConfig.tsx           # Spacing scale
├── ThemePreview.tsx            # Live preview
└── index.ts                    # Exports
```

### Migration Notes

- **Breaking Change:** Old schema tables (stages, jobs, context_nodes, io_nodes, io_envelopes) are replaced
- Execution tables (`execution_runs`, `stage_executions`, `job_executions`) remain separate
- Replan tables updated to reference new node structure

### Query Examples

#### Get Subtree
```sql
SELECT * FROM nodes 
WHERE path <@ 'plan_1.stage_2'::ltree
  AND tenant_id = 1
  AND active = true
ORDER BY depth, path;
```

#### Get Ancestors
```sql
SELECT * FROM nodes 
WHERE 'plan_1.stage_2.job_3'::ltree <@ path
  AND tenant_id = 1
ORDER BY depth;
```

#### Resolve Dependencies for Job
```typescript
// Inherits context/io from all ancestors
// Respects excludeDependencyIds and includeDependencyIds
const deps = await resolveInheritedDependencies(jobNodeId);
```

---

*Generated: Build Mode*
