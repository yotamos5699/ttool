"use client";

import { create } from "zustand";
import type { WsState } from "./types";
import { WebSocketReadyStateMap } from "./types";

/* ----------------------------------
 * State Types
 * ---------------------------------- */

type WSState = {
  ws: WebSocket | null;
  wsState: WsState;
  lastWsError: { ts: number; error: string } | null;
  roomSize: number;
};

type WSActions = {
  setWs: (ws: WebSocket | null) => void;
  setWsState: (state: number) => void;
  setWsError: (error: string) => void;
  setRoomSize: (size: number) => void;
  reset: () => void;
};

type WSStore = WSState & WSActions;

/* ----------------------------------
 * Store
 * ---------------------------------- */

const initialState: WSState = {
  ws: null,
  wsState: "IDLE",
  lastWsError: null,
  roomSize: 0,
};

export const useWSStore = create<WSStore>()((set) => ({
  ...initialState,

  setWs: (ws) => set({ ws }),

  setWsState: (state) => {
    const wsState =
      WebSocketReadyStateMap[state as keyof typeof WebSocketReadyStateMap] ||
      "IDLE";
    set({ wsState });
  },

  setWsError: (error) => set({ lastWsError: { ts: Date.now(), error } }),

  setRoomSize: (roomSize) => set({ roomSize }),

  reset: () => set(initialState),
}));
