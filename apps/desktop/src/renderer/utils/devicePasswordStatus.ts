// Tracks remote devices whose access password no longer works (typically because
// the host changed it). The flag drives an "Update password" hint on the device
// row and is persisted so it survives reloads. Keyed by normalized access key.

const STORAGE_KEY = 'r365_devices_need_password_update';

const normalize = (accessKey: string) => String(accessKey || '').replace(/\s/g, '');

const read = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const write = (keys: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(keys))));
  } catch {
    /* localStorage unavailable — ignore */
  }
};

export const getDevicesNeedingPasswordUpdate = (): string[] => read();

export const deviceNeedsPasswordUpdate = (accessKey: string): boolean =>
  read().includes(normalize(accessKey));

export const markDeviceNeedsPasswordUpdate = (accessKey: string): string[] => {
  const key = normalize(accessKey);
  if (!key) return read();
  const next = Array.from(new Set([...read(), key]));
  write(next);
  return next;
};

export const clearDeviceNeedsPasswordUpdate = (accessKey: string): string[] => {
  const key = normalize(accessKey);
  const next = read().filter((existing) => existing !== key);
  write(next);
  return next;
};

// Tracks devices this viewer has connected to WITHOUT a password prompt — i.e.
// "Remember this machine" was on, or the host granted Easy Access. A later 401 on
// such a device means the host rotated its password (trust was dropped), so we can
// show the "password changed" hint. A device that was never remembered simply needs
// its password each time (no "changed" wording).
const REMEMBERED_KEY = 'r365_remembered_devices';

const readRemembered = (): string[] => {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const writeRemembered = (keys: string[]) => {
  try {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(Array.from(new Set(keys))));
  } catch {
    /* localStorage unavailable — ignore */
  }
};

export const isDeviceRemembered = (accessKey: string): boolean =>
  readRemembered().includes(normalize(accessKey));

export const markDeviceRemembered = (accessKey: string): void => {
  const key = normalize(accessKey);
  if (!key) return;
  writeRemembered([...readRemembered(), key]);
};

export const clearDeviceRemembered = (accessKey: string): void => {
  const key = normalize(accessKey);
  writeRemembered(readRemembered().filter((existing) => existing !== key));
};
