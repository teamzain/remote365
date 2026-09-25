import { create } from 'zustand';
import api from '../lib/api';
import { useAuthStore } from './authStore';
import { buildSignalUrl } from '../utils/server';
import { SIGNAL_URL } from '../lib/env';

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface ChatMessage {
  id: string;
  clientMessageId?: string | null;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: ChatUser;
}

export interface ChatConversation {
  id: string;
  isGroup: boolean;
  name: string | null;
  requestedById?: string | null;
  blockedById?: string | null;
  otherOnline?: boolean;
  participants: { userId: string; user: ChatUser; nickname?: string | null; muted?: boolean; lastReadAt?: string | null }[];
  /** Server-side unread count (from the participant read marker). */
  unreadCount?: number;
  messages: ChatMessage[];
  updatedAt: string;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
}

interface ChatState {
  conversations: ChatConversation[];
  messages: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  readReceipts: Record<string, Record<string, string>>;
  // Real presence: userId -> online, and userId -> last-seen ISO timestamp.
  onlineUsers: Record<string, boolean>;
  lastSeenByUser: Record<string, string>;
  activeChatId: string | null;
  ws: WebSocket | null;
  isLoading: boolean;
  loadingMessages: Record<string, boolean>;
  pendingMessages: Record<string, { conversationId: string; content: string }>;
  reconnectAttempts: number;

  setActiveChat: (id: string | null) => void;
  markRead: (id: string) => void;
  onNewMessage?: (msg: any, convId: string) => void;
  onToastMessage?: (msg: any, convId: string) => void;
  onInvite?: (conv: any) => void;
  onSessionInvite?: (invite: any) => void;
  onConversationEvent?: (event: { type: string; conversation?: ChatConversation; conversationId?: string; actorUserId?: string; reason?: string }) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string, options?: { before?: string }) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  // Paging: whether an older page may exist, and whether one is being fetched.
  hasMoreMessages: Record<string, boolean>;
  loadingOlder: Record<string, boolean>;
  createConversation: (email: string) => Promise<{ success: boolean; error?: string }>;
  createGroup: (name: string, emails: string[]) => Promise<boolean>;
  addGroupMembers: (id: string, emails: string[]) => Promise<boolean>;
  sendMessage: (conversationId: string, content: string, options?: { replyToId?: string; attachment?: { url: string; name: string; type: string; size: number } }) => string;
  sendTyping: (conversationId: string, userName?: string, isTyping?: boolean) => void;
  applyMessageUpdate: (conversationId: string, message: ChatMessage) => void;
  typingUsers: Record<string, { userId: string; userName?: string; at: number } | undefined>;
  ingestMessage: (conversationId: string, message: ChatMessage) => void;
  renameConversation: (id: string, name: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  unfriendConversation: (id: string) => Promise<void>;
  blockConversation: (id: string) => Promise<void>;
  unblockConversation: (id: string) => Promise<void>;
  acceptInvite: (id: string) => Promise<void>;
  rejectInvite: (id: string) => Promise<void>;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
}

const getAuthToken = async (): Promise<string | null> => {
  const isElectron = !!(window as any).electronAPI;
  if (isElectron) {
    const result = await (window as any).electronAPI.getToken();
    return result?.token || null;
  }
  return localStorage.getItem('remotelink_access_token');
};

const getWsUrl = (): string => {
  const envUrl = SIGNAL_URL;
  return normalizeSignalUrl(envUrl);
};

const normalizeSignalUrl = (value?: string): string => {
  try {
    return buildSignalUrl(value);
  } catch {
    return buildSignalUrl();
  }
};

const UNREAD_STORAGE_KEY = 'remote365_chat_unread_counts';
const READ_AT_STORAGE_KEY = 'remote365_chat_read_at';

