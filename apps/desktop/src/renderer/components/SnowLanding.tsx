import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Copy, Eye, EyeOff, Globe2, Languages, CircleHelp, Lock, LogIn, Monitor, RefreshCw, Settings, Trash2, Video, Wand2, X } from 'lucide-react';
import { RecentConnection, formatAccessKey, getAllRecentConnections, removeRecentConnectionEverywhere } from '../lib/recentConnections';
import { RecentMeeting, formatRecentMeetingCode, getRecentMeetings, recordRecentMeeting, removeRecentMeeting } from '../lib/recentMeetings';
import { LottieScene } from './lottie/LottieScene';
// Connect Anything is not built yet: the tab shows this looping teaser (816x372 export).
import connectAnythingSoonAnimation from '../assets/animations/connectAnythingSoon.json';
import logo from '../../logo.png';
import api from '../lib/api';
import { getMachineFingerprint } from '../utils/device';
import { isClipboardSyncEnabled, setClipboardSyncEnabled } from '../lib/clipboardSyncPreference';
import { areConnectionAlertsEnabled, isHostAutoMinimizeEnabled, setConnectionAlertsEnabled, setHostAutoMinimizeEnabled } from '../lib/hostPreferences';
import { applyEasyAccess, isEasyAccessEnabled, subscribeEasyAccess } from '../lib/easyAccess';
import { applyStartWithWindowsPreference, readStartWithWindowsPreference } from '../lib/startupPreferences';
import { useAuthStore } from '../store/authStore';
import { MeetingPreviewModal } from './MeetingPreviewModal';

interface SnowLandingProps {
  hostAccessKey: string | null;
  hostStatus: string;
  devicePassword: string;
  isAutoHostEnabled: boolean;
  isAuthenticated: boolean;
  connectStep: 1 | 2;
  sessionCode: string;
  accessPassword: string;
  connectError: string | null;
  connectStatus: string;
  targetDeviceName: string | null;
  targetPasswordRequired: boolean;
  lockoutSeconds: number;
  onCopyAccessKey: () => void;
  onToggleAutoHost: () => void;
  onOpenSetPassword: () => void;
  onStartHosting: () => void;
  onStopHosting: () => void;
  onSignIn: () => void;
  onHelp?: () => void;
  onSignUp: () => void;
  onSessionCodeChange: (code: string) => void;
  onAccessPasswordChange: (pwd: string) => void;
  onFindDevice: (accessKey?: string) => void;
  onConnectToHost: () => void;
  onBackToStep1: () => void;
  onJoinMeeting: (meetingId: string) => void;
  onCreateMeeting: (meetingId: string) => void;
  isElectron: boolean;
}

// The little "i" next to a landing-page option. It shows its explanation as a
// tooltip on hover or keyboard focus; clicking it must NOT toggle the
// checkbox its <label> wraps, which is what preventDefault is for.
const InfoDot = ({ tip }: { tip: string }) => (
  <span
    className="tv-info-dot"
    data-tip={tip}
    role="img"
    aria-label={tip}
    tabIndex={0}
    onClick={(e) => e.preventDefault()}
  >
    i
  </span>
);

// Below this the column would be unreadable; the wrapper scrolls instead
// (only windows shorter than ~500px get there).
const MIN_FIT_SCALE = 0.5;

// Text size for the signed-out landing (Remote365 Options → General). The
// column is zoomed by this factor on top of the fit-to-window scale, so the
// whole page grows together and still never scrolls.
const FONT_SCALE_KEY = 'remote365_landing_font_scale';
const FONT_SCALE_OPTIONS = [
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
  { value: 1.5, label: 'Largest' },
];
const readFontScale = () => {
  try {
    const stored = Number(localStorage.getItem(FONT_SCALE_KEY));
    return FONT_SCALE_OPTIONS.some((option) => option.value === stored) ? stored : 1;
  } catch {
    return 1;
  }
};

// Same list the signed-in Settings page offers.
const LANGUAGE_KEY = 'pref_language';
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
  { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
];
const readLanguage = () => {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY) || 'en';
    return LANGUAGE_OPTIONS.some((option) => option.value === stored) ? stored : 'en';
  } catch {
    return 'en';
  }
};
const RECENTS_OPEN_KEY = 'remote365_landing_recents_open';

type HeightTier = 'roomy' | 'compact' | 'tight';
const HEIGHT_TIER_QUERIES = ['(max-height: 1100px)', '(max-height: 900px)'];
const readHeightTier = (): HeightTier => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'roomy';
  if (window.matchMedia(HEIGHT_TIER_QUERIES[1]).matches) return 'tight';
  if (window.matchMedia(HEIGHT_TIER_QUERIES[0]).matches) return 'compact';
  return 'roomy';
};

