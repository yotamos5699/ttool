"use client";

import { useEffect } from "react";
import { PlanTree } from "@/components/plan-tree/PlanTree";
import { DetailPanel } from "@/components/detail-panel";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePlanStore, type Plan } from "@/stores/planStore";
import { handleWsMessage } from "@/lib/wsHandler";

type PlanClientProps = {
  initialPlan: Plan;
};

export function PlanClient({ initialPlan }: PlanClientProps) {
  const setPlan = usePlanStore((s) => s.setPlan);
  const planId = usePlanStore((s) => s.plan?.id);

  // Sync initial plan to store on mount
  useEffect(() => {
    setPlan(initialPlan);
  }, [initialPlan, setPlan]);

  // WebSocket connection - store updates handled internally
  useWebSocket({
    userId: "user-123", // TODO: Replace with actual user ID
    planId: planId ?? initialPlan.id,
    onMessage: handleWsMessage,
  });

  return (
    <div className="h-screen flex">
      {/* Tree Panel */}
      <div className="w-96 border-r bg-card flex flex-col">
        <PlanTree />
      </div>

      {/* Detail Panel */}
      <div className="flex-1 bg-background">
        <DetailPanel />
      </div>
    </div>
  );
}
