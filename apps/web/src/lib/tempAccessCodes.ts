/**
 * Local record of the one-time access codes generated on THIS machine.
 *
 * The server only ever stores a hash of each code and returns the plaintext
 * once, at creation. To let the owner re-view a code they generated (until it
 * expires) and to announce expiry, we keep a plaintext copy in localStorage on
 * the machine that made it — the same machine already holds full control of the
 * device, so this leaks nothing new. Codes are pruned once they expire.
 */

export interface StoredTempCode {
  id: string;
  code: string;        // full plaintext, e.g. "GY6-YGQ"
  deviceId: string;
  expiresAt: string;   // ISO timestamp
  notified?: boolean;  // expiry already announced (defensive; expired ones are pruned)
}

const KEY = 'remote365_temp_access_codes';

const readAll = (): StoredTempCode[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const writeAll = (list: StoredTempCode[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
};

export const addTempCode = (entry: StoredTempCode) => {
  const list = readAll().filter((c) => c.id !== entry.id);
  list.push(entry);
  writeAll(list);
};

export const removeTempCode = (id: string) => {
  writeAll(readAll().filter((c) => c.id !== id));
};

/** Active (unexpired) codes for a device, newest expiry first. */
export const getActiveTempCodes = (deviceId: string): StoredTempCode[] => {
  const now = Date.now();
  return readAll()
    .filter((c) => c.deviceId === deviceId && new Date(c.expiresAt).getTime() > now)
    .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
};

/**
 * For the global expiry watcher: returns codes that have just expired (and were
 * not announced yet), then prunes ALL expired codes from storage so each is
 * announced at most once.
 */
export const collectExpiredTempCodes = (): StoredTempCode[] => {
  const now = Date.now();
  const list = readAll();
  const expired: StoredTempCode[] = [];
  const keep: StoredTempCode[] = [];
  for (const c of list) {
    if (new Date(c.expiresAt).getTime() <= now) {
      if (!c.notified) expired.push(c);
    } else {
      keep.push(c);
    }
  }
  if (keep.length !== list.length) writeAll(keep);
  return expired;
};
