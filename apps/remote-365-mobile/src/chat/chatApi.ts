// REST + type helpers for mobile chat. Mirrors the desktop chat data shapes so
// the same auth-service endpoints back both clients.

export const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';

export type ChatMessage = {
  id: string;
  conversationId?: string;
  senderId: string;
  content: string;
  createdAt: string;
  clientMessageId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinned?: boolean;
  reactions?: Record<string, string[]> | null;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content?: string;
    senderId?: string;
    attachmentName?: string | null;
    sender?: { name?: string | null; email?: string | null };
  } | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  sender?: { id: string; name?: string | null; email?: string | null; avatar?: string | null };
  pending?: boolean;
};

export type ChatParticipant = {
  userId: string;
  muted?: boolean;
  user?: { id: string; name?: string | null; email?: string | null; avatar?: string | null };
};

export type ChatConversation = {
  id: string;
  name?: string | null;
  isGroup?: boolean;
  status?: string;
  updatedAt?: string;
  participants?: ChatParticipant[];
  messages?: ChatMessage[];
  unreadCount?: number;
};

export async function chatFetch<T>(
  apiBaseUrl: string,
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  // Only declare a JSON body when there IS one. Fastify rejects a request that
  // says `Content-Type: application/json` and then sends nothing ("Body cannot be
  // empty when content-type is set to 'application/json'"), which is exactly what
  // body-less POSTs like accept/reject-invite were doing — so Accept and Decline
  // failed every time, and until the error was surfaced it looked like the
  // buttons simply did nothing.
  const hasBody = options.body !== undefined && options.body !== null;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || data?.message || 'Request failed');
  return data as T;
}

export function fetchConversationMessages(
  apiBaseUrl: string,
  conversationId: string,
  accessToken?: string | null,
) {
  return chatFetch<ChatMessage[]>(apiBaseUrl, `/api/chat/conversations/${conversationId}/messages`, {}, accessToken);
}

/** Accept a pending contact request (recipient side). */
export function acceptInvite(apiBaseUrl: string, conversationId: string, accessToken?: string | null) {
  return chatFetch(apiBaseUrl, `/api/chat/conversations/${conversationId}/accept`, { method: 'POST' }, accessToken);
}

/** Decline a pending contact request (recipient side). */
export function rejectInvite(apiBaseUrl: string, conversationId: string, accessToken?: string | null) {
  return chatFetch(apiBaseUrl, `/api/chat/conversations/${conversationId}/reject`, { method: 'POST' }, accessToken);
}

/** Upload a chat attachment (base64) and get back its stored URL + metadata. */
export function uploadChatFile(
  apiBaseUrl: string,
  file: { name: string; type: string; base64: string },
  accessToken?: string | null,
): Promise<{ url: string; name: string; type: string; size: number }> {
  return chatFetch(
    apiBaseUrl,
    '/api/chat/uploads',
    { method: 'POST', body: JSON.stringify({ name: file.name, type: file.type, data: file.base64 }) },
    accessToken,
  );
}

/** Delete one of your own messages (soft delete → renders as "Message deleted"). */
export function deleteMessage(apiBaseUrl: string, messageId: string, accessToken?: string | null) {
  return chatFetch(apiBaseUrl, `/api/chat/messages/${messageId}`, { method: 'DELETE' }, accessToken);
}

