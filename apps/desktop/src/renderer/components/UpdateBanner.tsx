import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react';

const UpdateBanner: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<'available' | 'downloading' | 'downloaded' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [restartIn, setRestartIn] = useState<number | null>(null); // auto-restart countdown (seconds)

  // Mirror of `status` readable from the (once-mounted) poll closure.
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (!(window as any).electronAPI?.updates) return;

    // @ts-ignore
    const unAvailable = window.electronAPI.updates.onAvailable((info: any) => {
      setUpdateInfo(info);
      setVisible(true);
      // The 60s poll re-emits "available" on every check. Never downgrade a
      // download that's already in flight or finished back to "available" —
      // that's what made the button reappear and require repeated clicks.
      setStatus((prev) => (prev === 'downloading' || prev === 'downloaded') ? prev : 'available');
    });

    // @ts-ignore
    const unProgress = window.electronAPI.updates.onDownloadProgress((p: any) => {
      setProgress(p.percent);
      setStatus('downloading');
    });

    // @ts-ignore
    const unDownloaded = window.electronAPI.updates.onDownloaded((info: any) => {
      // In auto mode the download happens silently (no prior "available" banner
      // ever set `visible`), so the ready-to-restart pill must show itself.
      if (info) setUpdateInfo(info);
      setStatus('downloaded');
      setVisible(true);
    });

    // The app restarts ITSELF once the update is ready (main gives a few
    // seconds of notice; a session defers it until the session ends). The
    // banner just narrates: "Restarting In Ns…" → "Restarting…".
    // @ts-ignore
    const unRestarting = window.electronAPI.updates.onRestarting?.((info: { seconds: number }) => {
      setStatus('downloaded');
      setVisible(true);
      setIsInstalling(true);
      setRestartIn(Math.max(0, Number(info?.seconds || 0)));
    });

    // @ts-ignore
    const unError = window.electronAPI.updates.onError((err: string) => {
      setError(err);
      // Don't wipe an in-progress/finished download with a transient check error.
      setStatus((prev) => (prev === 'downloading' || prev === 'downloaded') ? prev : 'error');
      setVisible((prev) => prev || true);
    });

    // A reachable feed with no newer version means connectivity is back — drop
    // any stale "Update Error" banner (e.g. the one left over after Wi-Fi
    // dropped and came back).
    const clearStaleError = () => {
      setStatus((prev) => {
        if (prev !== 'error') return prev;
        setError(null);
        setVisible(false);
        return null;
      });
    };

    // @ts-ignore
    const unNotAvailable = window.electronAPI.updates.onNotAvailable?.(clearStaleError);

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    const runCheck = () => {
      // Once a download is in flight or finished, stop polling — re-checking would
      // re-emit events that fight the download and make the button flicker.
      if (statusRef.current === 'downloading' || statusRef.current === 'downloaded') return Promise.resolve();
      // @ts-ignore
      return window.electronAPI.updates.check().then(() => {
        // The check succeeded, so we're back online — clear any stale error
        // banner. If an update exists, onAvailable re-shows it right after.
        clearStaleError();
      }).catch((err: any) => {
        // This poll is a background check (no manual flag), so a failure — e.g.
        // hitting a half-published feed mid-upload — must never raise an error
        // banner. Log and let the next 60s poll retry; it succeeds once the
        // upload completes. User-initiated errors still arrive via onError.
        console.warn('[UpdateBanner] Background update check failed (will retry):', err?.message || err);
      });
    };

    // Re-check the moment the OS reports the network is back, so a lingering
    // "Update Error" banner clears without waiting for the next 60s poll.
    const onOnline = () => { runCheck(); };

    // @ts-ignore
    window.electronAPI.isPackaged?.().then((isPackaged: boolean) => {
      // Unmounted before this resolved: arming the interval now would leave a
      // 60 s update poller that nothing can ever clear.
      if (disposed) return;
      if (isPackaged) {
        const autoInstall = localStorage.getItem('pref_auto_update') !== 'false';
        // @ts-ignore
        window.electronAPI.updates.setAutoInstall?.(autoInstall).finally(runCheck);
        // Main already checks the feed every 60 s. Only the primary window
        // adds its own poll; session, meeting and wait windows used to stack
        // one extra feed request per minute each.
        const isSecondaryWindow = Boolean(new URLSearchParams(window.location.search).get('view'));
        if (!isSecondaryWindow) pollTimer = setInterval(runCheck, 60_000);
        window.addEventListener('online', onOnline);
      }
    });

    return () => {
      disposed = true;
      unAvailable();
      unProgress();
      unDownloaded();
      unError();
      unNotAvailable?.();
      unRestarting?.();
      window.removeEventListener('online', onOnline);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  // Tick the auto-restart countdown down to 0 ("Restarting In 3S… 2S… 1S…").
  useEffect(() => {
    if (restartIn === null || restartIn <= 0) return;
    const t = setTimeout(() => setRestartIn((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearTimeout(t);
  }, [restartIn]);

  if (!visible) return null;

  const handleDownload = async () => {
    // Flip to "downloading" immediately so a single click gives instant feedback
    // and the button can't be pressed again (the old banner looked inert on click,
    // which is why it took several presses). Progress/finish arrive via events.
    setStatus('downloading');
    setProgress(0);
    try {
      // @ts-ignore
      await window.electronAPI.updates.download();
    } catch (err: any) {
      setError(err?.message || 'Download failed. Please try again.');
      setStatus('error');
    }
  };

  const handleInstall = () => {
    setIsInstalling(true);
    // @ts-ignore
    window.electronAPI.updates.quitAndInstall();
  };

  const isError = status === 'error';
  const Icon =
    status === 'downloading' ? RefreshCw :
    status === 'downloaded' ? CheckCircle :
    status === 'error' ? AlertCircle :
    Download;

  const sessionDeferred = Boolean(updateInfo?.sessionActive) && !isInstalling;
  const title =
    status === 'available' ? 'Update Available' :
    status === 'downloading' ? 'Downloading Update' :
    status === 'downloaded'
      ? (isInstalling
          ? (restartIn && restartIn > 0 ? `Restarting in ${restartIn}s…` : 'Restarting…')
          : 'Update Ready To Install')
      : 'Update Error';

  const subtitle =
    status === 'available' ? `Version ${updateInfo?.version ?? ''} of Remote365 is ready to install.`.trim() :
    status === 'downloading' ? `Please wait. ${Math.round(progress)}% downloaded.` :
    status === 'downloaded'
      ? (isInstalling
          ? 'Remote365 restarts by itself to apply the latest version. Nothing to do.'
          : sessionDeferred
            ? 'Update downloaded. Remote365 restarts automatically as soon as the remote session ends.'
            : 'Update downloaded. Remote365 restarts automatically in a moment.')
      : (error || 'Something went wrong while updating.');

  return (
    <div className="fixed left-1/2 top-[49px] z-[9999] w-[894px] max-w-[calc(100vw-32px)] -translate-x-1/2 px-4 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-[12px] bg-[#F3F4F6] p-5">
        {/* Download progress fill */}
        {status === 'downloading' && (
          <div
            className="absolute bottom-0 left-0 h-1 bg-[#FF8A00] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        )}

        {/* Left: icon + copy */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px]"
            style={{ background: isError ? 'rgba(217,45,32,0.15)' : 'rgba(255,179,71,0.3)' }}
          >
            <Icon
              size={24}
              className={status === 'downloading' ? 'animate-spin' : ''}
              style={{ color: isError ? '#D92D20' : '#FF8A00' }}
            />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h4 className="m-0 truncate text-[24px] font-bold leading-[34px] text-black">{title}</h4>
            <p className="m-0 truncate text-[14px] font-normal leading-[20px] text-black/80">{subtitle}</p>
          </div>
        </div>

        {/* Right: action + dismiss */}
        <div className="flex shrink-0 items-center gap-3">
          {status === 'available' && (
            <button
              onClick={handleDownload}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[4px] px-4 text-[14px] font-medium leading-5 text-white transition-[filter] hover:brightness-105"
              style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
            >
              Update Now
            </button>
          )}
          {status === 'downloaded' && !isInstalling && (
            <button
              onClick={handleInstall}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[4px] px-4 text-[14px] font-medium leading-5 text-white transition-[filter] hover:brightness-105"
              style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
            >
              Restart Now
            </button>
          )}
          {status === 'downloaded' && isInstalling && (
            <span className="inline-flex h-10 items-center justify-center gap-2 px-2 text-[14px] font-medium leading-5" style={{ color: '#FF8A00' }}>
              <RefreshCw size={16} className="animate-spin" />
            </span>
          )}
          {status !== 'downloading' && (
            <button
              onClick={() => setVisible(false)}
              aria-label="Dismiss"
              className="flex h-8 w-8 items-center justify-center rounded-[4px] text-black/40 transition-colors hover:bg-black/5 hover:text-black/70"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
