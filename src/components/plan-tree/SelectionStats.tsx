"use client";

import { Button } from "@/components/ui/button";

type SelectionStatsProps = {
  selectedCount: number;
  blastCount: number;
  onClearSelections: () => void;
};

export function SelectionStats({
  selectedCount,
  blastCount,
  onClearSelections,
}: SelectionStatsProps) {
  if (selectedCount === 0 && blastCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-3 rounded-lg border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Selected</span>
          <span className="font-semibold text-foreground">{selectedCount}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Blast</span>
          <span className="font-semibold text-warning">{blastCount}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onClearSelections}>
          Clear
        </Button>
      </div>
    </div>
  );
}
