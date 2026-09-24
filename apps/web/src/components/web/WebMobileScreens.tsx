import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  Edit2,
  Link2,
  LogIn,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { SnowMeeting } from '../SnowMeeting';
import api from '../../lib/api';
import { formatAccessKey, getRecentConnections, recordRecentConnection } from '../../lib/recentConnections';
import { buildWebMeetingUrl, normalizeMeetingCode } from '../../lib/meetingLinks';
import { buildGoogleCalendarEventUrl } from '../../lib/googleCalendar';
import { openSessionTab } from '../../lib/sessionLauncher';
import { useAuthStore } from '../../store/authStore';

const gradient = { background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' };

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// ---- Support (home) --------------------------------------------------------

export const MobileSupportHome: React.FC<{ user: any }> = ({ user }) => {
  const [partnerId, setPartnerId] = useState('');
  const [recents, setRecents] = useState(() => getRecentConnections());

  const connect = (rawKey: string, name?: string) => {
    const clean = String(rawKey || '').replace(/\D/g, '');
    if (clean.length < 6) return;
    setRecents(recordRecentConnection(clean, name));
    openSessionTab(clean);
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="px-4 pb-6 pt-5">
        <p className="m-0 text-[12px] text-[#111315]/45">{greeting()}</p>
        <h2 className="m-0 text-[20px] font-semibold text-[#111315]">{(user?.name || 'there').split(' ')[0]}</h2>

        <div className="mt-4 rounded-2xl border border-[rgba(26,29,33,0.1)] p-4">
          <p className="m-0 text-[12px] font-medium text-[#111315]/45">Connect to a device</p>
          <form
            onSubmit={(event) => { event.preventDefault(); connect(partnerId); }}
            className="mt-2 flex flex-col gap-2"
          >
            <input
              inputMode="numeric"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              placeholder="Partner ID"
              className="h-12 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-center text-[17px] font-medium tracking-[2px] text-[#111315] outline-none focus:border-[#FF8A00]"
            />
            <button
              type="submit"
              disabled={partnerId.replace(/\D/g, '').length < 6}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#34C759] text-[14px] font-semibold text-white disabled:opacity-50"
            >
              Connect <ArrowRight size={16} />
            </button>
          </form>
          <p className="m-0 mt-2 text-[11px] leading-4 text-[#111315]/40">
            The session opens in a new tab. If the device asks for a password, you'll be prompted there.
          </p>
        </div>

        {recents.length > 0 && (
          <div className="mt-5">
            <p className="m-0 mb-1 text-[12px] font-medium text-[#111315]/45">Recent connections</p>
            {recents.slice(0, 6).map((recent) => (
              <button
                key={recent.accessKey}
                type="button"
                onClick={() => connect(recent.accessKey, recent.name)}
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
      </div>
    </div>
  );
};

// ---- Devices ---------------------------------------------------------------

interface MobileDevicesProps {
  devices: any[];
  refreshing?: boolean;
  onAdd: () => void;
  onConnect: (device: any) => void;
  onRename: (device: any) => void;
  onRemove: (device: any) => void;
  onRefresh: () => void;
}

export const MobileDevices: React.FC<MobileDevicesProps> = ({ devices, refreshing, onAdd, onConnect, onRename, onRemove, onRefresh }) => {
  const [filter, setFilter] = useState<'all' | 'online'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sheetDevice, setSheetDevice] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return devices
      .filter((device) => (filter === 'online' ? device.is_online : true))
      .filter((device) => (query ? `${device.device_name || ''} ${device.access_key || ''}`.toLowerCase().includes(query) : true));
  }, [devices, filter, search]);

  const lastSeenLabel = (device: any) => {
    const value = device.last_seen || device.last_seen_at;
    if (!value) return 'offline';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'offline';
    const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (mins < 60) return `offline · ${mins}m ago`;
    if (mins < 60 * 24) return `offline · ${Math.round(mins / 60)}h ago`;
    return `offline · ${Math.round(mins / 1440)}d ago`;
  };

  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="flex-none px-4 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[20px] font-semibold text-[#111315]">Devices</h2>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Refresh devices" onClick={onRefresh} className="flex h-9 w-9 items-center justify-center rounded-full text-[#111315]/70 active:bg-[#F3F4F6]">
              <RefreshCw size={17} className={refreshing ? 'animate-spin text-[#FF8A00]' : ''} />
            </button>
            <button
              type="button"
              aria-label="Search devices"
              onClick={() => { setSearchOpen((open) => !open); setSearch(''); }}
              className={`flex h-9 w-9 items-center justify-center rounded-full active:bg-[#F3F4F6] ${searchOpen ? 'text-[#FF8A00]' : 'text-[#111315]/70'}`}
            >
              <Search size={18} />
            </button>
          </div>
        </div>
        {searchOpen && (
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search devices"
            className="mt-2 h-10 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00]"
          />
        )}
        <div className="mt-3 flex gap-2">
          {(['all', 'online'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`h-8 rounded-full px-4 text-[12px] font-semibold capitalize ${
                filter === key ? 'bg-[#111315] text-white' : 'border border-[rgba(26,29,33,0.15)] text-[#111315]/70'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[rgba(26,29,33,0.06)]">
        {visible.length === 0 && (
          <p className="m-0 px-6 pt-10 text-center text-[13px] text-[#111315]/45">
            {devices.length === 0 ? 'No devices yet — add one with the + button.' : 'No devices match.'}
          </p>
        )}
        {visible.map((device) => (
          <div key={device.id || device.access_key} className="flex items-center gap-3 border-b border-[rgba(26,29,33,0.06)] px-4 py-3">
            <span className={`h-2.5 w-2.5 flex-none rounded-full ${device.is_online ? 'bg-[#34C759]' : 'bg-[rgba(26,29,33,0.2)]'}`} />
            <button type="button" onClick={() => onConnect(device)} className="min-w-0 flex-1 text-left">
              <span className={`block truncate text-[14px] font-medium ${device.is_online ? 'text-[#111315]' : 'text-[#111315]/55'}`}>
                {device.device_name || device.name || 'Device'}
              </span>
              <span className="block text-[12px] text-[#111315]/45">
                {device.is_online ? formatAccessKey(device.access_key) : lastSeenLabel(device)}
              </span>
            </button>
            {device.is_online && (
              <button type="button" onClick={() => onConnect(device)} className="flex-none rounded-full bg-[#34C759] px-3.5 py-1.5 text-[12px] font-semibold text-white active:scale-95">
                Connect
              </button>
            )}
            <button
              type="button"
              aria-label={`Actions for ${device.device_name || 'device'}`}
              onClick={() => { setCopied(false); setSheetDevice(device); }}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#111315]/45 active:bg-[#F3F4F6]"
            >
              <MoreVertical size={17} />
            </button>
          </div>
        ))}
        <div className="h-24" />
      </div>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add device"
        className="absolute bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl active:scale-95"
        style={gradient}
      >
        <Plus size={26} />
      </button>

      {sheetDevice && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Device actions">
          <button type="button" aria-label="Close device actions" onClick={() => setSheetDevice(null)} className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <div className="px-5 py-3">
              <p className="m-0 text-[14px] font-semibold text-[#111315]">{sheetDevice.device_name || 'Device'}</p>
              <p className="m-0 text-[12px] text-[#111315]/45">{formatAccessKey(sheetDevice.access_key)}</p>
            </div>
            <div className="border-t border-[rgba(26,29,33,0.08)]">
              {sheetDevice.is_online && (
                <button type="button" onClick={() => { const device = sheetDevice; setSheetDevice(null); onConnect(device); }} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]">
                  <LogIn size={17} className="text-[#34C759]" /><span className="text-[14px] font-medium text-[#111315]">Connect</span>
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try { await navigator.clipboard?.writeText?.(String(sheetDevice.access_key || '')); setCopied(true); } catch { /* clipboard unavailable */ }
                }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]"
              >
                <Copy size={17} className="text-[#111315]/55" />
                <span className="text-[14px] font-medium text-[#111315]">{copied ? 'ID copied' : 'Copy ID'}</span>
              </button>
              <button type="button" onClick={() => { const device = sheetDevice; setSheetDevice(null); onRename(device); }} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#F9FAFB]">
                <Edit2 size={17} className="text-[#111315]/55" /><span className="text-[14px] font-medium text-[#111315]">Rename</span>
              </button>
              <button type="button" onClick={() => { const device = sheetDevice; setSheetDevice(null); onRemove(device); }} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#FFF5F5]">
                <Trash2 size={17} className="text-[#D64545]" /><span className="text-[14px] font-medium text-[#D64545]">Remove</span>
              </button>
              <button type="button" onClick={() => setSheetDevice(null)} className="flex w-full items-center gap-3 border-t border-[rgba(26,29,33,0.08)] px-5 py-3 text-left active:bg-[#F9FAFB]">
                <X size={17} className="text-[#111315]/55" /><span className="text-[14px] font-medium text-[#111315]">Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Meeting ---------------------------------------------------------------

export const MobileMeeting: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [busyAction, setBusyAction] = useState<'instant' | 'later' | 'calendar' | null>(null);
  const [laterInfo, setLaterInfo] = useState<{ link: string; code: string; expiresAt?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const formatDashedCode = (code: string) => {
    const clean = normalizeMeetingCode(code);
    if (clean.length === 9) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
    return code;
  };

  const createMeeting = async (variant: 'instant' | 'later') => {
    const { data } = await api.post('/api/chat/meetings', {
      name: `${user?.name || 'Remote365'} meeting`,
      ...(variant === 'later' ? { variant } : {}),
    });
    return data;
  };

  const startInstant = async () => {
    setBusyAction('instant');
    setError('');
    try {
      const data = await createMeeting('instant');
      setActiveMeetingId(data.displayCode || formatDashedCode(data.sessionCode));
    } catch {
      // Offline fallback: unregistered codes still work as ephemeral rooms.
      const raw = Math.floor(100000000 + Math.random() * 900000000).toString();
      setActiveMeetingId(`${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const createForLater = async (schedule: boolean) => {
    setBusyAction(schedule ? 'calendar' : 'later');
    setError('');
    try {
      const data = await createMeeting('later');
      const code = data.displayCode || formatDashedCode(data.sessionCode);
      const link = buildWebMeetingUrl(code);
      if (schedule) {
        window.open(
          buildGoogleCalendarEventUrl({ title: data.name || 'Remote365 meeting', meetingLink: link, meetingCode: code }),
          '_blank',
          'noopener,noreferrer'
        );
      } else {
        setCopied(false);
        setLaterInfo({ link, code, expiresAt: data.expiresAt || null });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create meeting. Check your connection.');
    } finally {
      setBusyAction(null);
    }
  };

  const copyJoiningInfo = () => {
    if (!laterInfo) return;
    navigator.clipboard?.writeText(`${laterInfo.link}\nMeeting code: ${laterInfo.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  // Accepts a bare code or a pasted meeting link (use only the last path
  // segment so the digits in the domain never leak into the code).
  const parseJoinInput = (raw: string) => {
    const value = String(raw || '').trim();
    const segment = value.includes('/') ? value.split('/').filter(Boolean).pop() || '' : value;
    return normalizeMeetingCode(segment);
  };

  const joinMeeting = () => {
    const clean = parseJoinInput(joinCode);
    if (clean) setActiveMeetingId(clean);
  };

  if (activeMeetingId) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#080808]">
        <SnowMeeting meetingId={activeMeetingId} onLeave={() => setActiveMeetingId(null)} />
      </div>
    );
  }

  const now = new Date();
  const timeLine = `${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${now.toLocaleDateString([], { weekday: 'long', month: 'numeric', day: 'numeric', year: '2-digit' })}`;

  // Figma "Meeting" home: time header, start card, quick join.
  return (
    <div className="h-full overflow-y-auto bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="px-4 pb-6 pt-4">
        <h2 className="m-0 text-[20px] font-semibold text-[#111315]">Meeting</h2>
        <p className="m-0 mt-1 text-[12px] text-[#111315]/45">{timeLine}</p>
        <p className="m-0 mt-2 text-[13px] leading-5 text-[#111315]/55">
          Use secure meetings, collaborate with your team and connect instantly from anywhere.
        </p>

        <div className="mt-5 rounded-2xl border border-[rgba(26,29,33,0.1)] p-4">
          <p className="m-0 text-[15px] font-semibold text-[#111315]">Start a new meeting</p>
          <p className="m-0 mt-0.5 text-[12px] text-[#111315]/45">Instant, for later, or in Google Calendar</p>
          <button
            type="button"
            onClick={startInstant}
            disabled={busyAction !== null}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white active:scale-[0.99] disabled:opacity-60"
            style={gradient}
          >
            {busyAction === 'instant' ? <RefreshCw size={17} className="animate-spin" /> : <Video size={17} />}
            {busyAction === 'instant' ? 'Starting…' : 'Start an instant meeting'}
          </button>
          <button
            type="button"
            onClick={() => createForLater(false)}
            disabled={busyAction !== null}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[rgba(26,29,33,0.15)] text-[14px] font-semibold text-[#111315] active:bg-[#F9FAFB] disabled:opacity-60"
          >
            {busyAction === 'later' ? <RefreshCw size={17} className="animate-spin" /> : <Link2 size={17} className="text-[#111315]/55" />}
            {busyAction === 'later' ? 'Creating…' : 'Create a meeting for later'}
          </button>
          <button
            type="button"
            onClick={() => createForLater(true)}
            disabled={busyAction !== null}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[rgba(26,29,33,0.15)] text-[14px] font-semibold text-[#111315] active:bg-[#F9FAFB] disabled:opacity-60"
          >
            {busyAction === 'calendar' ? <RefreshCw size={17} className="animate-spin" /> : <CalendarPlus size={17} className="text-[#111315]/55" />}
            {busyAction === 'calendar' ? 'Creating…' : 'Schedule in Google Calendar'}
          </button>
          {error && <p className="m-0 mt-2 text-[12px] font-medium text-[#D64545]">{error}</p>}
        </div>

        <div className="mt-4 rounded-2xl border border-[rgba(26,29,33,0.1)] p-4">
          <p className="m-0 text-[15px] font-semibold text-[#111315]">Quick join</p>
          <p className="m-0 mt-0.5 text-[12px] text-[#111315]/45">Enter meeting code or link</p>
          <form
            onSubmit={(event) => { event.preventDefault(); joinMeeting(); }}
            className="mt-3 flex gap-2"
          >
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="xxx-xxx-xxx or link"
              className="h-11 min-w-0 flex-1 rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00]"
            />
            <button
              type="submit"
              disabled={!parseJoinInput(joinCode)}
              className="flex h-11 flex-none items-center justify-center rounded-xl bg-[#34C759] px-5 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      {laterInfo && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-label="Meeting joining info">
          <button type="button" aria-label="Close joining info" onClick={() => setLaterInfo(null)} className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-white shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[rgba(26,29,33,0.2)]" />
            <div className="px-5 py-4">
              <p className="m-0 text-[16px] font-semibold text-[#111315]">Here's your joining info</p>
              <p className="m-0 mt-1 text-[12px] leading-4 text-[#111315]/55">
                Send this to people you want to meet with. Save it so you can use it later, too.
              </p>
              <div className="mt-3 rounded-xl bg-[#F9FAFB] p-3">
                <p className="m-0 break-all text-[13px] leading-5 text-[#111315]">{laterInfo.link}</p>
                <p className="m-0 mt-1 font-mono text-[12px] text-[#111315]/55">Meeting code: {laterInfo.code}</p>
                {laterInfo.expiresAt && (
                  <p className="m-0 mt-1 text-[11px] text-[#111315]/45">
                    Active until {new Date(laterInfo.expiresAt).toLocaleDateString([], { month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={copyJoiningInfo}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white active:scale-[0.99]"
                style={gradient}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copied!' : 'Copy joining info'}
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(
                    buildGoogleCalendarEventUrl({ title: `${user?.name || 'Remote365'} meeting`, meetingLink: laterInfo.link, meetingCode: laterInfo.code }),
                    '_blank',
                    'noopener,noreferrer'
                  );
                }}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[rgba(26,29,33,0.15)] text-[14px] font-semibold text-[#111315] active:bg-[#F9FAFB]"
              >
                <CalendarPlus size={17} className="text-[#111315]/55" />
                Schedule in Google Calendar
              </button>
              <button
                type="button"
                onClick={() => setLaterInfo(null)}
                className="mt-2 flex h-10 w-full items-center justify-center rounded-xl text-[13px] font-medium text-[#111315]/55 active:bg-[#F9FAFB]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
