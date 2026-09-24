import React, { useEffect, useRef, useState } from 'react';

// While this machine is being controlled remotely, cover the Remote365 app body
// with a gray blocking overlay so the LOCAL user cannot click or type anywhere in
// the app until the session ends. The title bar is deliberately left OUT of the
// overlay — it stays clickable/accessible (move / minimize / maximize / close).
//
// The REMOTE technician is treated differently: their input is injected by the
// main process, which stamps every injected event. When a click lands on the
// overlay, we ask main whether remote input happened in the last moment — if it
// did, the click came from the remote session and the overlay steps aside so the
// technician can use the host-side app. It re-arms when the window blurs, so the
// local user can't inherit the unlocked state afterwards.
//
// The local user always keeps ONE control: a Disconnect button that ends the
// remote session immediately (same action as the dock's red button).
//
// Driven by the main-process `host:remote-control` event ({active, viewerName}).
// Mounted once in main.tsx, alongside WindowTitleBar. No-op in sub-windows
// (viewer/meeting/wait), which load the app with a `?view=` param.

const TITLEBAR_HEIGHT = 32; // keep in sync with .r365-titlebar height in index.css

export default function HostLockOverlay() {
  const isSubWindow = React.useMemo(
    () => !!new URLSearchParams(window.location.search).get('view'),
    []
  );
  const [controlled, setControlled] = useState(false);
  const [viewerName, setViewerName] = useState('');
  const [remoteUnlocked, setRemoteUnlocked] = useState(false);
  const probeInFlight = useRef(false);

  useEffect(() => {
    if (isSubWindow) return;
    const api = (window as any).electronAPI;
    if (!api?.onRemoteControlChange) return;
    const off = api.onRemoteControlChange((active: boolean, name?: string) => {
      setControlled(Boolean(active));
      setViewerName(String(name || ''));
      setRemoteUnlocked(false); // every session (re)start begins locked
    });
    return () => { if (typeof off === 'function') off(); };
  }, [isSubWindow]);

  // Re-arm the lock whenever the window loses focus: an unlock granted to the
  // remote technician must not survive for the local user to pick up later.
  useEffect(() => {
    if (!controlled) return;
    const relock = () => setRemoteUnlocked(false);
    window.addEventListener('blur', relock);
    return () => window.removeEventListener('blur', relock);
  }, [controlled]);

  // Swallow every keyboard event while the overlay is up so no keystroke reaches
  // the locked app body behind it. (The title bar has no keyboard interaction.)
  useEffect(() => {
    if (!controlled || remoteUnlocked) return;
    const block = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e as any).stopImmediatePropagation?.();
    };
    window.addEventListener('keydown', block, true);
    window.addEventListener('keyup', block, true);
    window.addEventListener('keypress', block, true);
    return () => {
      window.removeEventListener('keydown', block, true);
      window.removeEventListener('keyup', block, true);
      window.removeEventListener('keypress', block, true);
    };
  }, [controlled, remoteUnlocked]);

  if (isSubWindow || !controlled || remoteUnlocked) return null;

  // The overlay's own controls (Disconnect) must receive their events — the
  // capture-phase swallow below skips anything inside [data-lock-action].
  const isOverlayControl = (e: React.SyntheticEvent) =>
    Boolean((e.target as HTMLElement)?.closest?.('[data-lock-action]'));

  const swallow = (e: React.SyntheticEvent) => {
    if (isOverlayControl(e)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  // Any pointer-down on the overlay: if it was injected by the remote session,
  // drop the overlay for the technician; a local click just stays swallowed.
  const maybeUnlockForRemote = async (e: React.SyntheticEvent) => {
    if (isOverlayControl(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (probeInFlight.current) return;
    probeInFlight.current = true;
    try {
      const remote = await (window as any).electronAPI?.wasRemoteInputRecent?.();
      if (remote) setRemoteUnlocked(true);
    } catch { /* keep locked */ } finally {
      probeInFlight.current = false;
    }
  };

  const endSession = () => {
    (window as any).electronAPI?.endRemoteSession?.();
  };

  const who = viewerName || 'A Remote User';

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: TITLEBAR_HEIGHT,          // leave the title bar uncovered + clickable
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2147482000,            // below .r365-titlebar (2147483000) so it stays on top
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'not-allowed',
    background: 'rgba(55, 58, 64, 0.78)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    userSelect: 'none',
    fontFamily: "'Mona Sans', system-ui, sans-serif",
  };

  return (
    <div
      // Capture-phase mouse handlers eat every pointer interaction before it can
      // reach anything beneath the overlay (buttons, links, selection). The
      // mousedown probe decides whether the interaction came from the remote
      // session and may lift the overlay for the technician.
      onMouseDownCapture={maybeUnlockForRemote}
      onMouseUpCapture={swallow}
      onClickCapture={swallow}
      onDoubleClickCapture={swallow}
      onWheelCapture={swallow}
      onContextMenu={swallow}
      style={overlayStyle}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: '30px 38px',
          borderRadius: 16,
          background: 'rgba(0, 0, 0, 0.55)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          textAlign: 'center',
          maxWidth: 440,
        }}
      >
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(255, 138, 0, 0.16)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF8A00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: '#fff' }}>
          {`${who} is controlling this computer`}
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.72)' }}>
          Remote365 is locked while the remote session is active. Use the title
          bar to move or minimize this window, or end the session below.
        </p>
        <button
          data-lock-action="disconnect"
          onClick={endSession}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            padding: '10px 22px',
            borderRadius: 8,
            border: 0,
            background: '#e81123',
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(232,17,35,0.4)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          Disconnect Session
        </button>
      </div>
    </div>
  );
}
