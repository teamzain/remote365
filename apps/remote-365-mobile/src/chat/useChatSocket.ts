import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { buildSignalUrl } from '../meetings/meetingUtils';
import { ChatMessage } from './chatApi';

// Shared chat WebSocket. Mirrors the desktop chatStore handshake:
//   connect → { type: 'authenticate-chat', token } → 'chat-authenticated'
// then send-chat-message / chat-message-received / chat-message-updated / chat-typing.
//
// The same authenticated socket also carries the device-fleet sync the web
// console gets from useDeviceMonitor: per-user `account-sync` pushes, and —
// after `subscribePresence(accessKeys)` — `presence-update` / `session-status`
// for those devices.

type ChatSocketHandlers = {
  onMessage?: (message: ChatMessage, conversationId: string) => void;
  onMessageUpdated?: (message: ChatMessage, conversationId: string) => void;
  onTyping?: (conversationId: string, userId: string, userName: string | undefined, isTyping: boolean) => void;
  onReadReceipt?: (conversationId: string, userId: string, readAt: string) => void;
  /** `reason` is the server's word for WHY it changed: 'accepted' | 'group-created' |
   *  'members-added' | 'renamed' | 'blocked' | 'rejected' | 'unfriended'. It was being
   *  discarded, which made every change indistinguishable to the UI. */
  onConversationUpdated?: (conversation: any, reason?: string) => void;
  onConversationRemoved?: (conversationId: string) => void;
  /** A brand-new incoming contact request, as distinct from an update to an existing one. */
  onContactRequest?: (conversation: any) => void;
  /** Someone invited this user to a remote session or meeting. The server fans this out
   *  (auth-service chat.ts session-invites) but nothing on mobile listened for it, so
   *  invites arrived silently — no toast, no notification, nothing. */
  onSessionInvite?: (invite: any) => void;
  onPresence?: (userId: string, online: boolean, lastSeen?: string) => void;
  onPresenceSnapshot?: (online: Record<string, boolean>, lastSeen: Record<string, string>) => void;
  onAuthenticated?: () => void;
  onAccountSync?: (scope: string, action?: string) => void;
  onDevicePresence?: (accessKey: string, online: boolean) => void;
  onDeviceSessionStatus?: (accessKey: string, inSession: boolean) => void;
};

export type ChatSocket = {
  ready: boolean;
  sendMessage: (input: {
    conversationId: string;
    content: string;
    clientMessageId: string;
    replyToId?: string;
    attachment?: { url: string; name: string; type: string; size: number };
  }) => void;
  sendTyping: (conversationId: string, userName?: string, isTyping?: boolean) => void;
  markRead: (conversationId: string) => void;
  subscribePresence: (accessKeys: string[]) => void;
};

