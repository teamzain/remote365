// Quick Connect history: the devices this account connected to BY ID (Quick
// Connect page, the top search bar, the dashboard recent list). Sessions
// started from the Devices table are deliberately NOT recorded here; that
// page has its own server-backed "Recent Connections" filter.
const STORAGE_KEY = 'remote365_recent_connections';
const MAX_ENTRIES = 8;
// Entries written before the source tag existed were a mix of Quick Connect
// and Devices-page sessions that cannot be told apart, so only tagged entries
// are read back; untagged legacy ones drop off on the next write.
const QUICK_CONNECT_SOURCE = 'quick-connect' as const;

export interface RecentConnection {
  accessKey: string;
  name?: string;
  avatar?: string | null;
  lastConnectedAt: string;
  source: typeof QUICK_CONNECT_SOURCE;
}

const getStorageKey = (accountKey?: string | null) => {
  const clean = String(accountKey || '').trim().toLowerCase();
  return clean ? `${STORAGE_KEY}:${clean}` : STORAGE_KEY;
};

const safeParse = (raw: string | null): RecentConnection[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry) => entry && typeof entry.accessKey === 'string' && entry.source === QUICK_CONNECT_SOURCE)
      : [];
  } catch {
    return [];
  }
};

export const formatAccessKey = (raw: string | null | undefined): string => {
  if (!raw) return '--- --- ---';
  const clean = String(raw).replace(/\D/g, '');
  if (!clean) return raw;
  return (clean.match(/.{1,3}/g) || [clean]).join(' ');
};

export const getRecentConnections = (accountKey?: string | null): RecentConnection[] => {
  const scoped = safeParse(localStorage.getItem(getStorageKey(accountKey)));
  if (scoped.length > 0 || accountKey) return scoped;
  return safeParse(localStorage.getItem(STORAGE_KEY));
};

export const recordRecentConnection = (accessKey: string, name?: string, avatar?: string | null, accountKey?: string | null): RecentConnection[] => {
  const cleanKey = String(accessKey || '').replace(/\D/g, '');
  if (!cleanKey) return getRecentConnections(accountKey);
  const existing = getRecentConnections(accountKey).filter((entry) => entry.accessKey !== cleanKey);
  const next: RecentConnection[] = [
    { accessKey: cleanKey, name: name?.trim() || undefined, avatar: avatar || undefined, lastConnectedAt: new Date().toISOString(), source: QUICK_CONNECT_SOURCE },
    ...existing,
  ].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(getStorageKey(accountKey), JSON.stringify(next));
  } catch (err) {
    console.warn('[recentConnections] Failed to persist', err);
  }
  return next;
};

// Every list on this machine (signed-out plus each account), newest first.
// The landing page shows this: it is signed out, but the user is the same
// person who connected while signed in.
const listStorageKeys = (): string[] => {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key === STORAGE_KEY || key.startsWith(`${STORAGE_KEY}:`))) keys.push(key);
    }
  } catch {}
  return keys;
};

export const getAllRecentConnections = (): RecentConnection[] => {
  const newest = new Map<string, RecentConnection>();
  for (const key of listStorageKeys()) {
    for (const entry of safeParse(localStorage.getItem(key))) {
      const current = newest.get(entry.accessKey);
      if (!current || entry.lastConnectedAt > current.lastConnectedAt) newest.set(entry.accessKey, entry);
    }
  }
  return [...newest.values()]
    .sort((a, b) => b.lastConnectedAt.localeCompare(a.lastConnectedAt))
    .slice(0, MAX_ENTRIES);
};

export const removeRecentConnectionEverywhere = (accessKey: string): RecentConnection[] => {
  const cleanKey = String(accessKey || '').replace(/\D/g, '');
  for (const key of listStorageKeys()) {
    const kept = safeParse(localStorage.getItem(key)).filter((entry) => entry.accessKey !== cleanKey);
    try {
      localStorage.setItem(key, JSON.stringify(kept));
    } catch (err) {
      console.warn('[recentConnections] Failed to persist', err);
    }
  }
  return getAllRecentConnections();
};

export const removeRecentConnection = (accessKey: string, accountKey?: string | null): RecentConnection[] => {
  const cleanKey = String(accessKey || '').replace(/\D/g, '');
  const next = getRecentConnections(accountKey).filter((entry) => entry.accessKey !== cleanKey);
  try {
    localStorage.setItem(getStorageKey(accountKey), JSON.stringify(next));
  } catch (err) {
    console.warn('[recentConnections] Failed to persist', err);
  }
  return next;
};

export const clearRecentConnections = (accountKey?: string | null) => {
  try {
    localStorage.removeItem(getStorageKey(accountKey));
  } catch {}
};
