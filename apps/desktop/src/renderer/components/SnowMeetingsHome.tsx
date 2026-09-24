import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Copy,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Link2,
  CalendarPlus,
  ExternalLink,
  Check,
} from 'lucide-react';
import api from '../lib/api';
import { MeetingPreviewModal } from './MeetingPreviewModal';
import { MeetingReadyModal } from './MeetingReadyModal';
import { buildMeetingWebUrl } from '../utils/server';
import { buildGoogleCalendarEventUrl } from '../utils/googleCalendar';
import FirstRunGuide from './onboarding/FirstRunGuide';

import { LottieScene } from './lottie/LottieScene';
import meetingsConnectAnimation from '../assets/animations/meetingsConnect.json';
interface SnowMeetingsHomeProps {
  onJoinMeeting: (meetingId: string) => void;
  user: any;
}

type MeetingKind = 'instant' | 'later' | 'calendar';

export const SnowMeetingsHome: React.FC<SnowMeetingsHomeProps> = ({ onJoinMeeting, user }) => {
  const [meetingCode, setMeetingCode] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [meetings, setMeetings] = useState<any[]>([]);
  const [creatingVariant, setCreatingVariant] = useState<'instant' | 'later' | 'calendar' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [readyMeeting, setReadyMeeting] = useState<any | null>(null);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Which Recent Meetings row has its share menu (link / ID) open.
  const [shareMenuFor, setShareMenuFor] = useState<string | null>(null);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<{ mode: 'create' } | { mode: 'join'; code: string } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isCreating = creatingVariant !== null;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!shareMenuFor) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!shareMenuRef.current?.contains(event.target as Node)) setShareMenuFor(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShareMenuFor(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [shareMenuFor]);

  // Only hours and minutes are shown, so tick once per minute, aligned to the
  // minute boundary, instead of re-rendering the whole page every second.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = new Date();
      setCurrentTime(now);
      timer = setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
    };
    tick();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  const fetchMeetings = async () => {
    setIsLoadingMeetings(true);
    try {
      const { data } = await api.get('/api/chat/meetings');
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Meetings] Failed to load meetings', err);
    } finally {
      setIsLoadingMeetings(false);
    }
  };

  // The main window's signaling socket already relays account-sync events for
  // meetings as 'remote365:remote-sessions-changed' (see App.tsx), so this page
  // no longer opens a second authenticated socket of its own. Window focus is
  // the fallback for anything missed while the app was in the background.
  useEffect(() => {
    fetchMeetings();
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.scope === 'meetings') fetchMeetings();
    };
    const onFocus = () => fetchMeetings();
    window.addEventListener('remote365:remote-sessions-changed', onSync);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('remote365:remote-sessions-changed', onSync);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const formatCode = (code: string) => {
    const clean = String(code || '').replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length === 9) return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
    return code;
  };

  const extractMeetingCode = (value: string) => {
    const trimmed = value.trim();
    // Pasted joining info may carry the link plus a "Meeting code:" line; pull
    // the first URL out of it, then fall back to the first 9-character code.
    const urlMatch = trimmed.match(/https?:\/\/\S+|remote365:\/\/\S+/i);
    try {
      const parsed = new URL(urlMatch ? urlMatch[0] : trimmed);
      return parsed.searchParams.get('code') || parsed.pathname.split('/').filter(Boolean).pop() || trimmed;
    } catch {
      const codeMatch = trimmed.match(/\b([a-zA-Z0-9]{3})[-\s]?([a-zA-Z0-9]{3})[-\s]?([a-zA-Z0-9]{3})\b/);
      return codeMatch ? `${codeMatch[1]}${codeMatch[2]}${codeMatch[3]}` : trimmed;
    }
  };

  const requestMeeting = async (kind: MeetingKind) => {
    const { data } = await api.post('/api/chat/meetings', {
      name: `${user?.name || 'Remote365'} meeting`,
      // 'variant' drives the link lifetime on every server; 'kind' is the finer
      // label (instant / later / calendar) newer servers store so Recent
      // Meetings can show which of the three each meeting is.
      ...(kind === 'instant' ? {} : { variant: 'later' }),
      kind,
    });
    setMeetings((prev) => [data, ...prev.filter((meeting) => meeting.id !== data.id)]);
    return data;
  };

  const createMeeting = async () => {
    setCreatingVariant('instant');
    setErrorMessage('');
    try {
      const data = await requestMeeting('instant');
      setPreview(null);
      onJoinMeeting(data.displayCode || formatCode(data.sessionCode));
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Could not create meeting.');
    } finally {
      setCreatingVariant(null);
    }
  };

  const openExternalUrl = (url: string) => {
    const electronApi = (window as any).electronAPI;
    if (electronApi?.openExternal) {
      electronApi.openExternal(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openGoogleCalendar = (meeting: any) => {
    const code = meeting.displayCode || formatCode(meeting.sessionCode);
    const link = meeting.joinLink || buildMeetingWebUrl(code);
    openExternalUrl(
      buildGoogleCalendarEventUrl({
        title: meeting.name || 'Remote365 Meeting',
        meetingLink: link,
        meetingCode: code,
        validUntil: meeting.expiresAt,
      })
    );
  };

  const createMeetingForLater = async (schedule: boolean) => {
    setMenuOpen(false);
    setCreatingVariant(schedule ? 'calendar' : 'later');
    setErrorMessage('');
    try {
      const data = await requestMeeting(schedule ? 'calendar' : 'later');
      const code = data.displayCode || formatCode(data.sessionCode);
      // Build the link client-side so it targets this build's web host.
      const enriched = { ...data, displayCode: code, joinLink: buildMeetingWebUrl(code) };
      if (schedule) openGoogleCalendar(enriched);
      else setReadyMeeting(enriched);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Could not create meeting.');
    } finally {
      setCreatingVariant(null);
    }
  };

  const openPreview = (target: { mode: 'create' } | { mode: 'join'; code: string }) => {
    setErrorMessage('');
    setPreview(target);
  };

  const closePreview = () => {
    setPreview(null);
    setErrorMessage('');
  };

  const handleConfirmPreview = () => {
    if (!preview) return;
    if (preview.mode === 'create') {
      createMeeting();
    } else {
      const code = preview.code;
      setPreview(null);
      onJoinMeeting(code);
    }
  };

  const handleJoin = () => {
    if (!meetingCode.trim()) return;
    // Meeting codes are 9 characters. Anything else used to open a meeting
    // window for a room that does not exist (typing "abc" created room ABC).
    const clean = extractMeetingCode(meetingCode).replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length !== 9) {
      setErrorMessage('Enter A 9-Digit Meeting Code Or A Meeting Link.');
      return;
    }
    openPreview({ mode: 'join', code: formatCode(clean) });
  };

  const getMeetingExpiresAt = (meeting: any) => {
    if (meeting?.expiresAt) return new Date(meeting.expiresAt);
    return new Date(new Date(meeting?.createdAt || Date.now()).getTime() + 30 * 60 * 1000);
  };

  // Live = running right now (IN_PROGRESS, however old its link) or an unused
  // link that has not expired. The status flips to IN_PROGRESS the moment
  // anyone joins, which this page used to read as "Expired".
  const isMeetingJoinable = (meeting: any) => {
    const status = String(meeting?.status || 'ACTIVE').toUpperCase();
    if (status === 'IN_PROGRESS') return true;
    return status === 'ACTIVE' && !meeting?.isExpired && getMeetingExpiresAt(meeting).getTime() > Date.now();
  };

  const meetingValidityLabel = (meeting: any) => {
    if (!isMeetingJoinable(meeting)) return '• Expired';
    if (String(meeting?.status || '').toUpperCase() === 'IN_PROGRESS') return '• Live Now';
    const expires = getMeetingExpiresAt(meeting);
    // Only long-lived "for later" links warrant a validity note.
    if (expires.getTime() - Date.now() < 2 * 60 * 60 * 1000) return '';
    return `• Active until ${expires.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  // The three New Meeting options, shown per row so the kinds are told apart
  // at a glance. Icons match the New Meeting menu.
  const MEETING_KINDS = {
    instant: { label: 'Instant', icon: Video, chip: 'bg-[#ECFDF3] text-[#15803D] dark:bg-[#34C759]/15 dark:text-[#6EE7A0]' },
    later: { label: 'For Later', icon: Link2, chip: 'bg-[#FFF4E5] text-[#B54708] dark:bg-[#FF8A00]/15 dark:text-[#FFB347]' },
    calendar: { label: 'Google Calendar', icon: CalendarPlus, chip: 'bg-[#EEF4FF] text-[#3B5BDB] dark:bg-[#5B7CFA]/15 dark:text-[#9DB2FF]' },
  } as const;
  const getMeetingKind = (meeting: any): MeetingKind => {
    const stored = String(meeting?.variant || '').toLowerCase();
    if (stored === 'instant' || stored === 'later' || stored === 'calendar') return stored;
    // Rows created before the kind was stored: a link that lives longer than a
    // couple of hours can only have come from "for later".
    const lifetime = getMeetingExpiresAt(meeting).getTime() - new Date(meeting?.createdAt || Date.now()).getTime();
    return lifetime > 2 * 60 * 60 * 1000 ? 'later' : 'instant';
  };

  // Copies a value (the join link, or the code as displayed: 123-456-789) and
  // flags that exact button as "Copied" for a moment.
  const handleCopyValue = (key: string, value: string) => {
    const electronApi = (window as any).electronAPI;
    if (electronApi?.clipboard?.writeText) electronApi.clipboard.writeText(value);
    else navigator.clipboard?.writeText(value);
    setCopiedId(key);
    setTimeout(() => setCopiedId((current) => (current === key ? null : current)), 1600);
  };

  const formattedTime = currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
    <div className="flex h-full w-full flex-col bg-white font-sans text-[#111315] dark:bg-[#080808] dark:text-[#F5F5F5] overflow-hidden animate-in fade-in duration-300">
      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 sm:px-10">
        <div className="w-full max-w-[1320px]">
          {/* Time row */}
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-medium leading-[25px] text-black dark:text-white">{formattedTime}</span>
            <span className="h-[3px] w-[3px] rounded-full bg-[#1A1D21]/30 dark:bg-white/30" />
            <span className="text-[14px] font-normal leading-5 text-black dark:text-[#D1D1D1]">{formattedDate}</span>
          </div>

          {/* Heading */}
          <h1 className="mt-6 max-w-[592px] text-[24px] font-bold leading-[34px] text-black dark:text-white">
            Start secure meetings, collaborate with your team, and connect instantly from anywhere.
          </h1>

          {/* Two columns */}
          <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12 xl:gap-[120px]">
            {/* Left column */}
            <div className="flex w-full min-w-0 flex-col gap-8 lg:mt-6 lg:w-[497px] lg:flex-shrink">
              <FirstRunGuide
                pageId="meetings"
                steps={[
                  { title: 'Welcome To Meetings', description: 'Host video meetings with screen sharing and remote control, right from Remote365.' },
                  { title: 'Start A Meeting', description: 'Click New meeting to start an instant room, create a link for later, or schedule it in Google Calendar.', target: '[data-tour="new-meeting"]' },
                  { title: 'Join With A Code', description: 'Got an invite? Paste the meeting code or link into the join box and you\'re in.' },
                ]}
              />
              {/* Start a new meeting */}
              <div className="flex items-center justify-between gap-6">
                <div className="flex flex-col">
                  <span className="text-[18px] font-medium leading-[25px] text-black dark:text-white">Start A New Meeting</span>
                  <span className="mt-1 text-[14px] font-normal leading-5 text-black dark:text-[#D1D1D1]">Instant, for later, or in Google Calendar</span>
                </div>
                <div ref={menuRef} className="relative flex-shrink-0">
                  <button
                    type="button"
                    data-tour="new-meeting"
                    onClick={() => setMenuOpen((open) => !open)}
                    disabled={isCreating}
                    className="group flex h-10 items-center justify-center gap-2 rounded px-4 text-[14px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
                    style={{ background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' }}
                  >
                    {isCreating ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Video size={16} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
                    )}
                    {isCreating ? 'Creating…' : 'New Meeting'}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-11 z-30 w-[268px] overflow-hidden rounded-[8px] border border-[#1A1D21]/10 bg-white py-1 shadow-[0_12px_32px_rgba(17,19,21,0.16)] animate-in fade-in zoom-in-95 duration-150 dark:border-white/10 dark:bg-[#101010]">
                      {[
                        { icon: Link2, label: 'Create A Meeting For Later', action: () => createMeetingForLater(false) },
                        { icon: Video, label: 'Start An Instant Meeting', action: () => { setMenuOpen(false); openPreview({ mode: 'create' }); } },
                        { icon: CalendarPlus, label: 'Schedule In Google Calendar', action: () => createMeetingForLater(true) },
                      ].map(({ icon: Icon, label, action }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={action}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-normal text-[#111315] transition-colors hover:bg-[#F3F4F6] dark:text-white dark:hover:bg-white/5"
                        >
                          <Icon size={16} className="flex-shrink-0 text-[#1A1D21]/60 dark:text-white/60" />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick join */}
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                  <h2 className="text-[18px] font-medium leading-[25px] text-black dark:text-white">Quick Join</h2>
                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium leading-5 text-[#1A1D21] dark:text-[#F5F5F5]">Enter Code Or Link</label>
                    <div className="flex items-end gap-2">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1D21]/40 dark:text-white/40" />
                        <input
                          type="text"
                          value={meetingCode}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (errorMessage) setErrorMessage('');
                            // Leave invite links untouched; auto-format plain codes as 123-456-789.
                            if (/[:/.]/.test(value)) {
                              setMeetingCode(value);
                              return;
                            }
                            const raw = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);
                            const parts = raw.match(/.{1,3}/g) || [];
                            setMeetingCode(parts.join('-'));
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                          placeholder="e.g. 123-456-789"
                          className="h-10 w-full rounded border border-[#1A1D21]/30 bg-white pl-11 pr-4 text-[14px] font-normal text-[#111315] outline-none transition-colors placeholder:text-[#111315]/30 focus:border-[#FF8A00] dark:border-white/20 dark:bg-transparent dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleJoin}
                        disabled={!meetingCode.trim()}
                        className={`h-10 w-[136px] flex-shrink-0 rounded border text-[14px] font-medium transition-all ${
                          meetingCode.trim()
                            ? 'border-[#FF8A00] bg-[#FF8A00] text-white hover:brightness-105'
                            : 'cursor-not-allowed border-[#F3F4F6] bg-[#F3F4F6] text-[#1A1D21]/30 dark:border-white/5 dark:bg-white/5 dark:text-white/30'
                        }`}
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </div>

                {errorMessage && <p className="-mt-4 text-[13px] font-medium text-red-500">{errorMessage}</p>}

                {/* Recent meetings */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-medium text-[#1A1D21] dark:text-[#F5F5F5]">Recent Meetings</span>
                    <button
                      type="button"
                      onClick={fetchMeetings}
                      title="Refresh Meetings"
                      className="flex h-8 w-8 items-center justify-center rounded text-[#1A1D21]/60 transition-colors hover:text-[#FF8A00] dark:text-white/60"
                    >
                      <RefreshCw size={15} className={isLoadingMeetings ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {meetings.length === 0 ? (
                    <div className="flex h-9 items-center justify-center rounded bg-[#F3F4F6] text-[12px] font-normal leading-[17px] text-[#111315] dark:bg-white/5 dark:text-[#D1D1D1]">
                      No Meetings Yet.
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {meetings.slice(0, 6).map((meeting) => {
                        const code = meeting.displayCode || formatCode(meeting.sessionCode);
                        const joinable = isMeetingJoinable(meeting);
                        const kind = MEETING_KINDS[getMeetingKind(meeting)];
                        const KindIcon = kind.icon;
                        // Built here so it targets this build's web host, like the joining-info modal.
                        const link = buildMeetingWebUrl(code);
                        const shareOpen = shareMenuFor === meeting.id;
                        return (
                          <div
                            key={meeting.id}
                            className="group flex items-center gap-3 border-b border-[#1A1D21]/30 px-4 py-2 dark:border-white/15"
                          >
                            <KindIcon size={18} className="flex-shrink-0 text-[#1A1D21] dark:text-white/70" aria-label={kind.label} />
                            <button
                              type="button"
                              onClick={() => joinable && openPreview({ mode: 'join', code })}
                              disabled={!joinable}
                              className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-[14px] font-normal leading-5 text-[#111315] dark:text-white">
                                  {meeting.name}
                                </span>
                                <span className={`inline-flex flex-shrink-0 items-center rounded-[10px] px-1.5 py-0.5 text-[10px] font-medium leading-[14px] ${kind.chip}`}>
                                  {kind.label}
                                </span>
                              </div>
                              <div className="truncate font-mono text-[12px] text-[#1A1D21]/50 dark:text-[#A0A0A0]">
                                {code} {meetingValidityLabel(meeting)}
                              </div>
                            </button>
                            <div className="relative" ref={shareOpen ? shareMenuRef : undefined}>
                              <button
                                type="button"
                                onClick={() => setShareMenuFor((current) => (current === meeting.id ? null : meeting.id))}
                                disabled={!joinable}
                                aria-expanded={shareOpen}
                                title={joinable ? 'Share Meeting' : 'This Meeting Has Expired'}
                                className={`flex h-7 w-7 items-center justify-center rounded transition-colors hover:text-[#FF8A00] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[#1A1D21]/50 ${shareOpen ? 'text-[#FF8A00]' : 'text-[#1A1D21]/50 dark:text-white/50'}`}
                              >
                                <Copy size={14} />
                              </button>
                              {shareOpen && (
                                <div className="absolute right-0 top-8 z-30 w-[300px] rounded-[8px] border border-[#1A1D21]/10 bg-white p-2 shadow-[0_12px_32px_rgba(17,19,21,0.16)] animate-in fade-in zoom-in-95 duration-150 dark:border-white/10 dark:bg-[#101010]">
                                  <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[#1A1D21]/50 dark:text-white/40">Meeting Link</p>
                                  <button
                                    type="button"
                                    onClick={() => openExternalUrl(link)}
                                    title="Open In Browser"
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-[#F3F4F6] dark:hover:bg-white/5"
                                  >
                                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#FF8A00] underline-offset-2 hover:underline">{link}</span>
                                    <ExternalLink size={13} className="flex-shrink-0 text-[#1A1D21]/50 dark:text-white/50" />
                                  </button>
                                  <div className="mt-1 grid grid-cols-2 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyValue(`${meeting.id}:link`, link)}
                                      className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#F3F4F6] text-[12px] font-medium text-[#111315] transition-colors hover:bg-[#E5E7EB] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                                    >
                                      {copiedId === `${meeting.id}:link` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                      {copiedId === `${meeting.id}:link` ? 'Copied' : 'Copy Link'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyValue(`${meeting.id}:id`, code)}
                                      className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#F3F4F6] text-[12px] font-medium text-[#111315] transition-colors hover:bg-[#E5E7EB] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                                    >
                                      {copiedId === `${meeting.id}:id` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                      {copiedId === `${meeting.id}:id` ? 'Copied' : 'Copy ID'}
                                    </button>
                                  </div>
                                  <p className="mt-1.5 px-2 font-mono text-[11px] text-[#1A1D21]/50 dark:text-[#A0A0A0]">ID {code}</p>
                                </div>
                              )}
                            </div>
                            <ChevronRight size={16} className="flex-shrink-0 text-[#111315] dark:text-white/70" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column — a single illustration. The glow cluster and the
                Secure Link Ready card that used to live here were removed. */}
            <div className="flex w-full items-center justify-center lg:flex-1">
              {/* 518 is the animation's authored canvas size. Its chat bubbles
                  carry baked 12-14px text, so anything smaller renders the text
                  at a few pixels and it turns to mush. */}
              <LottieScene
                animationData={meetingsConnectAnimation}
                size={518}
                label="Connect And Chat"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <MeetingPreviewModal
      open={!!preview}
      mode={preview?.mode ?? 'join'}
      busy={isCreating}
      error={errorMessage}
      onCancel={closePreview}
      onConfirm={handleConfirmPreview}
    />

    <MeetingReadyModal
      open={!!readyMeeting}
      meeting={readyMeeting}
      onClose={() => setReadyMeeting(null)}
      onSchedule={openGoogleCalendar}
    />
    </>
  );
};
