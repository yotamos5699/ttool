"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Selection, NodeKey, NodeType, Plan } from "./types";
import {
  getSelectionKeys,
  computeBlastRadiusForSelection,
  parseNodeKey,
} from "./blastRadius";

/* ----------------------------------
 * State Types
 * ---------------------------------- */

type UIState = {
  selection: Selection;
  selectedNodesByPlan: Record<number, NodeKey[]>;
  blastRadiusByPlan: Record<number, NodeKey[]>;
  allExpanded: boolean;
  openStagesByPlan: Record<number, Record<number, boolean>>;
  openJobsByPlan: Record<number, Record<number, boolean>>;
};

type UIActions = {
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  selectNode: (params: {
    plan: Plan;
    type: NodeType;
    id: number;
    mode: "replace" | "toggle" | "add" | "focus";
    setPrimary?: boolean;
  }) => void;
  clearSelections: (planId: number) => void;
  clearBlastRadius: (planId: number) => void;
  toggleAllExpanded: () => void;
  setStageOpen: (planId: number, stageId: number, isOpen: boolean) => void;
  setJobOpen: (planId: number, jobId: number, isOpen: boolean) => void;
};

type UIStore = UIState & UIActions;

/* ----------------------------------
 * Store
 * ---------------------------------- */

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial state
      selection: null,
      selectedNodesByPlan: {},
      blastRadiusByPlan: {},
      allExpanded: false,
      openStagesByPlan: {},
      openJobsByPlan: {},

      // Selection actions
      setSelection: (selection) => set({ selection }),
      clearSelection: () => set({ selection: null }),

      selectNode: ({ plan, type, id, mode, setPrimary = true }) =>
        set((state) => {
          const planId = plan.id;
          const selectionKeys = getSelectionKeys(plan, type, id);
          const current = state.selectedNodesByPlan[planId] || [];
          const selectionKeySet = new Set(selectionKeys);
          let next: NodeKey[] = [];

          if (mode === "focus") return { selection: { id, type } };
          if (mode === "replace") {
            next = selectionKeys;
          } else if (mode === "add") {
            next = Array.from(new Set([...current, ...selectionKeys]));
          } else {
            const currentSet = new Set(current);
            const allIncluded = selectionKeys.every((key) => currentSet.has(key));
            if (allIncluded) {
              next = current.filter((key) => !selectionKeySet.has(key));
            } else {
              next = Array.from(new Set([...current, ...selectionKeys]));
            }
          }

          const nextBlastRadius = computeBlastRadiusForSelection(plan, next);

          let nextSelection = state.selection;
          if (next.length === 0) {
            nextSelection = null;
          } else if (setPrimary || mode !== "toggle") {
            nextSelection = { id, type };
          } else if (state.selection?.id === id && state.selection?.type === type) {
            const fallback = next[0];
            nextSelection = fallback ? parseNodeKey(fallback) : null;
          }

          return {
            selection: nextSelection,
            selectedNodesByPlan: {
              ...state.selectedNodesByPlan,
              [planId]: next,
            },
            blastRadiusByPlan: {
              ...state.blastRadiusByPlan,
              [planId]: nextBlastRadius,
            },
          };
        }),

      clearSelections: (planId) =>
        set((state) => {
          const nextSelection =
            state.selection?.type === "stage" || state.selection?.type === "job"
              ? null
              : state.selection;

          return {
            selection: nextSelection,
            selectedNodesByPlan: {
              ...state.selectedNodesByPlan,
              [planId]: [],
            },
            blastRadiusByPlan: {
              ...state.blastRadiusByPlan,
              [planId]: [],
            },
          };
        }),

      clearBlastRadius: (planId) =>
        set((state) => ({
          selection:
            state.selection?.type === "stage" || state.selection?.type === "job"
              ? null
              : state.selection,
          selectedNodesByPlan: {
            ...state.selectedNodesByPlan,
            [planId]: [],
          },
          blastRadiusByPlan: {
            ...state.blastRadiusByPlan,
            [planId]: [],
          },
        })),

      // UI actions
      toggleAllExpanded: () => set((state) => ({ allExpanded: !state.allExpanded })),

      setStageOpen: (planId, stageId, isOpen) =>
        set((state) => ({
          openStagesByPlan: {
            ...state.openStagesByPlan,
            [planId]: {
              ...state.openStagesByPlan[planId],
              [stageId]: isOpen,
            },
          },
        })),

      setJobOpen: (planId, jobId, isOpen) =>
        set((state) => ({
          openJobsByPlan: {
            ...state.openJobsByPlan,
            [planId]: {
              ...state.openJobsByPlan[planId],
              [jobId]: isOpen,
            },
          },
        })),
    }),
    {
      name: "plan-ui-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
