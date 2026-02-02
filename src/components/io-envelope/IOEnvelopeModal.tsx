"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { IONodeForm, type IONode } from "./IONodeForm";
import { ContextSelector } from "./ContextSelector";

type ContextNode = {
  id: number;
  level: string;
  type: string;
  title: string;
  payload: string;
};

type IOEnvelope = {
  id?: number;
  stageId: number;
  jobId?: number | null;
  inputNode: IONode;
  outputNode: IONode;
  inheritedContextIds: number[];
  includedContextIds: number[];
  excludedContextIds: number[];
};

type IOEnvelopeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: number;
  stageTitle: string;
  jobId?: number | null;
  availableContext: ContextNode[];
  existingEnvelope?: IOEnvelope | null;
  onSave: (envelope: Omit<IOEnvelope, "id">) => Promise<void>;
  onDelete?: (envelopeId: number) => Promise<void>;
};

export function IOEnvelopeModal({
  open,
  onOpenChange,
  stageId,
  stageTitle,
  jobId,
  availableContext,
  existingEnvelope,
  onSave,
  onDelete,
}: IOEnvelopeModalProps) {
  const [isPending, startTransition] = useTransition();

  // Form state
  const [inputNode, setInputNode] = useState<IONode>(
    existingEnvelope?.inputNode || { type: "data", data: "" },
  );
  const [outputNode, setOutputNode] = useState<IONode>(
    existingEnvelope?.outputNode || { type: "artifact", data: "" },
  );
  const [inheritedContextIds, setInheritedContextIds] = useState<number[]>(
    existingEnvelope?.inheritedContextIds ||
      availableContext.map((c) => c.id),
  );
  const [includedContextIds, setIncludedContextIds] = useState<number[]>(
    existingEnvelope?.includedContextIds || [],
  );
  const [excludedContextIds, setExcludedContextIds] = useState<number[]>(
    existingEnvelope?.excludedContextIds || [],
  );

  const handleContextChange = (
    inherited: number[],
    included: number[],
    excluded: number[],
  ) => {
    setInheritedContextIds(inherited);
    setIncludedContextIds(included);
    setExcludedContextIds(excluded);
  };

  const handleSave = () => {
    startTransition(async () => {
      await onSave({
        stageId,
        jobId: jobId || null,
        inputNode,
        outputNode,
        inheritedContextIds,
        includedContextIds,
        excludedContextIds,
      });
      onOpenChange(false);
    });
  };

  const handleDelete = () => {
    if (!existingEnvelope?.id || !onDelete) return;
    if (!confirm("Are you sure you want to delete this IO envelope?")) return;
    startTransition(async () => {
      await onDelete(existingEnvelope.id!);
      onOpenChange(false);
    });
  };

  const isValid = inputNode.data.trim() !== "" || outputNode.data.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {existingEnvelope ? "Edit" : "Configure"} IO Envelope
          </DialogTitle>
          <DialogDescription>
            Configure the input/output nodes and context for stage:{" "}
            <Badge variant="outline">{stageTitle}</Badge>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Input Node */}
            <IONodeForm
              label="Input Node"
              node={inputNode}
              onChange={setInputNode}
              disabled={isPending}
            />

            <Separator />

            {/* Output Node */}
            <IONodeForm
              label="Output Node"
              node={outputNode}
              onChange={setOutputNode}
              disabled={isPending}
            />

            <Separator />

            {/* Context Selection */}
            <ContextSelector
              inheritedContextIds={inheritedContextIds}
              includedContextIds={includedContextIds}
              excludedContextIds={excludedContextIds}
              availableContext={availableContext}
              onChange={handleContextChange}
              disabled={isPending}
            />

            {/* Summary */}
            <div className="p-3 bg-muted/30 rounded-lg space-y-2">
              <h4 className="text-sm font-semibold">Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Input Type:</span>{" "}
                  <Badge variant="outline">{inputNode.type}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Output Type:</span>{" "}
                  <Badge variant="outline">{outputNode.type}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Context Nodes:</span>{" "}
                  <span className="font-medium">
                    {inheritedContextIds.length +
                      includedContextIds.length -
                      excludedContextIds.length}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Excluded:</span>{" "}
                  <span className="font-medium">{excludedContextIds.length}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {existingEnvelope && onDelete && (
            <Button
              onClick={handleDelete}
              variant="destructive"
              disabled={isPending}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !isValid}>
            {isPending ? "Saving..." : existingEnvelope ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
