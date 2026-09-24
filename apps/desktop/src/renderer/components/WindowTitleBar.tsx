import React, { useEffect, useState } from 'react';

// Custom Windows-11-style title bar. The main window is frameless (titleBarStyle:'hidden'),
// so these controls are app content — which IS reachable over a remote session, unlike the
// native caption buttons. Background is transparent so it blends with the app; the strip is a
// drag region, and only the buttons on the right are interactive.

const wc = () => (window as any).electronAPI?.windowControls;

const iconStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1 } as const;

export default function WindowTitleBar() {
  // Only the MAIN window is frameless. The viewer/meeting/wait windows load the app with a
  // ?view= param and have their own chrome (tab bar) — don't add a second title bar there.
  const isSubWindow = React.useMemo(() => !!new URLSearchParams(window.location.search).get('view'), []);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (isSubWindow) return;
    // Reserve the top strip only in the main window (see index.css .r365-has-titlebar).
    document.body.classList.add('r365-has-titlebar');
    return () => document.body.classList.remove('r365-has-titlebar');
  }, [isSubWindow]);

  useEffect(() => {
    if (isSubWindow) return;
    let mounted = true;
    wc()?.isMaximized?.().then((v: boolean) => { if (mounted) setMaximized(!!v); }).catch(() => {});
    const off = wc()?.onMaximizedChange?.((v: boolean) => setMaximized(!!v));
    return () => { mounted = false; if (typeof off === 'function') off(); };
  }, [isSubWindow]);

  if (isSubWindow) return null;

  return (
    <div className="r365-titlebar">
      <div className="r365-titlebar-drag" />
      <div className="r365-winctl">
        <button className="r365-winctl-btn" onClick={() => wc()?.minimize?.()} aria-label="Minimize" tabIndex={-1}>
          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" {...iconStroke} /></svg>
        </button>
        <button className="r365-winctl-btn" onClick={() => wc()?.maximize?.()} aria-label={maximized ? 'Restore' : 'Maximize'} tabIndex={-1}>
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="2.5" width="6" height="6" {...iconStroke} />
              <path d="M2.7 2.5 V0.5 H9.5 V7.3 H7.5" {...iconStroke} />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" {...iconStroke} /></svg>
          )}
        </button>
        <button className="r365-winctl-btn danger" onClick={() => wc()?.close?.()} aria-label="Close" tabIndex={-1}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0 L10 10 M10 0 L0 10" {...iconStroke} /></svg>
        </button>
      </div>
    </div>
  );
}
