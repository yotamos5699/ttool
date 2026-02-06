"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanDataStore } from "@/stores/plan";
import { usePlanMutations } from "@/hooks/usePlanMutations";

export function PlanDetailForm() {
  const plan = usePlanDataStore((s) => s.plan);
  const [name, setName] = useState(plan?.name ?? "");
  const [goal, setGoal] = useState(plan?.goal ?? "");

  const { updatePlan } = usePlanMutations();

  if (!plan) return null;

  const hasChanges = name !== plan.name || goal !== plan.goal;

  const handleSave = () => {
    updatePlan.mutate({ name, goal });
  };

  const handleReset = () => {
    setName(plan.name);
    setGoal(plan.goal);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Plan Details</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">v{plan.version}</Badge>
          {plan.parentVersion && (
            <Badge variant="secondary">forked from v{plan.parentVersion}</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="plan-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="plan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Plan name"
            disabled={updatePlan.isPending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="plan-goal" className="text-sm font-medium">
            Goal
          </label>
          <Textarea
            id="plan-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe the plan's goal..."
            rows={4}
            disabled={updatePlan.isPending}
          />
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={updatePlan.isPending} size="sm">
              {updatePlan.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              disabled={updatePlan.isPending}
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2">Plan ID: {plan.id}</div>
    </div>
  );
}
