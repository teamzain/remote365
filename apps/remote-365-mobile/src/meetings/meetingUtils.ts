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
};

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
