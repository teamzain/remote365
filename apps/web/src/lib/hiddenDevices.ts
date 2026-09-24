export const getDeviceAccessKey = (device: any) =>
  String(device?.access_key || device?.accessKey || '').replace(/\D/g, '');

const storageKey = (userId?: string | null) =>
  `remote365_hidden_devices_${userId || 'default'}`;

export const getHiddenDeviceKeys = (userId?: string | null): Set<string> => {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const values = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(values)
        ? values.map((key) => String(key || '').replace(/\D/g, '')).filter(Boolean)
        : [],
    );
  } catch {
    return new Set<string>();
  }
};

export const setHiddenDeviceKeys = (userId: string | null | undefined, keys: Set<string>) => {
  localStorage.setItem(storageKey(userId), JSON.stringify(Array.from(keys).filter(Boolean)));
};
