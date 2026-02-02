// DEPRECATED: This file is kept for backwards compatibility
// All state management has been moved to @/stores/planStore

// Re-export from the new unified store for backwards compatibility
export {
  usePlanStore,
  type Plan,
  type Stage,
  type Job,
  type ContextNode,
  type Selection,
} from "@/stores/planStore";

// Legacy aliases (deprecated - use usePlanStore directly)
export const usePlanStateStore = () => {
  console.warn(
    "usePlanStateStore is deprecated. Use usePlanStore from @/stores/planStore instead.",
  );
  // This is just for type compatibility during migration
  return null;
};

export const useUiStateStore = () => {
  console.warn(
    "useUiStateStore is deprecated. Use usePlanStore from @/stores/planStore instead.",
  );
  return null;
};
