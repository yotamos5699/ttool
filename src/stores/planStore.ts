"use client";

/**
 * @deprecated This file is maintained for backwards compatibility only.
 * Import from '@/stores/plan' instead:
 *
 * - usePlanDataStore: Plan data and mutations
 * - useUIStore: UI state (selection, expanded states)
 * - useWSStore: WebSocket state
 */

// Re-export types
export type {
  ContextNode,
  Job,
  IOEnvelope,
  Stage,
  Plan,
  Selection,
  NodeType,
  NodeKey,
  WSMessageType,
  WSMessage,
  WsState,
} from "./plan/types";
export { WebSocketReadyStateMap } from "./plan/types";

// Re-export stores
export { usePlanDataStore, useUIStore, useWSStore } from "./plan";

// Re-export utilities
export {
  findStage,
  findJob,
  getAllStages,
  getAllJobs,
  getAllJobsFromList,
  toNodeKey,
  parseNodeKey,
  getSelectionKeys,
  computeBlastRadiusForSelection,
} from "./plan/blastRadius";

/**
 * @deprecated Use usePlanDataStore instead
 * This is a compatibility alias - the old usePlanStore is no longer available.
 * Migrate your code to use the new split stores.
 */
export { usePlanDataStore as usePlanStore } from "./plan";
