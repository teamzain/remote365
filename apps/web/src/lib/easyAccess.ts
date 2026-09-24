/**
 * Single source of truth for "Easy Access" / "Unattended access" — the same
 * feature surfaced under different names in four places: the Remote Support
 * host toggle, the landing page "Grant Easy Access" checkbox, the legacy
 * SnowSettings "Grant easy access" option, and Settings → Device management →
 * "Unattended access". Enabled means: connecting to this device needs no
 * password and the host approval prompt is skipped.
 *
 * The setter aligns every legacy localStorage key those UIs historically
 * wrote, then emits one event. App.tsx owns the side effects (syncing
 * passwordRequired to the server and starting the host); each UI subscribes
 * so all switches move together.
 */

const EASY_ACCESS_EVENT = 'remote365:easy-access-changed';

export const isEasyAccessEnabled = (): boolean =>
  localStorage.getItem('remote365_require_password') === 'false';

export const applyEasyAccess = (enabled: boolean) => {
  localStorage.setItem('remote365_require_password', enabled ? 'false' : 'true');
  localStorage.setItem('pref_dm_unattended', String(enabled));
  localStorage.setItem('pref_easy_access', String(enabled));
  // Easy Access implies the device must actually be reachable. Disabling it
  // deliberately leaves hosting on — connections just need the password and
  // approval again.
  if (enabled) localStorage.setItem('is_auto_host_enabled', 'true');
  window.dispatchEvent(new CustomEvent(EASY_ACCESS_EVENT, { detail: { enabled } }));
};

export const subscribeEasyAccess = (listener: (enabled: boolean) => void): (() => void) => {
  const handler = (event: Event) => listener(Boolean((event as CustomEvent).detail?.enabled));
  window.addEventListener(EASY_ACCESS_EVENT, handler);
  return () => window.removeEventListener(EASY_ACCESS_EVENT, handler);
};
