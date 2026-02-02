// DEPRECATED: This file is kept for backwards compatibility
// All state management has been moved to @/stores/planStore

import { usePlanStore } from "@/stores/planStore";

// Re-export types and store from the new unified store
export {
  usePlanStore as useWsStore,
  type Plan,
  type Stage,
  type Job,
  type ContextNode,
  type IOEnvelope,
  type Selection,
  type WSMessage,
  type WSMessageType,
  WebSocketReadyStateMap,
} from "@/stores/planStore";

// Legacy type alias
export type PlanClientProps = {
  initialPlan: import("@/stores/planStore").Plan;
};

// Legacy action types (deprecated)
export type PlanAction =
  | { type: "UPDATE_PLAN"; data: Partial<import("@/stores/planStore").Plan> }
  | { type: "UPDATE_STAGE"; id: number; data: Partial<import("@/stores/planStore").Stage> }
  | { type: "UPDATE_JOB"; id: number; data: Partial<import("@/stores/planStore").Job> }
  | { type: "ADD_STAGE"; stage: import("@/stores/planStore").Stage }
  | { type: "ADD_JOB"; job: import("@/stores/planStore").Job }
  | { type: "DELETE_STAGE"; id: number }
  | { type: "DELETE_JOB"; id: number }
  | {
      type: "ADD_CONTEXT";
      context: import("@/stores/planStore").ContextNode;
      targetType: "plan" | "stage" | "job";
      targetId: number;
    }
  | { type: "UPDATE_CONTEXT"; id: number; data: Partial<import("@/stores/planStore").ContextNode> }
  | { type: "DELETE_CONTEXT"; id: number };

// Legacy setters (deprecated - use store actions directly)
export const setReadyState = (state: number) => {
  console.warn("setReadyState is deprecated. Use usePlanStore().setWsState() instead.");
  usePlanStore.getState().setWsState(state);
};

export const setLastWsError = (error: string) => {
  console.warn("setLastWsError is deprecated. Use usePlanStore().setWsError() instead.");
  usePlanStore.getState().setWsError(error);
};
