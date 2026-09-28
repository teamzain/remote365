import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, LogIn, MonitorUp, RefreshCw, UserPlus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { openSessionHere } from '../../lib/sessionLauncher';
import { recordRecentConnection } from '../../lib/recentConnections';
import logoAsset from '../../assets/logo.png';

const logo = logoAsset.src;

/**
 * Public join page for a support-session invite (the button in the invite
 * email, and the Share link in both apps). A session shares the computer of
 * the person who created it, so the person opening this link is the VIEWER:
 * signed in, the page trades the code for access and opens the browser
 * viewer right here; signed out, it offers sign-in / sign-up and comes back
 * to this page afterwards. The desktop app hand-off stays as an alternative.
 */

const cleanSessionCode = (value: string) => String(value || '').replace(/\D/g, '').slice(0, 9);
const formatSessionCode = (code: string) =>
  code.length === 9 ? `${code.slice(0, 3)} ${code.slice(3, 6)} ${code.slice(6, 9)}` : code;

const PublicSessionJoinPage: React.FC = () => {
  const { code: codeParam = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const code = cleanSessionCode(codeParam || searchParams.get('code') || '');
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'opened' | 'failed'>('idle');
  const [joinError, setJoinError] = useState('');
  const autoJoinedRef = useRef(false);

  const joinNow = async () => {
    if (!code || joinState === 'joining') return;
    setJoinState('joining');
    setJoinError('');
    try {
      const { data } = await api.post('/api/chat/remote-sessions/join', { code });
      const hostKey = String(data?.hostAccessKey || '').replace(/\D/g, '');
      if (!data?.token || !hostKey) throw new Error('The session did not return access to the remote computer.');
      recordRecentConnection(hostKey, data?.hostName);
      setJoinState('opened');
      openSessionHere(hostKey, { accessToken: data.token, deviceName: data?.hostName, accessKey: hostKey });
    } catch (error: any) {
      setJoinState('failed');
      setJoinError(error?.response?.data?.error || error?.message || 'Could not join this session.');
    }
  };

  // Signed in: go straight in, once.
  useEffect(() => {
    if (!code || !isInitialized || !accessToken || !user || autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    void joinNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isInitialized, accessToken, user]);

  const openInApp = () => {
    window.location.href = `remote365://join?code=${encodeURIComponent(code)}`;
  };

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

  const signedIn = Boolean(isInitialized && accessToken && user);
  const nextState = { next: `/join/${code}` };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] p-4 font-['Mona_Sans',system-ui,sans-serif]">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6 rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="Remote365" className="h-12 w-12 rounded-xl object-contain" />
          <h1 className="m-0 text-[20px] font-semibold text-[#111315]">Use a shared computer</h1>
          <span className="rounded-lg bg-[#F3F4F6] px-4 py-1.5 text-[16px] font-semibold tracking-wider text-[#111315]">{formatSessionCode(code)}</span>
        </div>

        <p className="m-0 text-center text-[13px] leading-5 text-[#667085]">
          Someone shared their computer with you through this code. You will see their screen here in the browser, and they will be asked before you can use their keyboard and mouse.
        </p>

        {!isInitialized ? (
          <div className="flex items-center gap-2 text-[13px] text-[#667085]"><RefreshCw size={14} className="animate-spin" /> Checking your sign-in…</div>
        ) : signedIn ? (
          <div className="flex w-full flex-col gap-2.5">
            {joinState === 'joining' || joinState === 'opened' ? (
              <div className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#F3F4F6] text-[14px] font-medium text-[#111315]">
                <RefreshCw size={16} className="animate-spin" /> {joinState === 'opened' ? 'Opening the session…' : 'Joining…'}
              </div>
            ) : (
              <button
                type="button"
                onClick={joinNow}
                style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-medium text-white transition hover:brightness-105 active:scale-[0.99]"
              >
                <MonitorUp size={16} /> {joinState === 'failed' ? 'Try again' : 'Join now'}
              </button>
            )}
            {joinError && (
              <p className="m-0 rounded-lg bg-red-50 px-3 py-2 text-center text-[13px] leading-5 text-red-600">{joinError}</p>
            )}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/login', { state: nextState })}
              style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-medium text-white transition hover:brightness-105 active:scale-[0.99]"
            >
              <LogIn size={16} /> Sign in to join
            </button>
            <button
              type="button"
              onClick={() => navigate('/register', { state: nextState })}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[rgba(26,29,33,0.25)] bg-white text-[14px] font-medium text-[#111315] transition hover:bg-[#F9FAFB]"
            >
              <UserPlus size={16} /> Create a free account
            </button>
          </div>
        )}

        <div className="flex w-full flex-col gap-1 border-t border-[rgba(26,29,33,0.1)] pt-4">
          <p className="m-0 text-center text-[12px] leading-4 text-[#98A2B3]">Prefer the desktop app?</p>
          <div className="flex gap-2">
            <button type="button" onClick={openInApp} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-[#FF8A00] transition hover:bg-[#FFF7EE]">
              <MonitorUp size={15} /> Open in the app
            </button>
            <a href="/downloads" className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-[#111315] no-underline transition hover:bg-[#F9FAFB]">
              <Download size={15} /> Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicSessionJoinPage;
