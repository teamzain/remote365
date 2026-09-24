// Which devices this browser currently has an open remote session with.
//
// The desktop app asks its main process (electronAPI.viewers.getActive/
// onActiveChanged) — it owns every viewer window, so the Devices page gets a
// true "In Active Session" count for free. The web viewer instead runs in its
// OWN browser tab (sessionLauncher opens /session/<key> via window.open), so
// the dashboard tab holds no reference to it and the count was hard-coded to 0.
// localStorage + BroadcastChannel reproduce the same answer across tabs:
// localStorage so a dashboard opened AFTER a session still sees it, the channel
// so updates land instantly rather than on the next poll.
//
// Entries are heartbeated and carry a timestamp, because the one thing worse
// than a missing count is a stuck one: a session tab killed abruptly (crash,
// browser quit, force-close) never runs its cleanup, and without expiry it
// would advertise a phantom session forever.

const STORE_KEY = 'remote365_active_sessions';
const CHANNEL_NAME = 'remote365:active-sessions';
const HEARTBEAT_MS = 4000;
/** Three missed heartbeats — long enough to ride out a busy/throttled tab. */
const STALE_MS = 13000;

type Entry = { key: string; at: number };

const normalize = (value?: string) => String(value || '').replace(/\s/g, '');

const openChannel = (): BroadcastChannel | null => {
  try {
    return typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
  } catch {
    return null;
  }
};

function readEntries(): Entry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - STALE_MS;
    return parsed
      .map((entry: any) => ({ key: normalize(entry?.key), at: Number(entry?.at) || 0 }))
      .filter((entry: Entry) => entry.key && entry.at > cutoff);
  } catch {
    return [];
  }
}

function writeEntries(entries: Entry[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(entries));
  } catch {
    /* private mode / quota — the count degrades to 0, never breaks the page */
  }
}

/** Access keys with a live session right now, newest heartbeat wins. */
export function getActiveSessionKeys(): string[] {
  return Array.from(new Set(readEntries().map((entry) => entry.key)));
}

/**
 * Announce that this tab is running a session against `deviceKey`, until the
 * returned function is called. Safe to call with an empty key (no-op).
 */
export function publishActiveSession(deviceKey: string): () => void {
  const key = normalize(deviceKey);
  if (!key) return () => {};

  const channel = openChannel();
  const announce = () => {
    const others = readEntries().filter((entry) => entry.key !== key);
    writeEntries([...others, { key, at: Date.now() }]);
    try { channel?.postMessage({ type: 'changed' }); } catch { /* channel closed */ }
  };

  announce();
  const timer = setInterval(announce, HEARTBEAT_MS);

  // pagehide fires for tab close, navigation AND bfcache on mobile Safari,
  // where beforeunload is unreliable. Belt and braces: the heartbeat expiry
  // still covers a hard kill that runs neither.
  const onPageHide = () => retract();
  let retracted = false;
  const retract = () => {
    if (retracted) return;
    retracted = true;
    clearInterval(timer);
    window.removeEventListener('pagehide', onPageHide);
    writeEntries(readEntries().filter((entry) => entry.key !== key));
    try {
      channel?.postMessage({ type: 'changed' });
      channel?.close();
    } catch { /* already closed */ }
  };
  window.addEventListener('pagehide', onPageHide);

  return retract;
}

/**
 * Watch the live set. Fires immediately with the current keys, then on every
 * change from any tab, plus a slow tick that retires stale entries so a count
 * left behind by a crashed tab clears itself.
 */
export function subscribeActiveSessions(listener: (keys: string[]) => void): () => void {
  let previous = '';
  const emit = () => {
    const keys = getActiveSessionKeys();
    const signature = keys.slice().sort().join(',');
    if (signature === previous) return; // no churn for identical heartbeats
    previous = signature;
    listener(keys);
  };

  // Prime synchronously so the first render isn't a flash of 0.
  previous = getActiveSessionKeys().slice().sort().join(',');
  listener(getActiveSessionKeys());

  const channel = openChannel();
  if (channel) channel.onmessage = emit;
  const onStorage = (event: StorageEvent) => { if (!event.key || event.key === STORE_KEY) emit(); };
  window.addEventListener('storage', onStorage);
  const timer = setInterval(emit, HEARTBEAT_MS);

  return () => {
    clearInterval(timer);
    window.removeEventListener('storage', onStorage);
    try { channel?.close(); } catch { /* already closed */ }
  };
}