/** Edit one of your own messages; the server stamps editedAt and broadcasts the update. */
export function editMessage(
  apiBaseUrl: string,
  messageId: string,
  content: string,
  accessToken?: string | null,
) {
  return chatFetch<ChatMessage>(apiBaseUrl, `/api/chat/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  }, accessToken);
}

/** Mute/unmute notifications for this conversation (current user only). */
export function muteConversation(
  apiBaseUrl: string,
  conversationId: string,
  muted: boolean,
  accessToken?: string | null,
) {
  return chatFetch(apiBaseUrl, `/api/chat/conversations/${conversationId}/mute`, {
    method: 'POST',
    body: JSON.stringify({ muted }),
  }, accessToken);
}

export function reactToMessage(
  apiBaseUrl: string,
  messageId: string,
  emoji: string,
  accessToken?: string | null,
) {
  return chatFetch<ChatMessage>(apiBaseUrl, `/api/chat/messages/${messageId}/react`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  }, accessToken);
}

/** Block the other person in a conversation. */
export function blockConversation(apiBaseUrl: string, conversationId: string, accessToken?: string | null) {
  return chatFetch(apiBaseUrl, `/api/chat/conversations/${conversationId}/block`, { method: 'POST' }, accessToken);
}

/** Unblock a previously-blocked conversation. */
export function unblockConversation(apiBaseUrl: string, conversationId: string, accessToken?: string | null) {
  return chatFetch(apiBaseUrl, `/api/chat/conversations/${conversationId}/unblock`, { method: 'POST' }, accessToken);
}

/** Remove the other person from your contacts (and delete the conversation). */
export function unfriendConversation(apiBaseUrl: string, conversationId: string, accessToken?: string | null) {
  return chatFetch(apiBaseUrl, `/api/chat/conversations/${conversationId}/unfriend`, { method: 'POST' }, accessToken);
}

/** Delete / leave a conversation for the current user. */
export function deleteConversation(apiBaseUrl: string, conversationId: string, accessToken?: string | null) {
  return chatFetch(apiBaseUrl, `/api/chat/conversations/${conversationId}`, { method: 'DELETE' }, accessToken);
}

export function createMeetingSessionInvite(
  apiBaseUrl: string,
  input: {
    conversationId: string;
    sessionName: string;
  },
  accessToken?: string | null,
): Promise<{ message?: ChatMessage | null; remoteSession?: any }> {
  return chatFetch(apiBaseUrl, '/api/chat/session-invites', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: input.conversationId,
      sessionName: input.sessionName,
      sessionCode: '',
      sessionPassword: '',
      sessionLink: '',
      type: 'VIDEO_MEETING',
    }),
  }, accessToken);
}

export function conversationDisplayName(conversation: ChatConversation, selfId?: string): string {
  if (conversation.name) return conversation.name;
  const other = conversation.participants?.find((p) => p.userId !== selfId)?.user
    || conversation.participants?.[0]?.user;
  return other?.name || other?.email || 'Conversation';
}

export function structuredMessagePreview(content?: string): string | null {
  const payload = parseSessionInvite(content);
  if (!payload) return null;
  if (payload.kind === 'meeting-status' || payload.kind === 'remote-session-status') {
    return payload.text || 'Session status updated.';
  }
  if (payload.kind === 'meeting-invite-response') {
    return `${payload.responderName || 'Someone'} ${payload.accepted ? 'accepted' : 'declined'} the meeting invite.`;
  }
  if (payload.sessionType === 'VIDEO_MEETING') return 'Video meeting invite';
  return 'Remote session invite';
}

export function messagePreview(message?: ChatMessage): string {
  if (!message) return 'No messages yet.';
  if (message.deletedAt) return 'Message deleted';
  const structuredPreview = structuredMessagePreview(message.content);
  if (structuredPreview) return structuredPreview;
  if (!message.content && message.attachmentName) return `📎 ${message.attachmentName}`;
  return message.content || 'No messages yet.';
}

// Structured session-invite payloads are embedded in message content.
export function parseSessionInvite(content?: string): any | null {
  if (!content || !content.startsWith(SESSION_INVITE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SESSION_INVITE_PREFIX.length));
  } catch {
    return null;
  }
}

// Device mentions travel as "@[Device Name](device:ACCESSKEY)" — the same
// token format the desktop chat writes and renders as clickable chips.
export const DEVICE_MENTION_REGEX = /@\[([^\]]+)\]\(device:([^)]+)\)/g;

/** Replace typed "@Name" mentions with device tokens (longest names first). */
export function tokenizeDeviceMentions(content: string, mentions: Record<string, string>): string {
  let out = content;
  for (const [name, key] of Object.entries(mentions).sort((a, b) => b[0].length - a[0].length)) {
    out = out.split(`@${name}`).join(`@[${name}](device:${key})`);
  }
  return out;
}

/** Human-readable text with mention tokens collapsed back to "@Name". */
export function humanizeDeviceMentions(text?: string | null): string {
  return String(text || '').replace(DEVICE_MENTION_REGEX, '@$1');
}

export function createClientMessageId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function attachmentSrc(apiBaseUrl: string, url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBaseUrl}${url}`;
}