const compareVersionText = (left: string, right: string) => {
  const a = String(left || '').split('.').map(part => parseInt(part.replace(/\D/g, ''), 10) || 0);
  const b = String(right || '').split('.').map(part => parseInt(part.replace(/\D/g, ''), 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
};

export const SnowLanding: React.FC<SnowLandingProps> = ({
  hostAccessKey,
  hostStatus,
  devicePassword,
  isAutoHostEnabled,
  isAuthenticated,
  connectStep,
  sessionCode,
  accessPassword,
  connectError,
  connectStatus,
  targetDeviceName,
  targetPasswordRequired,
  lockoutSeconds,
  onCopyAccessKey,
  onToggleAutoHost,
  onOpenSetPassword,
  onSignIn,
  onHelp,
  onSignUp,
  onSessionCodeChange,
  onAccessPasswordChange,
  onFindDevice,
  onConnectToHost,
  onBackToStep1,
  onJoinMeeting,
  onCreateMeeting,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [joinMode, setJoinMode] = useState<'session' | 'meeting' | 'anything'>('session');
  // Devices this machine connected to by ID (see lib/recentConnections).
  const [recentConnections, setRecentConnections] = useState<RecentConnection[]>(() => getAllRecentConnections());
  // Meeting codes joined or created from this page (see lib/recentMeetings).
  const [recentMeetings, setRecentMeetings] = useState<RecentMeeting[]>(() => getRecentMeetings());
  // Both recents lists are collapsed behind a toggle so they take one line
  // until wanted; the choice is remembered per list.
  const [recentOpen, setRecentOpen] = useState(() => localStorage.getItem(`${RECENTS_OPEN_KEY}:connections`) === 'true');
  const [recentMeetingsOpen, setRecentMeetingsOpen] = useState(() => localStorage.getItem(`${RECENTS_OPEN_KEY}:meetings`) === 'true');
  const toggleRecents = (list: 'connections' | 'meetings') => {
    const setter = list === 'connections' ? setRecentOpen : setRecentMeetingsOpen;
    setter((open) => {
      try { localStorage.setItem(`${RECENTS_OPEN_KEY}:${list}`, String(!open)); } catch { /* storage unavailable */ }
      return !open;
    });
  };
  // Fit-to-window: the whole column is scaled with CSS zoom (fonts, spacing
  // and controls together, unlike transform: scale which leaves the layout
  // footprint behind) so it never needs a scrollbar. The natural size is
  // measured at the current zoom and compared with the space the wrapper
  // offers minus the footer.
  const scrollRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const fitScaleRef = useRef(1);
  const scheduleFitRef = useRef<() => void>(() => {});
  const [fitScale, setFitScale] = useState(1);
  const [fontScale, setFontScale] = useState(() => readFontScale());
  const fontScaleRef = useRef(fontScale);
  const updateFontScale = (value: number) => {
    fontScaleRef.current = value;
    setFontScale(value);
    try { localStorage.setItem(FONT_SCALE_KEY, String(value)); } catch { /* storage unavailable */ }
    scheduleFitRef.current();
  };
  const [language, setLanguageChoice] = useState(() => readLanguage());
  const [showLanguages, setShowLanguages] = useState(false);
  const updateLanguage = (value: string) => {
    setLanguageChoice(value);
    setShowLanguages(false);
    if (useAuthStore.getState().user) {
      useAuthStore.getState().setLanguage(value);
      return;
    }
    // Signed out: remember the choice locally; the store applies it on sign-in.
    try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* storage unavailable */ }
    try {
      document.documentElement.lang = value;
      document.documentElement.dir = value === 'ar-SA' ? 'rtl' : 'ltr';
    } catch { /* not in a document */ }
  };
  useEffect(() => {
    const wrap = scrollRef.current;
    const col = colRef.current;
    if (!wrap || !col || typeof ResizeObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const measure = () => {
      timer = null;
      const current = fitScaleRef.current || 1;
      const text = fontScaleRef.current || 1;
      const rect = col.getBoundingClientRect();
      if (!rect.height || !rect.width) return;
      // The column is zoomed by fit × text size; measure at text size 1 and
      // find the fit that keeps the text-scaled column inside the window.
      const naturalH = rect.height / (current * text);
      const naturalW = rect.width / (current * text);
      const footerH = footerRef.current?.getBoundingClientRect().height || 0;
      const availH = wrap.clientHeight - footerH - 12;
      const availW = wrap.clientWidth - 16;
      const next = Math.max(MIN_FIT_SCALE, Math.min(1, availH / (naturalH * text), availW / (naturalW * text)));
      if (Math.abs(next - current) < 0.005) return;
      fitScaleRef.current = next;
      setFitScale(next);
    };
    // A timeout (not rAF: it never fires while the window is hidden) also
    // keeps the size change out of the observer callback, which would
    // otherwise report an observer loop.
    const schedule = () => { if (!timer) timer = setTimeout(measure, 0); };
    scheduleFitRef.current = schedule;
    const observer = new ResizeObserver(schedule);
    observer.observe(wrap);
    observer.observe(col);
    schedule();
    return () => { observer.disconnect(); if (timer) clearTimeout(timer); scheduleFitRef.current = () => {}; };
  }, []);
  // Window height tiers (index.css carries the matching media queries):
  // roomy > 1100px, compact = a maximised 1080p window (~1032px), tight =
  // 900p / 768p laptops. The teaser animation shrinks with the tier so the
  // column fits without scrolling wherever possible.
  const [heightTier, setHeightTier] = useState<HeightTier>(() => readHeightTier());
  const [meetingCode, setMeetingCode] = useState('');
  const [meetingPreview, setMeetingPreview] = useState<{ mode: 'create' } | { mode: 'join'; code: string } | null>(null);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [meetingError, setMeetingError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('General');
  const [startWithWindows, setStartWithWindows] = useState(() => readStartWithWindowsPreference(true));
  const [easyAccess, setEasyAccess] = useState(() => isEasyAccessEnabled());
  const [autoUpdate, setAutoUpdate] = useState(() => localStorage.getItem('pref_auto_update') !== 'false');
  const [installedVersion, setInstalledVersion] = useState('Unknown');
  const [latestVersion, setLatestVersion] = useState('Unknown');
  const [updateStatus, setUpdateStatus] = useState('Checking...');
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [syncClipboard, setSyncClipboard] = useState(() => localStorage.getItem('remote365_sync_clipboard') !== 'false');
  const [autoMinimize, setAutoMinimize] = useState(() => isHostAutoMinimizeEnabled());
  const [shareMeetingAudio, setShareMeetingAudio] = useState(() => localStorage.getItem('remote365_meeting_share_system_audio') === 'true');
  const [deviceName, setDeviceName] = useState(() => localStorage.getItem('remote365_device_name') || '');
  const [videoQuality, setVideoQuality] = useState(() => localStorage.getItem('remote365_video_quality') || 'ultra');
  const [streamFps, setStreamFps] = useState(() => localStorage.getItem('remote365_stream_fps') || '30');
  const [requirePassword, setRequirePassword] = useState(() => !isEasyAccessEnabled());
  const [showConnectionAlerts, setShowConnectionAlerts] = useState(() => areConnectionAlertsEnabled());
  const { user, updateProfile } = useAuthStore();

  // "Grant Easy Access" and "Require Password" are the same flag from opposite
  // ends; keep both checkboxes (and every other Easy Access switch) in step.
  useEffect(() => subscribeEasyAccess((enabled) => { setEasyAccess(enabled); setRequirePassword(!enabled); }), []);

  useEffect(() => {
    if (!isAuthenticated || user?.startWithWindows === undefined) return;
    const next = Boolean(user.startWithWindows);
    setStartWithWindows(next);
    applyStartWithWindowsPreference(next).then(setStartWithWindows);
  }, [isAuthenticated, user?.startWithWindows]);

  useEffect(() => {
    let active = true;
    const electronApi = (window as any).electronAPI;
    Promise.resolve(electronApi?.getAppVersion?.())
      .then((version) => {
        if (active && version) setInstalledVersion(String(version).replace(/^v/i, ''));
      })
      .catch(() => {
        if (active) setInstalledVersion('Unknown');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showSettings) return;
    const electronApi = (window as any).electronAPI;
    const stored = localStorage.getItem('pref_auto_update');
    const preferred = stored === null ? autoUpdate : stored !== 'false';
    setAutoUpdate(preferred);
    electronApi?.updates?.setAutoInstall?.(preferred).catch((error: any) => {
      console.warn('[Settings] Failed to apply auto-update preference:', error?.message || error);
    });
    if (stored === null) {
      electronApi?.updates?.getAutoInstall?.().then((enabled: boolean) => {
        const next = Boolean(enabled);
        setAutoUpdate(next);
        localStorage.setItem('pref_auto_update', String(next));
      }).catch(() => {});
    }
    Promise.all([
      electronApi?.getAppVersion?.().catch(() => null),
      electronApi?.updates?.getLatestInfo?.().catch((error: any) => ({ error: error?.message })),
    ]).then(([version, latest]) => {
      const current = version ? String(version) : 'Unknown';
      const newest = latest?.version ? String(latest.version) : 'Unknown';
      setInstalledVersion(current);
      setLatestVersion(newest);
      if (latest?.error) setUpdateStatus('Could Not Check Updates');
      else if (current !== 'Unknown' && newest !== 'Unknown' && compareVersionText(newest, current) > 0) setUpdateStatus(`Update available: ${newest}`);
      else setUpdateStatus('Up To Date');
    }).catch(() => {
      setUpdateStatus('Could Not Check Updates');
    });
  }, [showSettings]);

  const checkForUpdates = async () => {
    const electronApi = (window as any).electronAPI;
    if (!electronApi?.updates?.getLatestInfo) {
      setUpdateStatus('Updates are available in the desktop app only');
      return;
    }
    setUpdateStatus('Checking...');
    setCheckingUpdates(true);
    try {
      const [version, latest] = await Promise.all([
        electronApi?.getAppVersion?.().catch(() => null),
        electronApi.updates.getLatestInfo().catch((error: any) => ({ error: error?.message })),
      ]);
      const current = version ? String(version) : installedVersion;
      const newest = latest?.version ? String(latest.version) : 'Unknown';
      setInstalledVersion(current || 'Unknown');
      setLatestVersion(newest);

      if (latest?.error) {
        setUpdateStatus(`Could not check updates: ${latest.error}`);
        return;
      }

      const hasUpdate = current !== 'Unknown' && newest !== 'Unknown' && compareVersionText(newest, current) > 0;
      setUpdateStatus(hasUpdate ? `Update available: ${newest}` : 'Checked just now - up to date');

      if (hasUpdate && electronApi?.updates?.check) {
        await electronApi.updates.check().catch(() => null);
      }
    } catch (error: any) {
      setUpdateStatus(error?.message || 'Could Not Check Updates');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const refreshUpdateInfo = async () => {
    const electronApi = (window as any).electronAPI;
    try {
      const [version, latest] = await Promise.all([
        electronApi?.getAppVersion?.().catch(() => null),
        electronApi?.updates?.getLatestInfo?.().catch((error: any) => ({ error: error?.message })),
      ]);
      const current = version ? String(version) : 'Unknown';
      const newest = latest?.version ? String(latest.version) : 'Unknown';
      setInstalledVersion(current);
      setLatestVersion(newest);
      if (latest?.error) setUpdateStatus('Could Not Check Updates');
      else if (current !== 'Unknown' && newest !== 'Unknown' && compareVersionText(newest, current) > 0) setUpdateStatus(`Update available: ${newest}`);
      else setUpdateStatus('Up To Date');
    } catch {
      setUpdateStatus('Could Not Check Updates');
    }
  };

  const formatCode = (code: string) => {
    if (!code) return '';
    const c = code.replace(/[^0-9]/g, '');
    if (c.length === 9) return `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 9)}`;
    return c.match(/.{1,3}/g)?.join(' ') || c;
  };

  const displayAccessKey = hostAccessKey ? formatCode(hostAccessKey) : '';

  const extractMeetingCode = (value: string) => {
    const trimmed = value.trim();
    try {
      const parsed = new URL(trimmed);
      return parsed.searchParams.get('code') || parsed.pathname.split('/').filter(Boolean).pop() || trimmed;
    } catch {
      return trimmed;
    }
  };

  const formatMeetingCode = (code: string) => {
    const clean = String(code || '').replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length === 9) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
    return code.trim();
  };

  const handleCopy = () => {
    if (displayAccessKey) onCopyAccessKey();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyText = (text: string) => {
    const electronApi = (window as any).electronAPI;
    if (electronApi?.clipboard?.writeText) return electronApi.clipboard.writeText(text);
    return navigator.clipboard.writeText(text);
  };

  const updateStartWithWindows = (checked: boolean) => {
    setStartWithWindows(checked);
    applyStartWithWindowsPreference(checked).then(setStartWithWindows);
    if (isAuthenticated) {
      updateProfile({ startWithWindows: checked }).catch((error) => {
        console.error('[SnowLanding] Failed to save startup preference:', error);
      });
    }
  };

  const updateAutoUpdate = (checked: boolean) => {
    setAutoUpdate(checked);
    localStorage.setItem('pref_auto_update', String(checked));
    const updates = (window as any).electronAPI?.updates;
    updates?.setAutoInstall?.(checked).then(() => {
      // Enabling should start a pending update immediately, not wait for the poll.
      if (checked) updates?.check?.().catch(() => {});
    }).catch((error: any) => {
      console.warn('[Settings] Failed to save auto-update preference:', error?.message || error);
    });
  };

  // A finished connection resets the join step; re-read the list then, and
  // whenever the window comes back (a viewer window may have recorded one).
  useEffect(() => {
    const refresh = () => setRecentConnections(getAllRecentConnections());
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [connectStep, connectStatus]);

  useEffect(() => {
    const lists = HEIGHT_TIER_QUERIES.map((query) => window.matchMedia(query));
    const update = () => setHeightTier(readHeightTier());
    lists.forEach((list) => list.addEventListener('change', update));
    return () => lists.forEach((list) => list.removeEventListener('change', update));
  }, []);
  // Content changes (tab, step, recents) re-fit right after they paint.
  useLayoutEffect(() => {
    scheduleFitRef.current();
  }, [joinMode, connectStep, connectStatus, recentOpen, recentMeetingsOpen, recentConnections.length, recentMeetings.length, heightTier]);

  // The public policy page in the system browser: window.open here made
  // Electron spawn a bare child window. Always the production site.
  const openPrivacyPolicy = () => {
    const url = 'https://remote365.ai/privacy';
    const electronApi = (window as any).electronAPI;
    if (electronApi?.openExternal) electronApi.openExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePickRecentMeeting = (entry: RecentMeeting) => {
    const code = formatMeetingCode(entry.code);
    setMeetingCode(code);
    openMeetingPreview({ mode: 'join', code });
  };

  const handleRemoveRecentMeeting = (event: React.MouseEvent, entry: RecentMeeting) => {
    event.stopPropagation();
    setRecentMeetings(removeRecentMeeting(entry.code));
  };

  const handlePickRecent = (entry: RecentConnection) => {
    if (connectStatus === 'connecting') return;
    onSessionCodeChange(formatAccessKey(entry.accessKey));
    onFindDevice(entry.accessKey);
  };

  const handleRemoveRecent = (event: React.MouseEvent, entry: RecentConnection) => {
    event.stopPropagation();
    setRecentConnections(removeRecentConnectionEverywhere(entry.accessKey));
  };

  const updateEasyAccess = (checked: boolean) => {
    setEasyAccess(checked);
    // Shared flag — App.tsx handles server sync + hosting, and every other
    // Easy Access / Unattended switch follows (see lib/easyAccess).
    applyEasyAccess(checked);
  };

  const updateSyncClipboard = (checked: boolean) => {
    setSyncClipboard(checked);
    setClipboardSyncEnabled(checked);
  };

  const updateAutoMinimize = (checked: boolean) => {
    setAutoMinimize(checked);
    void setHostAutoMinimizeEnabled(checked);
  };

  const updateShareMeetingAudio = (checked: boolean) => {
    setShareMeetingAudio(checked);
    localStorage.setItem('remote365_meeting_share_system_audio', String(checked));
  };

  // The server keeps the name people see when they connect; push it once
  // typing pauses (a routine registration: no password, no access flag).
  const deviceNameSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateDeviceName = (value: string) => {
    setDeviceName(value);
    localStorage.setItem('remote365_device_name', value);
    if (deviceNameSyncRef.current) clearTimeout(deviceNameSyncRef.current);
    const clean = value.trim();
    if (!hostAccessKey || !clean) return;
    deviceNameSyncRef.current = setTimeout(() => {
      getMachineFingerprint()
        .then((fingerprint) => api.post('/api/devices/self-register', { accessKey: hostAccessKey, name: clean, fingerprint: fingerprint || undefined }))
        .catch((err: any) => console.warn('[Settings] Failed to sync the display name:', err?.message || err));
    }, 800);
  };

  const updateVideoQuality = (value: string) => {
    setVideoQuality(value);
    localStorage.setItem('remote365_video_quality', value);
  };

  const updateStreamFps = (value: string) => {
    setStreamFps(value);
    localStorage.setItem('remote365_stream_fps', value);
  };

  const updateRequirePassword = (checked: boolean) => {
    setRequirePassword(checked);
    // Inverse of Easy Access — App.tsx's listener syncs the server flag.
    applyEasyAccess(!checked);
  };

  const updateConnectionAlerts = (checked: boolean) => {
    setShowConnectionAlerts(checked);
    setConnectionAlertsEnabled(checked);
  };

  // Both create and join open the device-preview lobby first, so the camera /
  // mic choices (and the "join with video off" → no camera light behaviour)
  // match the in-app Meetings page exactly.
  const openMeetingPreview = (target: { mode: 'create' } | { mode: 'join'; code: string }) => {
    setMeetingError('');
    setMeetingPreview(target);
  };

  const closeMeetingPreview = () => {
    setMeetingPreview(null);
    setMeetingError('');
  };

  const createMeeting = async () => {
    setIsCreatingMeeting(true);
    setMeetingError('');
    try {
      const { data } = await api.post('/api/chat/meetings', {
        name: `${deviceName || 'Remote365'} meeting`
      });
      const issued = data?.displayCode || data?.sessionCode;
      if (issued) {
        setMeetingPreview(null);
        const created = formatMeetingCode(String(issued));
        setRecentMeetings(recordRecentMeeting(created, 'created'));
        onCreateMeeting(created);
        return;
      }
    } catch (err) {
      console.warn('[Meetings] Server meeting creation failed; falling back to local code.', err);
    } finally {
      setIsCreatingMeeting(false);
    }

    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const raw = Array.from({ length: 9 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    setMeetingPreview(null);
    const local = formatMeetingCode(raw);
    setRecentMeetings(recordRecentMeeting(local, 'created'));
    onCreateMeeting(local);
  };

  const handleJoinMeeting = () => {
    const code = formatMeetingCode(extractMeetingCode(meetingCode));
    if (code) openMeetingPreview({ mode: 'join', code });
  };

  const handleCreateMeeting = () => openMeetingPreview({ mode: 'create' });

  const handleConfirmMeetingPreview = () => {
    if (!meetingPreview) return;
    if (meetingPreview.mode === 'create') {
      createMeeting();
    } else {
      const code = meetingPreview.code;
      setMeetingPreview(null);
      setRecentMeetings(recordRecentMeeting(code, 'joined'));
      onJoinMeeting(code);
    }
  };

  return (
    <div className="tv-guest">
      <div className="tv-guest-gradient" />

      <div className="tv-guest-brand">
        <img src={logo} alt="Remote365" />
        <span className="tv-guest-brand-name">Remote365</span>
        {installedVersion !== 'Unknown' && (
          <span className="tv-guest-brand-version">v{installedVersion}</span>
        )}
      </div>

      {onHelp && (
        <button type="button" onClick={onHelp} className="tv-help-button" title="Help And Support">
          <CircleHelp size={15} />
          <span>Help</span>
        </button>
      )}
      <div className="tv-language-wrap">
        <button
          type="button"
          onClick={() => setShowLanguages((open) => !open)}
          className="tv-language-button"
          title="Language"
          aria-haspopup="listbox"
          aria-expanded={showLanguages}
        >
          <Languages size={16} />
          <span>{LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || 'English'}</span>
          <ChevronDown size={14} />
        </button>
        {showLanguages && (
          <>
            <button type="button" className="tv-language-backdrop" aria-label="Close" onClick={() => setShowLanguages(false)} />
            <ul className="tv-language-menu" role="listbox">
              {LANGUAGE_OPTIONS.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={language === option.value}
                    className={language === option.value ? 'active' : ''}
                    onClick={() => updateLanguage(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <button onClick={() => setShowSettings(true)} className="tv-settings-button" title="Settings"><Settings size={18} /></button>

        {showSettings && (
          <div className="tv-settings-modal-wrap">
            <div className="tv-settings-modal">
              <div className="tv-settings-head">
                <div>
                  <h3>Remote365 Options</h3>
                  <p>Local access and session preferences</p>
                </div>
                <button onClick={() => setShowSettings(false)}><X size={16} /></button>
              </div>

              <div className="tv-options-shell">
                <nav className="tv-options-tabs">
                  {['General', 'Account', 'Remote Control', 'Meeting', 'Video', 'Text Size', 'Software Update'].map(tab => (
                    <button
                      key={tab}
                      type="button"
                      className={activeSettingsTab === tab ? 'active' : ''}
                      onClick={() => setActiveSettingsTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>

                <div className="tv-options-panel">
                  {activeSettingsTab === 'General' && (
                    <>
                      <h4>Most Popular Options</h4>
                      <p className="tv-options-help"><span>i</span> Hover your mouse over options to get additional info</p>

                      <section>
                        <h5>Important Options For Working With Remote365</h5>
                        <div className="tv-options-row">
                          <label>Your Display Name</label>
                          <input
                            type="text"
                            placeholder="This Laptop"
                            value={deviceName}
                            onChange={e => updateDeviceName(e.target.value)}
                          />
                        </div>
                        <label className="tv-options-check"><input type="checkbox" checked={startWithWindows} onChange={e => updateStartWithWindows(e.target.checked)} /> Start Remote365 With Windows</label>
                        <label className="tv-options-check"><input type="checkbox" checked={autoUpdate} onChange={e => updateAutoUpdate(e.target.checked)} /> Install Updates Automatically</label>
                        <label className="tv-options-check"><input type="checkbox" checked={easyAccess} onChange={e => updateEasyAccess(e.target.checked)} /> Grant Easy Access To This Device</label>
                      </section>

                      <section>
                        <h5>Access Settings</h5>
                        <label className="tv-options-check"><input type="checkbox" checked={requirePassword} onChange={e => updateRequirePassword(e.target.checked)} /> Require Password Before Remote Access</label>
                        <div className="tv-options-row">
                          <label>Password</label>
                          <button type="button" onClick={onOpenSetPassword}>Change Password...</button>
                        </div>
                      </section>
                    </>
                  )}

                  {activeSettingsTab === 'Remote Control' && (
                    <>
                      <h4>Remote Control Options</h4>
                      <section>
                        <h5>Session Behavior</h5>
                        <label className="tv-options-check"><input type="checkbox" checked={syncClipboard} onChange={e => updateSyncClipboard(e.target.checked)} /> Sync Clipboard During Sessions</label>
                        <label className="tv-options-check"><input type="checkbox" checked={autoMinimize} onChange={e => updateAutoMinimize(e.target.checked)} /> Minimize App When A Session Starts</label>
                        <label className="tv-options-check"><input type="checkbox" checked={showConnectionAlerts} onChange={e => updateConnectionAlerts(e.target.checked)} /> Show Connection Alerts</label>
                      </section>
                    </>
                  )}

                  {activeSettingsTab === 'Meeting' && (
                    <>
                      <h4>Meeting Options</h4>
                      <section>
                        <h5>Audio Sharing</h5>
                        <label className="tv-options-check"><input type="checkbox" checked={shareMeetingAudio} onChange={e => updateShareMeetingAudio(e.target.checked)} /> Share desktop audio during meeting screen share</label>
                      </section>
                    </>
                  )}

                  {activeSettingsTab === 'Video' && (
                    <>
                      <h4>Video Options</h4>
                      <section>
                        <h5>Remote Quality</h5>
                        <div className="tv-options-row">
                          <label>Video Quality</label>
                          <select value={videoQuality} onChange={e => updateVideoQuality(e.target.value)}>
                            <option value="smooth">Smooth - Lower Bandwidth</option>
                            <option value="balanced">Balanced</option>
                            <option value="sharp">Sharp - Clear Text</option>
                            <option value="ultra">Ultra Clarity - Best Picture</option>
                          </select>
                        </div>
                        <div className="tv-options-row">
                          <label>Frame Rate</label>
                          <select value={streamFps} onChange={e => updateStreamFps(e.target.value)}>
                            <option value="30">30 FPS</option>
                            <option value="60">60 FPS</option>
                            <option value="75">75 FPS</option>
                            <option value="90">90 FPS</option>
                            <option value="120">120 FPS</option>
                          </select>
                        </div>
                      </section>
                    </>
                  )}

                  {activeSettingsTab === 'Text Size' && (
                    <>
                      <h4>Text Size</h4>
                      <p className="tv-options-help"><span>i</span> Makes the text and controls on this page larger. The page still fits the window without scrolling.</p>
                      <section>
                        <h5>Size Of Text On This Page</h5>
                        <div className="tv-text-size-options">
                          {FONT_SCALE_OPTIONS.map(option => (
                            <label key={option.value} className={`tv-text-size-option${fontScale === option.value ? ' active' : ''}`}>
                              <input type="radio" name="tv-text-size" checked={fontScale === option.value} onChange={() => updateFontScale(option.value)} />
                              <span className="tv-text-size-sample" style={{ fontSize: `${Math.round(13 * option.value)}px` }}>Aa</span>
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </section>
                    </>
                  )}

                  {activeSettingsTab === 'Software Update' && (
                    <>
                      <h4>Software Update</h4>
                      <p className="tv-options-help"><span>i</span> View the installed Remote365 release and update preference</p>
                      <section>
                        <h5>Release Information</h5>
                        <div className="tv-options-row">
                          <label>Installed Version</label>
                          <input type="text" value={installedVersion} readOnly />
                        </div>
                        <div className="tv-options-row">
                          <label>Latest Version</label>
                          <input type="text" value={latestVersion} readOnly />
                        </div>
                        <div className="tv-options-row">
                          <label>Update Status</label>
                          <input type="text" value={updateStatus} readOnly />
                        </div>
                        <label className="tv-options-check"><input type="checkbox" checked={autoUpdate} onChange={e => updateAutoUpdate(e.target.checked)} /> Install Updates Automatically</label>
                        <div className="tv-options-row">
                          <label>Manual Check</label>
                          <button type="button" onClick={checkForUpdates} disabled={checkingUpdates}>
                            {checkingUpdates ? 'Checking...' : 'Check For Updates...'}
                          </button>
                        </div>
                      </section>
                    </>
                  )}

                  {activeSettingsTab === 'Account' && (
                    <>
                      <h4>Account</h4>
                      <p className="tv-options-help"><span>i</span> Sign in to see your saved devices, groups and meetings on every machine</p>
                      <section>
                        <h5>This Device</h5>
                        <div className="tv-options-row">
                          <label>Your ID</label>
                          <input type="text" value={displayAccessKey || '--- --- ---'} readOnly />
                        </div>
                        <div className="tv-options-row">
                          <label>Password</label>
                          <input type="text" value={devicePassword ? 'Set' : 'Not Set'} readOnly />
                        </div>
                        <div className="tv-options-row">
                          <label>Host Status</label>
                          <input type="text" value={hostStatus === 'status' ? 'Online And Ready' : hostStatus === 'connecting' ? 'Connecting' : hostStatus === 'error' ? 'Error' : 'Offline'} readOnly />
                        </div>
                      </section>
                      <section>
                        <h5>Remote365 Account</h5>
                        <p className="tv-options-empty">You are not signed in on this device.</p>
                        <div className="tv-options-row">
                          <label>Sign In</label>
                          <button type="button" onClick={() => { setShowSettings(false); onSignIn(); }}>Sign In To Remote365...</button>
                        </div>
                        <div className="tv-options-row">
                          <label>New Here?</label>
                          <button type="button" onClick={() => { setShowSettings(false); onSignUp(); }}>Create Account...</button>
                        </div>
                      </section>
                    </>
                  )}
                </div>
              </div>

              <div className="tv-settings-actions">
                <button onClick={() => setShowSettings(false)}>OK</button>
                <button onClick={() => setShowSettings(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* The scroller: brand, gear and gradient stay put while a column taller
            than the window scrolls (small laptops clipped it top and bottom). */}
        <div className="tv-guest-scroll" ref={scrollRef}>
          <div className="tv-guest-col" ref={colRef} style={{ zoom: fitScale * fontScale }}>
            <header className="tv-guest-head">
              <h1>Access And Support From Anywhere</h1>
            </header>

            <p className="tv-helper-text tv-helper-lead">Share your ID and password for Remote Support.</p>

            <div className="tv-credential-card">
              <div className="tv-credential-row">
                <div>
                  <p className="tv-label">Your ID</p>
                  <p className="tv-id">{displayAccessKey || '--- --- ---'}</p>
                </div>
                <button onClick={handleCopy} className="tv-icon-button">
                  {copied ? <CheckCircle2 size={18} className="text-green-600" /> : <Copy size={18} />}
                </button>
              </div>

              {displayAccessKey && (
                <>
                  <div className="tv-divider" />

                  <div className="tv-credential-row">
                    <div>
                      <p className="tv-label">Password</p>
                      <p className="tv-password">{devicePassword || 'Not Set'}</p>
                    </div>
                    <div className="tv-icon-group">
                      <button onClick={onOpenSetPassword} className="tv-icon-button"><RefreshCw size={17} /></button>
                      <button onClick={() => devicePassword && copyText(devicePassword)} className="tv-icon-button">
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="tv-or"><span />Or<span /></div>
            <div className="tv-join-tabs">
              <button className={joinMode === 'session' ? 'active' : ''} onClick={() => setJoinMode('session')}><Monitor size={14} /> Remote Session</button>
              <button className={joinMode === 'meeting' ? 'active' : ''} onClick={() => setJoinMode('meeting')}><Video size={14} /> Meeting</button>
              <button className={joinMode === 'anything' ? 'active' : ''} onClick={() => setJoinMode('anything')}><Globe2 size={14} /> Connect Anything</button>
            </div>
            {joinMode === 'anything' && (
              <p className="tv-helper-text">A whole new way to connect — arriving soon.</p>
            )}

            {joinMode === 'anything' ? (
              <div className="tv-anything">
                <h3>Connect Anything</h3>
                <LottieScene
                  animationData={connectAnythingSoonAnimation}
                  size={heightTier === 'tight' ? 280 : heightTier === 'compact' ? 400 : 456}
                  loop
                  canvasAspect={816 / 372}
                  label="Coming Soon"
                />
              </div>
            ) : joinMode === 'meeting' ? (
              <div className="tv-meeting-tools">
                <div className="tv-session-row">
                  <label className="tv-session-field">
                    <span>Meeting Code</span>
                    <input
                      type="text"
                      placeholder="e.g. 123-456-789"
                      maxLength={11}
                      value={meetingCode}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);
                        const parts = raw.match(/.{1,3}/g) || [];
                        setMeetingCode(parts.join('-'));
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') handleJoinMeeting(); }}
                    />
                  </label>
                  <button onClick={handleJoinMeeting} disabled={!meetingCode.trim()} className="tv-join-button">
                    Join Meeting
                  </button>
                </div>
                <button onClick={handleCreateMeeting} className="tv-create-meeting-button">
                  <Wand2 size={15} /> Create New Meeting
                </button>
                {recentMeetings.length > 0 && (
                  <div className="tv-recent">
                    <button type="button" className="tv-recent-toggle" onClick={() => toggleRecents('meetings')} aria-expanded={recentMeetingsOpen}>
                      <Clock size={14} /><span>Recent Meetings</span><em>{recentMeetings.length}</em><ChevronDown size={14} className={recentMeetingsOpen ? 'open' : ''} />
                    </button>
                    {recentMeetingsOpen && <div className="tv-recent-list">
                      {recentMeetings.slice(0, 6).map((entry) => (
                        <div key={entry.code} className="tv-recent-item">
                          <button type="button" className="tv-recent-pick" onClick={() => handlePickRecentMeeting(entry)}>
                            <span className="tv-recent-name">{formatRecentMeetingCode(entry.code)}</span>
                            <span className="tv-recent-id">
                              {entry.role === 'created' ? 'Created' : 'Joined'} · {new Date(entry.lastUsedAt).toLocaleDateString('en-GB')}
                            </span>
                          </button>
                          <button type="button" className="tv-recent-remove" onClick={(e) => handleRemoveRecentMeeting(e, entry)} title="Remove" aria-label="Remove">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>}
                  </div>
                )}
              </div>
            ) : connectStep === 1 ? (
              <>
                <div className="tv-session-row">
                  <label className="tv-session-field">
                    <span>Remote Device ID</span>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Remote Device ID or Host ID (Example: 123 456 789)"
                      maxLength={11}
                      value={sessionCode}
                      onChange={e => onSessionCodeChange(formatCode(e.target.value))}
                      onKeyDown={e => { if (e.key === 'Enter') onFindDevice(); }}
                    />
                  </label>
                  <button onClick={() => onFindDevice()} disabled={connectStatus === 'connecting' || !sessionCode} className="tv-join-button">
                    {connectStatus === 'connecting' ? 'Checking...' : 'Join Session'}
                  </button>
                </div>
                {recentConnections.length > 0 && (
                  <div className="tv-recent">
                    <button type="button" className="tv-recent-toggle" onClick={() => toggleRecents('connections')} aria-expanded={recentOpen}>
                      <Clock size={14} /><span>Recent Connections</span><em>{recentConnections.length}</em><ChevronDown size={14} className={recentOpen ? 'open' : ''} />
                    </button>
                    {recentOpen && <div className="tv-recent-list">
                      {recentConnections.slice(0, 6).map((entry) => (
                        <div
                          key={entry.accessKey}
                          className="tv-recent-item"
                          title={`Last Connected ${new Date(entry.lastConnectedAt).toLocaleDateString('en-GB')}`}
                        >
                          <button
                            type="button"
                            className="tv-recent-pick"
                            onClick={() => handlePickRecent(entry)}
                            disabled={connectStatus === 'connecting'}
                          >
                            <span className="tv-recent-name">{entry.name?.trim() || 'Remote Device'}</span>
                            <span className="tv-recent-id">{formatAccessKey(entry.accessKey)}</span>
                          </button>
                          <button type="button" className="tv-recent-remove" onClick={(e) => handleRemoveRecent(e, entry)} title="Remove" aria-label="Remove">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>}
                  </div>
                )}
              </>
            ) : (
              <div className="tv-password-flow">
                <div className="tv-target-box">
                  <div>
                    <p>Target Device</p>
                    <strong>{formatCode(sessionCode)}</strong>
                    {targetDeviceName && <span>{targetDeviceName}</span>}
                  </div>
                  <i />
                </div>
                {targetPasswordRequired ? (
                  <div className="tv-password-input-wrap">
                    <Lock size={15} />
                    <input
                      autoFocus
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Enter Password"
                      value={accessPassword}
                      onChange={e => onAccessPasswordChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') onConnectToHost(); }}
                    />
                    <button onClick={() => setShowPwd(!showPwd)}>
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                ) : (
                  <div className="tv-passwordless-note">
                    <CheckCircle2 size={16} />
                    <span>This device allows passwordless access.</span>
                  </div>
                )}
                <div className="tv-connect-row">
                  <button onClick={() => onConnectToHost()} disabled={connectStatus === 'connecting' || (targetPasswordRequired && !accessPassword) || lockoutSeconds > 0}>
                    {connectStatus === 'connecting' ? 'Connecting...' : 'Connect'}
                  </button>
                  <button onClick={onBackToStep1}>Back</button>
                </div>
              </div>
            )}

            {(connectError || lockoutSeconds > 0) && (
              <div className="tv-error">
                <AlertTriangle size={14} />
                <p>{lockoutSeconds > 0 ? `Too many attempts. Try again in ${lockoutSeconds}s.` : connectError}</p>
              </div>
            )}

            <div className="tv-options">
              <label><input type="checkbox" checked={startWithWindows} onChange={e => updateStartWithWindows(e.target.checked)} /> Start Remote365 With Windows <InfoDot tip="Opens Remote365 automatically every time you sign in to Windows, so this PC can be reached without anyone starting the app first." /></label>
              <label><input type="checkbox" checked={easyAccess} onChange={e => updateEasyAccess(e.target.checked)} /> Grant Easy Access To This Device <InfoDot tip="Unattended access: keeps this PC online and lets your trusted account connect without typing the password or waiting for someone here to accept. Turn it off to require the password and approval on every connection." /></label>
            </div>

            <button onClick={onSignIn} className="tv-signin-button">Already Have An Account – Remote365</button>
            <div className="tv-or tv-or-auth"><span />Or<span /></div>
            <button onClick={onSignUp} className="tv-signin-button tv-signup-button">Don't Have An Account – Sign Up</button>
          </div>

          <footer className="tv-guest-footer" ref={footerRef}>
            <span className="tv-guest-copyright">Copyright 2026 © TechVision365 Inc. All Rights Reserved.</span>
          </footer>
        </div>

        <MeetingPreviewModal
          open={!!meetingPreview}
          mode={meetingPreview?.mode ?? 'join'}
          busy={isCreatingMeeting}
          error={meetingError}
          onCancel={closeMeetingPreview}
          onConfirm={handleConfirmMeetingPreview}
        />
    </div>
  );
};
