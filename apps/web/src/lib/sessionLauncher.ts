// Opens the remote-session viewer in its OWN browser tab so several sessions
// can run side by side. sessionStorage is cloned into a tab opened by a plain
// window.open from the same origin (deliberately NO 'noopener' — that would
// suppress the clone), so an access-token handoff written just before the
// open rides along; without one the viewer self-authorizes (silent
// verify-access, password prompt on 401).
export interface SessionHandoff {
  accessToken: string;
  accessKey?: string;
  deviceName?: string;
  deviceType?: string;
}

const VIEWER_HANDOFF_KEY = 'remotelink_viewer_handoff';

// Same handoff, but the viewer replaces the CURRENT tab. Used when the app
// connects on its own (a collaborator just joined a session we created):
// window.open outside a click is popup-blocked, and the creator is sitting
// in the waiting room anyway.
export function openSessionHere(deviceId: string, handoff?: SessionHandoff) {
  const clean = String(deviceId || '').replace(/\s/g, '');
  if (!clean) return;
  if (handoff?.accessToken) {
    try {
      sessionStorage.setItem(
        VIEWER_HANDOFF_KEY,
        JSON.stringify({
          deviceId: clean,
          accessToken: handoff.accessToken,
          accessKey: handoff.accessKey || clean,
          deviceName: handoff.deviceName,
          deviceType: handoff.deviceType,
          ts: Date.now(),
        })
      );
    } catch {
      /* private mode / quota — the viewer will self-authorize instead */
    }
  }
  window.location.assign(`/session/${encodeURIComponent(clean)}`);
}

export function openSessionTab(deviceId: string, handoff?: SessionHandoff) {
  const clean = String(deviceId || '').replace(/\s/g, '');
  if (!clean) return;
  if (handoff?.accessToken) {
    try {
      sessionStorage.setItem(
        VIEWER_HANDOFF_KEY,
        JSON.stringify({
          deviceId: clean,
          accessToken: handoff.accessToken,
          accessKey: handoff.accessKey || clean,
          deviceName: handoff.deviceName,
          deviceType: handoff.deviceType,
          ts: Date.now(),
        })
      );
    } catch {
      /* private mode / quota — the viewer will self-authorize instead */
    }
  }
  window.open(`/session/${encodeURIComponent(clean)}`, '_blank');
}
