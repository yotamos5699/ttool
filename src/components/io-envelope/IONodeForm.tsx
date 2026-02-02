"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type IONodeType =
  | "data"
  | "generator"
  | "artifact"
  | "model"
  | "dataset"
  | "url";

export type IONode = {
  id?: number;
  type: IONodeType;
  data: string;
};

type IONodeFormProps = {
  label: string;
  node: IONode;
  onChange: (node: IONode) => void;
  disabled?: boolean;
};

const nodeTypes: { value: IONodeType; label: string; description: string }[] = [
  { value: "data", label: "Data", description: "Raw data or structured input" },
  {
    value: "generator",
    label: "Generator",
    description: "Code or function that produces data",
  },
  { value: "artifact", label: "Artifact", description: "File or binary output" },
  { value: "model", label: "Model", description: "ML model reference" },
  { value: "dataset", label: "Dataset", description: "Reference to a dataset" },
  { value: "url", label: "URL", description: "External resource URL" },
];

export function IONodeForm({ label, node, onChange, disabled }: IONodeFormProps) {
  const handleTypeChange = (type: IONodeType) => {
    onChange({ ...node, type });
  };

  const handleDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...node, data: e.target.value });
  };

  const selectedType = nodeTypes.find((t) => t.value === node.type);

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold">{label}</label>
        {node.id && (
          <Badge variant="outline" className="text-xs">
            ID: {node.id}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <Select
          value={node.type}
          onValueChange={handleTypeChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {nodeTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex flex-col">
                  <span>{type.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedType && (
          <p className="text-xs text-muted-foreground">
            {selectedType.description}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {node.type === "url"
            ? "URL"
            : node.type === "generator"
              ? "Generator Code"
              : "Data"}
        </label>
        <Textarea
          value={node.data}
          onChange={handleDataChange}
          placeholder={
            node.type === "url"
              ? "https://example.com/resource"
              : node.type === "generator"
                ? "// Generator function or reference"
                : "Enter data or JSON..."
          }
          rows={4}
          disabled={disabled}
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}
