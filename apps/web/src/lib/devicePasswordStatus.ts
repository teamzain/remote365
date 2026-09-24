const UPDATE_KEY = 'r365_devices_need_password_update';
const REMEMBERED_KEY = 'r365_remembered_devices';

const normalize = (accessKey: string) => String(accessKey || '').replace(/\s/g, '');

const read = (key: string): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const write = (key: string, values: string[]) => {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(values.filter(Boolean)))));
};

export const deviceNeedsPasswordUpdate = (accessKey: string) =>
  read(UPDATE_KEY).includes(normalize(accessKey));

export const markDeviceNeedsPasswordUpdate = (accessKey: string) => {
  const key = normalize(accessKey);
  if (key) write(UPDATE_KEY, [...read(UPDATE_KEY), key]);
};

export const clearDeviceNeedsPasswordUpdate = (accessKey: string) => {
  const key = normalize(accessKey);
  write(UPDATE_KEY, read(UPDATE_KEY).filter((value) => value !== key));
};

export const isDeviceRemembered = (accessKey: string) =>
  read(REMEMBERED_KEY).includes(normalize(accessKey));

export const markDeviceRemembered = (accessKey: string) => {
  const key = normalize(accessKey);
  if (key) write(REMEMBERED_KEY, [...read(REMEMBERED_KEY), key]);
};

export const clearDeviceRemembered = (accessKey: string) => {
  const key = normalize(accessKey);
  write(REMEMBERED_KEY, read(REMEMBERED_KEY).filter((value) => value !== key));
};
