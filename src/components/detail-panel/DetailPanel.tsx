"use client";

import { PlanDetailForm } from "./PlanDetailForm";
import { NodeDetailForm } from "./NodeDetailForm";
import { ContextNodeList } from "./ContextNodeList";
import { ConnectedEdgesPanel } from "./ConnectedEdgesPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSelectedNode } from "@/stores/plan/uiStore";

export function DetailPanel() {
  const { text, node } = useSelectedNode();

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
            contextNodes={node.contextNodes ?? []}
            targetId={node.id}
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
            contextNodes={node.contextNodes || []}
            targetId={node.id}
            targetType={node.type}
          />
        </div>
      </ScrollArea>
    );
  }

  return null;
}
