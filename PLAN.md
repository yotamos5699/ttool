# ttool - Deterministic Plan & Context Management System

## Overview

A Next.js application for managing hierarchical execution plans with context inheritance, real-time collaboration, and replanning capabilities.

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
| `stages` | Self-nesting, execution mode (sequential/parallel), dependsOn array |
| `jobs` | Self-nesting, belongs to stage, dependsOn array |
| `contextNodes` | Attachable at plan/stage/job level (requirement, constraint, decision, code, note) |
| `ioNodes` | Data nodes (data, generator, artifact, model, dataset, url) |
| `ioEnvelopes` | Execution barrier with input/output + context snapshot |

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
- Dependencies within same level (dependsOn arrays)

### 2. Context Inheritance
- Global → Project → Stage → Job
- IO Envelopes control which context is included/excluded
- Context snapshot at execution time

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
│   ├── plans.ts                  # getPlanTree, forkPlan
│   ├── stages.ts                 # CRUD, move, duplicate
│   ├── jobs.ts                   # CRUD, move, duplicate
│   ├── context.ts                # getInheritedContext
│   ├── io-nodes.ts
│   ├── io-envelopes.ts
│   ├── replan.ts                 # computeBlastRadius
│   └── execution.ts
├── components/
│   ├── plan-tree/                # Tree view (PlanTree, StageNode, JobNode)
│   ├── detail-panel/             # Forms (PlanDetailForm, StageDetailForm, JobDetailForm)
│   ├── replan/                   # BlastRadiusIndicator, ReplanPanel
│   ├── io-envelope/              # IOEnvelopeModal, ContextSelector
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
6. **Export/Import** - Plan templates and sharing


