import { useMemo, useState } from "react";
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
import { usePlanDataStore, type PlanNode } from "@/stores/plan";
import { usePlanMutations } from "@/hooks/usePlanMutations";

type NodeDetailFormProps = {
  node: PlanNode;
};

export function NodeDetailForm({ node }: NodeDetailFormProps) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description || "");
  const [executionMode, setExecutionMode] = useState(node.executionMode ?? "sequential");
  const [includeDependencyIds, setIncludeDependencyIds] = useState<number[]>(
    node.dependencies.includeDependencyIds,
  );
  const [excludeDependencyIds, setExcludeDependencyIds] = useState<number[]>(
    node.dependencies.excludeDependencyIds,
  );
  const [disableDependencyInheritance, setDisableDependencyInheritance] = useState(
    node.dependencies.disableDependencyInheritance,
  );

  const planId = usePlanDataStore((s) => s.plan?.id ?? 0);
  const { updateStage, updateJob } = usePlanMutations();

  const isStage = node.type === "stage";
  const isJob = node.type === "job";

  const hasChanges =
    title !== node.title ||
    description !== (node.description || "") ||
    (isStage && executionMode !== (node.executionMode ?? "sequential")) ||
    JSON.stringify([...includeDependencyIds].sort()) !==
      JSON.stringify([...node.dependencies.includeDependencyIds].sort()) ||
    JSON.stringify([...excludeDependencyIds].sort()) !==
      JSON.stringify([...node.dependencies.excludeDependencyIds].sort()) ||
    disableDependencyInheritance !== node.dependencies.disableDependencyInheritance;

  const handleIncludeToggle = (nodeId: number) => {
    const newDeps = includeDependencyIds.includes(nodeId)
      ? includeDependencyIds.filter((id) => id !== nodeId)
      : [...includeDependencyIds, nodeId];
    setIncludeDependencyIds(newDeps);
  };

  const handleExcludeToggle = (nodeId: number) => {
    const newDeps = excludeDependencyIds.includes(nodeId)
      ? excludeDependencyIds.filter((id) => id !== nodeId)
      : [...excludeDependencyIds, nodeId];
    setExcludeDependencyIds(newDeps);
  };

  const handleSave = () => {
    const update: Partial<PlanNode> = {
      title,
      description: description || null,
      dependencies: {
        includeDependencyIds,
        excludeDependencyIds,
        disableDependencyInheritance,
      },
    };
    if (isStage) {
      update.executionMode = executionMode;
    }
    if (isStage) {
      updateStage.mutate({ id: node.id, data: update });
    }
    if (isJob) {
      updateJob.mutate({ id: node.id, data: update });
    }
  };

  const handleReset = () => {
    setTitle(node.title);
    setDescription(node.description || "");
    setExecutionMode(node.executionMode ?? "sequential");
    setIncludeDependencyIds(node.dependencies.includeDependencyIds);
    setExcludeDependencyIds(node.dependencies.excludeDependencyIds);
    setDisableDependencyInheritance(node.dependencies.disableDependencyInheritance);
  };

  const plan = usePlanDataStore((s) => s.plan);
  const availableDependencies = useMemo(() => {
    if (!plan) return [];
    const collectNodes = (nodes: PlanNode[]): PlanNode[] => {
      const result: PlanNode[] = [];
      for (const n of nodes) {
        result.push(n);
        if (n.childNodes) {
          result.push(...collectNodes(n.childNodes));
        }
      }
      return result;
    };
    return collectNodes(plan.parts).filter(
      (part) => part.id !== node.id && part.type === node.type,
    );
  }, [plan, node.id, node.type]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isStage ? "Stage" : "Job"} Details</h2>
        {isStage && (
          <Badge variant={executionMode === "parallel" ? "default" : "secondary"}>
            {executionMode}
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="node-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="node-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="node-description" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="node-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this node..."
            rows={3}
          />
        </div>

        {isStage && (
          <div className="space-y-2">
            <label htmlFor="execution-mode" className="text-sm font-medium">
              Execution Mode
            </label>
            <Select
              value={executionMode}
              onValueChange={(v) => setExecutionMode(v as "sequential" | "parallel")}
            >
              <SelectTrigger id="execution-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequential</SelectItem>
                <SelectItem value="parallel">Parallel</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {executionMode === "sequential"
                ? "Child nodes run one after another"
                : "Child nodes can run simultaneously"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Dependency Inheritance</label>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={disableDependencyInheritance ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setDisableDependencyInheritance((v) => !v)}
            >
              {disableDependencyInheritance ? "Inheritance Off" : "Inheritance On"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            When off, only explicitly included dependencies apply.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Include Dependencies</label>
          {availableDependencies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableDependencies.map((dep) => (
                <Badge
                  key={dep.id}
                  variant={includeDependencyIds.includes(dep.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleIncludeToggle(dep.id)}
                >
                  {dep.title}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No other nodes available for dependencies
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Exclude Inherited</label>
          {availableDependencies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableDependencies.map((dep) => (
                <Badge
                  key={dep.id}
                  variant={excludeDependencyIds.includes(dep.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleExcludeToggle(dep.id)}
                >
                  {dep.title}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No other nodes available for dependencies
            </p>
          )}
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} size="sm">
              Save Changes
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              Reset
            </Button>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2">Node ID: {node.id}</div>
    </div>
  );
}
