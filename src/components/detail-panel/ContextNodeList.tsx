"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { type ContextNode } from "@/stores/plan";
import { usePlanMutations } from "@/hooks/usePlanMutations";
import type { ContextType } from "@/dbs/drizzle/schema";

type ContextNodeListProps = {
  contextNodes: ContextNode[];
  targetId: number;
  targetType: "plan" | "stage" | "job";
};

const contextTypes = [
  { value: "rule", label: "Rule", color: "bg-blue-500" },
  { value: "skill", label: "Skill", color: "bg-emerald-500" },
  { value: "input", label: "Input", color: "bg-amber-500" },
  { value: "output", label: "Output", color: "bg-purple-500" },
];

function ContextNodeItem({ node }: { node: ContextNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [type, setType] = useState(node.type);
  const [payload, setPayload] = useState(node.payload);

  const { updateContext, deleteContext } = usePlanMutations();

  const typeConfig = contextTypes.find((t) => t.value === node.type) || contextTypes[0];

  const handleSave = () => {
    updateContext.mutate({
      id: node.id,
      data: { title, type: type as ContextType, payload },
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(node.title);
    setType(node.type);
    setPayload(node.payload);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!confirm("Delete this context node?")) return;
    deleteContext.mutate(node.id);
  };

  const isPending = updateContext.isPending || deleteContext.isPending;

  if (isEditing) {
    return (
      <div className="border rounded-md p-3 space-y-3 bg-muted/30">
        <div className="space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Select value={type} onValueChange={setType} disabled={isPending}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contextTypes.map((ct) => (
                <SelectItem key={ct.value} value={ct.value}>
                  {ct.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="Content..."
            rows={4}
            disabled={isPending}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? "Saving..." : "Save"}
          </Button>
          <Button onClick={handleCancel} variant="outline" size="sm" disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-md overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${typeConfig.color}`} />
              <span className="font-medium text-sm">{node.title}</span>
              <Badge variant="outline" className="text-xs">
                {typeConfig.label}
              </Badge>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
          <div className="px-3 pb-3 pt-0 border-t">
            <div className="text-sm text-muted-foreground whitespace-pre-wrap py-2">
              {node.payload || <em>No content</em>}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                Edit
              </Button>
              <Button
                onClick={handleDelete}
                variant="destructive"
                size="sm"
                disabled={isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ContextNodeList({
  contextNodes,
  targetId,
  targetType,
}: ContextNodeListProps) {
  const { createContext } = usePlanMutations();

  const handleAdd = () => {
    createContext.mutate({
      targetType,
      targetId,
      title: "New Context",
      type: "rule",
      payload: "",
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Context Nodes</h3>
        <Button
          onClick={handleAdd}
          variant="outline"
          size="sm"
          disabled={createContext.isPending}
        >
          {createContext.isPending ? "Adding..." : "+ Add Context"}
        </Button>
      </div>

      {contextNodes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No context nodes attached
        </p>
      ) : (
        <div className="space-y-2">
          {contextNodes.map((node) => (
            <ContextNodeItem key={node.id} node={node} />
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Context nodes define rules, skills, inputs, and outputs that guide planning.
      </div>
    </div>
  );
}
