<!-- # ttool - Deterministic Plan & Context Management System

Version: 0.2
Updated: 2026-02-04

## Overview

A Next.js application for managing hierarchical planning trees with context inheritance, real-time collaboration, and replanning capabilities.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Database:** Drizzle ORM + Neon PostgreSQL (serverless)
- **Real-time:** WebSocket (custom server integrated with Next.js)
- **Package Manager:** pnpm

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Plan                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Context Nodes (project-level)                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Stage 1   │  │   Stage 2   │  │   Stage 3   │        │
│  │  (parallel) │─▶│(sequential) │─▶│  (parallel) │        │
│  │             │  │             │  │             │        │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │        │
│  │ │  Job A  │ │  │ │Child    │ │  │ │  Job X  │ │        │
│  │ │         │ │  │ │Stage 2.1│ │  │ │         │ │        │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │        │
│  │ ┌─────────┐ │  │             │  │             │        │
│  │ │  Job B  │ │  │             │  │             │        │
│  │ └─────────┘ │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### Core Entities

| Table | Description |
|-------|-------------|
| `plans` | Versioned plans with parent-version for forking |
| `nodes` | Unified hierarchy (plan, stage, job, context, data, collector) with ltree paths |
| `plan_nodes` | Plan-specific attributes (goal, version, parentVersion) |
| `stage_nodes` | Stage-specific attributes (executionMode, description) |
| `job_nodes` | Job-specific attributes (description) |
| `context_nodes` | Context-specific attributes (contextType, payload) |
| `data_nodes` | Data-specific payloads (jsonb) |
| `plan_edges` | Explicit control/data flow edges between nodes |

### Execution & Replan

| Table | Description |
|-------|-------------|
| `executionRuns` | Plan-level execution tracking |
| `stageExecutions` | Stage execution states |
| `jobExecutions` | Job execution states |
| `replanSessions` | Tracks replan with blast radius (upstream/downstream/affected) |

## Key Features

### 1. Hierarchical Plan Tree
- Stages can nest other stages
- Jobs can nest other jobs
- Dependencies stored on nodes via include/exclude/disable inheritance

### 2. Context Inheritance
- Global → Project → Stage → Job
- Dependencies inherit from ancestors via ltree traversal

### 3. Real-time Collaboration
- WebSocket for live updates
- Room-based subscriptions per plan
- Cursor sync, node CRUD events

### 4. Replanning
- Select scope (stages or jobs)
- Compute blast radius (upstream + downstream affected nodes)
- Propose changes, commit or abort

## Project Structure

```
src/
├── app/
│   └── (pages)/plans/
│       ├── page.tsx              # Plan list
│       └── [planId]/
│           ├── page.tsx          # Server component
│           └── PlanClient.tsx    # Client with reducer state
├── actions/                      # Server actions
│   ├── plan-actions.ts           # getPlanTree, forkPlan
│   ├── stage-actions.ts          # CRUD, move, duplicate
│   ├── job-actions.ts            # CRUD, move, duplicate
│   ├── context-actions.ts        # getInheritedContext
│   ├── data-actions.ts           # data node CRUD
│   ├── replan-actions.ts         # computeBlastRadius
│   └── execution-actions.ts
├── components/
│   ├── plan-tree/                # Tree view (PlanTree, StageNode, JobNode)
│   ├── detail-panel/             # Forms (PlanDetailForm, StageDetailForm, JobDetailForm)
│   ├── replan/                   # BlastRadiusIndicator, ReplanPanel
│   ├── data-node/                # data node UI (if added)
│   └── ui/                       # shadcn primitives
├── hooks/
│   └── useWebSocket.ts           # Real-time connection
├── dbs/drizzle/
│   └── schema/                   # Drizzle schema definitions
└── scripts/
    └── seed-example-plan.ts      # Example data
```

## Commands

```bash
pnpm dev          # Start dev server with WebSocket
pnpm build        # Production build
pnpm lint         # ESLint
pnpm db:push      # Push schema to Neon
pnpm db:seed      # Seed example plan
pnpm db:studio    # Drizzle Studio GUI
```

## State Management

PlanClient uses `useReducer` for local state with optimistic updates:

```typescript
type PlanAction =
  | { type: "UPDATE_PLAN"; data: Partial<Plan> }
  | { type: "UPDATE_STAGE"; id: number; data: Partial<Stage> }
  | { type: "UPDATE_JOB"; id: number; data: Partial<Job> }
  | { type: "ADD_STAGE"; stage: Stage }
  | { type: "ADD_JOB"; job: Job }
  | { type: "DELETE_STAGE"; id: number }
  | { type: "DELETE_JOB"; id: number }
  | { type: "ADD_CONTEXT"; context: ContextNode; targetType; targetId }
  | { type: "UPDATE_CONTEXT"; id: number; data: Partial<ContextNode> }
  | { type: "DELETE_CONTEXT"; id: number };
```

WebSocket messages trigger dispatches for real-time sync across clients.

## Next Steps (Future Work)

1. **Execution Engine** - Actually run stages/jobs with status tracking
2. **Agent Integration** - Connect AI agents for automated job execution
3. **Diff View** - Visual comparison for replan changes
4. **History/Audit** - Track all changes with timestamps
5. **Permissions** - Role-based access control
6. **Export/Import** - Plan templates and sharing -->


