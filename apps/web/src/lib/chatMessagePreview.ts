// Turns an incoming chat message into the title/preview the notification
// centre, the snackbar and the browser notification all show. Mirrors the
// desktop App's onNewMessage wording so a message reads the same on both.

export const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';

export const parseSessionInviteContent = (content: string): any | null => {
  if (!content?.startsWith(SESSION_INVITE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SESSION_INVITE_PREFIX.length));
  } catch {
    return null;
  }
};

// Device mentions travel inside the plain message text as
// "@[Device Name](device:ACCESSKEY)"; previews show "@Device Name".
const DEVICE_MENTION_REGEX = /@\[([^\]\n]{1,80})\]\(device:([A-Za-z0-9]{4,24})\)/g;
export const stripDeviceMentionTokens = (text?: string | null) =>
  String(text || '').replace(DEVICE_MENTION_REGEX, '@$1');

export interface MessageNotification {
  title: string;
  preview: string;
  kind: 'message' | 'session' | 'accepted';
  /** Where clicking the entry goes. */
  target: Record<string, any>;
  /** True for a live meeting invite: click should join, not open the chat. */
  isSessionEvent: boolean;
}

export const describeIncomingMessage = (msg: any, conversationId: string): MessageNotification => {
  const senderName = msg?.sender?.name || msg?.sender?.email || 'Someone';
  const event = parseSessionInviteContent(String(msg?.content || ''));
  const attachmentName = msg?.attachmentName ? String(msg.attachmentName) : '';
  const attachmentType = String(msg?.attachmentType || '');

  const title = event?.kind === 'remote-access-request'
    ? 'Remote Access Request Received'
    : event?.kind === 'remote-access-response'
      ? `Remote access request ${event.approved ? 'accepted' : 'declined'}`
      : event?.kind === 'meeting-invite-response'
        ? `Meeting invite ${event.accepted ? 'accepted' : 'declined'}`
        : event?.sessionType === 'VIDEO_MEETING'
          ? 'Meeting Invite Received'
          : event
            ? 'Remote Session Invite Received'
            : `New message from ${senderName}`;

  const textPreview = stripDeviceMentionTokens(msg?.content).slice(0, 100)
    || (attachmentType.startsWith('image/') ? `${senderName} sent a photo`
      : attachmentType.startsWith('audio/') ? `${senderName} sent a voice message`
        : attachmentName ? `${senderName} sent ${attachmentName}` : `${senderName} sent a message`);

  const preview = event?.kind === 'remote-access-request'
    ? `${senderName} requested access to your computer.`
    : event?.kind === 'remote-access-response'
      ? `${senderName} ${event.approved ? 'accepted' : 'declined'} your remote access request.`
      : event?.kind === 'meeting-invite-response'
        ? `${event.responderName || senderName} ${event.accepted ? 'accepted' : 'declined'} your meeting invite.`
        : event
          ? `${senderName} invited you to join ${event.sessionName || (event.sessionType === 'VIDEO_MEETING' ? 'a meeting' : 'a remote session')}.`
          : textPreview;

  const isAcceptedResponse = (event?.kind === 'remote-access-response' && event.approved)
    || (event?.kind === 'meeting-invite-response' && event.accepted);
  const kind = event ? (isAcceptedResponse ? 'accepted' : 'session') : 'message';

  const isMeetingInvite = event?.sessionType === 'VIDEO_MEETING'
    && event?.kind !== 'meeting-invite-response'
    && Boolean(event?.sessionCode);
  const target = isMeetingInvite
    ? { view: 'meetings', meetingId: event.sessionCode }
    : { view: 'chat', chatId: conversationId };

  return { title, preview, kind, target, isSessionEvent: Boolean(event) };
};
