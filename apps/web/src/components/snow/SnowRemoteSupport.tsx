import React, { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Video,
  Copy,
  RefreshCw,
  ChevronDown,
  Clock,
  History,
  Zap,
  Mail,
  CheckCircle2,
  AlertCircle,
  X as CloseIcon,
  Trash2,
  ArrowRight,
  MoreVertical,
  Send,
  Pencil,
} from 'lucide-react';
import api from '../../lib/api';
import { applyEasyAccess, isEasyAccessEnabled, subscribeEasyAccess } from '../../lib/easyAccess';
import { translateStaticText } from '../../lib/translations';
import { useAuthStore } from '../../store/authStore';
import { buildWebSessionJoinUrl } from '../../lib/meetingLinks';
import { LottieScene } from '../lottie/LottieScene';
import devicesChangingAnimation from '../../assets/animations/devicesChanging.json';
import collaboratorIconAsset from '../../assets/collaborator.svg';
import {
  formatAccessKey,
  getRecentConnections,
  removeRecentConnection,
} from '../../lib/recentConnections';
import type { RecentConnection } from '../../lib/recentConnections';

const collaboratorIcon = collaboratorIconAsset.src;

interface SnowRemoteSupportProps {
  localAuthKey: string | null;
  devicePassword: string;
  onCopyAccessKey: () => void;
  onOpenSetPassword: () => void;
  onConnect: (partnerId: string) => void;
  onStartHosting: () => void;
  onStopHosting: () => void;
  hostStatus: string;
  onJoinSessionInvite?: (code: string, password?: string) => void;
  onJoinMeeting?: (meetingId: string) => void;
  onHostOwnSession?: (session: any) => void;
  isAutoHostEnabled?: boolean;
  onToggleAutoHost?: (next: boolean) => void;
  /** Shown under Connect when device lookup fails (signed-in Remote Support). */
  remoteLookupError?: string | null;
  /** True while /lookup or /status is in progress. */
  isRemoteLookupConnecting?: boolean;
  initialTab?: 'id' | 'sessions';
  openCreateSessionSignal?: number;
  openJoinSessionSignal?: number;
}

