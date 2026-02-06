"use client";

import { useUIStore } from "@/stores/planStore";

export const useIsOpen = (nodeId: number) => {
  const planId = useUIStore((s) => s.planId);

  const allExpanded = useUIStore((s) => s.allExpanded);
  const expandedNodes = useUIStore((s) => s.expandedNodes)[planId || 0] || [];
  const included = expandedNodes.includes(nodeId);

  return included || !!allExpanded[planId || 0];
};
