import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Globe, MonitorUp } from 'lucide-react';
import { MeetingPreviewModal } from '../../components/MeetingPreviewModal';
import { SnowMeeting } from '../../components/SnowMeeting';
import { normalizeMeetingCode } from '../../lib/meetingLinks';
import { useAuthStore } from '../../store/authStore';
import logo from '../../assets/logo.png';
import faultIllustration from '../../assets/fault.png';

/**
 * Public meeting landing page (Zoom-style). Anyone with the link lands here —
 * signed in or not. On load it fires the remote365:// deep link so the browser
 * shows its native "Open Remote365?" prompt when the app is installed; the
 * page detects the hand-off (tab losing focus) and reports it. Everyone else
 * joins as a guest straight from the browser, entering a display name first —
 * signed-in visitors join under their account name automatically.
 */

const formatMeetingCode = (code: string) =>
  code.length === 9 ? `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6, 9)}` : code;

type LaunchState = 'idle' | 'attempting' | 'opened' | 'not-detected';

const PublicMeetingPage: React.FC = () => {
  const { meetingId = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const code = normalizeMeetingCode(meetingId);
  const [stage, setStage] = useState<'launcher' | 'preview' | 'joined' | 'ended'>('launcher');
  const [launchState, setLaunchState] = useState<LaunchState>('idle');
  const [guestName, setGuestName] = useState(() => {
    try { return localStorage.getItem('remote365_guest_name') || ''; } catch { return ''; }
  });
  const autoLaunchedRef = useRef(false);

  // The page going hidden/blurred right after firing the deep link means the
  // OS switched to the app — the only "is it installed?" signal a browser gets.
  useEffect(() => {
    const markOpened = () => setLaunchState((s) => (s === 'attempting' ? 'opened' : s));
    const onVisibility = () => { if (document.hidden) markOpened(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', markOpened);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', markOpened);
    };
  }, []);

  const attemptAppLaunch = () => {
    setLaunchState('attempting');
    window.location.href = `remote365://meeting?code=${encodeURIComponent(code)}`;
    window.setTimeout(() => {
      setLaunchState((s) => (s === 'attempting' ? 'not-detected' : s));
    }, 2600);
  };

  // Zoom-style auto-attempt: if Remote365 is installed the browser pops its
  // native "Open Remote365?" dialog immediately; if not, nothing happens and
  // the visitor just uses the buttons below.
  useEffect(() => {
    if (!code || autoLaunchedRef.current) return;
    autoLaunchedRef.current = true;
    attemptAppLaunch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const joinFromBrowser = () => {
    try { if (guestName.trim()) localStorage.setItem('remote365_guest_name', guestName.trim()); } catch { /* ignore */ }
    setStage('preview');
  };

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 font-['Mona_Sans',system-ui,sans-serif]">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-[#111315]">Invalid meeting link</h1>
          <button type="button" onClick={() => navigate('/')} className="mt-6 rounded-lg bg-[#111315] px-5 py-2.5 text-sm font-medium text-white">Go home</button>
        </div>
      </div>
    );
  }

  if (stage === 'joined') {
    return (
      <div className="fixed inset-0 bg-[#080808]">
        <SnowMeeting
          meetingId={code}
          guestName={user?.name || guestName.trim() || 'Guest'}
          onLeave={() => setStage('ended')}
        />
      </div>
    );
  }

  // Meeting over (left, ended by the host, or declined) — the Figma
  // "Connection fault" page: glow, illustration, and a way back in.
  if (stage === 'ended') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-6 font-['Mona_Sans',system-ui,sans-serif]">
        <div className="pointer-events-none absolute left-1/2 top-[-400px] h-[517px] w-[min(1748px,calc(100vw+320px))] -translate-x-1/2 rounded-full bg-[linear-gradient(360deg,rgba(255,255,255,0.375)_-16.83%,rgba(255,179,71,0.6)_29.84%,rgba(255,138,0,0.75)_76.5%)] blur-[39.5px]" />
        <div className="relative z-10 flex w-full max-w-[377px] flex-col items-center gap-[60px] text-center">
          <div className="flex flex-col items-center gap-[45px]">
            <img src={faultIllustration} alt="" className="h-[214px] w-[251px] object-contain" draggable={false} />
            <div className="flex flex-col items-center gap-[14px]">
              <h1 className="m-0 text-[24px] font-medium leading-[34px] text-black">Meeting ended</h1>
              <p className="m-0 text-[14px] font-normal leading-5 text-black">
                You've left the meeting or the host ended it for everyone.
              </p>
            </div>
          </div>
          <div className="flex w-full items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-10 flex-1 items-center justify-center rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white text-[14px] font-medium leading-5 text-[#111315] transition hover:bg-black/5"
            >
              Go home
            </button>
            <button
              type="button"
              onClick={() => setStage('preview')}
              className="flex h-10 flex-1 items-center justify-center rounded-[4px] text-[14px] font-medium leading-5 text-white transition hover:brightness-105"
              style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
            >
              Rejoin meeting
            </button>
          </div>
        </div>
        <div className="absolute bottom-2 left-1/2 flex w-[226px] -translate-x-1/2 flex-col items-center text-center text-[rgba(26,29,33,0.5)]">
          <div className="text-[10px] leading-[14px]">Privacy Policy</div>
          <div className="text-[8px] leading-[11px]">Copyright {new Date().getFullYear()} © TechVision365 Inc. All rights reserved.</div>
        </div>
      </div>
    );
  }

  if (stage === 'preview') {
    return (
      <div className="min-h-screen bg-[#F3F4F6]">
        <MeetingPreviewModal
          open
          mode="join"
          onCancel={() => setStage('launcher')}
          onConfirm={() => setStage('joined')}
        />
      </div>
    );
  }

  const statusLine = (() => {
    if (launchState === 'attempting') return 'Opening Remote365…';
    if (launchState === 'opened') return 'Meeting opened in the Remote365 app. You can close this tab.';
    if (launchState === 'not-detected') return "Didn't see a prompt? The app may not be installed — join from your browser instead.";
    return 'If Remote365 is installed, your browser will ask to open it.';
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] p-4 font-['Mona_Sans',system-ui,sans-serif]">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6 rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="Remote365" className="h-12 w-12 rounded-xl object-contain" />
          <h1 className="m-0 text-[20px] font-semibold text-[#111315]">Join meeting</h1>
          <span className="rounded-lg bg-[#F3F4F6] px-4 py-1.5 text-[16px] font-semibold tracking-wider text-[#111315]">{formatMeetingCode(code)}</span>
        </div>

        <p className={`m-0 text-center text-[13px] leading-5 ${launchState === 'opened' ? 'font-medium text-[#067647]' : 'text-[#667085]'}`}>
          {statusLine}
        </p>

        {user?.name ? (
          <p className="m-0 -mt-2 text-center text-[13px] text-[#667085]">
            Joining as <span className="font-medium text-[#111315]">{user.name}</span>
          </p>
        ) : (
          <div className="w-full">
            <label className="mb-1.5 block text-[13px] font-medium text-[#111315]">Your name</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name to join from the browser"
              maxLength={60}
              className="h-11 w-full rounded-lg border border-[rgba(26,29,33,0.25)] bg-white px-3.5 text-[14px] text-[#111315] placeholder:text-[rgba(17,19,21,0.35)] outline-none transition-colors focus:border-[#FF8A00]"
            />
          </div>
        )}

        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={attemptAppLaunch}
            style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-medium text-white transition hover:brightness-105 active:scale-[0.99]"
          >
            <MonitorUp size={16} /> Open in Remote365 app
          </button>
          <button
            type="button"
            onClick={joinFromBrowser}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[rgba(26,29,33,0.25)] bg-white text-[14px] font-medium text-[#111315] transition hover:bg-black/5"
          >
            <Globe size={16} /> Join from browser
          </button>
        </div>

        <a
          href="/downloads"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#FF8A00] no-underline hover:underline"
        >
          <Download size={14} /> Don't have the app? Download Remote365
        </a>
      </div>
    </div>
  );
};

export default PublicMeetingPage;
