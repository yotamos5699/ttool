"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlanNode } from "@/stores/plan";

/* ----------------------------------
 * Types
 * ---------------------------------- */

type ReplanScopeSelectorProps = {
  parts: PlanNode[];
  onComputeBlastRadius: (type: "stage" | "job", ids: number[]) => Promise<void>;
  onClear: () => void;
  isActive: boolean;
};

/* ----------------------------------
 * Helpers
 * ---------------------------------- */

function flattenNodes(nodes: PlanNode[]): PlanNode[] {
  const result: PlanNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.childNodes) {
      result.push(...flattenNodes(node.childNodes));
    }
  }
  return result;
}

/* ----------------------------------
 * Component
 * ---------------------------------- */

export function ReplanScopeSelector({
  parts,
  onComputeBlastRadius,
  onClear,
  isActive,
}: ReplanScopeSelectorProps) {
  const [isPending, startTransition] = useTransition();
  const [scopeType, setScopeType] = useState<"stage" | "job">("stage");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const allNodes = flattenNodes(parts);
  const allStages = allNodes.filter((node) => node.type === "stage");
  const allJobs = allNodes.filter((node) => node.type === "job");

  const handleScopeTypeChange = (value: "stage" | "job") => {
    setScopeType(value);
    setSelectedIds([]);
  };

  const handleSelectNode = (id: string) => {
    const numId = parseInt(id, 10);
    setSelectedIds((prev) =>
      prev.includes(numId) ? prev.filter((i) => i !== numId) : [...prev, numId]
    );
  };

  const handleCompute = () => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      await onComputeBlastRadius(scopeType, selectedIds);
    });
  };

  const handleClear = () => {
    setSelectedIds([]);
    onClear();
  };

  const items = scopeType === "stage" ? allStages : allJobs;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Replan Scope</h3>
        {isActive && (
          <Badge variant="destructive" className="text-xs">
            Active
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Scope Type
          </label>
          <Select value={scopeType} onValueChange={handleScopeTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stage">Stages</SelectItem>
              <SelectItem value="job">Jobs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Select {scopeType === "stage" ? "Stages" : "Jobs"} to Replan
          </label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {items.map((item) => (
              <Badge
                key={item.id}
                variant={selectedIds.includes(item.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleSelectNode(item.id.toString())}
              >
                {item.title}
              </Badge>
            ))}
          </div>
          {selectedIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={handleCompute}
            disabled={isPending || selectedIds.length === 0}
            size="sm"
          >
            {isPending ? "Computing..." : "Compute Blast Radius"}
          </Button>
          {isActive && (
            <Button onClick={handleClear} variant="outline" size="sm">
              Clear
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The blast radius shows all upstream and downstream nodes that would be
        affected by replanning the selected scope.
      </p>
    </div>
  );
}
