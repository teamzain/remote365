// Live device state for the web console — the same presence socket the desktop
// app uses, so Online/Offline and "In session" change the instant they change on
// the server instead of on the next poll.
//
// Protocol (already implemented by apps/signaling-service, no server work here):
//   → subscribe-presence { accessKeys }   ← presence-update { sessionId, status }
//                                         ← session-status  { sessionId, inSession }
//   → authenticate-chat  { token }        ← account-sync    { scope }
//   ← ping                                → pong
//
// Presence/session pushes are patched straight into the device store by access
// key; only account-sync (a device was added/renamed/removed by a teammate)
// warrants refetching the list.
//
// A slow poll stays as the fallback for when the socket is down — a stale list
// is bad, but a silently frozen one with no recovery is worse.

import { useEffect, useRef } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { buildSignalUrl } from '../utils/server';
import { useNotificationStore } from '../store/notificationStore';

const POLL_FALLBACK_MS = 30000;
const RECONNECT_MAX_MS = 30000;
const TOKEN_KEY = 'remotelink_access_token';

const normalizeKey = (value?: string) => String(value || '').toLowerCase().replace(/\s/g, '');

export function useDeviceMonitor() {
  const fetchDevices = useDeviceStore((state) => state.fetchDevices);
  const patchDeviceByKey = useDeviceStore((state) => state.patchDeviceByKey);
  // Read device keys through a ref: the socket must NOT be torn down and rebuilt
  // every time a device's is_online flips, which is exactly what a `devices`
  // dependency would do (each push mutates the list that owns the effect).
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef('');

  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const sendSubscription = (socket: WebSocket) => {
      const keys = useDeviceStore.getState().devices.map((device) => normalizeKey(device.access_key)).filter(Boolean);
      if (!keys.length) return;
      const signature = keys.slice().sort().join(',');
      if (signature === subscribedRef.current) return; // already watching exactly these
      subscribedRef.current = signature;
      socket.send(JSON.stringify({
        type: 'subscribe-presence',
        accessKeys: keys,
        clientKind: 'web-presence',
        platform: navigator.platform,
      }));
    };

    const connect = () => {
      if (closed) return;
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return; // signed out — nothing to watch

      let socket: WebSocket;
      try {
        socket = new WebSocket(buildSignalUrl());
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        retries = 0;
        // The list may have changed while the socket was down (or this is a
        // reconnect after sleep), so resync before trusting incremental pushes.
        subscribedRef.current = '';
        fetchDevices(true).finally(() => {
          if (socket.readyState === WebSocket.OPEN) sendSubscription(socket);
        });
        // account-sync pushes are delivered per user, so this socket has to say
        // who it belongs to or teammate add/remove events never arrive.
        socket.send(JSON.stringify({ type: 'authenticate-chat', token, clientKind: 'web-presence' }));
      };

      socket.onmessage = (event) => {
        let data: any;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'ping') {
          try { socket.send(JSON.stringify({ type: 'pong' })); } catch { /* closing */ }
        } else if (data.type === 'presence-update') {
          const nextOnline = data.status === 'online';
          // A real change (not a repeat) goes to the notification centre, which
          // rolls several devices / flaps into one summary entry.
          const before = useDeviceStore.getState().devices.find((device) => normalizeKey(device.access_key) === normalizeKey(data.sessionId));
          if (before && Boolean(before.is_online) !== nextOnline) {
            useNotificationStore.getState().queueDeviceStatusChange(String(before.device_name || (before as any).name || 'Device'), nextOnline ? 'online' : 'offline');
          }
          patchDeviceByKey(data.sessionId, { is_online: nextOnline });
        } else if (data.type === 'session-status') {
          patchDeviceByKey(data.sessionId, { in_session: Boolean(data.inSession) });
        } else if (data.type === 'account-sync' && data.scope === 'devices') {
          // Membership of the list itself changed — a patch can't express that.
          fetchDevices(true);
        }
      };

      socket.onerror = () => { try { socket.close(); } catch { /* already gone */ } };
      socket.onclose = () => {
        socketRef.current = null;
        subscribedRef.current = '';
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer) return;
      const delay = Math.min(RECONNECT_MAX_MS, 1000 * Math.pow(2, retries));
      retries += 1;
      reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
    };

    connect();

    // Fallback + catch-up. The poll covers a dead socket; the focus/visibility
    // refresh covers a tab that was backgrounded (browsers throttle timers and
    // may drop sockets), so returning to it never shows a stale fleet.
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (socketRef.current?.readyState !== WebSocket.OPEN) fetchDevices(true);
    }, POLL_FALLBACK_MS);

    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      fetchDevices(true);
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        retries = 0;
        connect();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      closed = true;
      clearInterval(poll);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      try { socketRef.current?.close(); } catch { /* already gone */ }
      socketRef.current = null;
    };
  }, [fetchDevices, patchDeviceByKey]);

  // Keep the watch list in step as devices appear/disappear, without recreating
  // the socket. Subscribing is idempotent server-side (it replaces the set).
  const deviceKeys = useDeviceStore((state) => state.devices.map((device) => normalizeKey(device.access_key)).sort().join(','));
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !deviceKeys) return;
    if (deviceKeys === subscribedRef.current) return;
    subscribedRef.current = deviceKeys;
    socket.send(JSON.stringify({
      type: 'subscribe-presence',
      accessKeys: deviceKeys.split(','),
      clientKind: 'web-presence',
      platform: navigator.platform,
    }));
  }, [deviceKeys]);
}
