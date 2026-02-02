"use client";

import { Badge } from "@/components/ui/badge";

/* ----------------------------------
 * Types
 * ---------------------------------- */

type BlastRadiusIndicatorProps = {
  nodeId: number;
  nodeType: "stage" | "job";
  blastRadius: number[];
  isOrigin?: boolean;
};

/* ----------------------------------
 * Component
 * ---------------------------------- */

export function BlastRadiusIndicator({
  nodeId,
  nodeType,
  blastRadius,
  isOrigin = false,
}: BlastRadiusIndicatorProps) {
  const isAffected = blastRadius.includes(nodeId);

  if (!isAffected && !isOrigin) {
    return null;
  }

  return (
    <Badge
      variant={isOrigin ? "destructive" : "default"}
      className={`text-xs ${
        isOrigin
          ? "bg-orange-500 hover:bg-orange-600"
          : "bg-yellow-500/80 hover:bg-yellow-500 text-yellow-950"
      }`}
    >
      {isOrigin ? "Origin" : "Affected"}
    </Badge>
  );
}

/* ----------------------------------
 * Helper: Check if node is in blast radius
 * ---------------------------------- */

export function isInBlastRadius(nodeId: number, blastRadius: number[]): boolean {
  return blastRadius.includes(nodeId);
}

/* ----------------------------------
 * Helper: Get blast radius CSS classes
 * ---------------------------------- */

export function getBlastRadiusClasses(
  nodeId: number,
  blastRadius: number[],
  originIds: number[] = []
): string {
  if (originIds.includes(nodeId)) {
    return "ring-2 ring-orange-500 bg-orange-500/10";
  }
  if (blastRadius.includes(nodeId)) {
    return "ring-2 ring-yellow-500 bg-yellow-500/10";
  }
  return "";
}
