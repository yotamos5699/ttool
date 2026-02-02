import { usePlanStore, type WSMessage } from "@/stores/planStore";

/**
 * Centralized WebSocket message handler
 * Dispatches incoming messages to appropriate store actions
 */
export function handleWsMessage(message: WSMessage) {
  const store = usePlanStore.getState();

  switch (message.type) {
    // Room events
    case "joined":
      console.log("[WS] Joined room:", message);
      if (typeof message.roomSize === "number") {
        store.setRoomSize(message.roomSize);
      }
      break;

    case "user:joined":
      console.log("[WS] User joined:", message);
      if (typeof message.roomSize === "number") {
        store.setRoomSize(message.roomSize);
      }
      break;

    case "user:left":
      console.log("[WS] User left:", message);
      if (typeof message.roomSize === "number") {
        store.setRoomSize(message.roomSize);
      }
      break;

    // Cursor events (for collaborative editing)
    case "cursor":
      console.log("[WS] Cursor update:", message);
      // TODO: Handle cursor position updates
      break;

    // Node CRUD events
    case "node:updated":
      console.log("[WS] Node updated:", message);
      // TODO: Apply update to store based on nodeType
      // const { nodeType, nodeId, data } = message as NodeUpdatePayload;
      break;

    case "node:created":
      console.log("[WS] Node created:", message);
      // TODO: Add node to store based on nodeType
      break;

    case "node:deleted":
      console.log("[WS] Node deleted:", message);
      // TODO: Remove node from store based on nodeType
      break;

    // Replan events
    case "replan:started":
      console.log("[WS] Replan started:", message);
      // TODO: Show replan UI, update blast radius
      break;

    case "replan:updated":
      console.log("[WS] Replan updated:", message);
      // TODO: Update replan progress
      break;

    case "replan:committed":
      console.log("[WS] Replan committed:", message);
      // TODO: Apply replan changes, clear blast radius
      store.clearBlastRadius();
      break;

    case "replan:aborted":
      console.log("[WS] Replan aborted:", message);
      // TODO: Revert any pending changes, clear blast radius
      store.clearBlastRadius();
      break;

    // Error events
    case "error":
      console.error("[WS] Error:", message);
      if (typeof message.error === "string") {
        store.setWsError(message.error);
      }
      break;

    default:
      console.warn("[WS] Unknown message type:", message.type, message);
  }
}
