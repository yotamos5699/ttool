"use client";

import { PlanDetailForm } from "./PlanDetailForm";
import { NodeDetailForm } from "./NodeDetailForm";
import { ContextNodeList } from "./ContextNodeList";
import { ConnectedEdgesPanel } from "./ConnectedEdgesPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSelectedNode } from "@/stores/plan/uiStore";
import { usePlanDataStore } from "@/stores/plan";
import { useQuery } from "@tanstack/react-query";
import { getContextSubtree } from "@/actions/context-actions";

export function DetailPanel() {
  const { text, node } = useSelectedNode();
  const plan = usePlanDataStore((s) => s.plan);

  const contextTargetId =
    node?.type === "plan" ? (plan?.rootNodeId ?? null) : (node?.id ?? null);
  const contextLastUpdatedAt =
    node?.type === "plan" ? plan?.rootNodeLastUpdatedAt : node?.lastUpdatedAt;

  const contextQuery = useQuery({
    queryKey: ["contextNodes", contextTargetId],
    queryFn: () =>
      contextTargetId
        ? getContextSubtree(contextTargetId, contextLastUpdatedAt ?? new Date(0))
        : Promise.resolve([]),
    enabled: Boolean(contextTargetId),
  });

  const contextNodes = (contextQuery.data ?? []).map((ctx) => ({
    id: ctx.id,
    level: "context",
    type: ctx.contextType,
    title: ctx.title,
    payload: ctx.payload,
    parentId: ctx.parentId ?? null,
  }));

  if (text || !node) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        {text}
      </div>
    );
  }

  // Render plan detail
  if (node?.type === "plan") {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <PlanDetailForm />
          <Separator />
          <ContextNodeList
            contextNodes={contextNodes}
            targetId={contextTargetId ?? node.id}
            targetType="plan"
          />
        </div>
      </ScrollArea>
    );
  }

  // Render stage detail

  if (node.type === "stage" || node.type === "job") {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          <NodeDetailForm node={node} />
          <Separator />
          <ConnectedEdgesPanel nodeId={node.id} />
          <Separator />
          <ContextNodeList
            contextNodes={contextNodes}
            targetId={node.id}
            targetType={node.type}
          />
          {contextQuery.isLoading && (
            <div className="text-xs text-muted-foreground">Loading context…</div>
          )}
        </div>
      </ScrollArea>
    );
  }

  return null;
}
