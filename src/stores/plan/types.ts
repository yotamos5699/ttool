/* ----------------------------------
 * Plan Domain Types
 * ---------------------------------- */

export type ContextNode = {
  id: number;
  level: string;
  type: string;
  title: string;
  payload: string;
};

export type Job = {
  id: number;
  stageId: number;
  parentJobId: number | null;
  title: string;
  description: string | null;
  dependsOn: number[];
  dependsOnStages: number[];
  dependsOnJobs: number[];
  childJobs?: Job[];
  contextNodes?: ContextNode[];
};

export type IOEnvelope = {
  id: number;
  inputNode: { id: number; type: string; data: string };
  outputNode: { id: number; type: string; data: string };
};

export type Stage = {
  id: number;
  planId: number;
  parentStageId: number | null;
  title: string;
  description: string | null;
  executionMode: "sequential" | "parallel";
  dependsOn: number[];
  dependsOnStages: number[];
  childStages?: Stage[];
  jobs?: Job[];
  contextNodes?: ContextNode[];
  ioEnvelopes?: IOEnvelope[];
};

export type Plan = {
  id: number;
  name: string;
  goal: string;
  version: number;
  parentVersion: number | null;
  stages: Stage[];
  contextNodes: ContextNode[];
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
