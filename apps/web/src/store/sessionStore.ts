import { create } from 'zustand';
import { buildSignalUrl } from '../utils/server';

interface Session {
  id: string;
  deviceId: string;
  startTime: number;
  status: 'connecting' | 'active' | 'ended' | 'error';
  latency?: number;
}

type MessageHandler = (data: any) => void;

interface SessionState {
  activeSession: Session | null;
  ws: WebSocket | null;
  connectionId: string | null;
  activeSessionCount: number;
  startSession: (deviceId: string) => void;
  updateSessionStatus: (status: Session['status']) => void;
  updateLatency: (latency: number) => void;
  endSession: () => void;
  initSocket: (token: string) => WebSocket;
  closeSocket: () => void;
  sendMessage: (type: string, payload: object) => void;
  onMessage: (type: string, handler: MessageHandler) => () => void;
}

// Internal message listener registry (outside Zustand to avoid stale closures)
const listeners: Map<string, Set<MessageHandler>> = new Map();

const dispatchMessage = (type: string, data: any) => {
  listeners.get(type)?.forEach((fn) => fn(data));
};

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  activeSessionCount: 0,
  ws: null,
  connectionId: null,

  startSession: (deviceId) =>
    set({
      activeSession: {
        id: Math.random().toString(36).substring(7),
        deviceId,
        startTime: Date.now(),
        status: 'connecting',
      },
    }),

  updateSessionStatus: (status) =>
    set((state) => ({
      activeSession: state.activeSession ? { ...state.activeSession, status } : null,
    })),

  updateLatency: (latency) =>
    set((state) => ({
      activeSession: state.activeSession ? { ...state.activeSession, latency } : null,
    })),

  endSession: () => {
    get().closeSocket();
    set({ activeSession: null });
  },

  initSocket: (_token: string) => {
    const existing = get().ws;
    if (existing && existing.readyState === WebSocket.OPEN) return existing;

    // Use the same secure signaling URL resolver as chat/meetings. On the
    // deployed HTTPS web app, mobile browsers block insecure ws:// fallbacks,
    // which leaves the viewer stuck on "Connecting".
    const wsUrl = buildSignalUrl(import.meta.env.VITE_SIGNAL_URL);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Guard: skip if this WS was superseded (e.g., React StrictMode double-fire)
      if (get().ws !== ws) return;
      console.log('[Signaling] Connected');
      dispatchMessage('open', {});
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'ping') console.log('[Signaling] Received:', msg.type, msg);
        
        if (msg.type === 'global-stats') {
          set({ activeSessionCount: msg.activeSessions || 0 });
        }
        
        dispatchMessage(msg.type, msg);
      } catch (e) {
        console.warn('[Signaling] Failed to parse message', event.data);
      }
    };

    ws.onerror = (e) => {
      if (get().ws !== ws) return; // stale socket
      console.error('[Signaling] WebSocket error', e);
      dispatchMessage('error', {});
    };

    ws.onclose = () => {
      if (get().ws !== ws) return; // stale socket
      console.log('[Signaling] Disconnected');
      dispatchMessage('disconnect', {});
      set({ ws: null, connectionId: null });
    };

    set({ ws });
    return ws;
  },

  closeSocket: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, connectionId: null });
    }
    listeners.clear();
  },

  sendMessage: (type, payload) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    } else {
      console.warn('[Signaling] WebSocket not open, cannot send:', type);
    }
  },

  onMessage: (type, handler) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(handler);
    // Return cleanup function
    return () => listeners.get(type)?.delete(handler);
  },
}));
