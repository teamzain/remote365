import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Link2,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Share2,
  Ticket,
  X,
  XCircle,
} from 'lucide-react';
import api from '../../lib/api';
import { formatAccessKey, getRecentConnections, recordRecentConnection } from '../../lib/recentConnections';
import { buildWebSessionJoinUrl } from '../../lib/meetingLinks';
import { openSessionTab } from '../../lib/sessionLauncher';
import { notify } from '../NotificationProvider';

const gradient = { background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' };

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const relative = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

const sessionExpiresAt = (session: any) => {
  if (session?.expiresAt) return new Date(session.expiresAt);
  const ttlMs = session?.type === 'VIDEO_MEETING' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(new Date(session?.createdAt || Date.now()).getTime() + ttlMs);
};
const isJoinable = (session: any) =>
  String(session?.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && !session?.isExpired && sessionExpiresAt(session).getTime() > Date.now();

const cleanCode = (value: string) => String(value || '').replace(/\D/g, '');

/**
 * Phone version of the Remote Support page. Three jobs, in the order a phone
 * user needs them: connect to one of your devices by ID, join a session with
 * a code, and manage the sessions you created (share the link, end them).
 * Hosting THIS device is a desktop-app feature, so it is not offered here.
 */
export const WebMobileSupport: React.FC<{ user: any }> = ({ user }) => {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState('');
  const [recents, setRecents] = useState(() => getRecentConnections());
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [passwordFor, setPasswordFor] = useState<{ key: string; name?: string | null } | null>(null);
  const [password, setPassword] = useState('');

  const [joinCode, setJoinCode] = useState('');

  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sheetSession, setSheetSession] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ code: string; message: string } | null>(null);

  const fetchSessions = async (silent = false) => {
    if (!silent) setLoadingSessions(true);
    try {
      const { data } = await api.get('/api/chat/remote-sessions');
      setSessions((Array.isArray(data) ? data : []).filter(isJoinable));
    } catch {
      /* listed best-effort */
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const timer = window.setInterval(() => fetchSessions(true), 30000);
    const onJoined = () => fetchSessions(true);
    window.addEventListener('remote365:session-joined', onJoined);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('remote365:session-joined', onJoined);
    };
  }, []);

  const mine = useMemo(
    () => sessions.filter((session) => !session.createdById || !user?.id || session.createdById === user.id),
    [sessions, user?.id]
  );

  const runConnect = async (accessKey: string, secret?: string) => {
    const key = cleanCode(accessKey);
    if (key.length < 6) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const { data } = await api.post('/api/devices/verify-access', { accessKey: key, password: secret || undefined });
      if (data?.token && data?.device?.id) {
        const name = data.device?.name;
        setRecents(recordRecentConnection(key, name));
        setPasswordFor(null);
        setPassword('');
        openSessionTab(data.device.id, { accessToken: data.token, deviceName: name, accessKey: key });
      }
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        setPasswordFor({ key, name: error.response?.data?.device?.name || null });
        setConnectError(secret ? 'Incorrect password. Please try again.' : null);
      } else if (status === 409) {
        setConnectError('That device is offline.');
      } else {
        setConnectError(error.response?.data?.error || 'Could not start the session.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const shareSession = async (session: any) => {
    const url = buildWebSessionJoinUrl(String(session.sessionCode || ''));
    const text = `Join my Remote365 session ${formatAccessKey(session.sessionCode)}: ${url}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: session.name || 'Remote365 session', text, url });
        return;
      } catch {
        /* user dismissed the share sheet */
      }
    }
    try {
      await navigator.clipboard?.writeText?.(url);
      setCopied(true);
    } catch {
      notify(url, 'info');
    }
  };

  const endSession = async (session: any) => {
    try {
      await api.post(`/api/chat/remote-sessions/${session.id}/end`);
      setSessions((prev) => prev.filter((item) => item.id !== session.id));
      notify('Session ended.', 'success');
    } catch (error: any) {
      notify(error.response?.data?.error || 'Could not end the session.', 'error');
    }
  };

  const createSession = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/api/chat/session-invites', {
        email: newEmail.trim() || undefined,
        sessionName: newName.trim() || `${user?.name || 'Remote365'} session`,
      });
      const code = formatAccessKey(data?.remoteSession?.sessionCode || '');
      if (data?.remoteSession) setSessions((prev) => [data.remoteSession, ...prev.filter((item) => item.id !== data.remoteSession.id)]);
      setCreated({
        code,
        message: newEmail.trim()
          ? data?.existingUser
            ? 'Invite email sent and the recipient was notified in-app.'
            : 'Invite email sent with an install link.'
          : "Share the code or link. When they join, you'll connect to their PC automatically.",
      });
      setNewName('');
      setNewEmail('');
    } catch (error: any) {
      notify(error.response?.data?.error || 'Could not create the session.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const input = 'h-12 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-[15px] text-[#111315] outline-none focus:border-[#FF8A00]';

  return (
    <div className="relative flex h-full flex-col bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pb-8 pt-5">
          <p className="m-0 text-[12px] text-[#111315]/45">{greeting()}</p>
          <h2 className="m-0 text-[20px] font-semibold text-[#111315]">{(user?.name || 'there').split(' ')[0]}</h2>

          {/* Connect by ID */}
          <div className="mt-4 rounded-2xl border border-[rgba(26,29,33,0.1)] p-4">
            <p className="m-0 text-[12px] font-medium text-[#111315]/45">Connect to a device</p>
            <form
              onSubmit={(event) => { event.preventDefault(); runConnect(partnerId); }}
              className="mt-2 flex flex-col gap-2"
            >
              <input
                inputMode="numeric"
                autoComplete="off"
                value={partnerId}
                onChange={(event) => { setConnectError(null); setPartnerId(formatAccessKey(cleanCode(event.target.value).slice(0, 9))); }}
                placeholder="Device ID"
                className="h-12 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-center text-[18px] font-medium tracking-[3px] text-[#111315] outline-none focus:border-[#FF8A00]"
              />
              <button
                type="submit"
                disabled={cleanCode(partnerId).length < 6 || connecting}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#34C759] text-[14px] font-semibold text-white disabled:opacity-50"
              >
                {connecting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Connect
              </button>
            </form>
            {connectError && !passwordFor && <p className="m-0 mt-2 text-[12px] font-medium text-[#D64545]">{connectError}</p>}
            <p className="m-0 mt-2 text-[11px] leading-4 text-[#111315]/40">
              Opens the remote screen in a new tab. Devices with a password ask for it first.
            </p>
          </div>

          {/* Join with a code */}
          <div className="mt-3 rounded-2xl border border-[rgba(26,29,33,0.1)] p-4">
            <p className="m-0 text-[12px] font-medium text-[#111315]/45">Join a session</p>
            <form
              onSubmit={(event) => { event.preventDefault(); if (cleanCode(joinCode).length >= 6) navigate(`/join/${cleanCode(joinCode)}`); }}
              className="mt-2 flex gap-2"
            >
              <input
                inputMode="numeric"
                autoComplete="off"
                value={joinCode}
                onChange={(event) => setJoinCode(formatAccessKey(cleanCode(event.target.value).slice(0, 9)))}
                placeholder="Session code"
                className={`${input} min-w-0 flex-1 text-center tracking-[2px]`}
              />
              <button
                type="submit"
                disabled={cleanCode(joinCode).length < 6}
                className="flex h-12 flex-none items-center justify-center rounded-xl px-5 text-[14px] font-semibold text-white disabled:opacity-50"
                style={gradient}
              >
                Join
              </button>
            </form>
            <p className="m-0 mt-2 text-[11px] leading-4 text-[#111315]/40">
              A code from an invite shares the joiner's computer with the supporter, which needs the desktop app.
            </p>
          </div>

          {/* Sessions I created */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="m-0 text-[12px] font-medium text-[#111315]/45">Your sessions</p>
              <button type="button" aria-label="Refresh sessions" onClick={() => fetchSessions(true)} className="flex h-8 w-8 items-center justify-center rounded-full text-[#111315]/55 active:bg-[#F3F4F6]">
                <RefreshCw size={15} />
              </button>
            </div>
            {loadingSessions ? (
              <div className="flex justify-center py-6 text-[#FF8A00]"><Loader2 size={20} className="animate-spin" /></div>
            ) : mine.length === 0 ? (
              <p className="m-0 py-4 text-[13px] text-[#111315]/45">No active sessions. Create one to invite someone to share their screen with you.</p>
            ) : (
              mine.map((session) => (
                <div key={session.id} className="flex items-center gap-3 border-b border-[rgba(26,29,33,0.06)] py-3">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FFF1E0] text-[#FF8A00]">
                    <Ticket size={16} />
                  </span>
                  <button type="button" onClick={() => { setCopied(false); setSheetSession(session); }} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[14px] font-medium text-[#111315]">{session.name || 'Remote session'}</span>
                    <span className="block text-[12px] text-[#111315]/45">
                      {formatAccessKey(session.sessionCode)}{session.createdAt ? ` · ${relative(session.createdAt)}` : ''}
                    </span>
                  </button>
                  <button type="button" aria-label="Share session" onClick={() => shareSession(session)} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#111315]/55 active:bg-[#F3F4F6]">
                    <Share2 size={16} />
                  </button>
                  <button type="button" aria-label="Session actions" onClick={() => { setCopied(false); setSheetSession(session); }} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#111315]/45 active:bg-[#F3F4F6]">
                    <MoreVertical size={17} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Recents */}
          {recents.length > 0 && (
            <div className="mt-6">
              <p className="m-0 mb-1 text-[12px] font-medium text-[#111315]/45">Recent connections</p>
              {recents.slice(0, 6).map((recent) => (
                <button
                  key={recent.accessKey}
                  type="button"
                  onClick={() => runConnect(recent.accessKey)}
                  className="flex w-full items-center gap-3 border-b border-[rgba(26,29,33,0.06)] py-3 text-left active:bg-[#F9FAFB]"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#F3F4F6] text-[#111315]/55">
                    <Clock size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[#111315]">{recent.name || 'Device'}</span>
                    <span className="block text-[12px] text-[#111315]/45">{formatAccessKey(recent.accessKey)}</span>
                  </span>
                  <ArrowRight size={16} className="flex-none text-[#111315]/30" />
                </button>
              ))}
            </div>
          )}
          <div className="h-20" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => { setCreated(null); setNewOpen(true); }}
        aria-label="New session"
        className="absolute bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl active:scale-95"
        style={gradient}
      >
        <Plus size={26} />
      </button>

      {/* Password challenge */}
      {passwordFor && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Enter access password">
          <button type="button" aria-label="Cancel" onClick={() => { setPasswordFor(null); setPassword(''); setConnectError(null); }} className="absolute inset-0 bg-black/40" />
          <form
            onSubmit={(event) => { event.preventDefault(); if (password) runConnect(passwordFor.key, password); }}
            className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white px-5 pt-3 shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <p className="m-0 mt-4 text-[16px] font-semibold text-[#111315]">Enter access password</p>
            <p className="m-0 mt-1 text-[12px] text-[#111315]/50">
              {passwordFor.name ? `Connecting to ${passwordFor.name}` : `Device ID ${formatAccessKey(passwordFor.key)}`}
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Remote access password"
              className={`${input} mt-4`}
            />
            {connectError && <p className="m-0 mt-2 text-[12px] font-medium text-[#D64545]">{connectError}</p>}
            <button type="submit" disabled={!password || connecting} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50" style={gradient}>
              {connecting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Connect
            </button>
          </form>
        </div>
      )}

      {/* Session actions */}
      {sheetSession && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Session actions">
          <button type="button" aria-label="Close" onClick={() => setSheetSession(null)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white shadow-2xl animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <div className="px-5 py-3">
              <p className="m-0 text-[14px] font-semibold text-[#111315]">{sheetSession.name || 'Remote session'}</p>
              <p className="m-0 text-[12px] text-[#111315]/45">Code {formatAccessKey(sheetSession.sessionCode)} · expires {sessionExpiresAt(sheetSession).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
            </div>
            <div className="border-t border-[rgba(26,29,33,0.08)]">
              <button type="button" onClick={() => shareSession(sheetSession)} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]">
                <Share2 size={17} className="text-[#111315]/55" /><span className="text-[14px] font-medium text-[#111315]">Share invite link</span>
              </button>
              <button
                type="button"
                onClick={async () => { try { await navigator.clipboard?.writeText?.(buildWebSessionJoinUrl(String(sheetSession.sessionCode || ''))); setCopied(true); } catch { /* clipboard unavailable */ } }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]"
              >
                {copied ? <Check size={17} className="text-[#34C759]" /> : <Link2 size={17} className="text-[#111315]/55" />}
                <span className="text-[14px] font-medium text-[#111315]">{copied ? 'Link copied' : 'Copy link'}</span>
              </button>
              <button
                type="button"
                onClick={async () => { try { await navigator.clipboard?.writeText?.(cleanCode(sheetSession.sessionCode)); setCopied(true); } catch { /* clipboard unavailable */ } }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]"
              >
                <Copy size={17} className="text-[#111315]/55" /><span className="text-[14px] font-medium text-[#111315]">Copy code</span>
              </button>
              <button type="button" onClick={() => { const session = sheetSession; setSheetSession(null); endSession(session); }} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#FFF5F5]">
                <XCircle size={17} className="text-[#D64545]" /><span className="text-[14px] font-medium text-[#D64545]">End session</span>
              </button>
              <button type="button" onClick={() => setSheetSession(null)} className="flex w-full items-center gap-3 border-t border-[rgba(26,29,33,0.08)] px-5 py-3 text-left active:bg-[#F9FAFB]">
                <X size={17} className="text-[#111315]/55" /><span className="text-[14px] font-medium text-[#111315]">Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New session */}
      {newOpen && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="New session">
          <button type="button" aria-label="Close" onClick={() => setNewOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white px-5 pt-3 shadow-2xl animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            {created ? (
              <div className="pt-4">
                <p className="m-0 text-[16px] font-semibold text-[#111315]">Session created</p>
                <p className="m-0 mt-3 text-center text-[28px] font-semibold tracking-[3px] text-[#FF8A00]">{created.code}</p>
                <p className="m-0 mt-2 text-center text-[13px] leading-5 text-[#111315]/60">{created.message}</p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { const session = sessions.find((item) => formatAccessKey(item.sessionCode) === created.code); if (session) shareSession(session); }}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white"
                    style={gradient}
                  >
                    <Share2 size={16} /> Share
                  </button>
                  <button type="button" onClick={() => setNewOpen(false)} className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[rgba(26,29,33,0.2)] text-[14px] font-semibold text-[#111315]">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); createSession(); }} className="pt-4">
                <p className="m-0 text-[16px] font-semibold text-[#111315]">New session</p>
                <p className="m-0 mt-1 text-[12px] leading-4 text-[#111315]/50">
                  You get a code to share. Whoever joins with it shares their screen with you.
                </p>
                <label className="mt-4 block text-[12px] font-medium text-[#111315]/60">Session name</label>
                <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Help with printer" className={`${input} mt-1`} />
                <label className="mt-3 block text-[12px] font-medium text-[#111315]/60">Send invite by email (optional)</label>
                <input type="email" inputMode="email" autoComplete="off" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="name@company.com" className={`${input} mt-1`} />
                <button type="submit" disabled={creating} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50" style={gradient}>
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create session
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WebMobileSupport;
