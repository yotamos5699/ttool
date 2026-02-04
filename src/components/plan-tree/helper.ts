import { cn } from "@/lib/utils";
import { usePlanDataStore, useUIStore } from "@/stores/plan";

const Style_ = {
  focused: "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
  affected: "ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
  selected: "ring-2 ring-b ring-primary bg-primary/10",
};

export const useNodeStyle = (planId: number, nodeId: number, type: "stage" | "job") => {
  const blastRadiusByPlan = useUIStore((s) => s.blastRadiusByPlan);
  const selectedNodesByPlan = useUIStore((s) => s.selectedNodesByPlan);
  const selection = useUIStore((s) => s.selection);

  const selectedNodes = selectedNodesByPlan[planId] || [];
  const blastRadius = blastRadiusByPlan[planId] || [];
  const nodeKey = `${type}:${nodeId}` as const;
  const isSelected = selectedNodes.includes(nodeKey);
  const isAffected = blastRadius.includes(nodeKey);
  const isFocused = selection?.type === type && selection?.id === nodeId;

  return cn(
    "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group transition-colors",
    isFocused && Style_.focused,
    isAffected && !isFocused && Style_.focused,
    isSelected && !isFocused && Style_.selected,
  );
};
const NodeStyleMarker = (planId: number, nodeId: number, type: "stage" | "job") => {
  return;
};
export const handlePointerDown = (
  event: React.PointerEvent,
  planId: number,
  nodeId: number,
  type: "stage" | "job",
) => {
  const plan = usePlanDataStore.getState().plan;
  const selectNode = useUIStore.getState().selectNode;

  if (!plan || plan.id !== planId) return;

  if (event.shiftKey) {
    event.preventDefault();
    selectNode({
      plan,
      type,
      id: nodeId,
      mode: "add",
      setPrimary: false,
    });
    return;
  }
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    selectNode({
      plan,
      type,
      id: nodeId,
      mode: "toggle",
      setPrimary: false,
    });
    return;
  }
  selectNode({ plan, type, id: nodeId, mode: "focus" });
};
