import { useUIStore } from "@/stores/plan";

export const handlePointerDown = (event: React.PointerEvent, nodeId: number) => {
  const planId = useUIStore.getState().planId;
  const selectNode = useUIStore.getState().selectNode;
  console.log("handlePointerDown called with:", { nodeId, planId });
  if (!planId) return;

  if (event.shiftKey) {
    event.preventDefault();
    selectNode({ id: nodeId, mode: "toggle:isolated" });
    return;
  }
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    selectNode({ id: nodeId, mode: "toggle:cascade" });
    return;
  }
  selectNode({ id: nodeId, mode: "focus" });
};
