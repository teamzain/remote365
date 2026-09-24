export const normalizeMeetingCode = (value: string) =>
  String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

// Support-session invites: /join/<code> hands off to the desktop app (which
// is what actually shares a computer) or offers the download.
export const buildWebSessionJoinUrl = (code: string) => {
  const cleanCode = String(code || '').replace(/\D/g, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/join/${encodeURIComponent(cleanCode)}`;
};

export const buildWebMeetingUrl = (code: string) => {
  const cleanCode = normalizeMeetingCode(code);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/meeting/${encodeURIComponent(cleanCode)}`;
};
