export type MeetingUser = {
  id: string;
  email?: string;
  name?: string | null;
  avatar?: string | null;
};

export type MeetingItem = {
  id: string;
  name: string;
  displayCode?: string;
  sessionCode?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  isExpired?: boolean;
  /** Set when the meeting was created by SOMEONE ELSE — i.e. you were invited to it. */
  createdById?: string;
  createdByName?: string;
  /** Which of web's three kinds this is: 'instant' | 'later' | 'calendar'. */
  variant?: string;
};

export type MeetingKind = 'instant' | 'later' | 'calendar';

/** Same rule as web's Recent Meetings: the stored kind, else the link lifetime. */
export function getMeetingKind(meeting: MeetingItem): MeetingKind {
  const stored = String(meeting.variant || '').toLowerCase();
  if (stored === 'instant' || stored === 'later' || stored === 'calendar') return stored;
  const created = new Date(meeting.createdAt || Date.now()).getTime();
  const expires = meeting.expiresAt ? new Date(meeting.expiresAt).getTime() : created + 30 * 60 * 1000;
  return expires - created > 2 * 60 * 60 * 1000 ? 'later' : 'instant';
}

/** The web join link for a meeting on this app's server (same origin as the API). */
export function buildMeetingWebLink(apiBaseUrl: string, code: string) {
  const clean = String(code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${String(apiBaseUrl).replace(/\/+$/, '')}/meeting/${encodeURIComponent(clean)}`;
}

const toGoogleUtcStamp = (date: Date) => [
  date.getUTCFullYear(),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0'),
  'T',
  String(date.getUTCHours()).padStart(2, '0'),
  String(date.getUTCMinutes()).padStart(2, '0'),
  String(date.getUTCSeconds()).padStart(2, '0'),
  'Z',
].join('');

/**
 * Google Calendar "event template" link, the same one web opens: a prefilled
 * event in the user's own calendar with the meeting link, next full hour, 1 h.
 */
export function buildGoogleCalendarEventUrl(title: string, meetingLink: string, meetingCode: string) {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const query = [
    ['action', 'TEMPLATE'],
    ['text', title],
    ['dates', `${toGoogleUtcStamp(start)}/${toGoogleUtcStamp(end)}`],
    ['details', `Join the Remote365 meeting: ${meetingLink}\nMeeting code: ${meetingCode}`],
    ['location', meetingLink],
  ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `https://calendar.google.com/calendar/render?${query}`;
}

export type MeetingMediaPrefs = {
  audioOn: boolean;
  videoOn: boolean;
};

export const MEETING_PREF_KEYS = {
  audio: 'remote365_meeting_pref_audio_enabled',
  video: 'remote365_meeting_pref_video_enabled',
} as const;

export function normalizeMeetingCode(value: string) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function formatMeetingCode(value: string) {
  const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length === 9) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
  return clean || String(value || '').trim();
}

export function extractMeetingCode(value: string) {
  const trimmed = String(value || '').trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get('code')
      || parsed.pathname.split('/').filter(Boolean).pop()
      || trimmed;
  } catch {
    return trimmed;
  }
}

export function mapMeetingItem(row: any): MeetingItem {
  return {
    id: String(row.id || ''),
    name: row.name || 'Remote 365 meeting',
    displayCode: row.displayCode || row.sessionCode,
    sessionCode: row.sessionCode,
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    isExpired: Boolean(row.isExpired),
    createdById: row.createdById ? String(row.createdById) : (row.createdBy?.id ? String(row.createdBy.id) : undefined),
    createdByName: row.createdBy?.name || row.createdBy?.email || undefined,
    variant: row.variant || undefined,
  };
}

export function isMeetingJoinable(meeting: MeetingItem) {
  const status = String(meeting.status || 'ACTIVE').toUpperCase();
  const expiresAt = meeting.expiresAt ? new Date(meeting.expiresAt).getTime() : 0;
  return status === 'ACTIVE' || status === 'IN_PROGRESS'
    ? !meeting.isExpired && (!expiresAt || expiresAt > Date.now())
    : false;
}

export function buildSignalUrl(apiBaseUrl: string) {
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  url.pathname = '/api/signal';
  url.search = '';
  url.hash = '';
  return url.toString();
}
