import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persisted app-settings preferences. Every value is stored under a stable key
 * so a setting survives restarts, and the {@link useSetting} hook keeps the UI
 * in sync. Only settings that actually influence the app live here — no
 * decorative rows.
 */
const PREFIX = 'remote365_setting_';

export const SETTING_KEYS = {
  chatNotifications: 'chat.notifications',
  chatPreviews: 'chat.previews',
  chatAutoDownload: 'chat.autoDownload', // 'wifi' | 'always' | 'never'
  controlPointerMode: 'control.pointerMode', // 'touch' | 'trackpad'
  controlKeyboard: 'control.keyboard',
  controlAskBeforeControl: 'control.askBeforeControl',
  streamingQuality: 'streaming.quality', // 'auto' | 'smooth' | 'hd'
  privacyHidePreviews: 'privacy.hidePreviews',
  keepPresenceOnline: 'app.keepPresenceOnline',
  biometricEnabled: 'security.biometric',
  biometricLockDelay: 'security.lockDelay', // 'immediate' | '1m' | '5m' | '15m'
} as const;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore write failures — the in-memory value still applies this session */
  }
}

/**
 * Read + persist a single setting. Returns [value, setValue, loaded]; `loaded`
 * is false until the stored value has been read so callers can avoid flashing
 * the default.
 */
export function useSetting<T>(key: string, fallback: T): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getSetting<T>(key, fallback).then((stored) => {
      if (!active) return;
      setValue(stored);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
    // fallback is intentionally excluded — the key identifies the setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      void setSetting(key, next);
    },
    [key],
  );

  return [value, update, loaded];
}

/** Cache keys that "Clear local cache" is allowed to wipe (never auth/prefs). */
const CACHE_KEY_PATTERNS = ['remote365_cache_', 'remote365_recent_', 'remote365_chat_draft_'];

export async function clearLocalCache(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => CACHE_KEY_PATTERNS.some((p) => k.startsWith(p)));
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
    return toRemove.length;
  } catch {
    return 0;
  }
}
