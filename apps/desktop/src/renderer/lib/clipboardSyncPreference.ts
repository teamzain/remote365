// "Sync Clipboard Automatically" — the one switch behind viewer↔host clipboard
// sync during a remote session. The session toolbar toggles it, App.tsx's
// per-session poller and the incoming clipboard handler read it, and it is
// remembered across sessions in localStorage. Default ON (the historical
// behaviour); before this existed the toggle was cosmetic and the poller ran
// unconditionally.
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'remote365.clipboardSync';

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

let enabled = read();

export function isClipboardSyncEnabled(): boolean {
  return enabled;
}

export function setClipboardSyncEnabled(next: boolean): void {
  if (enabled === next) return;
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // Preference still applies for this session even if it cannot be persisted.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeClipboardSync(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useClipboardSyncPreference(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(subscribeClipboardSync, isClipboardSyncEnabled);
  return [value, setClipboardSyncEnabled];
}
