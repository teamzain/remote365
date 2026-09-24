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

export interface EasyAccessChange {
  enabled: boolean;
  /** The change came from the server (an owner changed the device remotely),
   *  so listeners must not send it back. */
  fromServer: boolean;
}

// The flag key is written ONLY here. Its presence therefore means the user
// (or an owner, remotely) actually decided it; routine registrations only
// send a decided value, see utils/device isRemotePasswordConfigured.
export const applyEasyAccess = (enabled: boolean, options: { fromServer?: boolean } = {}) => {
  localStorage.setItem('remote365_require_password', enabled ? 'false' : 'true');
  localStorage.setItem('pref_dm_unattended', String(enabled));
  localStorage.setItem('pref_easy_access', String(enabled));
  // Easy Access implies the device must actually be reachable. Disabling it
  // deliberately leaves hosting on — connections just need the password and
  // approval again.
  if (enabled) localStorage.setItem('is_auto_host_enabled', 'true');
  window.dispatchEvent(new CustomEvent(EASY_ACCESS_EVENT, { detail: { enabled, fromServer: Boolean(options.fromServer) } }));
};

export const subscribeEasyAccess = (listener: (enabled: boolean, change: EasyAccessChange) => void): (() => void) => {
  const handler = (event: Event) => {
    const detail = ((event as CustomEvent).detail || {}) as Partial<EasyAccessChange>;
    const enabled = Boolean(detail.enabled);
    listener(enabled, { enabled, fromServer: Boolean(detail.fromServer) });
  };
  window.addEventListener(EASY_ACCESS_EVENT, handler);
  return () => window.removeEventListener(EASY_ACCESS_EVENT, handler);
};
