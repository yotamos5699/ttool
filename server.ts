// import { createServer } from "http";
// import { parse } from "url";
// import next from "next";
// import { WebSocketServer, WebSocket } from "ws";

// const dev = process.env.NODE_ENV !== "production";
// const hostname = "localhost";
// const port = parseInt(process.env.PORT || "3000", 10);

// const app = next({ dev, hostname, port });
// const handle = app.getRequestHandler();

// /* ----------------------------------
//  * WebSocket Types
//  * ---------------------------------- */

// type WSMessage =
//   | { type: "join"; planId: number }
//   | { type: "leave" }
//   | { type: "broadcast"; payload: object }
//   | {
//       type: "cursor";
//       userId: string;
//       nodeId: number | null;
//       position?: { x: number; y: number };
//     }
//   | { type: "node:updated"; nodeType: string; nodeId: number; data: object }
//   | { type: "node:created"; nodeType: string; data: object }
//   | { type: "node:deleted"; nodeType: string; nodeId: number }
//   | { type: "replan:started"; sessionId: number }
//   | { type: "replan:updated"; sessionId: number; data: object }
//   | { type: "replan:committed"; sessionId: number }
//   | { type: "replan:aborted"; sessionId: number };

// type ClientMeta = {
//   planId: number | null;
//   userId: string | null;
// };

// /* ----------------------------------
//  * Room Management
//  * ---------------------------------- */

// const rooms = new Map<string, Set<WebSocket>>();
// const clientMeta = new WeakMap<WebSocket, ClientMeta>();

// function getRoomKey(planId: number): string {
//   return `plan:${planId}`;
// }

// function joinRoom(ws: WebSocket, planId: number): void {
//   const roomKey = getRoomKey(planId);

//   // Leave previous room if any
//   const meta = clientMeta.get(ws);
//   if (meta?.planId) {
//     leaveRoom(ws, meta.planId);
//   }

//   // Join new room
//   if (!rooms.has(roomKey)) {
//     rooms.set(roomKey, new Set());
//   }
//   rooms.get(roomKey)!.add(ws);

//   // Update client meta
//   clientMeta.set(ws, { ...meta, planId } as ClientMeta);

//   console.log(`Client joined room ${roomKey}. Room size: ${rooms.get(roomKey)!.size}`);
// }

// function leaveRoom(ws: WebSocket, planId: number): void {
//   const roomKey = getRoomKey(planId);
//   const room = rooms.get(roomKey);

//   if (room) {
//     room.delete(ws);
//     if (room.size === 0) {
//       rooms.delete(roomKey);
//     }
//     console.log(`Client left room ${roomKey}. Room size: ${room.size}`);
//   }
// }

// function broadcast(roomKey: string, message: object, excludeWs?: WebSocket): void {
//   const room = rooms.get(roomKey);
//   if (!room) return;

//   const data = JSON.stringify(message);
//   room.forEach((client) => {
//     if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
//       client.send(data);
//     }
//   });
// }

// function broadcastToPlan(planId: number, message: object, excludeWs?: WebSocket): void {
//   broadcast(getRoomKey(planId), message, excludeWs);
// }

// /* ----------------------------------
//  * Server Setup
//  * ---------------------------------- */

// app.prepare().then(() => {
//   const server = createServer((req, res) => {
//     const parsedUrl = parse(req.url!, true);
//     handle(req, res, parsedUrl);
//   });

//   const wss = new WebSocketServer({ noServer: true });

//   // Handle HTTP upgrade for WebSocket
//   server.on("upgrade", (req, socket, head) => {
//     const { pathname } = parse(req.url!, true);

//     // Only handle WebSocket upgrades on /api/ws
//     if (pathname === "/api/ws") {
//       wss.handleUpgrade(req, socket, head, (ws) => {
//         wss.emit("connection", ws, req);
//       });
//     } else {
//       // Let Next.js handle HMR websockets
//       socket.destroy();
//     }
//   });

//   // WebSocket connection handler
//   wss.on("connection", (ws) => {
//     console.log("New WebSocket connection");

//     // Initialize client metadata
//     clientMeta.set(ws, { planId: null, userId: null });

//     ws.on("message", (data) => {
//       try {
//         const message = JSON.parse(data.toString()) as WSMessage;
//         const meta = clientMeta.get(ws);

//         switch (message.type) {
//           case "join": {
//             joinRoom(ws, message.planId);
//             ws.send(
//               JSON.stringify({
//                 type: "joined",
//                 planId: message.planId,
//                 roomSize: rooms.get(getRoomKey(message.planId))?.size || 0,
//               }),
//             );

//             // Notify others in the room
//             broadcastToPlan(
//               message.planId,
//               {
//                 type: "user:joined",
//                 userId: meta?.userId,
//               },
//               ws,
//             );
//             break;
//           }

//           case "leave": {
//             if (meta?.planId) {
//               broadcastToPlan(
//                 meta.planId,
//                 {
//                   type: "user:left",
//                   userId: meta.userId,
//                 },
//                 ws,
//               );
//               leaveRoom(ws, meta.planId);
//             }
//             break;
//           }

//           case "broadcast": {
//             if (meta?.planId) {
//               broadcastToPlan(meta.planId, message.payload, ws);
//             }
//             break;
//           }

//           case "cursor": {
//             if (meta?.planId) {
//               // Update userId if provided
//               if (message.userId && meta) {
//                 meta.userId = message.userId;
//               }
//               broadcastToPlan(
//                 meta.planId,
//                 {
//                   type: "cursor",
//                   userId: message.userId,
//                   nodeId: message.nodeId,
//                   position: message.position,
//                 },
//                 ws,
//               );
//             }
//             break;
//           }

//           case "node:updated":
//           case "node:created":
//           case "node:deleted":
//           case "replan:started":
//           case "replan:updated":
//           case "replan:committed":
//           case "replan:aborted": {
//             // Forward these events to all clients in the room
//             if (meta?.planId) {
//               broadcastToPlan(meta.planId, message, ws);
//             }
//             break;
//           }
//         }
//       } catch (e) {
//         console.error("WebSocket message error:", e);
//         ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
//       }
//     });

//     ws.on("close", () => {
//       const meta = clientMeta.get(ws);
//       if (meta?.planId) {
//         // Notify others before leaving
//         broadcastToPlan(
//           meta.planId,
//           {
//             type: "user:left",
//             userId: meta.userId,
//           },
//           ws,
//         );
//         leaveRoom(ws, meta.planId);
//       }
//       console.log("WebSocket connection closed");
//     });

//     ws.on("error", (error) => {
//       console.error("WebSocket error:", error);
//     });
//   });

//   server.listen(port, () => {
//     console.log(`> Ready on http://${hostname}:${port}`);
//     console.log(`> WebSocket available at ws://${hostname}:${port}/api/ws`);
//   });
// });
