// export type ContextLevel = "global" | "project" | "stage" | "job";
// export type ContextType = "requirement" | "constraint" | "decision" | "code" | "note";

// export type ContextNode = {
//   id: number;
//   level: ContextLevel;
//   type: ContextType;
//   title: string;
//   payload: string;
//   createdAt: number;
//   updatedAt: number;
// };

// export type ExecutionMode = "sequential" | "parallel";
// type  IoNodeData = {
//     id: number;
//     type: "data" | "generator"|"artifact"|"model"|"dataset"|"url";
//  data:string // could be a path or a url or raw data(unprocessed)
//      createdAt: number;
//     updatedAt: number;
// }

// export type IOEnvelope = {
//     schemaVersion: 1;
//     stageId: number;
//     jobId?: number;

//     inputNode:IoNodeData;
//   outputNode: IoNodeData;

//   context: IOContext;
// };

// export type Stage = {
//   id: number;
//   title: string;
//   description?: string;
//   executionMode: ExecutionMode;
//   dependsOn: number[];
//   ioEnvelope: number;

//   contextNodes: number[];

//   createdAt: number;
//   updatedAt: number;
// };

// type job  = {
//     id: number;
//     stageId: number;
//     title: string;
//     description?: string;
//     dependsOn: number[];
//     ioEnvelope: number;
// }
// export type Plan = {
//   id: number;
//   name: string;
//   goal: string;
//   stages: Stage[];
//   version: number;
//   parentVersion?: number;
//   createdAt: number;
//   updatedAt: number;
// };