const readJsonMap = (key: string): Record<string, any> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeJsonMap = (key: string, value: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const persistUnreadCounts = (counts: Record<string, number>) => {
  writeJsonMap(UNREAD_STORAGE_KEY, counts);
};

const persistReadAt = (conversationId: string, readAt: string) => {
  const current = readJsonMap(READ_AT_STORAGE_KEY);
  writeJsonMap(READ_AT_STORAGE_KEY, { ...current, [conversationId]: readAt });
};

const createClientMessageId = () => globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map<string, ChatMessage>();
  [...current, ...incoming].forEach((message) => byId.set(message.id, message));
  return Array.from(byId.values()).sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return timeDiff || a.id.localeCompare(b.id);
  });
};

// Messages per page; the newest page loads first, earlier ones on demand.
const MESSAGE_PAGE_SIZE = 150;

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  unreadCounts: readJsonMap(UNREAD_STORAGE_KEY),
  readReceipts: {},
  onlineUsers: {},
  lastSeenByUser: {},
  activeChatId: null,
  ws: null,
  isLoading: false,
  loadingMessages: {},
  hasMoreMessages: {},
  loadingOlder: {},
  pendingMessages: {},
  typingUsers: {},
  reconnectAttempts: 0,

  setActiveChat: (id) => {
    console.log('[chatStore] setActiveChat called with:', id);
    if (id) {
      const nextUnreadCounts = { ...get().unreadCounts, [id]: 0 };
      persistUnreadCounts(nextUnreadCounts);
      persistReadAt(id, new Date().toISOString());
    }
    set((state) => ({
      activeChatId: id,
      unreadCounts: id ? { ...state.unreadCounts, [id]: 0 } : state.unreadCounts
    }));
    if (id && !get().messages[id]) {
      console.log('[chatStore] Fetching messages for:', id);
      get().fetchMessages(id);
    }
  },

  markRead: (id) => {
    const ws = get().ws;
    const readAt = new Date().toISOString();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat-read', conversationId: id, readAt }));
    }
    const nextUnreadCounts = { ...get().unreadCounts, [id]: 0 };
    persistUnreadCounts(nextUnreadCounts);
    persistReadAt(id, readAt);
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [id]: 0 }
    }));
  },

  fetchConversations: async () => {
    try {
      set({ isLoading: true });
      const { data } = await api.get('/api/chat/conversations');
      console.log('[chatStore] fetchConversations raw data:', data);
      const conversations = Array.isArray(data) ? data : [];
      const storedUnread = readJsonMap(UNREAD_STORAGE_KEY);
      const storedReadAt = readJsonMap(READ_AT_STORAGE_KEY);
      const currentUserId = useAuthStore.getState().user?.id;
      const conversationPresence = conversations.reduce((acc: Record<string, boolean>, conversation: ChatConversation) => {
        if (conversation.isGroup || typeof conversation.otherOnline !== 'boolean') return acc;
        const other = conversation.participants?.find((participant) => participant.userId !== currentUserId);
        if (other?.userId) acc[other.userId] = conversation.otherOnline;
        return acc;
      }, {});
      const nextUnreadCounts = conversations.reduce((acc: Record<string, number>, conversation: ChatConversation) => {
        // The server's read marker follows the person across devices; the
        // localStorage estimate only covers servers that send no count.
        if (typeof conversation.unreadCount === 'number') {
          acc[conversation.id] = conversation.id === get().activeChatId ? 0 : conversation.unreadCount;
        } else {
          const lastMessage = conversation.messages?.[0];
          const lastReadAt = storedReadAt[conversation.id];
          const hasUnreadLatest =
            lastMessage &&
            lastMessage.senderId !== currentUserId &&
            (!lastReadAt || new Date(lastMessage.createdAt).getTime() > new Date(lastReadAt).getTime());
          const storedCount = Number(storedUnread[conversation.id] || 0);
          acc[conversation.id] = hasUnreadLatest ? Math.max(storedCount, 1) : storedCount;
        }
        return acc;
      }, {});
      persistUnreadCounts(nextUnreadCounts);
      set((state) => ({
        conversations,
        unreadCounts: nextUnreadCounts,
        onlineUsers: { ...state.onlineUsers, ...conversationPresence },
        isLoading: false
      }));
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string, options?: { before?: string }) => {
    const older = Boolean(options?.before);
    const flag = older ? 'loadingOlder' : 'loadingMessages';
    try {
      set((state) => ({ [flag]: { ...state[flag], [conversationId]: true } }) as Partial<ChatState>);
      const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
      if (options?.before) params.set('before', options.before);
      const { data } = await api.get(`/api/chat/conversations/${conversationId}/messages?${params.toString()}`);
      const page: ChatMessage[] = Array.isArray(data) ? data : [];
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: mergeMessages(state.messages[conversationId] || [], page)
        },
        // A full page means there may be more above it.
        hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: page.length >= MESSAGE_PAGE_SIZE },
        [flag]: { ...state[flag], [conversationId]: false }
      }) as Partial<ChatState>);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      set((state) => ({ [flag]: { ...state[flag], [conversationId]: false } }) as Partial<ChatState>);
    }
  },

  loadOlderMessages: async (conversationId: string) => {
    const oldest = (get().messages[conversationId] || [])[0];
    if (!oldest || get().loadingOlder[conversationId]) return;
    await get().fetchMessages(conversationId, { before: oldest.createdAt });
  },

  createConversation: async (email: string) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    try {
      const { data } = await api.post('/api/chat/conversations', { email: normalizedEmail });
      set((state) => ({
        conversations: [data, ...state.conversations.filter(c => c.id !== data.id)]
      }));
      get().setActiveChat(data.id);
      return { success: true };
    } catch (err) {
      console.error('Failed to create conversation:', err);
      await get().fetchConversations();
      const existing = get().conversations.find((conversation) =>
        !conversation.isGroup &&
        conversation.participants.some((participant) =>
          participant.user.email?.toLowerCase() === normalizedEmail
        )
      );
      if (existing) {
        get().setActiveChat(existing.id);
        return { success: true };
      }
      const message = (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        'Could not send the contact request. Please try again.';
      return { success: false, error: message };
    }
  },

  createGroup: async (name: string, emails: string[]) => {
    try {
      const { data } = await api.post('/api/chat/groups', { name, emails });
      set((state) => ({
        conversations: [data, ...state.conversations.filter(c => c.id !== data.id)]
      }));
      get().setActiveChat(data.id);
      return true;
    } catch (err) {
      console.error('Failed to create group:', err);
      return false;
    }
  },

  addGroupMembers: async (id: string, emails: string[]) => {
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/members`, { emails });
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
      return true;
    } catch (err) {
      console.error('[ChatStore] Failed to add group members', err);
      return false;
    }
  },

  sendMessage: (conversationId: string, content: string, options?: { replyToId?: string; attachment?: { url: string; name: string; type: string; size: number } }) => {
    const clientMessageId = createClientMessageId();
    set((state) => ({
      pendingMessages: { ...state.pendingMessages, [clientMessageId]: { conversationId, content } }
    }));
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'send-chat-message',
        conversationId,
        content,
        clientMessageId,
        replyToId: options?.replyToId || undefined,
        attachment: options?.attachment || undefined
      }));
    }
    return clientMessageId;
  },

  sendTyping: (conversationId: string, userName?: string, isTyping = true) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat-typing', conversationId, userName, isTyping }));
    }
  },

  // Replace a mutated message (edit/delete/reaction/pin) in place.
  applyMessageUpdate: (conversationId: string, message: ChatMessage) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) => m.id === message.id ? { ...m, ...message } : m)
      }
    }));
  },

  // Inject a server-created message immediately (e.g. an HTTP action that returns the
  // persisted message) so the UI updates without waiting for the socket rebroadcast.
  // De-dupes by id, so the eventual socket echo is ignored.
  ingestMessage: (conversationId: string, message: ChatMessage) => {
    set((state) => {
      const current = state.messages[conversationId] || [];
      if (current.some((m) => m.id === message.id)) return state;
      const conversations = [...state.conversations];
      const index = conversations.findIndex((c) => c.id === conversationId);
      if (index > -1) {
        const conv = { ...conversations[index], messages: [message], updatedAt: message.createdAt };
        conversations.splice(index, 1);
        conversations.unshift(conv);
      }
      return {
        messages: { ...state.messages, [conversationId]: mergeMessages(current, [message]) },
        conversations
      };
    });
  },

  renameConversation: async (id: string, name: string) => {
    try {
      const { data } = await api.patch(`/api/chat/conversations/${id}`, { name });
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to rename conversation', err);
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await api.delete(`/api/chat/conversations/${id}`);
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeChatId: state.activeChatId === id ? null : state.activeChatId
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to delete conversation', err);
    }
  },

  unfriendConversation: async (id: string) => {
    try {
      await api.post(`/api/chat/conversations/${id}/unfriend`);
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeChatId: state.activeChatId === id ? null : state.activeChatId
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to unfriend conversation', err);
    }
  },

  blockConversation: async (id: string) => {
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/block`);
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to block conversation', err);
    }
  },

  unblockConversation: async (id: string) => {
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/unblock`);
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to unblock conversation', err);
    }
  },

  acceptInvite: async (id: string) => {
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/accept`);
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to accept invite', err);
    }
  },

  rejectInvite: async (id: string) => {
    try {
      await api.post(`/api/chat/conversations/${id}/reject`);
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeChatId: state.activeChatId === id ? null : state.activeChatId
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to reject invite', err);
    }
  },

  connectWebSocket: async () => {
    const existingWs = get().ws;
    if (existingWs && (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING)) return;

    const token = await getAuthToken();
    if (!token) return;

    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[ChatStore] WebSocket connected');
      Promise.resolve((window as any).electronAPI?.getAppVersion?.())
        .catch(() => undefined)
        .then((appVersion) => {
          ws.send(JSON.stringify({
            type: 'authenticate-chat',
            token,
            clientKind: 'web-chat',
            appVersion,
            platform: navigator.platform
          }));
        });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (data.type === 'chat-authenticated') {
          set({ reconnectAttempts: 0 });
          Object.entries(get().pendingMessages).forEach(([clientMessageId, pending]) => {
            ws.send(JSON.stringify({ type: 'send-chat-message', clientMessageId, ...pending }));
          });
          get().fetchConversations();
        } else if (data.type === 'chat-message-ack') {
          if (!data.clientMessageId) return;
          set((state) => {
            const pendingMessages = { ...state.pendingMessages };
            delete pendingMessages[data.clientMessageId];
            return { pendingMessages };
          });
        } else if (data.type === 'chat-message-received') {
          const { message, conversationId } = data;
          const currentUserId = useAuthStore.getState().user?.id;
          const isOwnMessage = message.senderId === currentUserId;
          let isDuplicate = false;
          
          set((state) => {
            // Update messages map
            const currentMessages = state.messages[conversationId] || [];
            // Prevent duplicates
            if (currentMessages.some(m => m.id === message.id)) {
              isDuplicate = true;
              return state;
            }
            
            const updatedMessages = {
              ...state.messages,
              [conversationId]: mergeMessages(currentMessages, [message])
            };

            // Move conversation to top and update its last message
            let updatedConversations = [...state.conversations];
            const convIndex = updatedConversations.findIndex(c => c.id === conversationId);
            
            if (convIndex > -1) {
              const conv = { ...updatedConversations[convIndex] };
              conv.messages = [message];
              conv.updatedAt = message.createdAt;
              updatedConversations.splice(convIndex, 1);
              updatedConversations.unshift(conv);
            } else {
              // If we received a message for a new conversation, fetch full conversation list
              get().fetchConversations();
            }

            const isUnread = !isOwnMessage && state.activeChatId !== conversationId;
            const unreadCounts = isUnread
              ? { ...state.unreadCounts, [conversationId]: (state.unreadCounts[conversationId] || 0) + 1 }
              : state.unreadCounts;
            persistUnreadCounts(unreadCounts);
            if (!isUnread) persistReadAt(conversationId, new Date().toISOString());

            return {
              messages: updatedMessages,
              conversations: updatedConversations,
              unreadCounts
            };
          });
          if (!isDuplicate && !isOwnMessage) {
            get().onNewMessage?.(message, conversationId);
            get().onToastMessage?.(message, conversationId);
          }
        } else if (data.type === 'chat-message-updated') {
          // Edit / delete / reaction / pin — replace the message in place.
          get().applyMessageUpdate(data.conversationId, data.message);
        } else if (data.type === 'chat-typing') {
          const key = String(data.conversationId);
          set((state) => ({
            typingUsers: {
              ...state.typingUsers,
              [key]: data.isTyping ? { userId: data.userId, userName: data.userName, at: Date.now() } : undefined
            }
          }));
          // Auto-clear if no stop signal arrives.
          if (data.isTyping) {
            setTimeout(() => {
              set((state) => {
                const entry = state.typingUsers[key];
                if (entry && Date.now() - entry.at >= 3900) {
                  return { typingUsers: { ...state.typingUsers, [key]: undefined } };
                }
                return state;
              });
            }, 4000);
          }
        } else if (data.type === 'chat-invite') {
          const { conversation } = data;
          set((state) => {
            // Check if it already exists to avoid duplicates
            if (state.conversations.some(c => c.id === conversation.id)) return state;
            
            // Show a native browser notification if permitted
            if (Notification.permission === 'granted') {
              new Notification('New Chat Invite', {
                body: `Someone wants to connect with you!`
              });
            }

            // Trigger callback for UI notification
            get().onInvite?.(conversation);

            return {
              conversations: [conversation, ...state.conversations]
            };
          });
        } else if (data.type === 'chat-conversation-updated') {
          const { conversation } = data;
          if (!conversation?.id) return;

          set((state) => {
            const exists = state.conversations.some(c => c.id === conversation.id);
            const conversations = exists
              ? state.conversations.map(c => c.id === conversation.id ? conversation : c)
              : [conversation, ...state.conversations];

            return { conversations };
          });

          get().onConversationEvent?.(data);
        } else if (data.type === 'chat-presence') {
          if (data.userId) {
            set((state) => ({
              onlineUsers: { ...state.onlineUsers, [data.userId]: !!data.online },
              lastSeenByUser: data.lastSeen
                ? { ...state.lastSeenByUser, [data.userId]: data.lastSeen }
                : state.lastSeenByUser,
            }));
          }
        } else if (data.type === 'chat-presence-snapshot') {
          set((state) => ({
            onlineUsers: { ...state.onlineUsers, ...(data.online || {}) },
            lastSeenByUser: { ...state.lastSeenByUser, ...(data.lastSeen || {}) },
          }));
        } else if (data.type === 'chat-conversation-removed') {
          const { conversationId } = data;
          if (!conversationId) return;

          set((state) => ({
            conversations: state.conversations.filter(c => c.id !== conversationId),
            activeChatId: state.activeChatId === conversationId ? null : state.activeChatId
          }));

          get().onConversationEvent?.(data);
        } else if (data.type === 'chat-session-invite') {
          get().onSessionInvite?.(data.invite);
        } else if (data.type === 'chat-read-receipt') {
          const { conversationId, userId, readAt } = data;
          if (!conversationId || !userId || !readAt) return;
          set((state) => ({
            readReceipts: {
              ...state.readReceipts,
              [conversationId]: {
                ...(state.readReceipts[conversationId] || {}),
                [userId]: readAt
              }
            }
          }));
        }
      } catch (err) {
        console.error('[ChatStore] Failed to parse message', err);
      }
    };

    ws.onclose = () => {
      console.log('[ChatStore] WebSocket disconnected');
      set({ ws: null });
      const attempt = get().reconnectAttempts + 1;
      set({ reconnectAttempts: attempt });
      const delay = Math.min(30000, 1000 * (2 ** Math.min(attempt, 5)));
      setTimeout(() => get().connectWebSocket(), delay);
    };

    set({ ws });
  },

  disconnectWebSocket: () => {
    const ws = get().ws;
    if (ws) {
      ws.onclose = null; // Prevent auto-reconnect
      ws.close();
      set({ ws: null });
    }
  }
}));
