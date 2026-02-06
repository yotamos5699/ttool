/* ----------------------------------
 * Plan Domain Types
 * ---------------------------------- */

export type ContextNode = {
  id: number;
  level: string;
  type: string;
  title: string;
  payload: string;
  parentId?: number | null;
};

export type PlanNodeType = "stage" | "job" | "context" | "data" | "plan";

export type PlanNode = {
  id: number;
  type: PlanNodeType;
  title: string;
  description: string | null;
  executionMode?: "sequential" | "parallel";
  contextNodes?: ContextNode[];
  dataNodeIds: number[];
  dependencies: NodeDependencies;
  childNodes?: PlanNode[];
  lastUpdatedAt?: Date;
};

export type Plan = {
  id: number;
  tenantId?: number;
  name: string;
  goal: string;
  version: number;
  parentVersion: number | null;
  rootNodeId?: number | null;
  rootNodeLastUpdatedAt?: Date;
  parts: PlanNode[];
  contextNodes: ContextNode[];
  dependencies: NodeDependencies;
  dataNodeIds: number[];
  edges: PlanEdge[];
  nodesByType: Record<string, number[]>;
};

/* ----------------------------------
 * UI State Types
 * ---------------------------------- */

export type Selection = {
  id: number;
  type: "plan" | "stage" | "job" | "context";
} | null;

export type NodeType = "stage" | "job";
export type NodeKey = `${NodeType}:${number}`;

export type NodeDependencies = {
  includeDependencyIds: number[];
  excludeDependencyIds: number[];
  disableDependencyInheritance: boolean;
};

export type PlanEdge = {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  kind: "control" | "data";
  role?: "required" | "optional";
};

/* ----------------------------------
 * WebSocket Types
 * ---------------------------------- */

export type WSMessageType =
  | "joined"
  | "user:joined"
  | "user:left"
  | "cursor"
  | "node:updated"
  | "node:created"
  | "node:deleted"
  | "replan:started"
  | "replan:updated"
  | "replan:committed"
  | "replan:aborted"
  | "error";

export type WSMessage = {
  type: WSMessageType;
  [key: string]: unknown;
};

export const WebSocketReadyStateMap = {
  0: "CONNECTING",
  1: "OPEN",
  2: "CLOSING",
  3: "CLOSED",
} as const;

export type WsState =
  | (typeof WebSocketReadyStateMap)[keyof typeof WebSocketReadyStateMap]
  | "IDLE";
