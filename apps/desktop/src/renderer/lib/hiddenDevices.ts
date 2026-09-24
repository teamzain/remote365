/**
 * Locally-archived ("hidden") devices. Archiving a device only hides it on this
 * install: the access keys are remembered in localStorage per signed-in user,
 * and every device list (main Devices page, admin settings) filters against
 * them. Restoring from the Archived Devices modal removes the key again.
 */

export const getDeviceAccessKey = (device: any) =>
  String(device?.access_key || device?.accessKey || '').replace(/\D/g, '');

export const hiddenDevicesStorageKey = (userId?: string | null) =>
  `remote365_hidden_devices_${userId || 'default'}`;

export const getHiddenDeviceKeys = (userId?: string | null): Set<string> => {
  try {
    const raw = localStorage.getItem(hiddenDevicesStorageKey(userId));
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.map((key) => String(key || '').replace(/\D/g, '')).filter(Boolean) : []);
  } catch {
    return new Set<string>();
  }
};

export const setHiddenDeviceKeys = (userId: string | null | undefined, keys: Set<string>) => {
  localStorage.setItem(hiddenDevicesStorageKey(userId), JSON.stringify(Array.from(keys).filter(Boolean)));
};
