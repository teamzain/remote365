// Landing-page meeting history: the codes this machine joined or created from
// the Meeting tab while signed out. (Signed in, the Meetings page shows the
// account's server-backed Recent Meetings instead.)
const STORAGE_KEY = 'remote365_recent_meetings';
const MAX_ENTRIES = 8;
// Same window the signed-in Recent Meetings list uses for ended meetings.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface RecentMeeting {
  /** Bare code, letters and digits only, upper-cased. */
  code: string;
  role: 'joined' | 'created';
  lastUsedAt: string;
}

const cleanMeetingCode = (raw: string | null | undefined): string =>
  String(raw || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);

/** 123-456-789 style, the same grouping the landing input shows. */
export const formatRecentMeetingCode = (raw: string | null | undefined): string => {
  const clean = cleanMeetingCode(raw);
  return (clean.match(/.{1,3}/g) || [clean]).join('-');
};

/** Not used for a day (or carrying an unreadable date): kept in the list, shown inactive. */
export const isRecentMeetingExpired = (entry: RecentMeeting): boolean =>
  !(Date.parse(entry.lastUsedAt) > Date.now() - MAX_AGE_MS);

const safeParse = (raw: string | null): RecentMeeting[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry) => entry && typeof entry.code === 'string' && (entry.role === 'joined' || entry.role === 'created'))
      : [];
  } catch {
    return [];
  }
};

export const getRecentMeetings = (): RecentMeeting[] => {
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
};

const persist = (next: RecentMeeting[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[recentMeetings] Failed to persist', err);
  }
};

export const recordRecentMeeting = (code: string, role: RecentMeeting['role']): RecentMeeting[] => {
  const clean = cleanMeetingCode(code);
  if (!clean) return getRecentMeetings();
  const next: RecentMeeting[] = [
    { code: clean, role, lastUsedAt: new Date().toISOString() },
    ...getRecentMeetings().filter((entry) => entry.code !== clean),
  ].slice(0, MAX_ENTRIES);
  persist(next);
  return next;
};

export const removeRecentMeeting = (code: string): RecentMeeting[] => {
  const clean = cleanMeetingCode(code);
  const next = getRecentMeetings().filter((entry) => entry.code !== clean);
  persist(next);
  return next;
};
