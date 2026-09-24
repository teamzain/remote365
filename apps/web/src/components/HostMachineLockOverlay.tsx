import { useEffect, useRef, useState } from 'react';

// If the machine this BROWSER is running on is currently being remote-controlled,
// cover the web app with the same kind of blocking overlay the desktop app shows
// (HostLockOverlay), so the local person cannot drive the account while a
// technician has the machine.
//
// How the browser knows: the Remote365 desktop host serves a loopback-only
// status endpoint (127.0.0.1:39867/host-status). On machines without the host
// app the fetch fails instantly and this component stays invisible — which is
// the common case and costs one refused connection every poll.
const STATUS_URL = 'http://127.0.0.1:39867/host-status';
const POLL_MS = 5000;

export default function HostMachineLockOverlay() {
  const [controlled, setControlled] = useState(false);
  const [viewerName, setViewerName] = useState('');
  // After the first failed probe we keep polling (the host app may start later),
  // but we stop logging/doing anything visible — silence is the feature.
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await fetch(STATUS_URL, { cache: 'no-store' });
        const data = await response.json();
        if (!stoppedRef.current) {
          setControlled(Boolean(data?.controlled));
          setViewerName(String(data?.viewerName || ''));
        }
      } catch {
        // No host app on this machine, or the browser blocked the loopback
        // request — either way the overlay must not show.
        if (!stoppedRef.current) setControlled(false);
      }
      if (!stoppedRef.current) timer = window.setTimeout(poll, POLL_MS);
    };
    poll();
    return () => {
      stoppedRef.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Swallow keystrokes while locked so nothing reaches the app underneath —
  // same behavior as the desktop overlay.
  useEffect(() => {
    if (!controlled) return;
    const block = (event: KeyboardEvent) => { event.preventDefault(); event.stopPropagation(); };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [controlled]);

  if (!controlled) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex select-none flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center text-white"
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="h-2.5 w-2.5 rounded-full bg-[#FF8A00] animate-pulse" />
      <div className="text-[18px] font-semibold">
        This computer is being controlled{viewerName ? ` by ${viewerName}` : ''}
      </div>
      <div className="max-w-[420px] text-[13px] leading-5 text-white/60">
        Remote365 is locked while the remote session is active. It unlocks
        automatically when the session ends.
      </div>
    </div>
  );
}
