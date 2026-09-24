const STORAGE_KEY = 'remote365_recent_connections';
const MAX_ENTRIES = 8;

export interface RecentConnection {
  accessKey: string;
  name?: string;
  avatar?: string;
  lastConnectedAt: string;
}

const safeParse = (raw: string | null): RecentConnection[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.accessKey === 'string') : [];
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

export const getRecentConnections = (): RecentConnection[] => {
  return safeParse(localStorage.getItem(STORAGE_KEY));
};

export const recordRecentConnection = (accessKey: string, name?: string): RecentConnection[] => {
  const cleanKey = String(accessKey || '').replace(/\D/g, '');
  if (!cleanKey) return getRecentConnections();
  const existing = getRecentConnections().filter((entry) => entry.accessKey !== cleanKey);
  const next: RecentConnection[] = [
    { accessKey: cleanKey, name: name?.trim() || undefined, lastConnectedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[recentConnections] Failed to persist', err);
  }
  return next;
};

export const removeRecentConnection = (accessKey: string): RecentConnection[] => {
  const cleanKey = String(accessKey || '').replace(/\D/g, '');
  const next = getRecentConnections().filter((entry) => entry.accessKey !== cleanKey);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[recentConnections] Failed to persist', err);
  }
  return next;
};