export function useChatSocket(
  apiBaseUrl: string,
  token: string | null,
  handlers: ChatSocketHandlers,
): ChatSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [ready, setReady] = useState(false);
  // Queue messages attempted before the socket authenticates.
  const pendingRef = useRef<any[]>([]);

  // Re-run the socket effect when the app moves between foreground and background.
  //
  // The server suppresses a push to anyone holding a "chat:online:<userId>" key, and it is
  // refreshed by any live socket. A backgrounded RN app keeps its socket open, so the user
  // was counted as online and got NO push — while the in-app toast was invisible behind the
  // launcher. Dropping the socket when we background lets the key expire, so push takes over
  // exactly when the in-app path stops being visible.
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!token || !appActive) return;
    let closed = false;
    let reconnectTimer: any = null;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(buildSignalUrl(apiBaseUrl));
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'authenticate-chat', token, clientKind: 'mobile-chat' }));
      };

      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data as string);
        } catch {
          return;
        }
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          case 'chat-authenticated':
            setReady(true);
            // Flush anything queued while connecting.
            pendingRef.current.forEach((payload) => ws.send(JSON.stringify(payload)));
            pendingRef.current = [];
            handlersRef.current.onAuthenticated?.();
            break;
          case 'chat-message-received':
            if (data.message && data.conversationId) {
              handlersRef.current.onMessage?.(data.message, data.conversationId);
            }
            break;
          case 'chat-message-updated':
            if (data.message && data.conversationId) {
              handlersRef.current.onMessageUpdated?.(data.message, data.conversationId);
            }
            break;
          case 'chat-typing':
            handlersRef.current.onTyping?.(data.conversationId, data.userId, data.userName, data.isTyping !== false);
            break;
          case 'chat-read-receipt':
            if (data.conversationId && data.userId && data.readAt) {
              handlersRef.current.onReadReceipt?.(data.conversationId, data.userId, data.readAt);
            }
            break;
          case 'chat-conversation-updated':
            // Fired when a conversation changes — e.g. an invite is accepted (status → ACCEPTED).
            if (data.conversation?.id) {
              handlersRef.current.onConversationUpdated?.(data.conversation, data.reason ? String(data.reason) : undefined);
            }
            break;
          case 'chat-invite':
            // A new incoming invite arrives as a full conversation object.
            if (data.conversation?.id) {
              handlersRef.current.onContactRequest?.(data.conversation);
              handlersRef.current.onConversationUpdated?.(data.conversation, 'invited');
            }
            break;
          case 'chat-session-invite':
            // Someone invited this user to a remote session or meeting. This case did not
            // exist: the event hit `default: break` below and was thrown away, which is why
            // an invite produced no notification of any kind while the app was open.
            if (data.invite) {
              handlersRef.current.onSessionInvite?.(data.invite);
            }
            break;
          case 'chat-conversation-removed':
            if (data.conversationId) {
              handlersRef.current.onConversationRemoved?.(data.conversationId);
            }
            break;
          case 'chat-presence':
            if (data.userId) {
              handlersRef.current.onPresence?.(data.userId, !!data.online, data.lastSeen);
            }
            break;
          case 'chat-presence-snapshot':
            handlersRef.current.onPresenceSnapshot?.(data.online || {}, data.lastSeen || {});
            break;
          case 'account-sync':
            if (data.scope) {
              handlersRef.current.onAccountSync?.(String(data.scope), data.action ? String(data.action) : undefined);
            }
            break;
          case 'presence-update':
            // sessionId is the device access key.
            if (data.sessionId) {
              handlersRef.current.onDevicePresence?.(String(data.sessionId), data.status === 'online');
            }
            break;
          case 'session-status':
            if (data.sessionId) {
              handlersRef.current.onDeviceSessionStatus?.(String(data.sessionId), Boolean(data.inSession));
            }
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        setReady(false);
        wsRef.current = null;
        if (!closed) reconnectTimer = setTimeout(connect, 2500);
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* noop */ }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { wsRef.current?.close(); } catch { /* noop */ }
      wsRef.current = null;
    };
  }, [apiBaseUrl, token, appActive]);

  const rawSend = useCallback((payload: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      pendingRef.current.push(payload);
    }
  }, []);

  const sendMessage = useCallback<ChatSocket['sendMessage']>((input) => {
    rawSend({
      type: 'send-chat-message',
      conversationId: input.conversationId,
      content: input.content,
      clientMessageId: input.clientMessageId,
      replyToId: input.replyToId || undefined,
      attachment: input.attachment || undefined,
    });
  }, [rawSend]);

  const sendTyping = useCallback((conversationId: string, userName?: string, isTyping = true) => {
    rawSend({ type: 'chat-typing', conversationId, userName, isTyping });
  }, [rawSend]);

  const markRead = useCallback((conversationId: string) => {
    rawSend({ type: 'chat-read', conversationId });
  }, [rawSend]);

  // Replaces the watched set server-side, so re-sending the full list is
  // idempotent (same contract the web presence monitor relies on).
  const subscribePresence = useCallback((accessKeys: string[]) => {
    if (!accessKeys.length) return;
    rawSend({ type: 'subscribe-presence', accessKeys, clientKind: 'mobile-presence', platform: Platform.OS });
  }, [rawSend]);

  return { ready, sendMessage, sendTyping, markRead, subscribePresence };
}
