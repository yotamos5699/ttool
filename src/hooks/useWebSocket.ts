"use client";

import { useWSStore, type WSMessage } from "@/stores/plan";
import { catchError } from "@/lib/catchWrapper";
import { useEffect, useRef } from "react";

type UseWebSocketOptions = {
  planId: number;
  userId: string;
  onMessage: (message: WSMessage) => void;
  onConnect?: (ws: WebSocket) => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
};

export function useWebSocket({
  planId,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  autoReconnect = true,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const isConnecting = useRef(false);
  const currentPlanId = useRef(planId);
  const shouldReconnect = useRef(autoReconnect);

  // Get store actions
  const setWsState = useWSStore((s) => s.setWsState);
  const setWs = useWSStore((s) => s.setWs);
  const setWsError = useWSStore((s) => s.setWsError);

  useEffect(() => {
    currentPlanId.current = planId;
    // If already connected, just re-join the new room
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "join", planId }));
    }
  }, [planId]);

  // Connection effect - runs once on mount
  useEffect(() => {
    shouldReconnect.current = autoReconnect;

    const connect = () => {
      // Prevent multiple simultaneous connection attempts
      if (isConnecting.current) return;
      if (ws.current?.readyState === WebSocket.OPEN) return;
      if (ws.current?.readyState === WebSocket.CONNECTING) return;

      isConnecting.current = true;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const socket = new WebSocket(`${protocol}//${host}/api/ws`);
      ws.current = socket;

      socket.onopen = () => {
        isConnecting.current = false;
        setWsState(socket.readyState);
        setWs(socket);
        onConnect?.(socket);
        socket.send(
          JSON.stringify({ type: "join", planId: currentPlanId.current }),
        );
      };

      socket.onmessage = (event) => {
        const [error, messageData] = catchError<WSMessage>(
          JSON.parse(event.data),
        );
        if (error || !messageData) {
          const errorMsg = error?.message || "WebSocket message parsing error";
          setWsError(errorMsg);
          onError?.(errorMsg);
        } else {
          onMessage(messageData);
        }
      };

      socket.onclose = (event) => {
        isConnecting.current = false;
        setWsState(ws.current?.readyState || WebSocket.CLOSED);
        setWs(null);
        ws.current = null;

        onDisconnect?.();

        // Only auto-reconnect if not a clean close and reconnect is enabled
        if (shouldReconnect.current && event.code !== 1000) {
          reconnectTimer.current = setTimeout(() => {
            console.log("Attempting to reconnect WebSocket...");
            connect();
          }, reconnectInterval);
        }
      };

      socket.onerror = () => {
        const errorMsg = "WebSocket error occurred";
        setWsError(errorMsg);
        onError?.(errorMsg);
      };
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (ws.current) {
        ws.current.close(1000, "Component unmounted");
        ws.current = null;
      }
    };
  }, [
    reconnectInterval,
    autoReconnect,
    onConnect,
    onMessage,
    onError,
    onDisconnect,
    setWsState,
    setWs,
    setWsError,
  ]);
}

// Re-export types from store for backwards compatibility
export type { WSMessage } from "@/stores/plan";
