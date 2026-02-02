# Refactoring Progress

## Overview
Refactoring the plan management UI to:
1. Remove props drilling by using Zustand store
2. Use React Query for data fetching and mutations with optimistic updates
3. Clean up code for React Compiler compatibility (remove useCallback, useMemo, useReducer where possible)
4. Centralize WebSocket handling

## Status: IN PROGRESS

---

## Completed

### Phase 1: Zustand Store Setup
- [x] Created unified `src/stores/planStore.ts` with:
  - Plan state (plan, selection, blastRadius, allExpanded)
  - WebSocket state (ws, wsState, lastWsError, roomSize)
  - All mutation actions (updatePlan, updateStage, updateJob, etc.)
  - Helper tree manipulation functions
  - Selector functions (findStage, findJob, getAllStages, getAllJobs)

### Phase 2: Basic React Query Integration
- [x] Created `src/hooks/usePlanMutations.ts` with optimistic updates
- [x] Plan page uses `useQuery` for initial data fetch
- [x] Created `src/lib/wsHandler.ts` for centralized message handling

### Phase 3: Deprecated Old Stores
- [x] `src/app/(pages)/plans/_stores/usePlanStateStore.tsx` - marked deprecated, re-exports from planStore
- [x] `src/app/(pages)/plans/_stores/useWsStore.tsx` - marked deprecated, re-exports from planStore
- [x] Deleted `src/app/(pages)/plans/[planId]/_mutations.tsx` - broken/unused

### Phase 4: Remove Props Drilling
- [x] PlanClient - uses initialPlan prop only for initialization
- [x] PlanTree - reads plan from store instead of props
- [x] DetailPanel - reads plan from store instead of props
- [x] PlanDetailForm - reads plan from store
- [x] All components now use `usePlanStore` selectors

### Phase 5: Connect Mutations to Forms
- [x] PlanDetailForm - uses usePlanMutations().updatePlan
- [x] StageDetailForm - uses usePlanMutations().updateStage
- [x] JobDetailForm - uses usePlanMutations().updateJob
- [x] ContextNodeList - uses usePlanMutations() for context CRUD

### Phase 6: Wire Context Menu Actions
- [x] StageNode context menu - createStage, deleteStage, duplicateStage, createJob, createContext
- [x] JobNode context menu - createJob, deleteJob, duplicateJob, createContext
- [x] Inline title editing uses mutations

### Phase 7: Remove useCallback/useMemo
- [x] ReplanPanel - removed useCallback wrappers
- [x] ReplanScopeSelector - removed useCallback wrappers
- [x] No useMemo or useReducer found in codebase (already clean)

---

## Pending

### Phase 8: Clean Up Forms
- [ ] Remove redundant useState in forms (consider using form library or direct store updates)
- [ ] Simplify hasChanges detection

### Phase 9: Component Splitting for React Compiler
- [ ] Split large components into smaller client components
- [ ] Consider extracting context menus to separate files
- [ ] Verify React Compiler is handling re-renders correctly

### Phase 10: Final Cleanup
- [ ] Review and remove remaining TODO comments
- [ ] Remove any dead code
- [ ] Consider removing deprecated store files entirely (breaking change)

---

## Architecture Summary

```
src/
├── stores/
│   └── planStore.ts          # Unified Zustand store (source of truth)
├── hooks/
│   ├── usePlanMutations.ts   # React Query mutations with optimistic updates
│   └── useWebSocket.ts       # WebSocket connection management
├── lib/
│   └── wsHandler.ts          # Centralized WS message handler (console.log for now)
├── components/
│   ├── plan-tree/
│   │   ├── PlanTree.tsx      # Reads from store
│   │   ├── StageNode.tsx     # Uses mutations for CRUD
│   │   └── JobNode.tsx       # Uses mutations for CRUD
│   └── detail-panel/
│       ├── DetailPanel.tsx   # Reads from store
│       ├── PlanDetailForm.tsx
│       ├── StageDetailForm.tsx
│       ├── JobDetailForm.tsx
│       └── ContextNodeList.tsx
└── app/(pages)/plans/
    └── [planId]/
        ├── page.tsx          # useQuery for data fetch
        └── PlanClient.tsx    # Initializes store, sets up WS
```

## Data Flow

1. **Initial Load**: `page.tsx` fetches plan with `useQuery`, passes to `PlanClient`
2. **Store Init**: `PlanClient` calls `setPlan(initialPlan)` on mount
3. **Reading**: All components read from `usePlanStore` selectors
4. **Mutations**: Components call `usePlanMutations()` hooks which:
   - Apply optimistic updates to store immediately
   - Call server action in background
   - Rollback on error
   - Invalidate React Query cache on settle
5. **WebSocket**: `useWebSocket` connects and calls `handleWsMessage` for incoming messages
6. **WS Messages**: Currently console.log - will dispatch to store when server is implemented

---

## WebSocket Message Types (for future server impl)

```typescript
// Room events
"joined"         // { roomSize: number }
"user:joined"    // { userId: string, roomSize: number }
"user:left"      // { userId: string, roomSize: number }

// Cursor events (collaborative)
"cursor"         // { userId: string, position: { x, y }, selection?: Selection }

// Node CRUD events
"node:updated"   // { nodeType: "plan"|"stage"|"job"|"context", nodeId: number, data: Partial }
"node:created"   // { nodeType: string, node: object }
"node:deleted"   // { nodeType: string, nodeId: number }

// Replan events
"replan:started"   // { sessionId, scopeType, scopeIds, blastRadius }
"replan:updated"   // { sessionId, progress, proposedChanges }
"replan:committed" // { sessionId, appliedChanges }
"replan:aborted"   // { sessionId, reason }

// Error events
"error"          // { error: string, code?: string }
```

---

## Notes
- Socket server implementation deferred - handlers console.log for now
- React Compiler enabled - removed all useCallback wrappers
- All mutations use optimistic updates with rollback on error
- Build and lint pass with only warnings (unused imports in unrelated files)
