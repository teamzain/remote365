// Landing "Remote365 Options" switches that the rest of the app must honour.
// Two of them used to write keys nobody read (the switch looked live but did
// nothing); each one now maps to the flag the behaviour actually checks.

// Connection alerts share the key the signed-in Settings already use for
// "Session Started" notifications, so both UIs move together.
export const CONNECTION_ALERTS_KEY = 'pref_notify_session';

export const areConnectionAlertsEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(CONNECTION_ALERTS_KEY) !== 'false';
};

export const setConnectionAlertsEnabled = (enabled: boolean) => {
  localStorage.setItem(CONNECTION_ALERTS_KEY, String(enabled));
};

// The host window minimises itself when a viewer connects; that happens in
// the main process, which cannot read localStorage, so the preference is
// pushed over IPC at boot and whenever it changes.
export const AUTO_MINIMIZE_KEY = 'remote365_auto_minimize_host';

export const isHostAutoMinimizeEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(AUTO_MINIMIZE_KEY) !== 'false';
};

export const pushHostAutoMinimize = (enabled: boolean = isHostAutoMinimizeEnabled()): Promise<unknown> => {
  const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : null;
  return Promise.resolve(electronApi?.setHostAutoMinimize?.(enabled)).catch(() => undefined);
};

export const setHostAutoMinimizeEnabled = (enabled: boolean): Promise<unknown> => {
  localStorage.setItem(AUTO_MINIMIZE_KEY, String(enabled));
  return pushHostAutoMinimize(enabled);
};
