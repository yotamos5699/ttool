"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* ----------------------------------
 * Types
 * ---------------------------------- */

type ReplanSession = {
  id: number;
  planId: number;
  scopeType: "stage" | "job";
  scopeIds: number[];
  upstreamIds: number[];
  downstreamIds: number[];
  status: "pending" | "in_progress" | "committed" | "aborted";
  proposedChanges: string | null;
  createdBy: "agent" | "human";
  createdAt: Date;
};

type ReplanPanelProps = {
  session: ReplanSession | null;
  blastRadius: number[];
  onCommit: () => Promise<void>;
  onAbort: () => Promise<void>;
  onUpdateProposal: (changes: string) => Promise<void>;
};

/* ----------------------------------
 * Component
 * ---------------------------------- */

export function ReplanPanel({
  session,
  blastRadius,
  onCommit,
  onAbort,
  onUpdateProposal,
}: ReplanPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [proposedChanges, setProposedChanges] = useState(
    session?.proposedChanges || ""
  );
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCommit = () => {
    startTransition(async () => {
      await onCommit();
    });
  };

  const handleAbort = () => {
    if (!confirm("Are you sure you want to abort this replan session?")) return;
    startTransition(async () => {
      await onAbort();
    });
  };

  const handleSaveProposal = () => {
    startTransition(async () => {
      await onUpdateProposal(proposedChanges);
    });
  };

  if (!session) {
    return (
      <div className="p-4 border rounded-lg bg-muted/30">
        <p className="text-sm text-muted-foreground text-center">
          No active replan session. Select nodes from the tree and use &quot;Replan
          from here&quot; to start.
        </p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    in_progress: "bg-blue-500",
    committed: "bg-green-500",
    aborted: "bg-red-500",
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 bg-card cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold">Replan Session</h3>
              <Badge
                className={`${statusColors[session.status]} text-white text-xs`}
              >
                {session.status.replace("_", " ")}
              </Badge>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
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
          <div className="p-4 pt-0 space-y-4">
            <Separator />

            {/* Scope Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Scope:</span>
                <Badge variant="outline">{session.scopeType}</Badge>
                <span className="text-muted-foreground">
                  ({session.scopeIds.length} selected)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted/30 rounded">
                  <span className="text-muted-foreground">Upstream:</span>{" "}
                  <span className="font-medium">
                    {session.upstreamIds.length} nodes
                  </span>
                </div>
                <div className="p-2 bg-muted/30 rounded">
                  <span className="text-muted-foreground">Downstream:</span>{" "}
                  <span className="font-medium">
                    {session.downstreamIds.length} nodes
                  </span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Total blast radius: {blastRadius.length} affected nodes
              </div>
            </div>

            <Separator />

            {/* Proposed Changes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Proposed Changes</label>
              <Textarea
                value={proposedChanges}
                onChange={(e) => setProposedChanges(e.target.value)}
                placeholder="Describe the changes to be made during this replan..."
                rows={4}
                disabled={
                  isPending ||
                  session.status === "committed" ||
                  session.status === "aborted"
                }
              />
              {session.status === "pending" ||
              session.status === "in_progress" ? (
                <Button
                  onClick={handleSaveProposal}
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                >
                  Save Proposal
                </Button>
              ) : null}
            </div>

            <Separator />

            {/* Actions */}
            {(session.status === "pending" ||
              session.status === "in_progress") && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCommit}
                  disabled={isPending}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isPending ? "Processing..." : "Commit Replan"}
                </Button>
                <Button
                  onClick={handleAbort}
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                >
                  Abort
                </Button>
              </div>
            )}

            {session.status === "committed" && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-700 dark:text-green-400">
                This replan session has been committed successfully.
              </div>
            )}

            {session.status === "aborted" && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-700 dark:text-red-400">
                This replan session was aborted.
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-muted-foreground pt-2">
              Created by {session.createdBy} on{" "}
              {new Date(session.createdAt).toLocaleString()}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
