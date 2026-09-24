const START_WITH_WINDOWS_KEYS = [
  'pref_start_with_windows',
  'remote365_start_with_windows'
];

export const readStartWithWindowsPreference = (fallback = false) => {
  for (const key of START_WITH_WINDOWS_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) return value === 'true';
  }
  return fallback;
};

export const persistStartWithWindowsPreference = (enabled: boolean) => {
  for (const key of START_WITH_WINDOWS_KEYS) {
    localStorage.setItem(key, String(enabled));
  }
};

export const applyStartWithWindowsPreference = async (enabled: boolean) => {
  persistStartWithWindowsPreference(enabled);

  const electronApi = (window as any).electronAPI;
  if (!electronApi?.setStartWithWindows) return enabled;

  try {
    const result = await electronApi.setStartWithWindows(enabled);
    const actual = typeof result === 'boolean'
      ? result
      : Boolean(result?.openAtLogin ?? enabled);
    persistStartWithWindowsPreference(actual);
    return actual;
  } catch (error) {
    console.error('[StartupPreferences] Failed to update Windows startup setting:', error);
    return enabled;
  }
};
