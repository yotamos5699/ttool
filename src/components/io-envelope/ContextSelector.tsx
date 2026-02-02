"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ContextNode = {
  id: number;
  level: string;
  type: string;
  title: string;
  payload: string;
};

type ContextSelectorProps = {
  inheritedContextIds: number[];
  includedContextIds: number[];
  excludedContextIds: number[];
  availableContext: ContextNode[];
  onChange: (
    inheritedIds: number[],
    includedIds: number[],
    excludedIds: number[],
  ) => void;
  disabled?: boolean;
};

const contextTypeColors: Record<string, string> = {
  requirement: "bg-blue-500",
  constraint: "bg-red-500",
  decision: "bg-green-500",
  code: "bg-purple-500",
  note: "bg-gray-500",
};

export function ContextSelector({
  inheritedContextIds,
  includedContextIds,
  excludedContextIds,
  availableContext,
  onChange,
  disabled,
}: ContextSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Group context by level
  const groupedContext = availableContext.reduce(
    (acc, node) => {
      const level = node.level;
      if (!acc[level]) acc[level] = [];
      acc[level].push(node);
      return acc;
    },
    {} as Record<string, ContextNode[]>,
  );

  const getNodeStatus = (
    id: number,
  ): "inherited" | "included" | "excluded" | "available" => {
    if (excludedContextIds.includes(id)) return "excluded";
    if (includedContextIds.includes(id)) return "included";
    if (inheritedContextIds.includes(id)) return "inherited";
    return "available";
  };

  const handleToggleNode = (nodeId: number) => {
    const status = getNodeStatus(nodeId);
    const newInherited = [...inheritedContextIds];
    let newIncluded = [...includedContextIds];
    let newExcluded = [...excludedContextIds];

    if (status === "inherited") {
      newExcluded = [...newExcluded, nodeId];
    } else if (status === "excluded") {
      newExcluded = newExcluded.filter((id) => id !== nodeId);
    } else if (status === "available") {
      newIncluded = [...newIncluded, nodeId];
    } else if (status === "included") {
      newIncluded = newIncluded.filter((id) => id !== nodeId);
    }

    onChange(newInherited, newIncluded, newExcluded);
  };

  const handleIncludeAll = () => {
    const allIds = availableContext.map((c) => c.id);
    const newIncluded = [...new Set([...includedContextIds, ...allIds])];
    onChange(inheritedContextIds, newIncluded, []);
  };

  const handleExcludeAll = () => {
    const inheritedIds = inheritedContextIds;
    const newExcluded = [...inheritedIds];
    onChange(inheritedContextIds, [], newExcluded);
  };

  const activeCount =
    inheritedContextIds.length +
    includedContextIds.length -
    excludedContextIds.length;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">Context Selection</h4>
              <Badge variant="secondary" className="text-xs">
                {activeCount} active
              </Badge>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-3 space-y-4">
            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleIncludeAll}
                variant="outline"
                size="sm"
                disabled={disabled}
              >
                Include All
              </Button>
              <Button
                onClick={handleExcludeAll}
                variant="outline"
                size="sm"
                disabled={disabled}
              >
                Exclude All
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                Inherited
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                Included
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                Excluded
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                Available
              </span>
            </div>

            {/* Context groups */}
            <ScrollArea className="max-h-64">
              <div className="space-y-4">
                {Object.entries(groupedContext).map(([level, nodes]) => (
                  <div key={level} className="space-y-2">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {level}
                    </h5>
                    <div className="space-y-1">
                      {nodes.map((node) => {
                        const status = getNodeStatus(node.id);
                        const statusColor =
                          status === "inherited"
                            ? "ring-green-500 bg-green-500/10"
                            : status === "included"
                              ? "ring-blue-500 bg-blue-500/10"
                              : status === "excluded"
                                ? "ring-red-500 bg-red-500/10 opacity-50"
                                : "";

                        return (
                          <div
                            key={node.id}
                            onClick={() => !disabled && handleToggleNode(node.id)}
                            className={`
                              flex items-center gap-2 p-2 rounded cursor-pointer
                              border hover:bg-muted/50 transition-colors
                              ${statusColor ? `ring-2 ${statusColor}` : ""}
                              ${disabled ? "cursor-not-allowed opacity-50" : ""}
                            `}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${
                                contextTypeColors[node.type] || "bg-gray-500"
                              }`}
                            />
                            <span className="text-sm flex-1">{node.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {node.type}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {Object.keys(groupedContext).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No context nodes available
                  </p>
                )}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              Click on a context node to toggle its inclusion. Green = inherited
              from parent, Blue = explicitly included, Red = excluded.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
