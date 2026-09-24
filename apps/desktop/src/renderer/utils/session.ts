// Session-invite encoding helpers (extracted from App.tsx, behaviour unchanged).

export const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';

export const parseSessionInviteContent = (content: string) => {
  if (!content?.startsWith(SESSION_INVITE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SESSION_INVITE_PREFIX.length));
  } catch {
    return null;
  }
};
