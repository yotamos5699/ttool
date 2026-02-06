import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Selection, Plan, PlanNode } from "./types";
import { use } from "react";
import { getNodeById, usePlanDataStore } from "./planDataStore";

/* ----------------------------------
 * State Types
 * ---------------------------------- */

type UIActions = {
  planId: number | null;
  focucedNodeId: Record<number, number | null>;
  allExpanded: Record<number, boolean>;
  clearSelection: () => void;
  expandedNodes: Record<number, number[]>;
  selectedNodes: Record<number, number[]>; // e.g. ["stage:1", "job:5"] for easy lookup
  selectNode: (params: {
    id: number;
    mode: "toggle:isolated" | "toggle:cascade" | "focus";
  }) => void;
  toggleAllExpanded: () => void;
};

type UIStore = UIActions;
export const useSelectedNode = ():
  | { text: null; node: PlanNode }
  | { text: string; node: null } => {
  const planId = useUIStore((s) => s.planId);
  const focucedNodeId = useUIStore((s) => s.focucedNodeId)[planId as number];
  if (!planId) return { text: "  Loading...", node: null } as const;
  if (!focucedNodeId)
    return { text: " Select a node from the tree to view details", node: null } as const;
  const node = getNodeById(focucedNodeId);
  if (!node) return { text: " Node not found", node: null } as const;

  return { text: null, node } as const;
};
export const useIsFocused = (nodeId: number): boolean => {
  const planId = useUIStore((s) => s.planId);
  const focucedNodeId = useUIStore((s) => s.focucedNodeId);
  return planId !== null && focucedNodeId[planId] === nodeId;
};
export const setPlanId = (planId: number | null) => {
  useUIStore.setState({ planId });
  const expandedObj = useUIStore.getState().allExpanded;
  if (!expandedObj[planId as number]) {
    useUIStore.setState({ allExpanded: { ...expandedObj, [planId as number]: false } });
  }
};
export const toggleExpandNode = (nodeId: number) => {
  const planId = useUIStore.getState().planId;
  if (!planId) return;
  const expandedNodes = useUIStore.getState().expandedNodes[planId] || [];
  const isExpanded = expandedNodes.includes(nodeId);
  const nextExpanded = isExpanded
    ? expandedNodes.filter((id) => id !== nodeId)
    : [...expandedNodes, nodeId];
  console.log("toggleExpandNode called with:", {
    nodeId,
    planId,
    isExpanded,
    nextExpanded,
  });
  useUIStore.setState((state) => ({
    expandedNodes: { ...state.expandedNodes, [planId]: nextExpanded },
  }));
};
/* ----------------------------------
 * Store
 * ---------------------------------- */
const getCascadingNodes = (plan: Plan, nodeId: number): number[] => {
  const node = plan.parts.find((n) => n.id === nodeId);
  if (!node) return [];
  const childNodes = node.childNodes;
  if (!childNodes || childNodes.length === 0) {
    return [nodeId];
  }
  let cascadingNodes: number[] = [nodeId];
  if ((node.type === "stage" || node.type === "job") && childNodes) {
    for (const node of childNodes) {
      cascadingNodes = cascadingNodes.concat(getCascadingNodes(plan, node.id));
    }
  }
  return cascadingNodes;
};
export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      planId: null,
      allExpanded: {},
      expandedNodes: {},
      focucedNodeId: {},

      selectedNodes: [],
      clearSelection: () =>
        set((state) => {
          const planId = state.planId;
          if (!planId) return state;
          return {
            focucedNodeId: { ...state.focucedNodeId, [planId]: null },
            selectedNodes: { ...state.selectedNodes, [planId]: [] },
          };
        }),
      selectNode: ({ id, mode }) =>
        set((state) => {
          const planId = state.planId;
          console.log("selectNode called with:", { id, mode, planId });
          if (!planId) return state;
          switch (mode) {
            case "focus": {
              console.log("selecting node:", { mode, id, planId });
              return {
                focucedNodeId: { ...state.focucedNodeId, [planId]: id },
              };
            }

            case "toggle:cascade": {
              const plan = usePlanDataStore.getState().plan;
              if (!plan) return state;
              const cascadingNodes = getCascadingNodes(plan, id);
              const selectedNodes = state.selectedNodes[planId] || [];
              let nextSelectedNodes = [...selectedNodes];
              let isAnyNodeSelected = false;
              for (const nodeId of cascadingNodes) {
                if (selectedNodes.includes(nodeId)) {
                  isAnyNodeSelected = true;
                  break;
                }
              }
              if (isAnyNodeSelected) {
                nextSelectedNodes = nextSelectedNodes.filter(
                  (n) => !cascadingNodes.includes(n),
                );
              } else {
                nextSelectedNodes = [...nextSelectedNodes, ...cascadingNodes];
              }
              return {
                selectedNodes: {
                  ...state.selectedNodes,
                  [planId]: nextSelectedNodes,
                },
              };
            }
            case "toggle:isolated": {
              const selectedNodes = state.selectedNodes[planId] || [];

              const isSelected = selectedNodes.includes(id);
              return {
                selectedNodes: {
                  ...state.selectedNodes,
                  [planId]: isSelected
                    ? selectedNodes.filter((n) => n !== id)
                    : [...selectedNodes, id],
                },
              };
            }
          }
        }),

      toggleAllExpanded: () =>
        set((state) => {
          const planId = state.planId;
          if (!planId) return state;
          const current = state.allExpanded[planId] || false;
          return { allExpanded: { ...state.allExpanded, [planId]: !current } };
        }),
    }),
    {
      name: "plan-ui-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
