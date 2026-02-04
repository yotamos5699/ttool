"use client";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/plan";

export const NodeStyleMarker = ({
  nodeId,
  planId,
  type,
}: {
  planId: number;
  nodeId: number;
  type: "stage" | "job";
}) => {
  const blastRadiusByPlan = useUIStore((s) => s.blastRadiusByPlan);
  const selectedNodesByPlan = useUIStore((s) => s.selectedNodesByPlan);
  const selection = useUIStore((s) => s.selection);

  const selectedNodes = selectedNodesByPlan[planId] || [];
  const blastRadius = blastRadiusByPlan[planId] || [];
  const nodeKey = `${type}:${nodeId}` as const;
  const isSelected = selectedNodes.includes(nodeKey);
  const isAffected = blastRadius.includes(nodeKey);
  const isFocused = selection?.type === type && selection?.id === nodeId;
  return (
    <div
      className={cn(
        " absolute bottom-0 w-full ",
        // "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group transition-colors",
        isFocused && "h-2 bg-blue-500",
        isAffected && !isFocused && "h-2 bg-orange-500 animate-pulse",
        isSelected && !isFocused && "h-2 bg-slate-400",
      )}
    ></div>
  );
};
