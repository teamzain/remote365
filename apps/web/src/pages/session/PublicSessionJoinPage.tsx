import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, LayoutDashboard, MonitorUp } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import logo from '../../assets/logo.png';

/**
 * Public join page for a remote-support session invite (the "Join session"
 * button in the invite email, and the Share link in both apps). Joining a
 * support session means sharing THIS computer with the supporter, which only
 * the desktop app can do, so the page hands off to the app (remote365://)
 * like the meeting page does and offers the download otherwise. Email clients
 * refuse custom-scheme links, which is why the email cannot point at the app
 * directly.
 */

const cleanSessionCode = (value: string) => String(value || '').replace(/\D/g, '').slice(0, 9);
const formatSessionCode = (code: string) =>
  code.length === 9 ? `${code.slice(0, 3)} ${code.slice(3, 6)} ${code.slice(6, 9)}` : code;

type LaunchState = 'idle' | 'attempting' | 'opened' | 'not-detected';

const PublicSessionJoinPage: React.FC = () => {
  const { code: codeParam = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const code = cleanSessionCode(codeParam || searchParams.get('code') || '');
  const [launchState, setLaunchState] = useState<LaunchState>('idle');
  const autoLaunchedRef = useRef(false);

  // The tab going hidden right after the deep link fires is the only signal a
  // browser gets that the OS switched to the app.
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
    window.location.href = `remote365://join?code=${encodeURIComponent(code)}`;
    window.setTimeout(() => {
      setLaunchState((s) => (s === 'attempting' ? 'not-detected' : s));
    }, 2600);
  };

  useEffect(() => {
    if (!code || autoLaunchedRef.current) return;
    autoLaunchedRef.current = true;
    attemptAppLaunch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 font-['Mona_Sans',system-ui,sans-serif]">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-[#111315]">Invalid session link</h1>
          <p className="mt-2 text-sm text-[#667085]">Ask the person who invited you to send the link again.</p>
          <button type="button" onClick={() => navigate('/')} className="mt-6 rounded-lg bg-[#111315] px-5 py-2.5 text-sm font-medium text-white">Go home</button>
        </div>
      </div>
    );
  }

  const statusLine = (() => {
    if (launchState === 'attempting') return 'Opening Remote365…';
    if (launchState === 'opened') return 'The session opened in the Remote365 app. You can close this tab.';
    if (launchState === 'not-detected') return "Didn't see a prompt? The app may not be installed yet — download it below, then open this link again.";
    return 'If Remote365 is installed, your browser will ask to open it.';
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] p-4 font-['Mona_Sans',system-ui,sans-serif]">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6 rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="Remote365" className="h-12 w-12 rounded-xl object-contain" />
          <h1 className="m-0 text-[20px] font-semibold text-[#111315]">Join support session</h1>
          <span className="rounded-lg bg-[#F3F4F6] px-4 py-1.5 text-[16px] font-semibold tracking-wider text-[#111315]">{formatSessionCode(code)}</span>
        </div>

        <p className={`m-0 text-center text-[13px] leading-5 ${launchState === 'opened' ? 'font-medium text-[#067647]' : 'text-[#667085]'}`}>
          {statusLine}
        </p>
        <p className="m-0 -mt-3 text-center text-[13px] leading-5 text-[#667085]">
          Joining shares this computer with the person who invited you, so the session runs in the desktop app.
        </p>

        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={attemptAppLaunch}
            style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-medium text-white transition hover:brightness-105 active:scale-[0.99]"
          >
            <MonitorUp size={16} /> Open in Remote365 app
          </button>
          <a
            href="/downloads"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[rgba(26,29,33,0.25)] bg-white text-[14px] font-medium text-[#111315] no-underline transition hover:bg-[#F9FAFB]"
          >
            <Download size={16} /> Download Remote365
          </a>
          {user && (
            <button
              type="button"
              onClick={() => navigate('/dashboard/sessions')}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-medium text-[#FF8A00] transition hover:bg-[#FFF7EE]"
            >
              <LayoutDashboard size={16} /> View my sessions
            </button>
          )}
        </div>

        <p className="m-0 text-center text-[12px] leading-4 text-[#98A2B3]">
          Already have the app open? Choose Join Session there and enter code {formatSessionCode(code)}.
        </p>
      </div>
    </div>
  );
};

export default PublicSessionJoinPage;