export const SnowRemoteSupport: React.FC<SnowRemoteSupportProps> = ({
  localAuthKey,
  devicePassword,
  onCopyAccessKey,
  onOpenSetPassword,
  onConnect,
  onStartHosting,
  onStopHosting,
  hostStatus,
  onJoinSessionInvite,
  onJoinMeeting,
  onHostOwnSession,
  isAutoHostEnabled,
  onToggleAutoHost,
  remoteLookupError,
  isRemoteLookupConnecting,
  initialTab,
  openCreateSessionSignal,
  openJoinSessionSignal,
}) => {
  const user = useAuthStore((state) => state.user);
  const lang = user?.language;
  const tx = (text: string) => translateStaticText(text, lang);
  const [partnerId, setPartnerId] = useState('');
  const [activeTab, setActiveTab] = useState<'id' | 'sessions'>('id');
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [sessionName, setSessionName] = useState('Remote session');
  const [sessionEmail, setSessionEmail] = useState('');
  const [sessionInviteStatus, setSessionInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sessionInviteMessage, setSessionInviteMessage] = useState('');
  const [remoteSessions, setRemoteSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsPage, setSessionsPage] = useState(1);
  const SESSIONS_PER_PAGE = 6;
  // Rows disappear on refresh (closed / expired sessions), so a page that no longer
  // exists must fall back to the last one instead of rendering an empty table.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(remoteSessions.length / SESSIONS_PER_PAGE));
    if (sessionsPage > totalPages) setSessionsPage(totalPages);
  }, [remoteSessions.length, sessionsPage]);
  // Creator-side waiting room: shown until someone joins the session, at which
  // point App auto-opens the remote viewer and fires remote365:session-joined.
  const [waitingSession, setWaitingSession] = useState<any | null>(null);

  useEffect(() => {
    // Someone used the code: the status panel switches from "waiting" to who
    // is connected, and the list refreshes with the joined state.
    const onJoined = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      setWaitingSession((current: any) => {
        if (!current || (detail.sessionId && current.id !== detail.sessionId)) return current;
        return { ...current, joinedByName: detail.joinerName || current.joinedByName || 'Someone' };
      });
      fetchRemoteSessions({ silent: true });
    };
    window.addEventListener('remote365:session-joined', onJoined);
    return () => window.removeEventListener('remote365:session-joined', onJoined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showInviteActions, setShowInviteActions] = useState(false);
  const [showJoinSessionModal, setShowJoinSessionModal] = useState(false);
  const [joinSessionCode, setJoinSessionCode] = useState('');
  const [openSessionMenu, setOpenSessionMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [copiedSessionCodeId, setCopiedSessionCodeId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const [editingSessionSaving, setEditingSessionSaving] = useState(false);
  const [closingSession, setClosingSession] = useState<any | null>(null);
  const [recentConnections, setRecentConnections] = useState<RecentConnection[]>(() => getRecentConnections());
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  // One flag shared with the landing checkbox and Settings → Device
  // management → "Unattended access" (see lib/easyAccess).
  const [easyAccess, setEasyAccess] = useState<boolean>(() => isEasyAccessEnabled());
  const recentDropdownRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeEasyAccess(setEasyAccess), []);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!openCreateSessionSignal) return;
    setActiveTab('sessions');
    setShowJoinSessionModal(false);
    setShowAddSessionModal(true);
  }, [openCreateSessionSignal]);

  useEffect(() => {
    if (!openJoinSessionSignal) return;
    setActiveTab('sessions');
    setShowAddSessionModal(false);
    setShowJoinSessionModal(true);
  }, [openJoinSessionSignal]);

  const refreshRecentConnections = () => setRecentConnections(getRecentConnections());

  // Re-read recent connections whenever this view re-mounts and when window regains focus
  useEffect(() => {
    refreshRecentConnections();
    const handler = () => refreshRecentConnections();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  useEffect(() => {
    if (recentConnections.length > 0) setRecentExpanded(true);
  }, [recentConnections.length]);

  // Close the recent-IDs dropdown on outside click
  useEffect(() => {
    if (!showRecentDropdown) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (recentDropdownRef.current?.contains(target)) return;
      if (inputWrapperRef.current?.contains(target)) return;
      setShowRecentDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showRecentDropdown]);

  const formatId = (id: string | null) => formatAccessKey(id);
  const cleanPartnerId = partnerId.replace(/\D/g, '');
  const canConnect = cleanPartnerId.length >= 6;

  const handlePartnerIdChange = (value: string) => {
    const formatted = formatAccessKey(value.replace(/\D/g, '').slice(0, 9));
    setPartnerId(formatted);
  };

  const handleConnect = () => {
    if (!canConnect) return;
    onConnect(cleanPartnerId);
  };

  const handleEasyAccessToggle = (checked: boolean) => {
    setEasyAccess(checked);
    // App.tsx's subscribeEasyAccess listener syncs the server password
    // setting and starts hosting; every other Easy Access switch follows.
    applyEasyAccess(checked);
  };

  const handlePickRecent = (entry: RecentConnection) => {
    setPartnerId(formatAccessKey(entry.accessKey));
    setShowRecentDropdown(false);
    onConnect(entry.accessKey);
  };

  const handleRemoveRecent = (event: React.MouseEvent, entry: RecentConnection) => {
    event.stopPropagation();
    setRecentConnections(removeRecentConnection(entry.accessKey));
  };

  const handleCopyId = () => {
    onCopyAccessKey();
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyPwd = () => {
    if (devicePassword) {
      const electronApi = (window as any).electronAPI;
      if (electronApi?.clipboard?.writeText) electronApi.clipboard.writeText(devicePassword);
      else navigator.clipboard.writeText(devicePassword);
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    }
  };

  const copyText = async (text: string) => {
    const value = String(text || '');
    if (!value) return false;
    const electronApi = (window as any).electronAPI;
    try {
      if (electronApi?.clipboard?.writeText) {
        await electronApi.clipboard.writeText(value);
        return true;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', 'true');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(input);
      return ok;
    } catch (error) {
      console.error('[RemoteSupport] Clipboard copy failed', error);
      return false;
    }
  };

  const isOnline = hostStatus.includes('Online') || hostStatus.includes('WebRTC') || hostStatus.includes('Registered');
  const sessionCode = (localAuthKey || '').replace(/\s/g, '');
  const sessionLink = buildWebSessionJoinUrl(sessionCode);
  const getSessionExpiresAt = (session: any) => {
    if (session?.expiresAt) return new Date(session.expiresAt);
    const ttlMs = session?.type === 'VIDEO_MEETING' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return new Date(new Date(session?.createdAt || Date.now()).getTime() + ttlMs);
  };
  const isSessionJoinable = (session: any) =>
    String(session?.status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
    !session?.isExpired &&
    getSessionExpiresAt(session).getTime() > Date.now();
  const handleOpenSessionRow = (session: any) => {
    if (!isSessionJoinable(session)) return;
    const code = String(session.sessionCode || '').replace(/[^a-zA-Z0-9]/g, '');
    if (!code) return;
    if (session.type === 'VIDEO_MEETING') {
      onJoinMeeting?.(formatId(code));
      return;
    }
    // The creator's own session shares the computer it was created on: their
    // row opens the status panel (waiting, or who is connected).
    if (session.createdById && user?.id && session.createdById === user.id) {
      if (code === sessionCode) {
        onHostOwnSession?.(session);
        return;
      }
      setWaitingSession(session);
      return;
    }
    // Anyone else: connect to the creator's computer.
    onJoinSessionInvite?.(code);
  };
  const isOwnSession = (session: any) => Boolean(session?.createdById && user?.id && session.createdById === user.id);
  const sessionJoinedBy = (session: any): string => {
    if (session?.joinedByName) return String(session.joinedByName);
    const list = Array.isArray(session?.collaborators) ? session.collaborators : [];
    const joined = list.find((c: any) => c?.status === 'JOINED');
    return joined ? String(joined.user?.name || joined.name || joined.user?.email || joined.email || '') : '';
  };

  const hasLoadedSessionsOnce = useRef(false);
  const fetchRemoteSessions = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent && !hasLoadedSessionsOnce.current) setLoadingSessions(true);
    try {
      const { data } = await api.get('/api/chat/remote-sessions');
      // Live sessions only. A session the creator closed (or one past its TTL) must not
      // come back as a greyed-out "Expired" row on the very next refresh; older backends
      // still return ENDED sessions, so filter here as well as on the server.
      const list: any[] = Array.isArray(data) ? data : [];
      setRemoteSessions(list.filter(isSessionJoinable));
      hasLoadedSessionsOnce.current = true;
    } catch (err) {
      console.error('[RemoteSupport] Failed to fetch remote sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions') fetchRemoteSessions({ silent: hasLoadedSessionsOnce.current });
  }, [activeTab]);

  useEffect(() => {
    const refresh = () => {
      if (activeTab === 'sessions') fetchRemoteSessions({ silent: true });
    };
    window.addEventListener('remote365:remote-sessions-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('remote365:remote-sessions-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formatTimeRemaining = (expiresAt: Date) => {
    const totalSeconds = Math.max(0, Math.floor((expiresAt.getTime() - nowMs) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Always the https web page; older rows still carry a remote365:// link
  // that nothing outside the app can open.
  const getSessionJoinLink = (session?: any) => {
    const link = String(session?.joinLink || session?.sessionLink || '');
    if (/^https?:\/\//i.test(link)) return link;
    const code = String(session?.sessionCode || sessionCode || '').replace(/\s/g, '');
    return buildWebSessionJoinUrl(code);
  };

  const handleCopyInviteLink = async (session?: any) => {
    const copied = await copyText(getSessionJoinLink(session));
    setSessionInviteStatus(copied ? 'sent' : 'error');
    setSessionInviteMessage(copied ? 'Invite link copied.' : 'Clipboard copy was blocked.');
    setShowInviteActions(false);
    setOpenSessionMenu(null);
  };

  const handleCopySessionCode = async (session: any) => {
    const copied = await copyText(formatId(session.sessionCode));
    if (!copied) return;
    setCopiedSessionCodeId(session.id);
    setTimeout(() => setCopiedSessionCodeId((id) => id === session.id ? null : id), 1600);
  };

  const handleEditSessionName = async (session: any) => {
    setOpenSessionMenu(null);
    setEditingSession(session);
    setEditingSessionName(session.name || 'Session name');
    setSessionInviteStatus('idle');
    setSessionInviteMessage('');
  };

  const handleSaveSessionName = async () => {
    if (!editingSession || editingSessionSaving) return;
    const session = editingSession;
    const cleanName = editingSessionName.trim();
    if (!cleanName) {
      setSessionInviteStatus('error');
      setSessionInviteMessage('Session name is required.');
      return;
    }
    const previous = remoteSessions;
    setEditingSessionSaving(true);
    setRemoteSessions((prev) => prev.map((item) => item.id === session.id ? { ...item, name: cleanName } : item));
    try {
      const { data } = await api.patch(`/api/chat/remote-sessions/${session.id}`, { name: cleanName });
      setRemoteSessions((prev) => prev.map((item) => item.id === session.id ? data : item));
      setSessionInviteStatus('sent');
      setSessionInviteMessage('Session name updated.');
      setEditingSession(null);
      setEditingSessionName('');
      window.dispatchEvent(new CustomEvent('remote365:remote-sessions-changed'));
    } catch (err) {
      console.error('[RemoteSupport] Failed to rename session', err);
      setRemoteSessions(previous);
      setSessionInviteStatus('error');
      setSessionInviteMessage('Could not edit this session name.');
    } finally {
      setEditingSessionSaving(false);
    }
  };

  const handleCloseSessionRow = (session: any) => {
    setOpenSessionMenu(null);
    setClosingSession(session);
  };

  const confirmCloseSession = async () => {
    const session = closingSession;
    if (!session) return;
    setClosingSession(null);
    const previous = remoteSessions;
    setRemoteSessions((prev) => prev.filter((item) => item.id !== session.id));
    try {
      await api.post(`/api/chat/remote-sessions/${session.id}/end`);
      setSessionInviteStatus('sent');
      setSessionInviteMessage('Session closed.');
      window.dispatchEvent(new CustomEvent('remote365:remote-sessions-changed'));
    } catch (err) {
      console.error('[RemoteSupport] Failed to close session', err);
      setRemoteSessions(previous);
      setSessionInviteStatus('error');
      setSessionInviteMessage('Could not close this session.');
    }
  };

  const handleToggleSessionMenu = (event: React.MouseEvent<HTMLButtonElement>, sessionId: string) => {
    if (openSessionMenu?.id === sessionId) {
      setOpenSessionMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 178;
    setOpenSessionMenu({
      id: sessionId,
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)),
    });
  };

  const handleStartSessionInvite = async () => {
    setSessionInviteStatus('sending');
    setSessionInviteMessage('');
    try {
      // A session shares the computer it is created on. A browser has no
      // screen to share, so this only works from the desktop app.
      const hostKey = String(localAuthKey || '').replace(/\D/g, '');
      if (!hostKey) throw new Error('Create the session from the Remote365 desktop app on the computer you want to share. From here you can use a code someone gave you.');
      const { data } = await api.post('/api/chat/session-invites', {
        email: sessionEmail.trim() || undefined,
        sessionName,
        hostAccessKey: hostKey
      });
      if (data?.remoteSession) {
        setRemoteSessions((prev) => [data.remoteSession, ...prev.filter((session) => session.id !== data.remoteSession.id)]);
      }
      setSessionInviteStatus('sent');
      const newCode = formatId(data?.remoteSession?.sessionCode || '');
      const hasEmail = Boolean(sessionEmail.trim());
      const isExistingUser = Boolean(data?.existingUser);
      setSessionInviteMessage(
        hasEmail
          ? isExistingUser
            ? `Session ${newCode} created. Invite email sent and the recipient was notified in-app. When they use the code, they connect to this computer.`
            : `Session ${newCode} created. Invite email sent with an install link. When they use the code, they connect to this computer.`
          : `Session ${newCode} created. Share the code — whoever uses it connects to this computer.`
      );
      setShowAddSessionModal(false);
      setShowInviteActions(false);
    } catch (err: any) {
      setSessionInviteStatus('error');
      setSessionInviteMessage(err.response?.data?.error || err.message || 'Could not create session invite.');
    }
  };

  const handleJoinSession = () => {
    const cleanCode = joinSessionCode.replace(/\D/g, '');
    if (!cleanCode) return;
    onJoinSessionInvite?.(cleanCode);
    setShowJoinSessionModal(false);
    setJoinSessionCode('');
  };

  const formattedLocalId = formatId(localAuthKey);
  const formatSessionCreatedAt = (value: string | Date | undefined) => {
    const date = new Date(value || Date.now());
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date).replace(',', ',');
  };
  const getSessionCollaborator = (session: any) => {
    // The API returns a collaborators[] relation (invited + joined people).
    const list = Array.isArray(session?.collaborators) ? session.collaborators : [];
    const names = list
      .map((c: any) => c?.user?.name || c?.name || c?.user?.email || c?.email)
      .filter(Boolean);
    if (names.length) return names.join(', ');
    const invited = session?.collaboratorName
      || session?.recipientName
      || session?.inviteeName
      || session?.userName
      || session?.email
      || session?.recipientEmail
      || session?.invitedEmail;
    return invited || '';
  };
  const getRecentDeviceName = (entry: RecentConnection) => entry.name?.trim() || tx('Remote device');
  const getSessionDisplayName = (session: any) =>
    session?.name || session?.sessionName || tx('Remote Support Session');
  const getSessionOwnerName = (session: any) =>
    session?.ownerName
    || session?.createdByName
    || session?.creatorName
    || session?.hostName
    || session?.user?.name
    || user?.name
    || tx('User');

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white font-lato text-[#111315] dark:bg-[#080808] dark:text-[#F5F5F5] animate-in fade-in duration-300">
      
      {/* Top Tab Switcher */}
      <div className="flex justify-center px-4 pt-8 sm:pt-[42px]">
        <div className="grid h-[52px] w-full max-w-[592px] grid-cols-2 rounded-[10px] bg-[#F3F4F6] p-[6px] dark:bg-white/5">
          <button 
            onClick={() => setActiveTab('id')}
            className={`flex items-center justify-center gap-3 rounded text-[18px] font-medium leading-[25px] transition-all ${
              activeTab === 'id' 
                ? 'bg-white text-[#111315] shadow-sm dark:bg-white/10 dark:text-white' 
                : 'text-[#111315] dark:text-[#D1D1D1]'
            }`}
          >
            <Video size={16} strokeWidth={1.8} />
            {tx('Quick Connect')}
          </button>
          <button 
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center justify-center gap-3 rounded text-[18px] font-medium leading-[25px] transition-all ${
              activeTab === 'sessions' 
                ? 'bg-white text-[#111315] shadow-sm dark:bg-white/10 dark:text-white' 
                : 'text-[#111315] dark:text-[#D1D1D1]'
            }`}
          >
            <Monitor size={16} strokeWidth={1.8} />
            {tx('Sessions')}
          </button>
        </div>
      </div>

      {/* Main Content Area — the Sessions tab keeps a tight top padding so its
          content fits the viewport without vertical scrolling. */}
      <div className={`flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-8 sm:px-6 lg:px-10 ${activeTab === 'sessions' ? 'pt-4 sm:pt-6' : 'pt-8 sm:pt-12 lg:pt-[74px]'}`}>
        <div className="w-full max-w-[1440px]">

          {activeTab === 'id' ? (
            <div className="mx-auto w-full max-w-[640px] animate-in fade-in duration-200">
              {/* A browser can't be remote-controlled, so the desktop's
                  "Allow remote control" (ID/password) panel has no web
                  equivalent — the web is connect-out only. */}
              <div className="flex flex-col pt-0 lg:pt-[30px]">
                <h3 className="text-center text-[18px] font-medium leading-[25px] text-[#000000] dark:text-[#F5F5F5] lg:text-left mt-3">{tx('Control remote device')}</h3>

                <div className="mt-12 flex flex-1 flex-col">
                  <div>
                    <label className="mb-2 block text-[14px] font-medium leading-5 text-[#1A1D21] dark:text-[#F5F5F5]">
                      {tx('Enter your remote ID')}
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1" ref={inputWrapperRef}>
                        <input
                          type="text"
                          placeholder={tx('e.g 123 456 789')}
                          value={partnerId}
                          onChange={(e) => handlePartnerIdChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleConnect();
                            }
                          }}
                          onFocus={() => { if (recentConnections.length > 0) setShowRecentDropdown(true); }}
                          className="h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 pr-10 text-[14px] font-normal leading-5 text-[#111315] outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00] dark:border-white/20 dark:bg-transparent dark:text-white"
                        />
                        {recentConnections.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowRecentDropdown((value) => !value)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${showRecentDropdown ? 'text-[#FF8A00]' : 'text-[#1A1D21]/30 hover:text-[#111315] dark:text-white/40 dark:hover:text-white'}`}
                            title={tx('Pick a recent connection')}
                          >
                            <ChevronDown size={18} className={showRecentDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
                          </button>
                        )}
                        {showRecentDropdown && recentConnections.length > 0 && (
                          <div
                            ref={recentDropdownRef}
                            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded border border-[#1A1D21]/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#151515]"
                          >
                            <div className="border-b border-[#1A1D21]/10 px-3 py-2 text-[11px] font-semibold uppercase text-[#1A1D21]/50 dark:text-[#A0A0A0]">
                              {tx('Recent IDs')}
                            </div>
                            <div className="max-h-[220px] overflow-y-auto">
                              {recentConnections.map((entry) => (
                                <button
                                  key={entry.accessKey}
                                  type="button"
                                  onClick={() => handlePickRecent(entry)}
                                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#F3F4F6] dark:hover:bg-white/5"
                                >
                                  <Clock size={14} className="shrink-0 text-[#111315]/50 dark:text-[#A0A0A0]" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-medium text-[#111315] dark:text-[#F5F5F5]">{formatAccessKey(entry.accessKey)}</div>
                                    {entry.name && (
                                      <div className="truncate text-[11px] text-[#1A1D21]/50 dark:text-[#A0A0A0]">{entry.name}</div>
                                    )}
                                  </div>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => handleRemoveRecent(e, entry)}
                                    className="rounded p-1 text-[#1A1D21]/40 transition-colors hover:bg-white hover:text-red-500 dark:hover:bg-white/10"
                                    title={tx('Remove from recent')}
                                  >
                                    <CloseIcon size={12} />
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={!canConnect || isRemoteLookupConnecting}
                        className={`h-10 w-full rounded-[4px] px-6 text-[14px] font-medium leading-5 transition-all sm:w-[136px] ${
                          canConnect && !isRemoteLookupConnecting
                            ? 'bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-[#111315] hover:brightness-105'
                            : 'cursor-not-allowed bg-[#F3F4F6] text-[#1A1D21]/30 dark:bg-white/5 dark:text-white/30'
                        }`}
                      >
                        {isRemoteLookupConnecting ? tx('Connecting...') : tx('Connect')}
                      </button>
                    </div>

                    {remoteLookupError ? (
                      <p className="mt-2 max-w-md text-[12px] font-medium text-red-500 dark:text-red-400">{remoteLookupError}</p>
                    ) : null}
                  </div>

                  <div className="mt-10 space-y-4">
                    <div>
                      <button
                        type="button"
                        onClick={() => setRecentExpanded((value) => !value)}
                        className="group flex h-9 w-full items-center justify-between border-b border-[rgba(26,29,33,0.3)] text-[#111315] transition-colors dark:border-white/15 dark:text-[#F5F5F5]"
                      >
                        <div className="flex items-center gap-2">
                          <History size={20} strokeWidth={1.8} />
                          <span className="text-[14px] font-normal leading-5">{tx('Recent Connections')}</span>
                        </div>
                        <ChevronDown size={16} className={`transition-transform ${recentExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {recentExpanded && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          {recentConnections.length === 0 ? (
                            <div className="rounded-[4px] bg-[#F3F4F6] px-4 py-2.5 text-[12px] leading-[17px] text-[#1A1D21]/60 dark:bg-white/5 dark:text-[#A0A0A0]">
                              {tx('No recent connection yet. Once you connect to a device, it will appear here.')}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {recentConnections.map((entry) => (
                                <div
                                  key={entry.accessKey}
                                  className="flex items-center gap-4 rounded-[4px] bg-[#F3F4F6] px-4 py-2.5 dark:bg-white/5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handlePickRecent(entry)}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="text-[12px] font-normal leading-[17px] text-[#1A1D21]/70 dark:text-[#D1D1D1]">{formatAccessKey(entry.accessKey)}</div>
                                    <div className="truncate text-[14px] font-medium leading-5 text-[#111315] dark:text-white">
                                      {getRecentDeviceName(entry)}
                                    </div>
                                  </button>
                                  <span className="shrink-0 text-[12px] font-normal leading-[17px] text-[#1A1D21]/70 dark:text-[#D1D1D1]">
                                    {new Date(entry.lastConnectedAt).toLocaleDateString('en-GB')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemoveRecent(e, entry)}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center text-[#111315] transition-colors hover:text-red-500 dark:text-white"
                                    title={tx('Remove')}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !historyExpanded;
                          setHistoryExpanded(next);
                          if (next && remoteSessions.length === 0) fetchRemoteSessions();
                        }}
                        className="group flex h-9 w-full items-center justify-between border-b border-[rgba(26,29,33,0.3)] text-[#111315] transition-colors dark:border-white/15 dark:text-[#F5F5F5]"
                      >
                        <div className="flex items-center gap-2">
                          <History size={20} strokeWidth={1.8} />
                          <span className="text-[14px] font-normal leading-5">{tx('Session History')}</span>
                        </div>
                        <ChevronDown size={16} className={`transition-transform ${historyExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {historyExpanded && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          {loadingSessions ? (
                            <div className="flex items-center gap-2 rounded-[4px] bg-[#F3F4F6] px-4 py-2.5 text-[12px] leading-[17px] text-[#1A1D21]/60 dark:bg-white/5 dark:text-[#A0A0A0]">
                              <RefreshCw size={14} className="animate-spin" />
                              {tx('Loading sessions...')}
                            </div>
                          ) : remoteSessions.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab('sessions')}
                              className="w-full rounded-[4px] bg-[#F3F4F6] px-4 py-2.5 text-left text-[12px] leading-[17px] text-[#1A1D21]/60 transition-colors hover:text-[#FF8A00] dark:bg-white/5 dark:text-[#A0A0A0]"
                            >
                              {tx('No sessions yet. Click to open the session tab.')}
                            </button>
                          ) : (
                            <div className="space-y-2">
                              {remoteSessions.slice(0, 4).map((session) => (
                                <div
                                  key={session.id}
                                  className="flex items-center gap-4 rounded-[4px] bg-[#F3F4F6] px-4 py-2.5 dark:bg-white/5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[12px] font-normal leading-[17px] text-[#1A1D21]/70 dark:text-[#D1D1D1]">{formatAccessKey(session.sessionCode)}</div>
                                    <div className="truncate text-[14px] font-medium leading-5 text-[#111315] dark:text-white">{session.name || tx('Session name')}</div>
                                  </div>
                                  <span className="shrink-0 text-[12px] font-normal leading-[17px] text-[#1A1D21]/70 dark:text-[#D1D1D1]">
                                    {new Date(session.createdAt).toLocaleDateString('en-GB')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-200">
              {sessionInviteMessage && (
                <div className={`mx-6 mt-4 flex items-center gap-2 rounded px-3 py-2 text-[12px] font-medium ${
                  sessionInviteStatus === 'error'
                    ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}>
                  {sessionInviteStatus === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  {sessionInviteMessage}
                </div>
              )}
              <div>
                {loadingSessions ? (
                  <div className="flex min-h-[470px] flex-col items-center justify-center gap-5">
                    <div className="relative h-12 w-12">
                      <div className="absolute inset-0 rounded-full border-[3px] border-[#FF8A00]/15" />
                      <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#FF8A00] border-r-[#FFB347]" />
                    </div>
                    <span className="animate-pulse text-[15px] font-medium text-[#1A1D21]/50 dark:text-[#A0A0A0]">
                      {tx('Loading sessions...')}
                    </span>
                  </div>
                ) : remoteSessions.length === 0 ? (
                  <div className="flex flex-col items-center pt-4 text-center sm:pt-8">
                    {/* Loops: the scene fades in and back out. Its outlines are
                        pure black on a transparent canvas, so on the dark page
                        invert+hue-rotate flips lightness and keeps the red accents red. */}
                    <LottieScene
                      animationData={devicesChangingAnimation}
                      size={240}
                      loop
                      className="dark:invert dark:hue-rotate-180"
                    />
                    <h2 className="mt-6 text-[22px] font-medium leading-[30px] text-[#000000] dark:text-[#F5F5F5]">
                      {tx('No Active Sessions')}
                    </h2>
                    <p className="mt-2 max-w-[520px] text-[14px] font-normal leading-5 text-[#1A1D21] dark:text-[#D1D1D1]">
                      {tx('Enter a code you were given to use that computer from this browser. To share your own computer, create the session in the desktop app.')}
                    </p>
                    <div className="mt-7 flex w-full flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
                      <button
                        type="button"
                        onClick={() => setShowAddSessionModal(true)}
                        className="h-11 w-full max-w-[240px] rounded bg-gradient-to-r from-[#FF8A00] to-[#FFB347] px-6 text-[15px] font-medium leading-5 text-[#111315] transition hover:brightness-105 sm:w-[220px]"
                      >
                        {tx('Start a New Session')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowJoinSessionModal(true)}
                        className="h-11 w-full max-w-[240px] rounded bg-[#111315] px-6 text-[15px] font-medium leading-5 text-white transition hover:bg-[#1A1D21] sm:w-[220px]"
                      >
                        {tx('Join Session')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-[15px]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h2 className="text-[22px] font-medium leading-[30px] text-[#000000] dark:text-[#F5F5F5]">{tx('Sessions')}</h2>
                        <p className="mt-1 text-[14px] font-normal leading-5 text-[#1A1D21]/70 dark:text-[#D1D1D1]">
                          {tx('Sessions you created share your computer. Sessions you were invited to let you use theirs.')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fetchRemoteSessions({ silent: true })}
                          className="flex h-10 w-10 items-center justify-center text-[#111315] transition hover:text-[#FF8A00] dark:text-white"
                          title={tx('Refresh support invites')}
                        >
                          <RefreshCw size={20} className={loadingSessions ? 'animate-spin' : ''} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddSessionModal(true)}
                          className="h-10 rounded-[4px] bg-gradient-to-r from-[#FF8A00] to-[#FFB347] px-5 text-[14px] font-medium leading-5 text-[#111315] transition hover:brightness-105"
                        >
                          {tx('New Session')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowJoinSessionModal(true)}
                          className="h-10 rounded-[4px] bg-[#111315] px-5 text-[14px] font-medium leading-5 text-white transition hover:bg-[#1A1D21]"
                        >
                          {tx('Join Session')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-8 overflow-x-auto rounded-[12px] border border-[#1A1D21]/30 dark:border-white/15">
                      <div className="grid h-11 min-w-[1020px] grid-cols-[270fr_130fr_150fr_90fr_150fr_180fr_120px_56px] items-center bg-[#F3F4F6] text-[12px] font-medium leading-[17px] text-[#1A1D21]/60 dark:bg-white/5 dark:text-[#A0A0A0]">
                        <div className="px-6">{tx('Sessions')}</div>
                        <div className="px-6">{tx('Session Code')}</div>
                        <div className="px-6">{tx('Collaborators')}</div>
                        <div className="flex justify-center px-6">{tx('Status')}</div>
                        <div className="px-6">{tx('Expires In')}</div>
                        <div className="px-6">{tx('Created')}</div>
                        <div className="px-4 text-center">{tx('Join')}</div>
                        <div />
                      </div>
                      <div>
                        {remoteSessions
                          .slice((sessionsPage - 1) * SESSIONS_PER_PAGE, sessionsPage * SESSIONS_PER_PAGE)
                          .map((session) => {
                          const joinable = isSessionJoinable(session);
                          const collaborator = getSessionCollaborator(session);
                          return (
                            <div
                              key={session.id}
                              onClick={() => handleOpenSessionRow(session)}
                              className={`grid min-h-[72px] min-w-[1020px] grid-cols-[270fr_130fr_150fr_90fr_150fr_180fr_120px_56px] items-center border-t border-[#1A1D21]/30 transition-colors hover:bg-[#FAFAFB] dark:border-white/15 dark:hover:bg-white/[0.03] ${joinable ? 'cursor-pointer' : 'opacity-70'}`}
                            >
                              <div className="min-w-0 px-6 py-4 text-left">
                                <div className="truncate text-[14px] font-medium leading-5 text-[#111315] dark:text-white">
                                  {getSessionDisplayName(session)}
                                </div>
                                <div className="mt-2 truncate text-[14px] font-normal leading-5 text-[#111315]/60 dark:text-[#A0A0A0]">
                                  {tx('By')} {getSessionOwnerName(session)}
                                </div>
                              </div>
                              <div className="px-6 text-[14px] font-normal leading-5 text-[#111315] dark:text-white">
                                {formatId(session.sessionCode)}
                              </div>
                              <div className="flex min-w-0 items-center gap-2 px-6">
                                {collaborator ? (
                                  <>
                                    <img src={collaboratorIcon} alt="" className="h-[13px] w-[17px] shrink-0 opacity-40 dark:invert" />
                                    <span className="truncate text-[14px] leading-5 text-[#111315] dark:text-white">{collaborator}</span>
                                  </>
                                ) : (
                                  <span className="text-[12px] font-medium leading-[17px] text-[#1A1D21]/60 dark:text-[#A0A0A0]">{tx('No Collaborators Yet')}</span>
                                )}
                              </div>
                              <div className="flex justify-center px-6">
                                <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal leading-[14px] ${
                                  !joinable
                                    ? 'bg-[#1A1D21]/10 text-[#1A1D21]/45 dark:bg-white/10 dark:text-[#A0A0A0]'
                                    : sessionJoinedBy(session)
                                      ? 'bg-[#ECFDF3] text-[#34C759]'
                                      : 'bg-[#FFF6ED] text-[#FF8A00]'
                                }`}>
                                  {!joinable ? tx('Expired') : sessionJoinedBy(session) ? tx('In session') : tx('Waiting')}
                                </span>
                              </div>
                              <div className="px-6">
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium leading-4 ${
                                  joinable
                                    ? 'bg-[#F3F4F6] text-[#1A1D21] dark:bg-white/10 dark:text-[#D1D1D1]'
                                    : 'bg-[#1A1D21]/10 text-[#1A1D21]/45 dark:bg-white/10 dark:text-[#A0A0A0]'
                                }`}>
                                  {joinable ? `${tx('Expires in')} ${formatTimeRemaining(getSessionExpiresAt(session))}` : tx('Expired')}
                                </span>
                              </div>
                              <div className="px-6 text-[14px] font-normal leading-5 text-[#111315] dark:text-[#D1D1D1]">
                                {formatSessionCreatedAt(session.createdAt)}
                              </div>
                              <div className="px-4 text-center" onClick={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenSessionRow(session)}
                                  disabled={!joinable}
                                  className="inline-flex h-[30px] min-w-[86px] items-center justify-center whitespace-nowrap rounded-[4px] bg-gradient-to-r from-[#FF8A00] to-[#FFB347] px-3 text-[12px] font-medium text-[#111315] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#F3F4F6] disabled:text-[#1A1D21]/40 dark:disabled:bg-white/10 dark:disabled:text-white/40"
                                >
                                  {isOwnSession(session) ? (sessionJoinedBy(session) ? tx('View status') : tx('Show code')) : tx('Connect')}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); handleToggleSessionMenu(event, session.id); }}
                                className="flex h-full items-center justify-center px-6 text-[#1A1D21] transition hover:text-[#FF8A00] dark:text-white"
                                title={tx('Session actions')}
                              >
                                <MoreVertical size={20} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pagination — keeps the page free of scrolling */}
                    {remoteSessions.length > SESSIONS_PER_PAGE && (() => {
                      const totalPages = Math.ceil(remoteSessions.length / SESSIONS_PER_PAGE);
                      const page = Math.min(sessionsPage, totalPages);
                      return (
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-[12px] font-medium leading-[17px] text-[#1A1D21]/60 dark:text-[#A0A0A0]">
                            {tx('Showing')} {(page - 1) * SESSIONS_PER_PAGE + 1}–{Math.min(page * SESSIONS_PER_PAGE, remoteSessions.length)} {tx('of')} {remoteSessions.length}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSessionsPage((p) => Math.max(1, p - 1))}
                              disabled={page <= 1}
                              className="flex h-8 items-center justify-center rounded-[4px] border border-[#1A1D21]/30 px-3 text-[13px] font-medium text-[#111315] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:text-white dark:hover:bg-white/5"
                            >
                              {tx('Previous')}
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setSessionsPage(n)}
                                className={`flex h-8 w-8 items-center justify-center rounded-[4px] text-[13px] font-medium transition ${
                                  n === page
                                    ? 'bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-[#111315]'
                                    : 'border border-[#1A1D21]/30 text-[#111315] hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setSessionsPage((p) => Math.min(totalPages, p + 1))}
                              disabled={page >= totalPages}
                              className="flex h-8 items-center justify-center rounded-[4px] border border-[#1A1D21]/30 px-3 text-[13px] font-medium text-[#111315] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:text-white dark:hover:bg-white/5"
                            >
                              {tx('Next')}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Creator waiting room — converts to the live session when someone joins */}
      {waitingSession && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setWaitingSession(null)}
        >
          <div
            className="flex w-[468px] max-w-[calc(100vw-32px)] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl dark:bg-[#1C1C1C]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-[22px] pt-2">
              <h3 className="text-[24px] font-bold leading-[34px] text-[#111315] dark:text-[#F5F5F5]">{getSessionDisplayName(waitingSession)}</h3>
              <button
                onClick={() => setWaitingSession(null)}
                className="flex h-6 w-6 items-center justify-center text-[#111315] transition-opacity hover:opacity-60 dark:text-white"
                aria-label="Close"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#FF8A00]/20" />
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF8A00]/10 text-[#FF8A00]">
                  <Monitor size={22} />
                </span>
              </div>
              <p className="text-center text-[14px] font-normal leading-5 text-[#111315] dark:text-[#F5F5F5]">
                {sessionJoinedBy(waitingSession)
                  ? `${sessionJoinedBy(waitingSession)} ${tx('is using your computer through this session.')}`
                  : tx('Waiting for someone to use this code. They will see and, once you allow it, control the computer this session was created on.')}
              </p>
              <div className="flex items-center gap-3 rounded-[8px] border border-[#1A1D21]/30 px-4 py-2 dark:border-white/20">
                <span className="text-[20px] font-bold tracking-[0.15em] text-[#111315] dark:text-white">{formatId(waitingSession.sessionCode)}</span>
                <button
                  onClick={() => handleCopySessionCode(waitingSession)}
                  className="text-[#1A1D21] transition-colors hover:text-[#FF8A00] dark:text-[#D1D1D1]"
                  title={tx('Copy Session code')}
                >
                  {copiedSessionCodeId === waitingSession.id ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-center text-[12px] leading-[17px] text-[#111315]/60 dark:text-[#A0A0A0]">
                {tx('The code works once. The desktop app asks before they can use the keyboard and mouse, and you can end the session at any time.')}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pb-2">
              <button
                onClick={() => setWaitingSession(null)}
                className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
              >
                {tx('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Session Modal */}
      {showAddSessionModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAddSessionModal(false)}
        >
          <div
            className="flex w-[468px] max-w-[calc(100vw-32px)] flex-col gap-6 rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl dark:bg-[#1C1C1C]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Editable title */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-left text-[24px] font-bold leading-[34px] text-[#111315] outline-none dark:text-[#F5F5F5]"
              />
              <Pencil size={20} className="shrink-0 text-[#111315] dark:text-[#F5F5F5]" />
            </div>

            <div className="flex flex-col gap-[22px]">
              <p className="text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.6)] dark:text-[#A0A0A0]">
                {tx('Press Start to get a one-time code for this computer. Whoever uses the code sees this screen and, once allowed, can use the keyboard and mouse. Creating a session needs the desktop app.')}
              </p>

              {/* Invite by email */}
              <input
                type="email"
                placeholder={tx("End user's email")}
                value={sessionEmail}
                onChange={(e) => {
                  setSessionEmail(e.target.value);
                  setSessionInviteStatus('idle');
                  setSessionInviteMessage('');
                }}
                className="h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] outline-none transition-colors placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00] dark:border-white/20 dark:bg-[#0A0A0A] dark:text-[#F5F5F5]"
              />

              {sessionInviteMessage && (
                <div className={`flex items-center gap-2 text-[12px] font-medium ${sessionInviteStatus === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {sessionInviteStatus === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  {sessionInviteMessage}
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSessionModal(false)}
                  className="flex h-10 w-[124px] items-center justify-center rounded-full border border-[#F3F4F6] bg-white text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.5)] transition-colors hover:bg-[#F3F4F6] dark:bg-transparent dark:hover:bg-white/5"
                >
                  {tx('Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleStartSessionInvite}
                  disabled={sessionInviteStatus === 'sending'}
                  className="flex h-10 w-[124px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-[14px] font-medium leading-5 text-[#111315] transition hover:brightness-105 disabled:opacity-60"
                >
                  {sessionInviteStatus === 'sending' ? <RefreshCw size={14} className="animate-spin" /> : sessionEmail ? <Mail size={14} /> : <Zap size={14} />}
                  {tx('Start')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showJoinSessionModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowJoinSessionModal(false)}
        >
          <div
            className="flex w-[468px] max-w-[calc(100vw-32px)] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl dark:bg-[#1C1C1C]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-6 pt-2">
              <div className="flex flex-col">
                <h3 className="text-[24px] font-bold leading-[34px] text-[#111315] dark:text-[#F5F5F5]">{tx('Join session')}</h3>
                <p className="text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.6)] dark:text-[#A0A0A0]">{tx('Enter the code you were given to use that computer from this browser.')}</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#F5F5F5]">{tx('Remote ID or invite code')}</label>
                <input
                  value={joinSessionCode}
                  onChange={(e) => setJoinSessionCode(formatId(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                  placeholder="000 000 000"
                  className="h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 tracking-wider text-[#111315] outline-none transition-colors placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00] dark:border-white/20 dark:bg-[#0A0A0A] dark:text-[#F5F5F5]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowJoinSessionModal(false)}
                className="flex h-10 w-[124px] items-center justify-center rounded-full border border-[#F3F4F6] bg-white text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.5)] transition-colors hover:bg-[#F3F4F6] dark:bg-transparent dark:hover:bg-white/5"
              >
                {tx('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleJoinSession}
                disabled={!joinSessionCode.replace(/\D/g, '')}
                className="flex h-10 w-[124px] items-center justify-center rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-[14px] font-medium leading-5 text-[#111315] transition hover:brightness-105 disabled:opacity-50"
              >
                {tx('Join')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSession && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setEditingSession(null); setEditingSessionName(''); }}
        >
          <div
            className="flex w-[468px] max-w-[calc(100vw-32px)] flex-col gap-[22px] rounded-[12px] bg-white px-6 py-5 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl dark:bg-[#1C1C1C]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col">
              <h3 className="text-[24px] font-bold leading-[34px] text-[#111315] dark:text-[#F5F5F5]">{tx('Edit session name')}</h3>
              <p className="text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.6)] dark:text-[#A0A0A0]">{tx('Rename this support invite for easier tracking.')}</p>
            </div>
            <input
              autoFocus
              value={editingSessionName}
              onChange={(event) => setEditingSessionName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSaveSessionName();
                if (event.key === 'Escape') {
                  setEditingSession(null);
                  setEditingSessionName('');
                }
              }}
              maxLength={120}
              className="h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] outline-none transition-colors placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00] dark:border-white/20 dark:bg-[#0A0A0A] dark:text-white"
            />
            {sessionInviteMessage && sessionInviteStatus === 'error' && (
              <div className="flex items-center gap-2 text-[12px] font-medium text-red-500">
                <AlertCircle size={14} />
                {sessionInviteMessage}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingSession(null);
                  setEditingSessionName('');
                }}
                disabled={editingSessionSaving}
                className="flex h-10 w-[124px] items-center justify-center rounded-full border border-[#F3F4F6] bg-white text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.5)] transition-colors hover:bg-[#F3F4F6] disabled:opacity-50 dark:bg-transparent dark:hover:bg-white/5"
              >
                {tx('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveSessionName}
                disabled={editingSessionSaving || !editingSessionName.trim()}
                className="flex h-10 w-[124px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-[14px] font-medium leading-5 text-[#111315] transition hover:brightness-105 disabled:opacity-50"
              >
                {editingSessionSaving && <RefreshCw size={14} className="animate-spin" />}
                {tx('Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {closingSession && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setClosingSession(null)}
        >
          <div
            className="flex w-[440px] max-w-[calc(100vw-32px)] flex-col gap-5 rounded-[12px] bg-white px-6 py-5 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl dark:bg-[#1C1C1C]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-[#E5484D]">
                <Trash2 size={20} />
              </div>
              <h3 className="text-[20px] font-bold leading-7 text-[#111315] dark:text-[#F5F5F5]">
                {tx('Close session?')}
              </h3>
              <p className="text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.6)] dark:text-[#A0A0A0]">
                {tx('Closing')} “{closingSession.name || tx('this session')}” {tx('removes the invite and stops anyone else from joining it.')}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClosingSession(null)}
                className="flex h-10 w-[124px] items-center justify-center rounded-full border border-[#F3F4F6] bg-white text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.5)] transition-colors hover:bg-[#F3F4F6] dark:bg-transparent dark:hover:bg-white/5"
              >
                {tx('Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmCloseSession}
                className="flex h-10 items-center justify-center rounded-full bg-[#E5484D] px-5 text-[14px] font-medium leading-5 text-white transition hover:bg-[#D33A3F]"
              >
                {tx('Close session')}
              </button>
            </div>
          </div>
        </div>
      )}

      {openSessionMenu && (() => {
        const session = remoteSessions.find((item) => item.id === openSessionMenu.id);
        if (!session) return null;
        return (
          <>
            <button
              type="button"
              aria-label={tx('Close session actions')}
              className="fixed inset-0 z-[55] cursor-default bg-transparent"
              onClick={() => setOpenSessionMenu(null)}
            />
            <div
              className="fixed z-[60] w-[178px] overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#232323]"
              style={{ top: openSessionMenu.top, left: openSessionMenu.left }}
            >
              <button
                type="button"
                onClick={() => handleCopyInviteLink(session)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/10"
              >
                <Send size={15} />
                {tx('Share')}
              </button>
              <button
                type="button"
                onClick={() => handleEditSessionName(session)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/10"
              >
                <Pencil size={15} />
                {tx('Edit name')}
              </button>
              <div className="my-1 h-px bg-gray-100 dark:bg-white/10" />
              <button
                type="button"
                onClick={() => handleCloseSessionRow(session)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/10"
              >
                <Trash2 size={15} />
                {tx('Close')}
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
};
