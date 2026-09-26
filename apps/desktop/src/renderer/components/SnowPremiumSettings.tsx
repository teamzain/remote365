import React, { useState, useRef, useEffect } from 'react';
import { User, Shield, ShieldCheck, Wifi, Monitor, Video, Bell, CheckCircle2, ChevronRight, ChevronDown, Check, Settings as SettingsIcon, LogOut, Edit3, Loader2, Moon, Search, Layout, Mail, Type, Smartphone, Rocket, Key, Usb, Mic, Volume2, VolumeX, ExternalLink, AlertTriangle, Camera, Eye, EyeOff, RefreshCw, Download, X as CloseIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { t } from '../lib/translations';
import api from '../lib/api';
import { LicensesPanel } from './settings/LicensesPanel';
import desktopDarkPreview from '../assets/desktop-dark.png';
import desktopLightPreview from '../assets/desktop-light.png';
import { applyStartWithWindowsPreference, readStartWithWindowsPreference } from '../lib/startupPreferences';
import { applyCustomizationPreferences, readCustomizationPreferences, SearchBehavior } from '../lib/customizationPreferences';
import { MEETING_PREF_KEYS } from './MeetingPreviewModal';
import { readPreferredDevice, writePreferredDevice } from '../lib/mediaPreferences';
import { applyEasyAccess, isEasyAccessEnabled, subscribeEasyAccess } from '../lib/easyAccess';
import { addTempCode, getActiveTempCodes, removeTempCode } from '../lib/tempAccessCodes';
import { hasUserFeature, hasUserPermission } from '../lib/permissions';
import { readPreferenceChoice } from '../lib/preferenceValue';

const RC_CLIPBOARD_OPTIONS = ['Outgoing Only', 'Incoming Only', 'Both', 'Off'] as const;
const RC_CURSOR_OPTIONS = ['Default', 'Dot', 'Hidden'] as const;
const RC_QUALITY_OPTIONS = ['Balanced', 'Optimize Speed', 'Optimize Quality'] as const;
const PERFORMANCE_OPTIONS = ['Recommended', 'Optimize Speed', 'Optimize Quality', 'Low Bandwidth'] as const;
const PROXY_OPTIONS = ['Recommended', 'System proxy', 'Manual proxy', 'No proxy'] as const;


interface SnowPremiumSettingsProps {
  user: any;
  logout?: () => void;
  currentDeviceId?: string | null;
  currentDeviceAccessKey?: string | null;
}

const normalizeAccessKey = (value: unknown) => String(value || '').replace(/\D/g, '');

const getDeviceAccessKey = (device: any) => normalizeAccessKey(device?.access_key || device?.accessKey);

// Multicolor Google "G" logo.
const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

interface SecuritySettings {
  blockList: string[];
  allowList: string[];
  requirePassword: boolean;
  easyAccess: boolean;
  confirmEachConnection: boolean;
  lockOnDisconnect: boolean;
  allowControl: boolean;
  allowClipboard: boolean;
  allowFileTransfer: boolean;
  maxParticipants: number;
  securityKeyInstalled: boolean;
}

interface LatestUpdateInfo {
  available?: boolean;
  version?: string | null;
  releaseDate?: string | null;
  releaseName?: string | null;
  releaseNotes?: string | null;
  feedUrl?: string;
  error?: string;
}

const compareVersions = (a?: string | null, b?: string | null) => {
  const left = String(a || '').split('.').map((part) => parseInt(part.replace(/\D/g, ''), 10) || 0);
  const right = String(b || '').split('.').map((part) => parseInt(part.replace(/\D/g, ''), 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    if ((left[i] || 0) > (right[i] || 0)) return 1;
    if ((left[i] || 0) < (right[i] || 0)) return -1;
  }
  return 0;
};

const fallbackReleaseNotes: Record<string, string[]> = {
  '1.1.67': [
    'Desktop backend now targets the configured Remote365 ID server.',
    'Improved update feed consistency for the current public release.',
  ],
  '1.1.66': [
    'Auto-hosting no longer claims a device under an account without explicit user action.',
    'Custom device names are preserved across desktop updates and releases.',
  ],
  '1.1.64': [
    'Added connection route diagnostics for remote desktop sessions.',
    'Improved ICE and signaling visibility for troubleshooting international sessions.',
  ],
  '1.1.63': [
    'Improved host capture pacing and stream backpressure behavior.',
    'Adjusted default desktop stream settings for smoother low-latency sessions.',
  ],
};

// Derive a friendly OS + client name from a user-agent string.
const parseClientInfo = (ua: string): { device: string; client: string } => {
  const s = ua || '';
  let device = 'Unknown Device';
  if (/Windows/i.test(s)) device = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(s)) device = 'macOS';
  else if (/Android/i.test(s)) device = 'Android';
  else if (/iPhone|iPad|iPod|iOS/i.test(s)) device = 'iOS';
  else if (/Linux/i.test(s)) device = 'Linux';
  let client = 'Remote365';
  if (/Electron/i.test(s)) client = 'Remote365 Desktop';
  else if (/Edg\//i.test(s)) client = 'Edge';
  else if (/Chrome\//i.test(s)) client = 'Chrome';
  else if (/Firefox\//i.test(s)) client = 'Firefox';
  else if (/Safari\//i.test(s)) client = 'Safari';
  return { device, client };
};

// Read the issued-at time (ms) from a JWT without verifying it.
const jwtIssuedAt = (token: string | null): number | null => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return payload?.iat ? payload.iat * 1000 : null;
  } catch {
    return null;
  }
};

const timeAgo = (ms: number | null): string => {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};

// Brand toggle switch reused inside the security modals.
const SecToggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
  </label>
);

const AdvancedCheckbox = ({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) => (
  <label className="flex h-5 cursor-pointer items-center gap-3">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 shrink-0 rounded-[2px] border border-[rgba(26,29,33,0.3)] accent-[#FF8A00]"
    />
    <span className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#F5F5F5]">{label}</span>
  </label>
);

interface StyledSelectOption {
  value: string;
  label: string;
}

// Custom dropdown that matches the app's design (orange focus/hover) instead of
// the native OS <select> with its blue highlight.
const StyledSelect: React.FC<{
  value: string;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, options, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`relative flex h-10 w-full items-center rounded border bg-white px-4 pr-10 text-left text-[14px] leading-5 text-[#111315] outline-none transition-colors disabled:opacity-50 dark:bg-[#141414] dark:text-white ${open ? 'border-[#FF8A00]' : 'border-[rgba(26,29,33,0.3)] hover:border-[rgba(26,29,33,0.5)]'}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label || ''}</span>
        <ChevronDown size={16} className={`absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(17,19,21,0.5)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-12 z-[70] max-h-60 overflow-y-auto rounded-lg border border-[rgba(26,29,33,0.12)] bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#1A1A1A]">
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => { onChange(option.value); setOpen(false); }}
                className={`flex h-10 w-full items-center justify-between px-4 text-left text-[14px] leading-5 transition-colors ${isSelected ? 'bg-[#FFF4E5] text-[#FF8A00]' : 'text-[#111315] hover:bg-[#FFF4E5] hover:text-[#FF8A00] dark:text-[#F5F5F5] dark:hover:bg-white/5'}`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check size={16} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const SnowPremiumSettings: React.FC<SnowPremiumSettingsProps> = ({
  user: initialUser,
  logout,
  currentDeviceId: hostDeviceId,
  currentDeviceAccessKey
}) => {
  const { user, accessToken, updateProfile, setLanguage: applyLanguage, isLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState('Profile');
  // Effective per-user gate: billing:view permission plus the "Licenses & Plan"
  // feature, both owner-editable per role and per member (owners always pass).
  const canViewBilling = hasUserPermission(user || initialUser, 'billing:view')
    && hasUserFeature(user || initialUser, 'licenses');
  const [displayName, setDisplayName] = useState(user?.name || 'User');
  const [language, setLanguage] = useState(user?.language || 'en');
  const [timezone, setTimezone] = useState(() => localStorage.getItem('pref_timezone') || 'Asia/Karachi');
  const lang = language || user?.language;
  // Google accounts are created without a local password, so password changes
  // are managed by Google rather than us.
  const isGoogleAccount = user?.provider === 'google' || user?.hasPassword === false;
  const [isRestricted, setIsRestricted] = useState(user?.notify_session_alert ?? true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  // Security tab state
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean>(
    () => (user?.is_2fa_enabled ?? (localStorage.getItem('pref_2fa') === 'true'))
  );
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCurrent, setResetCurrent] = useState('');
  const [resetNew, setResetNew] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [showResetCurrent, setShowResetCurrent] = useState(false);
  const [showResetNew, setShowResetNew] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [resetError, setResetError] = useState('');
  const [pwUpdatedAt, setPwUpdatedAt] = useState(() => localStorage.getItem('pref_pw_updated') || '');

  // --- Security configuration (block/allow list, auth, access control, key redirection) ---
  const [securityModal, setSecurityModal] = useState<null | 'block' | 'auth' | 'access' | 'redirection'>(null);
  const [secInput, setSecInput] = useState('');
  const [allowInput, setAllowInput] = useState('');
  const [installingKey, setInstallingKey] = useState(false);
  const [secSettings, setSecSettings] = useState<SecuritySettings>(() => {
    const defaults: SecuritySettings = {
      blockList: [],
      allowList: [],
      requirePassword: !isEasyAccessEnabled(),
      easyAccess: isEasyAccessEnabled(),
      confirmEachConnection: localStorage.getItem('remote365_confirm_each') !== 'false',
      lockOnDisconnect: localStorage.getItem('remote365_lock_on_disconnect') === 'true',
      allowControl: true,
      allowClipboard: true,
      allowFileTransfer: true,
      maxParticipants: 1,
      securityKeyInstalled: false,
    };
    try {
      const raw = localStorage.getItem('remote365_security_settings');
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<SecuritySettings>) };
    } catch {}
    return defaults;
  });

  // Mirror the keys the rest of the app (host process) actually reads.
  const mirrorSecToLocalStorage = (next: SecuritySettings) => {
    try {
      localStorage.setItem('remote365_security_settings', JSON.stringify(next));
      // requirePassword / easyAccess are NOT mirrored here: they are the
      // per-device Easy Access flag, owned by lib/easyAccess (applyEasyAccess
      // writes the keys AND syncs the server). Writing them directly used to
      // flip the device to password-required behind the landing checkbox.
      localStorage.setItem('remote365_confirm_each', String(next.confirmEachConnection));
      localStorage.setItem('remote365_lock_on_disconnect', String(next.lockOnDisconnect));
      localStorage.setItem('remote365_block_list', JSON.stringify(next.blockList));
      localStorage.setItem('remote365_allow_list', JSON.stringify(next.allowList));
    } catch {}
  };

  // Security settings live on the account (User.securitySettings) so they
  // follow the user across machines; adopt the server copy once it's loaded.
  const adoptedServerSecRef = useRef(false);
  useEffect(() => {
    const serverSec = (user as any)?.security_settings;
    if (!serverSec || adoptedServerSecRef.current) return;
    adoptedServerSecRef.current = true;
    setSecSettings((prev) => {
      // Easy Access is per device ("Grant Easy Access To This Device"), so the
      // copy saved from another machine must not override this one.
      const { requirePassword: _rp, easyAccess: _ea, ...portable } = serverSec as Partial<SecuritySettings>;
      const next = { ...prev, ...portable };
      mirrorSecToLocalStorage(next);
      return next;
    });
  }, [(user as any)?.security_settings]);

  // Update security settings: local state + localStorage mirror + account.
  const updateSec = (patch: Partial<typeof secSettings>) => {
    // "Grant Easy Access" and "Require Password Every Connection" are the
    // shared Easy Access flag seen from opposite ends — expand the patch so
    // both rows stay consistent, then broadcast so every other Easy Access
    // switch in the app follows (see lib/easyAccess).
    let expanded = { ...patch };
    if (patch.easyAccess !== undefined) expanded = { ...expanded, requirePassword: !patch.easyAccess };
    else if (patch.requirePassword !== undefined) expanded = { ...expanded, easyAccess: !patch.requirePassword };
    setSecSettings((prev) => {
      const next = { ...prev, ...expanded };
      mirrorSecToLocalStorage(next);
      // Persist to the account (best-effort — local mirror keeps working offline).
      updateProfile({ security_settings: next } as any).catch(() => {});
      return next;
    });
    if (expanded.easyAccess !== undefined) applyEasyAccess(expanded.easyAccess);
  };

  const saveAdvancedFlag = (key: string, value: boolean, setter: (value: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  const openAdvancedLogs = async () => {
    try {
      const electronApi = (window as any).electronAPI;
      if (electronApi?.openLogsFolder) {
        await electronApi.openLogsFolder();
      }
    } catch (error) {
      console.error('[Settings] Failed to open logs folder:', error);
    }
  };

  const resetAdvancedSettings = () => {
    saveAdvancedFlag('pref_adv_launch_minimized', false, setAdvLaunchMinimized);
    saveAdvancedFlag('pref_adv_hardware_acceleration', true, setAdvHardwareAcceleration);
    saveAdvancedFlag('pref_adv_direct_peer', true, setAdvDirectPeer);
    saveAdvancedFlag('pref_adv_connection_diagnostics', true, setAdvConnectionDiagnostics);
    saveAdvancedFlag('pref_adv_detailed_logs', true, setAdvDetailedLogs);
    saveAdvancedFlag('pref_adv_crash_reports', true, setAdvCrashReports);
    saveAdvancedFlag('pref_adv_update_logs', false, setAdvUpdateLogs);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const addToList = (key: 'blockList' | 'allowList', raw: string) => {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value) return;
    if (secSettings[key].includes(value)) return;
    updateSec({ [key]: [...secSettings[key], value] } as any);
  };
  const removeFromList = (key: 'blockList' | 'allowList', value: string) => {
    updateSec({ [key]: secSettings[key].filter((item) => item !== value) } as any);
  };
  const installSecurityKey = () => {
    if (secSettings.securityKeyInstalled || installingKey) return;
    setInstallingKey(true);
    // The virtual key driver is a host-side component; we record the opt-in and
    // signal the agent if it exposes an installer.
    try { (window as any).electronAPI?.installSecurityKeyDriver?.(); } catch {}
    setTimeout(() => {
      setInstallingKey(false);
      updateSec({ securityKeyInstalled: true } as any);
    }, 1200);
  };

  // Active sign-ins — fetched from the backend /sessions endpoint.
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const { data } = await api.get('/api/auth/sessions');
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Settings] Failed to load sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const revokeSession = async (id: string) => {
    setRevokingId(id);
    const previous = sessions;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.delete(`/api/auth/sessions/${id}`);
      await fetchSessions();
    } catch (err) {
      console.error('[Settings] Failed to revoke session', err);
      setSessions(previous);
    } finally {
      setRevokingId(null);
    }
  };

  const currentSession = sessions.find((s) => s.isCurrent) || null;
  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const currentClient = parseClientInfo(
    currentSession?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  );
  const signedInAt = jwtIssuedAt(accessToken);
  const currentSignedInAt = currentSession?.createdAt
    ? new Date(currentSession.createdAt).getTime()
    : signedInAt;

  useEffect(() => {
    if (activeTab === 'Active sign-ins') fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'Licenses' && !canViewBilling) {
      setActiveTab('Profile');
    }
  }, [activeTab, canViewBilling]);

  
  // Customization state
  const initialCustomization = readCustomizationPreferences();
  const [darkMode, setDarkMode] = useState(initialCustomization.darkMode);
  const [searchBehavior, setSearchBehavior] = useState<SearchBehavior>(initialCustomization.searchBehavior);
  const [useNewInterface, setUseNewInterface] = useState(initialCustomization.useNewInterface);
  const [marketingMessages, setMarketingMessages] = useState(initialCustomization.marketingMessages);
  const [fontSize, setFontSize] = useState(initialCustomization.fontSize);

  // New Settings state
  const [deviceName, setDeviceName] = useState('');
  const [deviceNameError, setDeviceNameError] = useState('');
  const [startWithWindows, setStartWithWindows] = useState(() => readStartWithWindowsPreference(true));
  const [useDeviceDock, setUseDeviceDock] = useState(false);
  const [windowsNotification, setWindowsNotification] = useState(() => localStorage.getItem('pref_windows_notification') !== 'false');
  const [incomingSessionNotification, setIncomingSessionNotification] = useState(() => localStorage.getItem('pref_incoming_session_notification') !== 'false');
  const [keepAgentRunning, setKeepAgentRunning] = useState(() => localStorage.getItem('pref_keep_agent') !== 'false');
  const [updatesAutomatically, setUpdatesAutomatically] = useState(() => localStorage.getItem('pref_auto_update') !== 'false');
  const [installedVersion, setInstalledVersion] = useState('Unknown');
  const [latestUpdate, setLatestUpdate] = useState<LatestUpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState('');
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(hostDeviceId || null);

  const refreshUpdateMetadata = async (runUpdaterCheck = false) => {
    const electronApi = (window as any).electronAPI;
    setUpdateStatus('checking');
    setUpdateError('');
    try {
      const [version, latest] = await Promise.all([
        electronApi?.getAppVersion?.().catch(() => null),
        electronApi?.updates?.getLatestInfo?.().catch((error: any) => ({ error: error?.message })),
      ]);
      if (version) setInstalledVersion(String(version));
      if (latest) {
        setLatestUpdate(latest);
        if (latest.error) {
          setUpdateError(latest.error);
          setUpdateStatus('error');
        } else if (latest.version && compareVersions(latest.version, version || installedVersion) > 0) {
          setUpdateStatus('available');
        } else {
          setUpdateStatus('up-to-date');
        }
      } else {
        setUpdateStatus('up-to-date');
      }

      if (runUpdaterCheck && electronApi?.updates?.check) {
        // runUpdaterCheck is the manual "Check For Updates" button — mark it
        // user-initiated so a real failure can surface (background polls stay silent).
        await electronApi.updates.check(true);
      }
    } catch (error: any) {
      setUpdateError(error?.message || 'Unable to check for updates.');
      setUpdateStatus('error');
    }
  };

  useEffect(() => {
    const electronApi = (window as any).electronAPI;
    const storedAutoUpdate = localStorage.getItem('pref_auto_update');
    const preferredAutoUpdate = storedAutoUpdate === null ? updatesAutomatically : storedAutoUpdate !== 'false';
    setUpdatesAutomatically(preferredAutoUpdate);
    electronApi?.updates?.setAutoInstall?.(preferredAutoUpdate).catch((error: any) => {
      console.error('[Settings] Failed to apply automatic update preference:', error);
    });
    electronApi?.updates?.getAutoInstall?.().then((enabled: boolean) => {
      const stored = localStorage.getItem('pref_auto_update');
      if (stored !== null) return;
      const next = Boolean(enabled);
      setUpdatesAutomatically(next);
      localStorage.setItem('pref_auto_update', String(next));
    }).catch(() => {});
    refreshUpdateMetadata(false);
    if (!electronApi?.updates) return;
    const cleanup = [
      electronApi.updates.onAvailable?.((info: any) => {
        setLatestUpdate((prev) => ({ ...(prev || {}), ...info, available: true }));
        setUpdateStatus('available');
      }),
      electronApi.updates.onNotAvailable?.(() => setUpdateStatus('up-to-date')),
      electronApi.updates.onDownloadProgress?.((progress: any) => {
        setUpdateProgress(Number(progress?.percent || 0));
        setUpdateStatus('downloading');
      }),
      electronApi.updates.onDownloaded?.((info: any) => {
        setLatestUpdate((prev) => ({ ...(prev || {}), ...info, available: true }));
        setUpdateStatus('downloaded');
      }),
      electronApi.updates.onError?.((message: string) => {
        setUpdateError(message || 'Unable to check for updates.');
        setUpdateStatus('error');
      }),
    ].filter(Boolean);
    return () => cleanup.forEach((fn: any) => fn?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audio & Video state
  const [audioInputs, setAudioInputs] = useState<{ value: string; label: string }[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<{ value: string; label: string }[]>([]);
  const [videoInputs, setVideoInputs] = useState<{ value: string; label: string }[]>([]);
  // Device choices share MEETING_PREF_KEYS with the meeting UI, so a mic or
  // camera picked here is what meetings and previews acquire next time.
  const [micDevice, setMicDevice] = useState(() => readPreferredDevice(MEETING_PREF_KEYS.mic) || 'default');
  const [speakerDevice, setSpeakerDevice] = useState(() => readPreferredDevice(MEETING_PREF_KEYS.speaker) || 'default');
  const [videoDevice, setVideoDevice] = useState(() => readPreferredDevice(MEETING_PREF_KEYS.cam) || 'default');
  const [inputVolume, setInputVolume] = useState(() => Number(localStorage.getItem('pref_input_volume') ?? 60));
  const [outputVolume, setOutputVolume] = useState(() => Number(localStorage.getItem('pref_output_volume') ?? 60));
  const [noiseSuppression, setNoiseSuppression] = useState(() => localStorage.getItem('pref_noise_suppression') !== 'false');
  const [speakerMuted, setSpeakerMuted] = useState(() => localStorage.getItem('pref_speaker_muted') === 'true');
  const [followFace, setFollowFace] = useState(() => localStorage.getItem('pref_follow_face') !== 'false');
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0); // 0..1
  const [cameraOn, setCameraOn] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Device Management state
  const [dmAssignedTo, setDmAssignedTo] = useState('');
  const [dmTags, setDmTags] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('pref_device_tags') || '["Client-facing"]'); } catch { return ['Client-facing']; } });
  const [dmDepartment, setDmDepartment] = useState(() => localStorage.getItem('pref_device_department') || '');
  const [dmAllowIncoming, setDmAllowIncoming] = useState(() => localStorage.getItem('pref_dm_allow_incoming') !== 'false');
  // Same flag as "Grant Easy Access" on the landing/Remote Support screens —
  // all switches move together (see lib/easyAccess).
  const [dmUnattended, setDmUnattended] = useState(() => isEasyAccessEnabled());
  // Server-owned (device.settings.allowControlWithoutPrompt); the localStorage
  // copy only avoids the toggle flicking off while /devices/mine loads.
  const [dmNoControlPrompt, setDmNoControlPrompt] = useState(() => localStorage.getItem('pref_dm_no_control_prompt') === 'true');
  const [dmHideFromNonAdmins, setDmHideFromNonAdmins] = useState(() => localStorage.getItem('pref_dm_hide') !== 'false');
  const [dmNotifyAccess, setDmNotifyAccess] = useState(() => localStorage.getItem('pref_dm_notify_access') !== 'false');
  const [dmAddingTag, setDmAddingTag] = useState(false);
  const [dmNewTag, setDmNewTag] = useState('');
  // Server-backed access settings + one-time codes for this device.
  const [dmSchedule, setDmSchedule] = useState<{ enabled: boolean; days: number[]; start: string; end: string }>({ enabled: false, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' });
  const [accessCodes, setAccessCodes] = useState<any[]>([]);
  const [codeTtl, setCodeTtl] = useState(60);
  const [freshCode, setFreshCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  // id → full plaintext code, for codes this machine generated (so we can
  // re-show them after leaving and returning to the page).
  const [localCodes, setLocalCodes] = useState<Record<string, string>>({});

  // Session-security settings (Remote control tab) — server-backed in device.settings.
  const [controlMode, setControlMode] = useState(() => localStorage.getItem('pref_control_mode') || 'ask');
  const [panicHotkey, setPanicHotkey] = useState(() => localStorage.getItem('pref_panic_hotkey') || '');
  const [panicKillIncoming, setPanicKillIncoming] = useState(() => localStorage.getItem('pref_panic_kill_incoming') === 'true');
  const [capturingHotkey, setCapturingHotkey] = useState(false);
  const [hotkeyError, setHotkeyError] = useState('');
  const [idleDisconnectMin, setIdleDisconnectMin] = useState(() => Number(localStorage.getItem('pref_idle_disconnect_min') || 0));
  const [receivedDir, setReceivedDir] = useState(() => localStorage.getItem('pref_received_dir') || '');
  // "Block File Transfer" lives in the main process (it is enforced there);
  // localStorage only seeds the switch until main answers.
  const [blockFileTransfer, setBlockFileTransfer] = useState(() => localStorage.getItem('pref_block_file_transfer') === 'true');
  useEffect(() => {
    electronAPI()?.getFileTransferBlocked?.().then((blocked: unknown) => {
      if (typeof blocked !== 'boolean') return;
      setBlockFileTransfer(blocked);
      localStorage.setItem('pref_block_file_transfer', String(blocked));
    }).catch(() => {});
  }, []);

  // Keep the "Unattended Access" toggle and the security modal's easy-access /
  // require-password rows in step when the flag changes anywhere else.
  useEffect(() => subscribeEasyAccess((enabled) => {
    setDmUnattended(enabled);
    setSecSettings((prev) => {
      if (prev.easyAccess === enabled && prev.requirePassword === !enabled) return prev;
      const next = { ...prev, easyAccess: enabled, requirePassword: !enabled };
      mirrorSecToLocalStorage(next);
      updateProfile({ security_settings: next } as any).catch(() => {});
      return next;
    });
  }), []);

  // Proof of possession for "This Device" routes: the machine's own access
  // key + device password authorize management regardless of which account
  // is signed in (they already grant full remote control).
  const thisDeviceAuth = () => ({
    accessKey: normalizeAccessKey(currentDeviceAccessKey || localStorage.getItem('remote365_device_access_key') || ''),
    password: localStorage.getItem('device_password') || '',
  });

  // The 9-digit Device ID a viewer types to reach this machine.
  const thisDeviceId = () => normalizeAccessKey(currentDeviceAccessKey || localStorage.getItem('remote365_device_access_key') || '');
  const formatDeviceId = (id: string) => (id ? id.replace(/(\d{3})(?=\d)/g, '$1 ') : '—');

  const loadAccessCodes = async (deviceId?: string | null) => {
    const id = deviceId || currentDeviceId;
    if (!id) return;
    // Restore plaintext codes this machine generated so they're viewable again.
    const local = getActiveTempCodes(id);
    setLocalCodes(Object.fromEntries(local.map((c) => [c.id, c.code])));
    if (local[0]) setFreshCode((prev) => prev || { code: local[0].code, expiresAt: local[0].expiresAt });
    try {
      const { data } = await api.post(`/api/devices/${id}/access-codes/list`, { deviceAuth: thisDeviceAuth() });
      setAccessCodes(Array.isArray(data?.codes) ? data.codes : []);
    } catch (error) {
      console.error('[Settings] Failed to load access codes:', error);
    }
  };

  const saveDeviceSettings = async (patch: any) => {
    if (!currentDeviceId) return;
    try {
      await api.patch(`/api/devices/${currentDeviceId}/settings`, { ...patch, deviceAuth: thisDeviceAuth() });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error('[Settings] Failed to save device settings:', error);
    }
  };

  const updateSchedule = (patch: Partial<{ enabled: boolean; days: number[]; start: string; end: string }>) => {
    const next = { ...dmSchedule, ...patch };
    setDmSchedule(next);
    saveDeviceSettings({ accessSchedule: { ...next, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
  };

  const generateAccessCode = async () => {
    if (!currentDeviceId || codeBusy) return;
    setCodeBusy(true);
    setCodeCopied(false);
    try {
      const { data } = await api.post(`/api/devices/${currentDeviceId}/access-codes`, { ttlMinutes: codeTtl, deviceAuth: thisDeviceAuth() });
      setFreshCode(data);
      if (data?.id && data?.code) {
        addTempCode({ id: data.id, code: data.code, deviceId: currentDeviceId, expiresAt: data.expiresAt });
      }
      loadAccessCodes();
    } catch (error) {
      console.error('[Settings] Failed to create access code:', error);
    } finally {
      setCodeBusy(false);
    }
  };

  const revokeAccessCode = async (codeId: string) => {
    if (!currentDeviceId) return;
    try {
      await api.delete(`/api/devices/${currentDeviceId}/access-codes/${codeId}`, { data: { deviceAuth: thisDeviceAuth() } });
      setAccessCodes(prev => prev.filter(c => c.id !== codeId));
      removeTempCode(codeId);
      setLocalCodes((prev) => { const next = { ...prev }; delete next[codeId]; return next; });
      if (freshCode && localCodes[codeId] === freshCode.code) setFreshCode(null);
    } catch (error) {
      console.error('[Settings] Failed to revoke access code:', error);
    }
  };

  // --- Session-security change handlers (server-backed + main-process enforcement) ---
  const electronAPI = () => (window as any).electronAPI;

  // A — Control permission mode. Mirrored to localStorage so App.tsx can read it
  // synchronously when a control request arrives.
  const changeControlMode = (mode: string) => {
    setControlMode(mode);
    localStorage.setItem('pref_control_mode', mode);
    saveDeviceSettings({ controlMode: mode });
  };

  // B — Panic hotkey. Capture the next key combo, register it in the main
  // process (system-wide), and persist.
  const applyPanicHotkey = async (accel: string) => {
    setHotkeyError('');
    setPanicHotkey(accel);
    localStorage.setItem('pref_panic_hotkey', accel);
    const res = await electronAPI()?.setPanicHotkey?.(accel).catch(() => null);
    if (accel && res && res.registered === false) {
      // The OS rejected the combo (already taken by another app); clear it.
      setPanicHotkey('');
      localStorage.setItem('pref_panic_hotkey', '');
      setHotkeyError('That combination is unavailable — try another (e.g. add Shift or Alt).');
      saveDeviceSettings({ panicHotkey: '' });
      return;
    }
    saveDeviceSettings({ panicHotkey: accel });
  };

  // While capturing, listen at the window level so it doesn't depend on the
  // button keeping focus. Requires at least one modifier + a real key; Esc
  // cancels; Backspace/Delete clears.
  useEffect(() => {
    if (!capturingHotkey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setCapturingHotkey(false); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { setCapturingHotkey(false); applyPanicHotkey(''); return; }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; // wait for a real key
      const mods: string[] = [];
      if (e.ctrlKey) mods.push('Control');
      if (e.shiftKey) mods.push('Shift');
      if (e.altKey) mods.push('Alt');
      if (mods.length === 0) {
        setHotkeyError('Include Ctrl, Alt or Shift so it never fires by accident.');
        return;
      }
      const named = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      setCapturingHotkey(false);
      applyPanicHotkey([...mods, named].join('+'));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturingHotkey]);

  const togglePanicKillIncoming = () => {
    const next = !panicKillIncoming;
    setPanicKillIncoming(next);
    localStorage.setItem('pref_panic_kill_incoming', String(next));
    saveDeviceSettings({ panicKillIncoming: next });
  };

  // C — Idle auto-disconnect. Default 0 (never).
  const changeIdleDisconnect = (minutes: number) => {
    setIdleDisconnectMin(minutes);
    localStorage.setItem('pref_idle_disconnect_min', String(minutes));
    electronAPI()?.setIdleTimeout?.(minutes).catch(() => {});
    saveDeviceSettings({ idleDisconnectMinutes: minutes });
  };

  // D — Received-files folder. Empty = default Downloads.
  const chooseReceivedDir = async () => {
    const res = await electronAPI()?.pickFolder?.().catch(() => null);
    if (!res || res.canceled || !res.path) return;
    setReceivedDir(res.path);
    localStorage.setItem('pref_received_dir', res.path);
    electronAPI()?.setReceivedDir?.(res.path).catch(() => {});
    saveDeviceSettings({ receivedFilesDir: res.path });
  };

  const resetReceivedDir = () => {
    setReceivedDir('');
    localStorage.setItem('pref_received_dir', '');
    electronAPI()?.setReceivedDir?.('').catch(() => {});
    saveDeviceSettings({ receivedFilesDir: '' });
  };

  const toggleBlockFileTransfer = () => {
    const next = !blockFileTransfer;
    setBlockFileTransfer(next);
    localStorage.setItem('pref_block_file_transfer', String(next));
    electronAPI()?.setFileTransferBlocked?.(next).catch(() => {});
  };

  // --- Network settings (Settings → Network) ---

  // Performance maps to the host's real capture quality + frame rate presets;
  // applied on the next host session (and to any that starts after).
  const PERFORMANCE_PRESETS: Record<string, { quality: string; fps: string }> = {
    'Recommended': { quality: 'sharp', fps: '30' },
    'Optimize Quality': { quality: 'ultra', fps: '30' },
    'Optimize Speed': { quality: 'balanced', fps: '60' },
    'Low Bandwidth': { quality: 'smooth', fps: '30' },
  };
  const changePerformance = (mode: string) => {
    setNetworkPerformanceMode(mode);
    localStorage.setItem('pref_network_performance_mode', mode);
    const p = PERFORMANCE_PRESETS[mode] || PERFORMANCE_PRESETS['Recommended'];
    localStorage.setItem('remote365_video_quality', p.quality);
    localStorage.setItem('remote365_stream_fps', p.fps);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  // Proxy routes the app's own API/signaling traffic via Electron's session.
  const changeProxyMode = (mode: string) => {
    setNetworkProxyMode(mode);
    localStorage.setItem('pref_network_proxy_mode', mode);
    electronAPI()?.net?.setProxy?.(mode, networkProxyManual).catch(() => {});
  };
  const changeProxyManual = (val: string) => {
    setNetworkProxyManual(val);
    localStorage.setItem('pref_network_proxy_manual', val);
    if (networkProxyMode === 'Manual proxy') electronAPI()?.net?.setProxy?.('Manual proxy', val).catch(() => {});
  };

  // Wake-on-LAN: store this machine's MAC server-side so another device on the
  // same network can broadcast a magic packet to wake it.
  const changeWakeOnLan = async (next: boolean) => {
    setNetworkWakeOnLan(next);
    localStorage.setItem('pref_network_wake_on_lan', String(next));
    let mac = wolMac;
    if (next && !mac) {
      const res = await electronAPI()?.net?.getMac?.().catch(() => null);
      mac = res?.mac || '';
      setWolMac(mac);
    }
    saveDeviceSettings({ wolEnabled: next, wolMac: next ? mac : '' });
  };

  // Remote Control state (persisted to localStorage)
  const [rcClipboard, setRcClipboard] = useState(() => readPreferenceChoice('pref_rc_clipboard', RC_CLIPBOARD_OPTIONS, 'Outgoing Only'));
  const [rcSyncKeyboard, setRcSyncKeyboard] = useState(() => localStorage.getItem('pref_rc_sync_keyboard') !== 'false');
  const [rcDragDrop, setRcDragDrop] = useState(() => localStorage.getItem('pref_rc_drag_drop') !== 'false');
  const [rcCursorStyle, setRcCursorStyle] = useState(() => readPreferenceChoice('pref_rc_cursor_style', RC_CURSOR_OPTIONS, 'Default'));
  const [rcDisplayQuality, setRcDisplayQuality] = useState(() => readPreferenceChoice('pref_rc_display_quality', RC_QUALITY_OPTIONS, 'Balanced'));
  const [rcSuppressWallpaper, setRcSuppressWallpaper] = useState(() => localStorage.getItem('pref_rc_suppress_wallpaper') !== 'false');
  const [rcLocalInputs, setRcLocalInputs] = useState(() => localStorage.getItem('pref_rc_local_inputs') !== 'false');
  const [rcBlackScreen, setRcBlackScreen] = useState(() => localStorage.getItem('pref_rc_black_screen') === 'true');
  const [rcEndHotkey, setRcEndHotkey] = useState(() => localStorage.getItem('pref_rc_end_hotkey') || 'Ctrl + F8');
  const [rcEditingHotkey, setRcEditingHotkey] = useState(false);
  const [rcPlaySounds, setRcPlaySounds] = useState(() => localStorage.getItem('pref_rc_play_sounds') !== 'false');

  const [advLaunchMinimized, setAdvLaunchMinimized] = useState(() => localStorage.getItem('pref_adv_launch_minimized') === 'true');
  const [advHardwareAcceleration, setAdvHardwareAcceleration] = useState(() => localStorage.getItem('pref_adv_hardware_acceleration') !== 'false');
  const [advDirectPeer, setAdvDirectPeer] = useState(() => localStorage.getItem('pref_adv_direct_peer') !== 'false');
  const [advConnectionDiagnostics, setAdvConnectionDiagnostics] = useState(() => localStorage.getItem('pref_adv_connection_diagnostics') !== 'false');
  const [advDetailedLogs, setAdvDetailedLogs] = useState(() => localStorage.getItem('pref_adv_detailed_logs') !== 'false');
  const [advCrashReports, setAdvCrashReports] = useState(() => localStorage.getItem('pref_adv_crash_reports') !== 'false');
  const [advUpdateLogs, setAdvUpdateLogs] = useState(() => localStorage.getItem('pref_adv_update_logs') === 'true');

  const [networkWakeOnLan, setNetworkWakeOnLan] = useState(() => localStorage.getItem('pref_network_wake_on_lan') === 'true');
  const [networkProxyMode, setNetworkProxyMode] = useState(() => readPreferenceChoice('pref_network_proxy_mode', PROXY_OPTIONS, 'Recommended'));
  const [networkProxyManual, setNetworkProxyManual] = useState(() => localStorage.getItem('pref_network_proxy_manual') || '');
  const [networkPerformanceMode, setNetworkPerformanceMode] = useState(() => readPreferenceChoice('pref_network_performance_mode', PERFORMANCE_OPTIONS, 'Recommended'));
  const [wolMac, setWolMac] = useState('');

  // Delete account flow
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') return;
    setDeleteStatus('loading');
    setDeleteError('');
    try {
      await api.delete('/api/auth/me');
      setShowDeleteModal(false);
      logout?.();
    } catch (err: any) {
      setDeleteStatus('error');
      setDeleteError(err?.response?.data?.error || err?.message || 'Failed to delete account. Please contact support.');
    }
  };


  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve this installation to its canonical device record.
  useEffect(() => {
    if (activeTab !== 'General' && activeTab !== 'Device management' && activeTab !== 'Remote control') return;
    let cancelled = false;

    const loadCurrentDevice = async () => {
      const accessKey = normalizeAccessKey(
        currentDeviceAccessKey || localStorage.getItem('remote365_device_access_key')
      );
      try {
        const { data } = await api.get('/api/devices/mine');
        const devices = Array.isArray(data) ? data : (data?.devices || []);
        const current = devices.find((device: any) =>
          (hostDeviceId && String(device.id) === String(hostDeviceId))
          || (accessKey && getDeviceAccessKey(device) === accessKey)
        );
        if (cancelled) return;
        if (current) {
          setCurrentDeviceId(current.id);
          setDeviceName(current.device_name || current.name || '');
          // Sync the server-enforced access settings for this device.
          const serverSettings = current.settings || {};
          setDmAllowIncoming(serverSettings.allowIncoming !== false);
          const noPrompt = serverSettings.allowControlWithoutPrompt === true;
          setDmNoControlPrompt(noPrompt);
          localStorage.setItem('pref_dm_no_control_prompt', String(noPrompt));
          if (serverSettings.accessSchedule) {
            setDmSchedule({
              enabled: serverSettings.accessSchedule.enabled === true,
              days: Array.isArray(serverSettings.accessSchedule.days) ? serverSettings.accessSchedule.days : [],
              start: serverSettings.accessSchedule.start || '09:00',
              end: serverSettings.accessSchedule.end || '18:00',
            });
          }
          // Session-security settings — hydrate state, mirror to localStorage
          // for App.tsx, and (re)apply enforcement to the main process.
          const eAPI = (window as any).electronAPI;
          const sm = serverSettings.controlMode || 'ask';
          setControlMode(sm); localStorage.setItem('pref_control_mode', sm);
          const ph = serverSettings.panicHotkey || '';
          setPanicHotkey(ph); localStorage.setItem('pref_panic_hotkey', ph);
          if (ph) eAPI?.setPanicHotkey?.(ph).catch?.(() => {});
          const pk = serverSettings.panicKillIncoming === true;
          setPanicKillIncoming(pk); localStorage.setItem('pref_panic_kill_incoming', String(pk));
          const idle = Number(serverSettings.idleDisconnectMinutes || 0);
          setIdleDisconnectMin(idle); localStorage.setItem('pref_idle_disconnect_min', String(idle));
          eAPI?.setIdleTimeout?.(idle).catch?.(() => {});
          const rdir = serverSettings.receivedFilesDir || '';
          setReceivedDir(rdir); localStorage.setItem('pref_received_dir', rdir);
          if (rdir) eAPI?.setReceivedDir?.(rdir).catch?.(() => {});
          // Wake-on-LAN state (server-backed).
          if (typeof serverSettings.wolEnabled === 'boolean') {
            setNetworkWakeOnLan(serverSettings.wolEnabled);
            localStorage.setItem('pref_network_wake_on_lan', String(serverSettings.wolEnabled));
          }
          if (serverSettings.wolMac) setWolMac(serverSettings.wolMac);
          if (activeTab === 'Device management') loadAccessCodes(current.id);
          return;
        }
      } catch (error) {
        console.error('[Settings] Failed to resolve current device:', error);
      }

      if (!cancelled && !deviceName && (window as any).electronAPI?.getMachineName) {
        const name = await (window as any).electronAPI.getMachineName();
        if (!cancelled) setDeviceName(name);
      }
    };

    loadCurrentDevice();
    return () => { cancelled = true; };
  }, [activeTab, currentDeviceAccessKey, hostDeviceId]);

  // Sync local state if user object in store changes

  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '');
      setLanguage(user.language || 'en');
      setIsRestricted(user.notify_session_alert ?? true);
      setTwoFAEnabled(localStorage.getItem('pref_2fa') === 'true' || (user.is_2fa_enabled ?? false));
      setDmAssignedTo(prev => prev || (user.name ? user.name.split(' ')[0] : ''));
      const customization = {
        darkMode: user.darkMode ?? initialCustomization.darkMode,
        searchBehavior: (user.searchBehavior === 'Direct connect' ? 'Direct connect' : 'Search for result') as SearchBehavior,
        useNewInterface: user.useNewInterface ?? initialCustomization.useNewInterface,
        marketingMessages: user.marketingMessages ?? initialCustomization.marketingMessages,
        fontSize: user.fontSize || initialCustomization.fontSize,
      };
      setDarkMode(customization.darkMode);
      setSearchBehavior(customization.searchBehavior);
      setUseNewInterface(customization.useNewInterface);
      setMarketingMessages(customization.marketingMessages);
      setFontSize(customization.fontSize);
      applyCustomizationPreferences(customization);

      const nextStartWithWindows = user.startWithWindows ?? readStartWithWindowsPreference(true);
      setStartWithWindows(nextStartWithWindows);
      setUseDeviceDock(user.useDeviceDock ?? false);
      const nextWindowsNotification = user.windowsNotification ?? true;
      const nextIncomingSessionNotification = user.incomingSessionNotification ?? true;
      setWindowsNotification(nextWindowsNotification);
      setIncomingSessionNotification(nextIncomingSessionNotification);
      localStorage.setItem('pref_windows_notification', String(nextWindowsNotification));
      localStorage.setItem('pref_incoming_session_notification', String(nextIncomingSessionNotification));
      setKeepAgentRunning(user.keepAgentRunning ?? true);
      localStorage.setItem('pref_keep_agent', String(user.keepAgentRunning ?? true));
      localStorage.setItem('pref_device_dock', String(user.useDeviceDock ?? false));
      applyStartWithWindowsPreference(nextStartWithWindows).then(setStartWithWindows);

    }
  }, [user]);

  const triggerSave = async (data: any) => {
    applyCustomizationPreferences(data);
    try {
      await updateProfile(data);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const updateAutomaticUpdates = (next: boolean) => {
    setUpdatesAutomatically(next);
    localStorage.setItem('pref_auto_update', String(next));
    const updates = (window as any).electronAPI?.updates;
    updates?.setAutoInstall?.(next).then(() => {
      // Enabling means "update by yourself": re-check immediately so a pending
      // update starts downloading + installing now instead of on the next poll.
      if (next) updates?.check?.().catch(() => {});
    }).catch((error: any) => {
      console.error('[Settings] Failed to update automatic update preference:', error);
    });
  };

  const startUpdateDownload = async () => {
    try {
      setUpdateStatus('downloading');
      setUpdateProgress(0);
      await (window as any).electronAPI?.updates?.download?.();
    } catch (error: any) {
      setUpdateError(error?.message || 'Unable to download update.');
      setUpdateStatus('error');
    }
  };

  const installDownloadedUpdate = async () => {
    try {
      await (window as any).electronAPI?.updates?.quitAndInstall?.();
    } catch (error: any) {
      setUpdateError(error?.message || 'Unable to install update.');
      setUpdateStatus('error');
    }
  };

  const saveDeviceName = async () => {
    const cleanName = deviceName.trim();
    if (!cleanName) return;

    setDeviceNameError('');
    try {
      let deviceId = currentDeviceId;
      if (!deviceId) {
        const accessKey = normalizeAccessKey(
          currentDeviceAccessKey || localStorage.getItem('remote365_device_access_key')
        );
        const { data } = await api.get('/api/devices/mine');
        const devices = Array.isArray(data) ? data : (data?.devices || []);
        deviceId = devices.find((device: any) =>
          (hostDeviceId && String(device.id) === String(hostDeviceId))
          || (accessKey && getDeviceAccessKey(device) === accessKey)
        )?.id || null;
      }
      if (!deviceId) throw new Error('This computer is not registered to your account yet.');

      await api.patch(`/api/devices/${deviceId}/name`, { device_name: cleanName });
      setCurrentDeviceId(deviceId);
      setDeviceName(cleanName);
      localStorage.setItem('remote365_device_name', cleanName);
      window.dispatchEvent(new CustomEvent('remote365:device-renamed', { detail: { id: deviceId, name: cleanName } }));
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error: any) {
      console.error('[Settings] Failed to rename current device:', error);
      // 409 = another device in the account already uses this name.
      setDeviceNameError(error?.response?.data?.error || 'Could not save this device name.');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (e.g., 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File too large. Max 2MB.');
      return;
    }

    try {
      const base64String = await downscaleImage(file, 256, 0.85);
      await triggerSave({ avatar: base64String });
    } catch (err) {
      console.error('Failed to process avatar image:', err);
    } finally {
      // Allow re-selecting the same file again.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Resize the picked image to a small square data URL before upload, so the
  // payload stays tiny (a few KB) instead of multi-MB base64.
  const downscaleImage = (file: File, maxSize: number, quality: number): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could Not Load Image'));
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas Not Supported'));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleDeleteAvatar = async () => {
    if (!user?.avatar) return;
    await triggerSave({ avatar: null });
  };

  const handleSignOutAll = async () => {
    setSigningOutAll(true);
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Failed to sign out of all devices:', err);
    } finally {
      setSigningOutAll(false);
      logout?.();
    }
  };

  // Lightweight password strength: needs length + variety of character classes.
  const getPasswordStrength = (pw: string): { label: string; color: string; score: number } => {
    if (!pw) return { label: '', color: '', score: 0 };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: 'Weak', color: '#FF383C', score };
    if (score === 3) return { label: 'Good', color: '#FF8A00', score };
    return { label: 'Very Secure', color: '#34C759', score };
  };

  const handleResetPassword = async () => {
    if (!resetCurrent || !resetNew) return;
    if (resetNew !== resetConfirm) {
      setResetStatus('error');
      setResetError('New passwords do not match.');
      return;
    }
    if (getPasswordStrength(resetNew).score <= 2) {
      setResetStatus('error');
      setResetError('Choose a stronger password (mix of upper/lowercase, numbers, and symbols).');
      return;
    }
    setResetStatus('loading');
    setResetError('');
    try {
      await updateProfile({ current_password: resetCurrent, password: resetNew });
      const now = new Date().toLocaleDateString('en-GB');
      localStorage.setItem('pref_pw_updated', now);
      setPwUpdatedAt(now);
      setResetStatus('success');
      setTimeout(() => {
        setShowResetModal(false);
        setResetStatus('idle');
        setResetCurrent('');
        setResetNew('');
        setResetConfirm('');
      }, 900);
    } catch (err: any) {
      setResetStatus('error');
      setResetError(err?.response?.data?.error || err?.message || 'Failed to reset password.');
    }
  };

  // --- Audio & Video helpers ---
  const enumerateMediaDevices = async () => {
    try {
      // Request permission so device labels are populated.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      probe?.getTracks().forEach(t => t.stop());
      const mics = devices.filter(d => d.kind === 'audioinput').map((d, i) => ({ value: d.deviceId || `mic-${i}`, label: d.label || `Microphone ${i + 1}` }));
      const spks = devices.filter(d => d.kind === 'audiooutput').map((d, i) => ({ value: d.deviceId || `spk-${i}`, label: d.label || `Speaker ${i + 1}` }));
      const cams = devices.filter(d => d.kind === 'videoinput').map((d, i) => ({ value: d.deviceId || `cam-${i}`, label: d.label || `Camera ${i + 1}` }));
      setAudioInputs(mics);
      setAudioOutputs(spks);
      setVideoInputs(cams);
      if (mics[0]) setMicDevice(prev => (prev === 'default' ? mics[0].value : prev));
      if (spks[0]) setSpeakerDevice(prev => (prev === 'default' ? spks[0].value : prev));
      if (cams[0]) setVideoDevice(prev => (prev === 'default' ? cams[0].value : prev));
    } catch (err) {
      console.error('Failed to enumerate media devices:', err);
    }
  };

  const stopMicTest = () => {
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
    micRafRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    setMicLevel(0);
    setMicTesting(false);
  };

  const startMicTest = async () => {
    if (micTesting) { stopMicTest(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(micDevice && micDevice !== 'default' ? { deviceId: { exact: micDevice } } : {}),
          noiseSuppression,
          echoCancellation: true,
        },
      });
      micStreamRef.current = stream;
      const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      setMicTesting(true);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
        setMicLevel(Math.min(1, peak * (inputVolume / 60)));
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.error('Microphone test failed:', err);
      setMicTesting(false);
    }
  };

  const playTestSound = () => {
    if (speakerMuted) return;
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      // Route the tone through the selected output device where supported.
      if (speakerDevice && speakerDevice !== 'default' && typeof (ctx as any).setSinkId === 'function') {
        (ctx as any).setSinkId(speakerDevice).catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 440;
      gain.gain.value = Math.max(0.0001, (outputVolume / 100) * 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.error('Failed to play test sound:', err);
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    setCameraOn(false);
  };

  const startCamera = async (overrideDeviceId?: string) => {
    if (cameraOn && overrideDeviceId === undefined) { stopCamera(); return; }
    try {
      const camId = overrideDeviceId ?? videoDevice;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: camId && camId !== 'default' ? { deviceId: { exact: camId } } : true,
      });
      cameraStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch (err) {
      console.error('Camera preview failed:', err);
    }
  };

  // Populate device lists when the Audio & Video tab opens.
  useEffect(() => {
    if (activeTab === 'Audio and video' && audioInputs.length === 0) {
      enumerateMediaDevices();
    }
    // Stop any live capture when leaving the tab.
    if (activeTab !== 'Audio and video') {
      stopMicTest();
      stopCamera();
    }
  }, [activeTab]);

  // Cleanup capture on unmount.
  useEffect(() => () => { stopMicTest(); stopCamera(); audioCtxRef.current?.close().catch(() => {}); }, []);

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'German' },
    { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
  ];

  const timezoneOptions = [
    { value: 'Asia/Karachi', label: '(GMT+05:00) Karachi' },
    { value: 'Asia/Dubai', label: '(GMT+04:00) Dubai' },
    { value: 'Europe/London', label: '(GMT+00:00) London' },
    { value: 'Europe/Berlin', label: '(GMT+01:00) Berlin' },
    { value: 'America/New_York', label: '(GMT-05:00) New York' },
    { value: 'America/Los_Angeles', label: '(GMT-08:00) Los Angeles' },
    { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo' },
    { value: 'Australia/Sydney', label: '(GMT+11:00) Sydney' },
  ];

  const sidebarSections = [
    {
      title: t('account', lang),
      items: [
        { id: 'Profile', label: t('profile', lang), icon: User },
        { id: 'Security', label: t('security_label', lang), icon: Shield },
        { id: 'Active sign-ins', label: t('active_sign_ins', lang), icon: Monitor },
        ...(canViewBilling ? [{ id: 'Licenses', label: t('licenses', lang), icon: CheckCircle2 }] : []),
      ],
    },
    {
      title: 'Preferences',
      items: [
        { id: 'General', label: t('general', lang), icon: SettingsIcon },
        { id: 'Software update', label: 'Software Update', icon: RefreshCw },
        { id: 'Customization', label: t('customization', lang), icon: Layout },
        { id: 'Audio and video', label: t('audio_video', lang), icon: Video },
        { id: 'Notifications', label: t('notifications_label', lang), icon: Bell },
      ],
    },
    {
      title: 'This Device',
      items: [
        { id: 'Device management', label: t('device_management_label', lang), icon: Monitor },
        { id: 'Remote control', label: t('remote_control', lang), icon: Smartphone },
        { id: 'Network', label: t('network_label', lang), icon: Wifi },
        { id: 'Advanced settings', label: t('advanced_settings', lang), icon: SettingsIcon },
      ],
    },
  ];

  const latestVersion = latestUpdate?.version || 'Unknown';
  const updateAvailable = latestUpdate?.version ? compareVersions(latestUpdate.version, installedVersion) > 0 : false;
  const releaseNotes = latestUpdate?.releaseNotes
    ? latestUpdate.releaseNotes.split(/\r?\n/).map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
    : fallbackReleaseNotes[String(latestUpdate?.version || '')] || [];
  const formattedReleaseDate = latestUpdate?.releaseDate
    ? new Date(latestUpdate.releaseDate).toLocaleString()
    : 'Not Published';

  return (
    <div className="h-full w-full flex bg-white dark:bg-[#080808] rounded-bl-[24px] overflow-hidden font-lato transition-colors duration-300">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAvatarUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Inner Sidebar */}
      <div className="w-[220px] shrink-0 bg-white dark:bg-[#0F0F0F] border-r border-[rgba(26,29,33,0.3)] dark:border-[rgba(255,255,255,0.06)] flex flex-col gap-[30px] overflow-y-auto px-3 py-6 font-['Mona_Sans',system-ui,sans-serif] transition-colors duration-300">
        {sidebarSections.map(section => (
          <div key={section.title} className="flex flex-col gap-3">
            <h2 className="m-0 px-1 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{section.title}</h2>
            <div className="flex flex-col gap-1">
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex h-10 items-center gap-2 rounded px-4 text-left text-[14px] font-medium leading-5 transition-colors ${
                      isActive
                        ? 'bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] text-white'
                        : 'text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-white' : 'text-[#111315] dark:text-[#A0A0A0]'} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#080808] p-10 custom-scrollbar relative transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'Profile' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-10">
                <div className="flex items-center gap-2">
                  <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('profile', lang)}</h1>
                  {(showSaved || isLoading) && (
                    <span className="flex items-center gap-1 text-[12px] font-medium text-[#FF8A00] animate-in fade-in slide-in-from-left-2 duration-300">
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : '•'} {isLoading ? t('saving', lang) : t('save_changes', lang)}
                    </span>
                  )}
                </div>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Manage your personal account and language preferences.</p>
              </div>

              {/* Profile Picture */}
              <div className="mb-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F3F4F6] dark:bg-white/5">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <Camera size={30} className="text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]" />
                    )}
                  </div>
                  <div>
                    <h3 className="m-0 text-[14px] font-medium leading-5 text-black dark:text-[#F5F5F5]">{t('profile_picture', lang)}</h3>
                    <p className="m-0 mt-1 text-[12px] font-medium leading-[17px] text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]">PNG, JPEG Under 2MB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="flex h-10 items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50 dark:bg-transparent dark:text-[#F5F5F5]"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Upload New Picture'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAvatar}
                    disabled={!user?.avatar || isLoading}
                    className="flex h-10 items-center justify-center rounded border border-[#F3F4F6] bg-[#F3F4F6] px-4 text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.3)] transition-colors enabled:hover:bg-[#E9EAEC] enabled:text-[#111315] disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Name + Email */}
              <div className="mb-7 grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={() => { if (displayName !== user?.name) triggerSave({ name: displayName }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] leading-5 text-[#111315] outline-none focus:border-[#FF8A00] dark:bg-[#141414] dark:text-white"
                  />
                  <span className="mt-1 text-[12px] leading-[17px] text-[rgba(26,29,33,0.55)] dark:text-[#A0A0A0]">The name shown to your team and on session requests.</span>
                </div>
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Email</label>
                  <input
                    type="text"
                    value={user?.email || ''}
                    readOnly
                    className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] leading-5 text-[#111315] outline-none dark:bg-[#141414] dark:text-white"
                  />
                  <span className="mt-1 text-[12px] leading-[17px] text-[rgba(26,29,33,0.55)] dark:text-[#A0A0A0]">We send security alerts and login codes here.</span>
                </div>
              </div>

              {/* Interface language + Regional time zone */}
              <div className="mb-9 grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Interface Language</label>
                  <StyledSelect
                    value={language}
                    options={languageOptions}
                    disabled={isLoading}
                    onChange={(val) => { setLanguage(val); applyLanguage(val); }}
                  />
                  <span className="mt-1 text-[12px] leading-[17px] text-[rgba(26,29,33,0.55)] dark:text-[#A0A0A0]">Changes the language across all Remote365 surfaces.</span>
                </div>
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Regional Time Zone</label>
                  <StyledSelect
                    value={timezone}
                    options={timezoneOptions}
                    disabled={isLoading}
                    onChange={(val) => { setTimezone(val); localStorage.setItem('pref_timezone', val); setShowSaved(true); setTimeout(() => setShowSaved(false), 2000); }}
                  />
                  <span className="mt-1 text-[12px] leading-[17px] text-[rgba(26,29,33,0.55)] dark:text-[#A0A0A0]">Used for session timestamps, audit logs, and scheduling.</span>
                </div>
              </div>

              {/* Status and messaging restrictions */}
              <div className="mb-9 flex items-center justify-between gap-6">
                <div>
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Status And Messaging Restrictions</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Only users in your contact can see your status and send you messages</p>
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isRestricted}
                    onChange={() => { const nextVal = !isRestricted; setIsRestricted(nextVal); triggerSave({ notify_session_alert: nextVal }); }}
                    disabled={isLoading}
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                </label>
              </div>

              {/* Account Security */}
              <div className="flex items-center justify-between gap-6">
                <div>
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Account Security</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Manage your account security</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSignOutAll}
                    disabled={signingOutAll}
                    className="flex h-10 items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50 dark:bg-transparent dark:text-[#F5F5F5]"
                  >
                    {signingOutAll && <Loader2 size={14} className="animate-spin" />}
                    Sign out of all devices
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmText('');
                      setDeleteStatus('idle');
                      setDeleteError('');
                      setShowDeleteModal(true);
                    }}
                    className="flex h-10 items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#FF383C] transition-colors hover:bg-red-50 dark:bg-transparent"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'Licenses' && canViewBilling ? (
            <LicensesPanel user={user} lang={lang} />
          ) : activeTab === 'Software update' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              <div className="mb-10">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">Software Update</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Review the installed version and latest release before installing updates.</p>
              </div>

              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {[
                    { label: 'Installed Version', value: installedVersion },
                    { label: 'Latest Version', value: latestVersion },
                    {
                      label: 'Update Status',
                      value:
                        updateStatus === 'checking' ? 'Checking...' :
                        updateStatus === 'available' || updateAvailable ? 'Update Available' :
                        updateStatus === 'downloading' ? `Downloading ${Math.round(updateProgress)}%` :
                        updateStatus === 'downloaded' ? 'Ready To Install' :
                        updateStatus === 'error' ? 'Check Failed' :
                        'Up To Date',
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded border border-[rgba(26,29,33,0.12)] bg-[#F9FAFB] p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="m-0 text-[12px] font-medium leading-[17px] text-[rgba(26,29,33,0.55)] dark:text-[#A0A0A0]">{item.label}</p>
                      <p className="m-0 mt-2 text-[18px] font-semibold leading-6 text-black dark:text-[#F5F5F5]">{item.value}</p>
                    </div>
                  ))}
                </div>

                {updateStatus === 'error' && (
                  <div className="flex items-start gap-3 rounded border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <p className="m-0 text-[14px] leading-5">{updateError || latestUpdate?.error || 'Unable to check for updates right now.'}</p>
                  </div>
                )}

                <div className="rounded border border-[rgba(26,29,33,0.12)] bg-white p-5 dark:border-white/10 dark:bg-[#111111]">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">
                        {latestUpdate?.releaseName || `Remote365 ${latestVersion}`}
                      </h3>
                      <p className="m-0 mt-1 text-[13px] leading-5 text-[rgba(26,29,33,0.6)] dark:text-[#A0A0A0]">Release date: {formattedReleaseDate}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => refreshUpdateMetadata(true)}
                      disabled={updateStatus === 'checking'}
                      className="flex h-10 items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50 dark:bg-transparent dark:text-[#F5F5F5]"
                    >
                      <RefreshCw size={16} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
                      Check Again
                    </button>
                  </div>

                  <div className="mb-5">
                    <h4 className="m-0 mb-2 text-[14px] font-semibold leading-5 text-black dark:text-[#F5F5F5]">What Changed</h4>
                    {releaseNotes.length > 0 ? (
                      <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[14px] leading-5 text-[#111315] dark:text-[#D8D8D8]">
                        {releaseNotes.map((note) => <li key={note}>{note}</li>)}
                      </ul>
                    ) : (
                      <p className="m-0 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">No release notes were published for this version yet.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {updateStatus === 'downloaded' ? (
                      <button
                        type="button"
                        onClick={installDownloadedUpdate}
                        className="flex h-10 items-center justify-center gap-2 rounded bg-[#FF8A00] px-4 text-[14px] font-semibold leading-5 text-white transition-colors hover:bg-[#E67A00]"
                      >
                        <Rocket size={16} />
                        Restart And Install
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startUpdateDownload}
                        disabled={!updateAvailable || updateStatus === 'downloading' || updateStatus === 'checking'}
                        className="flex h-10 items-center justify-center gap-2 rounded bg-[#FF8A00] px-4 text-[14px] font-semibold leading-5 text-white transition-colors hover:bg-[#E67A00] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updateStatus === 'downloading' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {updateStatus === 'downloading' ? `Downloading ${Math.round(updateProgress)}%` : 'Download Update'}
                      </button>
                    )}
                    <label className="relative inline-flex cursor-pointer items-center gap-3">
                      <input type="checkbox" className="sr-only peer" checked={updatesAutomatically} onChange={() => updateAutomaticUpdates(!updatesAutomatically)} />
                      <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                      <span className="text-[14px] leading-5 text-[#111315] dark:text-[#D8D8D8]">Install Updates Automatically</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'Customization' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-12">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('customization', lang)}</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Personalize the look and feel of Remote365.</p>
              </div>

              <div className="flex flex-col gap-6">
                {/* Color Mode */}
                <div className="flex items-start justify-between gap-12">
                  <div className="max-w-[300px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Color Mode</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Select the color mode for you Remote365</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-10">
                    {[
                      { id: 'dark', label: 'Dark Mode', img: desktopDarkPreview, value: true },
                      { id: 'light', label: 'Light Mode', img: desktopLightPreview, value: false },
                    ].map(mode => {
                      const isSelected = darkMode === mode.value;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => { setDarkMode(mode.value); triggerSave({ darkMode: mode.value }); }}
                          className={`flex flex-col items-center gap-3 rounded-xl p-2.5 transition-colors ${isSelected ? 'border-[0.5px] border-[rgba(0,136,255,0.7)] ring-1 ring-[rgba(0,136,255,0.4)]' : 'border-[0.5px] border-transparent'}`}
                        >
                          <div className="w-[205px] overflow-hidden rounded-xl border border-[rgba(26,29,33,0.3)] dark:border-white/10">
                            <img src={mode.img} alt={mode.label} className="block w-full" draggable={false} />
                          </div>
                          <span className="text-[12px] font-medium leading-[17px] text-black dark:text-[#F5F5F5]">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Global font scaling */}
                <div className="flex items-center justify-between gap-6">
                  <div className="max-w-[500px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Global Font Scaling</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Adjust text size across the entire application.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <input
                      type="range"
                      min={12}
                      max={24}
                      step={1}
                      value={fontSize}
                      onChange={(e) => { const next = parseInt(e.target.value); setFontSize(next); applyCustomizationPreferences({ fontSize: next }); }}
                      onMouseUp={(e) => triggerSave({ fontSize: Number(e.currentTarget.value) })}
                      onTouchEnd={(e) => triggerSave({ fontSize: Number(e.currentTarget.value) })}
                      onKeyUp={(e) => triggerSave({ fontSize: Number(e.currentTarget.value) })}
                      className="h-1 w-[100px] cursor-pointer appearance-none rounded-full bg-[rgba(26,29,33,0.3)] accent-[#FF8A00]"
                    />
                    <span className="w-[110px] text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">
                      {Math.round((fontSize / 16) * 100)}%{fontSize === 16 ? ' (Default)' : ''}
                    </span>
                  </div>
                </div>

                {/* Search action behavior */}
                <div className="flex items-start justify-between gap-12">
                  <div className="max-w-[600px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Search Action Behavior</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Choose what happens when you press Enter or click. The opposite action will automatically trigger when you use Alt+Enter.</p>
                  </div>
                  <div className="w-[220px] shrink-0">
                    <StyledSelect
                      value={searchBehavior}
                      options={[
                        { value: 'Search for result', label: t('search_for_result', lang) },
                        { value: 'Direct connect', label: t('direct_connect', lang) },
                      ]}
                      onChange={(val) => { const next = val as SearchBehavior; setSearchBehavior(next); triggerSave({ searchBehavior: next }); }}
                    />
                  </div>
                </div>

              </div>
            </div>
          ) : activeTab === 'General' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-12">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('general', lang)}</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Manage your device identity and startup behavior.</p>
              </div>

              <div className="flex flex-col gap-6">
                {/* Device Name */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[600px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Device Name</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Name to identify this machine across your fleet.</p>
                  </div>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => { setDeviceName(e.target.value); setDeviceNameError(''); }}
                    onBlur={saveDeviceName}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className={`h-10 w-[220px] shrink-0 rounded border bg-white px-4 text-[14px] leading-5 text-[#111315] outline-none dark:bg-[#141414] dark:text-white ${deviceNameError ? 'border-[#D92D20] focus:border-[#D92D20]' : 'border-[rgba(26,29,33,0.3)] focus:border-[#FF8A00]'}`}
                  />
                </div>
                {deviceNameError && <p className="-mt-4 text-right text-[13px] text-[#D92D20]">{deviceNameError}</p>}

                {/* Start Remote365 with Windows */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[500px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Start Remote365 With Windows</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Remote365 will launch automatically after you start your device.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={startWithWindows} onChange={() => { const next = !startWithWindows; setStartWithWindows(next); applyStartWithWindowsPreference(next).then(setStartWithWindows); triggerSave({ startWithWindows: next }); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

                {/* Remote365 Device Dock */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[500px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Remote365 Device Dock</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Have your devices always available on your screen in a compact view.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={useDeviceDock} onChange={() => { const next = !useDeviceDock; setUseDeviceDock(next); localStorage.setItem('pref_device_dock', String(next)); triggerSave({ useDeviceDock: next }); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

                {/* Keep agent running when app is closed */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[500px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Keep agent running when app is closed</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Allow your team to connect to this device even when the app isn't open.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={keepAgentRunning} onChange={() => { const next = !keepAgentRunning; setKeepAgentRunning(next); localStorage.setItem('pref_keep_agent', String(next)); triggerSave({ keepAgentRunning: next }); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

                {/* Updates automatically */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[500px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Updates Automatically</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">New versions download and install by themselves.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={updatesAutomatically} onChange={() => updateAutomaticUpdates(!updatesAutomatically)} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>
              </div>
            </div>
          ) : activeTab === 'Security' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-12">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('security_label', lang)}</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Protect your account and control how sessions are authenticated.</p>
              </div>

              {/* Password */}
              <div className="mb-12 flex items-start justify-between gap-6">
                <div className="w-[200px] shrink-0">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Password</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">
                    {isGoogleAccount ? 'Managed By Google' : `Last updated ${pwUpdatedAt || '—'}`}
                  </p>
                </div>
                {isGoogleAccount ? (
                  <div className="flex flex-1 items-center justify-end">
                    <div className="flex h-10 w-full max-w-[356px] items-center gap-3 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 dark:bg-[#141414]">
                      <GoogleIcon size={18} />
                      <span className="flex-1 truncate text-[14px] leading-5 text-[#111315] dark:text-white">Signed In With Google</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-start justify-end gap-4">
                    <div className="w-full max-w-[356px]">
                      <div className="flex h-10 items-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 dark:bg-[#141414]">
                        <span className="flex-1 select-none truncate text-[14px] leading-5 text-[#111315] dark:text-white">{'•'.repeat(10)}</span>
                        <button type="button" onClick={() => setShowResetModal(true)} className="shrink-0 text-[#111315] dark:text-[#A0A0A0]" title="Reset Password">
                          <Eye size={20} />
                        </button>
                      </div>
                      <p className="m-0 mt-1 text-[10px] leading-[14px]" style={{ color: '#34C759' }}>Very Secure</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setResetCurrent(''); setResetNew(''); setResetConfirm(''); setResetStatus('idle'); setResetError(''); setShowResetModal(true); }}
                      className="flex h-10 shrink-0 items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]"
                    >
                      Reset Password
                    </button>
                  </div>
                )}
              </div>

              {/* Two-factor authentication */}
              <div className="mb-9 flex items-start justify-between gap-6">
                <div className="max-w-[680px]">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Two-Factor Authentication For Connections</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Protect your account and control how sessions are authenticated.</p>
                </div>
                <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={twoFAEnabled}
                    onChange={() => {
                      const next = !twoFAEnabled;
                      setTwoFAEnabled(next);
                      localStorage.setItem('pref_2fa', String(next));
                      updateProfile({ is_2fa_enabled: next } as any).catch(() => {});
                    }}
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                </label>
              </div>

              {/* Action rows */}
              <div className="flex flex-col gap-9">
                {[
                  { id: 'block', title: 'Block And Allow List', desc: 'Setup your block and allow list. You can block a specific user or define a group of users who are allowed to connect to your device.', action: 'Configure' },
                  { id: 'auth', title: 'Additional Authentication Settings', desc: 'Use these settings to optimize the authentication process for your Remote365 connections.', action: 'Configure' },
                  { id: 'access', title: 'Access Control', desc: 'Define permissions and number of end users in the Remote365 session. You can apply rule sets or setup customize permissions for your remote connections.', action: 'Configure' },
                  { id: 'redirection', title: 'Security Key Redirection', desc: 'Install Remote365 virtual security key driver on remote side to enable redirection of security keys from the local side via a Remote365 session.', action: 'Install' },
                ].map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-6">
                    <div className="max-w-[700px]">
                      <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">{item.title}</h3>
                      <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSecurityModal(item.id as any)}
                      className="flex h-10 shrink-0 items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]"
                    >
                      {item.id === 'redirection'
                        ? (secSettings.securityKeyInstalled ? <><Check size={15} className="text-[#34C759]" /> Installed</> : item.action)
                        : item.action}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'Audio and video' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-12">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('audio_video', lang)}</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Configure the hardware used during remote sessions.</p>
              </div>

              {/* Microphone */}
              <div className="mb-6">
                <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Microphone</h3>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Configure all the required settings so that the end user can hear you.</p>
              </div>
              <div className="mb-6 grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Microphone</label>
                  <StyledSelect
                    value={micDevice}
                    options={audioInputs.length ? audioInputs : [{ value: 'default', label: 'Soundcard-Microphone' }]}
                    onChange={(val) => { setMicDevice(val); writePreferredDevice(MEETING_PREF_KEYS.mic, val); if (micTesting) stopMicTest(); }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Input Volume</label>
                  <div className="flex h-10 items-center gap-3">
                    <VolumeX size={20} className="shrink-0 text-[#111315] dark:text-[#A0A0A0]" />
                    <input type="range" min={0} max={100} value={inputVolume}
                      onChange={(e) => { const v = Number(e.target.value); setInputVolume(v); localStorage.setItem('pref_input_volume', String(v)); }}
                      className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[rgba(26,29,33,0.3)] accent-[#FF8A00]" />
                    <Volume2 size={20} className="shrink-0 text-[#111315] dark:text-[#A0A0A0]" />
                  </div>
                </div>
              </div>

              <div className="mb-6 flex items-center justify-between gap-6">
                <div>
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Test Microphone</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Say something to test your input.</p>
                </div>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={startMicTest}
                    className="flex h-10 shrink-0 items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]">
                    {micTesting ? 'Stop Test' : 'Start Test'}
                  </button>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 9 }).map((_, i) => {
                      const active = micTesting && micLevel * 9 > i;
                      return <div key={i} className={`h-10 w-7 border-[0.5px] border-[rgba(26,29,33,0.3)] ${i === 0 ? 'rounded-l' : ''} ${i === 8 ? 'rounded-r' : ''}`} style={{ background: active ? '#FF8A00' : '#F3F4F6' }} />;
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-6">
                <div className="max-w-[502px]">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Noise Suppression</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Reduces background noise during sessions.</p>
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input type="checkbox" className="sr-only peer" checked={noiseSuppression} onChange={() => { const next = !noiseSuppression; setNoiseSuppression(next); localStorage.setItem('pref_noise_suppression', String(next)); }} />
                  <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                </label>
              </div>

              <hr className="my-8 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Speaker */}
              <div className="mb-6">
                <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Speaker</h3>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Configure all the required settings so that you can hear the end user.</p>
              </div>
              <div className="mb-6 grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Speaker</label>
                  <StyledSelect
                    value={speakerDevice}
                    options={audioOutputs.length ? audioOutputs : [{ value: 'default', label: 'Soundcard-Speaker' }]}
                    onChange={(val) => { setSpeakerDevice(val); writePreferredDevice(MEETING_PREF_KEYS.speaker, val); }}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Output Volume</label>
                  <div className="flex h-10 items-center gap-3">
                    <VolumeX size={20} className="shrink-0 text-[#111315] dark:text-[#A0A0A0]" />
                    <input type="range" min={0} max={100} value={outputVolume}
                      onChange={(e) => { const v = Number(e.target.value); setOutputVolume(v); localStorage.setItem('pref_output_volume', String(v)); }}
                      className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[rgba(26,29,33,0.3)] accent-[#FF8A00]" />
                    <Volume2 size={20} className="shrink-0 text-[#111315] dark:text-[#A0A0A0]" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Play Test Sound</h3>
                  <button type="button" onClick={playTestSound}
                    className="flex h-10 items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-6 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50 dark:bg-transparent dark:text-[#F5F5F5]"
                    disabled={speakerMuted}>
                    Play
                  </button>
                </div>
                <div className="flex items-center gap-6">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Mute</h3>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={speakerMuted} onChange={() => { const next = !speakerMuted; setSpeakerMuted(next); localStorage.setItem('pref_speaker_muted', String(next)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>
              </div>

              <hr className="my-8 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Video */}
              <div className="mb-6">
                <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Video</h3>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Configure all the required settings for the best video experience.</p>
              </div>
              <div className="mb-6 flex items-start justify-between gap-12">
                <div>
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Camera Preview</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Live camera preview here.</p>
                </div>
                <button type="button" onClick={() => startCamera()}
                  className="relative flex h-[260px] w-[470px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3F4F6] dark:bg-white/5">
                  <video ref={videoPreviewRef} muted playsInline className={`h-full w-full object-cover ${cameraOn ? '' : 'hidden'}`} />
                  {!cameraOn && (
                    <span className="flex items-center gap-2 text-[14px] text-[rgba(17,19,21,0.6)] dark:text-[#A0A0A0]">
                      <Video size={20} /> Click To Enable Preview
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-end justify-between gap-12">
                <div className="flex w-[400px] flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Video Source</label>
                  <StyledSelect
                    value={videoDevice}
                    options={videoInputs.length ? videoInputs : [{ value: 'default', label: 'HP True Vision Camera' }]}
                    onChange={(val) => {
                      setVideoDevice(val);
                      writePreferredDevice(MEETING_PREF_KEYS.cam, val);
                      // Live preview follows the new camera immediately.
                      if (cameraOn) { stopCamera(); startCamera(val); }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Follow My Face</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">The camera will keep your face in center.</p>
                  </div>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={followFace} onChange={() => { const next = !followFace; setFollowFace(next); localStorage.setItem('pref_follow_face', String(next)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>
              </div>
            </div>
          ) : activeTab === 'Notifications' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-12">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('notifications_label', lang)}</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Choose what to be alerted about and how.</p>
              </div>

              <div className="flex flex-col gap-6">
                {/* Windows Notification */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Windows Notification</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Turn on push notifications to receive them on the Windows sidebar.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={windowsNotification} onChange={() => { const next = !windowsNotification; setWindowsNotification(next); localStorage.setItem('pref_windows_notification', String(next)); triggerSave({ windowsNotification: next }); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

                {/* Windows Notification for incoming sessions */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Windows Notification for incoming sessions.</h3>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Get notified when a session starts or ends.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={incomingSessionNotification} onChange={() => { const next = !incomingSessionNotification; setIncomingSessionNotification(next); localStorage.setItem('pref_incoming_session_notification', String(next)); triggerSave({ incomingSessionNotification: next }); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>
              </div>
            </div>
          ) : activeTab === 'Active sign-ins' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-12">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('active_sign_ins', lang)}</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Devices and browsers currently signed in to your account.</p>
              </div>

              {/* Current Session */}
              <div className="mb-12">
                <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Current Session</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">
                  <span>{currentClient.device} · {currentClient.client}</span>
                  {currentSession?.ip && (
                    <>
                      <span className="h-[3px] w-[3px] rounded-full bg-[rgba(26,29,33,0.3)]" />
                      <span>{currentSession.ip}</span>
                    </>
                  )}
                  {currentSignedInAt && (
                    <>
                      <span className="h-[3px] w-[3px] rounded-full bg-[rgba(26,29,33,0.3)]" />
                      <span>Signed in {timeAgo(currentSignedInAt)}</span>
                    </>
                  )}
                  <span className="h-[3px] w-[3px] rounded-full bg-[rgba(26,29,33,0.3)]" />
                  <span className="inline-flex h-[26px] items-center gap-1.5 rounded-[32px] px-1.5 text-[14px] text-[#34C759]">
                    <span className="h-[6px] w-[6px] rounded-full bg-[#34C759]" /> Active Now
                  </span>
                </div>
              </div>

              {/* Other Active Sessions */}
              <div>
                <div className="mb-[30px] flex items-center gap-3">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Other Active Sessions</h3>
                  <button type="button" onClick={fetchSessions} title="Refresh Sessions" className="text-[rgba(26,29,33,0.5)] transition-colors hover:text-[#FF8A00] dark:text-[#A0A0A0]">
                    <RefreshCw size={15} className={sessionsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
                {sessionsLoading && otherSessions.length === 0 ? (
                  <div className="rounded-xl border border-[rgba(26,29,33,0.3)] p-8 text-center text-[14px] text-[rgba(17,19,21,0.6)] dark:border-white/10">
                    Loading Sessions…
                  </div>
                ) : otherSessions.length === 0 ? (
                  <div className="rounded-xl border border-[rgba(26,29,33,0.3)] p-8 text-center text-[14px] text-[rgba(17,19,21,0.6)] dark:border-white/10">
                    No other active sessions. You're only signed in on this device.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-[rgba(26,29,33,0.3)] dark:border-white/10">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="h-11 bg-[#F3F4F6] text-left text-[12px] font-medium leading-[17px] text-[#111315] dark:bg-white/5 dark:text-[#F5F5F5]">
                          <th className="px-6 font-medium">Device</th>
                          <th className="px-6 font-medium">IP Address</th>
                          <th className="px-6 font-medium">Last Active</th>
                          <th className="px-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {otherSessions.map(session => {
                          const info = parseClientInfo(session.userAgent);
                          return (
                            <tr key={session.id} className="h-[72px] border-t border-[rgba(26,29,33,0.3)] text-[14px] leading-5 text-[#111315] dark:border-white/10 dark:text-[#F5F5F5]">
                              <td className="px-6">
                                <div className="font-medium text-[#111315] dark:text-[#F5F5F5]">{info.device}</div>
                                <div className="text-[rgba(17,19,21,0.6)] dark:text-[#A0A0A0]">{info.client}</div>
                              </td>
                              <td className="px-6">{session.ip || '—'}</td>
                              <td className="px-6">{session.lastSeen ? timeAgo(new Date(session.lastSeen).getTime()) : '—'}</td>
                              <td className="px-6 text-right">
                                <button
                                  type="button"
                                  onClick={() => revokeSession(session.id)}
                                  disabled={revokingId === session.id}
                                  className="inline-flex h-[22px] items-center justify-center rounded bg-[#F3F4F6] px-2 text-[10px] leading-[14px] text-[#111315] transition-colors hover:bg-[#E9EAEC] disabled:opacity-50 dark:bg-white/10 dark:text-[#F5F5F5]"
                                >
                                  {revokingId === session.id ? 'Revoking…' : 'Revoke'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'Device management' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-12">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('device_management_label', lang)}</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Control how this machine can be accessed by your team.</p>
              </div>

              {/* Device Name + Assigned to */}
              <div className="mb-6 grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Device Name</label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => { setDeviceName(e.target.value); setDeviceNameError(''); }}
                    onBlur={saveDeviceName}
                    className={`h-10 w-full rounded border bg-white px-4 text-[14px] leading-5 text-[#111315] outline-none dark:bg-[#141414] dark:text-white ${deviceNameError ? 'border-[#D92D20] focus:border-[#D92D20]' : 'border-[rgba(26,29,33,0.3)] focus:border-[#FF8A00]'}`}
                  />
                  {deviceNameError && <span className="mt-1 text-[13px] text-[#D92D20]">{deviceNameError}</span>}
                </div>
                <div className="flex flex-col">
                  <label className="mb-1 text-[14px] leading-5 text-[#111315] dark:text-[#F5F5F5]">Assigned To</label>
                  <input
                    type="text"
                    value={dmAssignedTo}
                    onChange={(e) => setDmAssignedTo(e.target.value)}
                    className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] leading-5 text-[#111315] outline-none focus:border-[#FF8A00] dark:bg-[#141414] dark:text-white"
                  />
                  <span className="mt-1 text-[10px] leading-[14px] text-[#0088FF]">Primary owner of this device.</span>
                </div>
              </div>

              {/* Tags + Department */}
              <div className="mb-6 grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Tags</h3>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {dmTags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-[32px] bg-[rgba(14,165,233,0.1)] px-2 py-1">
                        <span className="h-[5px] w-[5px] rounded-full bg-[#0EA5E9]" />
                        <span className="text-[10px] leading-[14px] text-[#000000] dark:text-[#F5F5F5]">#{tag}</span>
                        <button type="button" onClick={() => { const next = dmTags.filter(x => x !== tag); setDmTags(next); localStorage.setItem('pref_device_tags', JSON.stringify(next)); }} className="ml-0.5 text-black/40 hover:text-black">
                          <CloseIcon size={10} />
                        </button>
                      </span>
                    ))}
                    {dmAddingTag ? (
                      <input
                        type="text"
                        value={dmNewTag}
                        autoFocus
                        onChange={(e) => setDmNewTag(e.target.value)}
                        onBlur={() => { const v = dmNewTag.trim().replace(/^#/, ''); if (v) { const next = [...dmTags, v]; setDmTags(next); localStorage.setItem('pref_device_tags', JSON.stringify(next)); } setDmNewTag(''); setDmAddingTag(false); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDmNewTag(''); setDmAddingTag(false); } }}
                        placeholder="Tag Name"
                        className="h-10 w-28 rounded border border-[rgba(26,29,33,0.3)] px-3 text-[14px] outline-none focus:border-[#FF8A00] dark:bg-[#141414] dark:text-white"
                      />
                    ) : (
                      <button type="button" onClick={() => setDmAddingTag(true)} className="flex h-10 items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]">
                        Add Tag
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Department</h3>
                  <div className="w-[155px]">
                    <StyledSelect
                      value={dmDepartment}
                      options={[
                        { value: '', label: 'Department' },
                        { value: 'Support', label: 'Support' },
                        { value: 'Sales', label: 'Sales' },
                        { value: 'Engineering', label: 'Engineering' },
                        { value: 'IT', label: 'IT' },
                      ]}
                      onChange={(val) => { setDmDepartment(val); localStorage.setItem('pref_device_department', val); }}
                    />
                  </div>
                </div>
              </div>

              <hr className="my-6 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Access */}
              <h3 className="mb-6 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Access</h3>
              <div className="flex flex-col gap-6">
                {[
                  { id: 'allow', title: 'Allow Incoming Connections', desc: 'When off, the server refuses every connection to this device (you always keep access).', value: dmAllowIncoming, set: setDmAllowIncoming, key: 'pref_dm_allow_incoming' },
                  { id: 'unattended', title: 'Unattended Access', desc: 'Same as "Grant Easy Access": connect to this device without a password or your approval.', value: dmUnattended, set: setDmUnattended, key: 'pref_dm_unattended' },
                  { id: 'noPrompt', title: 'Allow Control Without Asking', desc: 'Skip the on-screen "allow control" prompt, but keep the password. For machines nobody sits at. Unattended access already includes this.', value: dmNoControlPrompt, set: setDmNoControlPrompt, key: 'pref_dm_no_control_prompt' },
                ].map(row => (
                  <div key={row.id} className="flex items-start justify-between gap-6">
                    <div className="max-w-[502px]">
                      <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">{row.title}</h4>
                      <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">{row.desc}</p>
                    </div>
                    <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                      <input type="checkbox" className="sr-only peer" checked={row.value} onChange={() => { const next = !row.value; row.set(next); if (row.id === 'unattended') { applyEasyAccess(next); return; } localStorage.setItem(row.key, String(next)); if (row.id === 'allow') saveDeviceSettings({ allowIncoming: next }); if (row.id === 'noPrompt') saveDeviceSettings({ allowControlWithoutPrompt: next }); }} />
                      <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                    </label>
                  </div>
                ))}
              </div>

              <hr className="my-6 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Temporary access codes */}
              <div className="mb-4 flex items-start justify-between gap-6">
                <div className="max-w-[560px]">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Temporary Access</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Give someone one-time access without sharing your real password. They still connect using your <span className="font-semibold text-[#111315] dark:text-white">Device ID</span> below — then type this code <span className="font-semibold text-[#111315] dark:text-white">Where The Password Is Asked</span>. It works once, then expires.</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="w-[130px]">
                    <StyledSelect
                      value={String(codeTtl)}
                      options={[
                        { value: '15', label: '15 Minutes' },
                        { value: '60', label: '1 Hour' },
                        { value: '240', label: '4 Hours' },
                        { value: '1440', label: '24 Hours' },
                      ]}
                      onChange={(v) => setCodeTtl(Number(v))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateAccessCode}
                    disabled={codeBusy || !currentDeviceId}
                    className="flex h-10 items-center justify-center gap-2 rounded bg-[#FF8A00] px-4 text-[14px] font-semibold leading-5 text-white transition-colors hover:bg-[#E67A00] disabled:opacity-50"
                  >
                    {codeBusy ? <Loader2 size={15} className="animate-spin" /> : <Key size={15} />}
                    Generate code
                  </button>
                </div>
              </div>
              {/* Device ID reminder — what the other person uses to find this machine */}
              <div className="mb-5 flex items-center gap-2 text-[13px] leading-5 text-[#757575] dark:text-[#A0A0A0]">
                Your Device ID:
                <span className="font-mono text-[14px] font-semibold tracking-wider text-[#111315] dark:text-[#F5F5F5]">{formatDeviceId(thisDeviceId())}</span>
              </div>
              {freshCode && (
                <div className="mb-4 flex items-center justify-between gap-6 rounded-xl border border-[#FFB347] bg-[#FFF6ED] px-5 py-4 dark:bg-[#FF8A00]/10">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="text-[12px] uppercase tracking-wide text-[#B45309]/80">ID</span>
                      <span className="font-mono text-[20px] font-bold tracking-[0.15em] text-[#111315] dark:text-white">{formatDeviceId(thisDeviceId())}</span>
                      <span className="text-[12px] uppercase tracking-wide text-[#B45309]/80">Code</span>
                      <span className="font-mono text-[20px] font-bold tracking-[0.2em] text-[#111315] dark:text-white">{freshCode.code}</span>
                    </div>
                    <p className="m-0 mt-1.5 text-[12px] leading-[17px] text-[#B45309]">Other person connects with the ID, then enters this code as the password. Works once · expires {new Date(freshCode.expiresAt).toLocaleString()}.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const invite = `Remote365 access\nDevice ID: ${formatDeviceId(thisDeviceId())}\nOne-time code (use as password): ${freshCode.code}\nExpires: ${new Date(freshCode.expiresAt).toLocaleString()}`;
                      navigator.clipboard.writeText(invite);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 1500);
                    }}
                    className="flex h-10 shrink-0 items-center justify-center gap-2 rounded border border-[#FFB347] bg-white px-4 text-[14px] font-medium leading-5 text-[#B45309] transition-colors hover:bg-[#FFF4E5] dark:bg-transparent"
                  >
                    {codeCopied ? <><Check size={15} className="text-[#34C759]" /> Copied</> : 'Copy Invite'}
                  </button>
                </div>
              )}
              {accessCodes.length > 0 && (
                <div className="mb-6 flex flex-col gap-2">
                  {accessCodes.map((c: any) => {
                    const full = localCodes[c.id];
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-4 rounded border border-[rgba(26,29,33,0.15)] px-4 py-2 dark:border-white/10">
                        <span className="font-mono text-[15px] font-semibold tracking-widest text-[#111315] dark:text-[#F5F5F5]">{full || c.hint || '••••••'}</span>
                        <span className="flex-1 text-[12px] leading-[17px] text-[#757575] dark:text-[#A0A0A0]">expires {new Date(c.expiresAt).toLocaleString()}</span>
                        {full && (
                          <button type="button" onClick={() => { navigator.clipboard.writeText(full); }} className="text-[13px] font-medium text-[#111315] hover:text-[#FF8A00] dark:text-[#A0A0A0]">
                            Copy
                          </button>
                        )}
                        <button type="button" onClick={() => revokeAccessCode(c.id)} className="text-[13px] font-medium text-[#D92D20] hover:underline">
                          Revoke
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <hr className="my-6 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Access schedule */}
              <div className="flex items-start justify-between gap-6">
                <div className="max-w-[502px]">
                  <h3 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Access Schedule</h3>
                  <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Only accept incoming connections during these hours ({Intl.DateTimeFormat().resolvedOptions().timeZone}). You can always connect to your own device.</p>
                </div>
                <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                  <input type="checkbox" className="sr-only peer" checked={dmSchedule.enabled} onChange={() => updateSchedule({ enabled: !dmSchedule.enabled })} />
                  <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                </label>
              </div>
              {dmSchedule.enabled && (
                <div className="mt-4 flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label, idx) => {
                      const active = dmSchedule.days.includes(idx);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => updateSchedule({ days: active ? dmSchedule.days.filter(d => d !== idx) : [...dmSchedule.days, idx].sort((a, b) => a - b) })}
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${active ? 'bg-[#FF8A00] text-white' : 'border border-[rgba(26,29,33,0.3)] text-[#111315] hover:bg-[#FFF4E5] dark:border-white/10 dark:text-[#F5F5F5]'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" value={dmSchedule.start} onChange={(e) => updateSchedule({ start: e.target.value })} className="h-10 rounded border border-[rgba(26,29,33,0.3)] bg-white px-3 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00] dark:bg-[#141414] dark:text-white" />
                    <span className="text-[14px] text-[#757575] dark:text-[#A0A0A0]">To</span>
                    <input type="time" value={dmSchedule.end} onChange={(e) => updateSchedule({ end: e.target.value })} className="h-10 rounded border border-[rgba(26,29,33,0.3)] bg-white px-3 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00] dark:bg-[#141414] dark:text-white" />
                  </div>
                </div>
              )}

              <hr className="my-6 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Security */}
              <h3 className="mb-6 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Security</h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Hide This Device From Non-Admins</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Only Super Admins and Department Managers can see this machine</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={dmHideFromNonAdmins} onChange={() => { const next = !dmHideFromNonAdmins; setDmHideFromNonAdmins(next); localStorage.setItem('pref_dm_hide', String(next)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Notify Me When Accessed</h4>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={dmNotifyAccess} onChange={() => { const next = !dmNotifyAccess; setDmNotifyAccess(next); localStorage.setItem('pref_dm_notify_access', String(next)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>
              </div>
            </div>
          ) : activeTab === 'Remote control' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              {/* Header */}
              <div className="mb-12">
                <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{t('remote_control', lang)}</h1>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Default behavior during remote control sessions with another device.</p>
              </div>

              {/* Input and Display */}
              <h3 className="mb-6 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Input And Display</h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Clipboard Syncing</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Share copied text and files between your device and the remote.</p>
                  </div>
                  <div className="w-[170px] shrink-0">
                    <StyledSelect value={rcClipboard} options={[{ value: 'Outgoing Only', label: 'Outgoing Only' }, { value: 'Incoming Only', label: 'Incoming Only' }, { value: 'Both', label: 'Both' }, { value: 'Off', label: 'Off' }]} onChange={(v) => { setRcClipboard(v); localStorage.setItem('pref_rc_clipboard', v); }} />
                  </div>
                </div>

                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Sync Keyboard Layout</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Use the remote machine's keyboard layout instead of yours.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={rcSyncKeyboard} onChange={() => { const n = !rcSyncKeyboard; setRcSyncKeyboard(n); localStorage.setItem('pref_rc_sync_keyboard', String(n)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Enable Drag And Drop</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">When enabled, the files can be transferred by drag and drop.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={rcDragDrop} onChange={() => { const n = !rcDragDrop; setRcDragDrop(n); localStorage.setItem('pref_rc_drag_drop', String(n)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Remote Cursor Style</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Share copied text and files between your device and the remote.</p>
                  </div>
                  <div className="w-[170px] shrink-0">
                    <StyledSelect value={rcCursorStyle} options={[{ value: 'Default', label: 'Default' }, { value: 'Dot', label: 'Dot' }, { value: 'Hidden', label: 'Hidden' }]} onChange={(v) => { setRcCursorStyle(v); localStorage.setItem('pref_rc_cursor_style', v); }} />
                  </div>
                </div>
              </div>

              <hr className="my-6 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Performance */}
              <h3 className="mb-6 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">PERFORMANCE</h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Display Quality</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Higher quality uses more bandwidth.</p>
                  </div>
                  <div className="w-[170px] shrink-0">
                    <StyledSelect value={rcDisplayQuality} options={[{ value: 'Balanced', label: 'Balanced' }, { value: 'Optimize Speed', label: 'Optimize Speed' }, { value: 'Optimize Quality', label: 'Optimize Quality' }]} onChange={(v) => { setRcDisplayQuality(v); localStorage.setItem('pref_rc_display_quality', v); }} />
                  </div>
                </div>

                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Suppress Remote Wallpaper</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Hide the remote machine's desktop wallpaper to improve speed.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={rcSuppressWallpaper} onChange={() => { const n = !rcSuppressWallpaper; setRcSuppressWallpaper(n); localStorage.setItem('pref_rc_suppress_wallpaper', String(n)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>
              </div>

              <hr className="my-6 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Incoming Connections */}
              <h3 className="mb-6 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Incoming Connections</h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Enable Local Inputs Doe Incoming Connections</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Allow data input operations by the end user who connects to this device.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={rcLocalInputs} onChange={() => { const n = !rcLocalInputs; setRcLocalInputs(n); localStorage.setItem('pref_rc_local_inputs', String(n)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-[rgba(0,0,0,0.7)] dark:text-[#A0A0A0]">Enable Black Screen For Incoming Connections</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[rgba(0,0,0,0.7)] dark:text-[#A0A0A0]">Switches the device screen into black.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={rcBlackScreen} onChange={() => { const n = !rcBlackScreen; setRcBlackScreen(n); localStorage.setItem('pref_rc_black_screen', String(n)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Hotkey To End Incoming Session</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Set a keyboard shortcut to instantly end any incoming session.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {rcEditingHotkey ? (
                      <input
                        type="text"
                        value={rcEndHotkey}
                        readOnly
                        autoFocus
                        onKeyDown={(e) => {
                          e.preventDefault();
                          const parts: string[] = [];
                          if (e.ctrlKey) parts.push('Ctrl');
                          if (e.altKey) parts.push('Alt');
                          if (e.shiftKey) parts.push('Shift');
                          const key = e.key;
                          if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                            parts.push(key.length === 1 ? key.toUpperCase() : key);
                            const combo = parts.join(' + ');
                            setRcEndHotkey(combo);
                            localStorage.setItem('pref_rc_end_hotkey', combo);
                            setRcEditingHotkey(false);
                          }
                        }}
                        onBlur={() => setRcEditingHotkey(false)}
                        className="h-10 w-28 rounded border border-[#FF8A00] px-3 text-[14px] outline-none dark:bg-[#141414] dark:text-white"
                      />
                    ) : (
                      <span className="text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">{rcEndHotkey}</span>
                    )}
                    <button type="button" onClick={() => setRcEditingHotkey(true)} className="flex h-10 items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]">
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              <hr className="my-6 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Outgoing Connections */}
              <h3 className="mb-6 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Outgoing Connections</h3>
              <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Play Device Sounds And Music</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">When activated, the sound from remote device is transferred to local device.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={rcPlaySounds} onChange={() => { const n = !rcPlaySounds; setRcPlaySounds(n); localStorage.setItem('pref_rc_play_sounds', String(n)); }} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>

              </div>

              <hr className="my-6 border-t border-[rgba(26,29,33,0.3)] dark:border-white/10" />

              {/* Session security (incoming) — server-backed in device.settings, enforced by the host */}
              <h3 className="mb-1 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Session Security</h3>
              <p className="m-0 mb-6 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">How this device behaves when someone connects to it. These settings are saved to your account.</p>
              <div className="flex flex-col gap-6">
                {/* A — Control permission mode */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Who Can Control This Device</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">View only lets people watch but not touch. Ask me shows a prompt each time. Allow grants control immediately.</p>
                  </div>
                  <div className="w-[190px] shrink-0">
                    <StyledSelect
                      value={controlMode}
                      options={[
                        { value: 'view', label: 'View Only' },
                        { value: 'ask', label: 'Ask Me First' },
                        { value: 'allow', label: 'Allow Control' },
                      ]}
                      onChange={changeControlMode}
                    />
                  </div>
                </div>

                {/* B — Panic hotkey */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Panic Hotkey</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">A system-wide shortcut that instantly ends every remote session — works even when Remote365 is minimized.</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setHotkeyError(''); setCapturingHotkey((v) => !v); }}
                        className={`flex h-10 w-[170px] items-center justify-center rounded border px-4 text-[14px] font-medium leading-5 outline-none transition-colors ${capturingHotkey ? 'border-[#FF8A00] text-[#FF8A00] animate-pulse' : 'border-[rgba(26,29,33,0.3)] text-[#111315] dark:text-[#F5F5F5] dark:border-white/10'}`}
                      >
                        {capturingHotkey ? 'Press Keys…' : (panicHotkey ? panicHotkey.replace(/\+/g, ' + ') : 'Set Hotkey')}
                      </button>
                      {panicHotkey && !capturingHotkey && (
                        <button type="button" onClick={() => applyPanicHotkey('')} className="text-[13px] font-medium text-[#D92D20] hover:underline">Clear</button>
                      )}
                    </div>
                    {capturingHotkey && <span className="text-[11px] leading-4 text-[#FF8A00]">Press a combo like Ctrl + Shift + F8 · Esc to cancel</span>}
                    {hotkeyError && !capturingHotkey && <span className="text-[11px] leading-4 text-[#D92D20]">{hotkeyError}</span>}
                  </div>
                </div>
                {panicHotkey && (
                  <div className="-mt-2 flex items-center justify-between gap-6 pl-1">
                    <span className="text-[13px] leading-5 text-[#111315]/70 dark:text-[#A0A0A0]">Also block new connections until I re-enable them</span>
                    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                      <input type="checkbox" className="sr-only peer" checked={panicKillIncoming} onChange={togglePanicKillIncoming} />
                      <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                    </label>
                  </div>
                )}

                {/* C — Idle auto-disconnect */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Disconnect Idle Viewers</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Automatically end a session when there's been no remote input for a while, so a forgotten session can't stay open.</p>
                  </div>
                  <div className="w-[190px] shrink-0">
                    <StyledSelect
                      value={String(idleDisconnectMin)}
                      options={[
                        { value: '0', label: 'Never' },
                        { value: '10', label: 'After 10 Minutes' },
                        { value: '30', label: 'After 30 Minutes' },
                        { value: '60', label: 'After 1 Hour' },
                      ]}
                      onChange={(v) => changeIdleDisconnect(Number(v))}
                    />
                  </div>
                </div>

                {/* D — Received files folder */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Save Received Files To</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Where files sent to this device are stored. Defaults to a Remote365 folder inside Downloads.</p>
                    <p className="m-0 mt-1 truncate text-[12px] leading-[17px] text-[#0088FF]" title={receivedDir || 'Downloads\\Remote365'}>{receivedDir || 'Downloads\\Remote365 (Default)'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={chooseReceivedDir} className="flex h-10 items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5] dark:border-white/10">
                      Choose Folder
                    </button>
                    {receivedDir && (
                      <button type="button" onClick={resetReceivedDir} className="text-[13px] font-medium text-[#D92D20] hover:underline">Reset</button>
                    )}
                  </div>
                </div>

                {/* E — Block file transfer entirely */}
                <div className="flex items-start justify-between gap-6">
                  <div className="max-w-[502px]">
                    <h4 className="m-0 text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Block File Transfer</h4>
                    <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Nobody connected to this device can browse its files, send files to it, or take files from it. Remote control keeps working.</p>
                  </div>
                  <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                    <input type="checkbox" className="sr-only peer" checked={blockFileTransfer} onChange={toggleBlockFileTransfer} />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[linear-gradient(180deg,#FF8A00_0%,#FFB347_100%)] peer-checked:after:translate-x-full dark:bg-white/10"></div>
                  </label>
                </div>
              </div>
            </div>
          ) : activeTab === 'Network' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              <div className="mb-12 flex w-full max-w-[900px] flex-col items-start gap-1">
                <h1 className="m-0 w-full text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">Network</h1>
                <p className="m-0 w-full text-[14px] font-normal leading-5 text-black dark:text-[#A0A0A0]">Configure how Remote365 connects, wakes devices, and optimizes session routing.</p>
              </div>

              <div className="flex w-full max-w-[848px] flex-col items-center gap-6">
                <div className="flex w-full flex-col items-start gap-[52px]">
                  <div className="flex min-h-[47px] w-full items-center justify-between gap-8">
                    <div className="flex w-[502px] flex-col items-start gap-1">
                      <h3 className="m-0 w-[307px] text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Wake-On-LAN</h3>
                      <p className="m-0 w-full text-[14px] font-normal leading-5 text-black dark:text-[#A0A0A0]">Let another Remote365 device on the same network wake this machine before connecting. {networkWakeOnLan && wolMac ? <span className="text-[#0088FF]">This device: {wolMac.toUpperCase()}</span> : null}</p>
                    </div>
                    <SecToggle
                      checked={networkWakeOnLan}
                      onChange={(next) => changeWakeOnLan(next)}
                    />
                  </div>

                  <div className="flex min-h-[47px] w-full items-center justify-between gap-8">
                    <div className="flex w-[502px] flex-col items-start gap-1">
                      <h3 className="m-0 w-[307px] text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Proxy</h3>
                      <p className="m-0 w-full text-[14px] font-normal leading-5 text-black dark:text-[#A0A0A0]">If needed, you can use the recommended settings or set up a manual proxy.</p>
                    </div>
                    <div className="flex w-[205px] shrink-0 flex-col gap-2">
                      <StyledSelect
                        value={networkProxyMode}
                        options={[
                          { value: 'Recommended', label: 'Recommended' },
                          { value: 'System proxy', label: 'System Proxy' },
                          { value: 'Manual proxy', label: 'Manual Proxy' },
                          { value: 'No proxy', label: 'No Proxy' },
                        ]}
                        onChange={changeProxyMode}
                      />
                      {networkProxyMode === 'Manual proxy' && (
                        <input
                          type="text"
                          value={networkProxyManual}
                          onChange={(e) => changeProxyManual(e.target.value)}
                          placeholder="host:port (e.g. 127.0.0.1:8080)"
                          className="h-10 w-full rounded border border-[rgba(26,29,33,0.3)] bg-white px-3 text-[13px] text-[#111315] outline-none focus:border-[#FF8A00] dark:bg-[#141414] dark:text-white dark:border-white/10"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex min-h-[67px] w-full items-center justify-between gap-8">
                    <div className="flex w-[502px] flex-col items-start gap-1">
                      <h3 className="m-0 w-[307px] text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Performance</h3>
                      <p className="m-0 w-full text-[14px] font-normal leading-5 text-black dark:text-[#A0A0A0]">Use the recommended settings for optimal performance on your remote control sessions.</p>
                    </div>
                    <div className="w-[205px] shrink-0">
                      <StyledSelect
                        value={networkPerformanceMode}
                        options={[
                          { value: 'Recommended', label: 'Recommended' },
                          { value: 'Optimize Speed', label: 'Optimize Speed' },
                          { value: 'Optimize Quality', label: 'Optimize Quality' },
                          { value: 'Low Bandwidth', label: 'Low Bandwidth' },
                        ]}
                        onChange={changePerformance}
                      />
                    </div>
                  </div>

                </div>

                <div className="flex w-full justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      changeWakeOnLan(false);
                      changeProxyMode('Recommended');
                      changePerformance('Recommended');
                    }}
                    className="flex h-10 w-[150px] items-center justify-center rounded-[32px] border border-[#F3F4F6] bg-white px-4 text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.7)] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]"
                  >
                    Reset To Defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerSave({
                        networkSettings: {
                          networkWakeOnLan,
                          networkProxyMode,
                          networkPerformanceMode,
                        },
                      });
                    }}
                    className="flex h-10 w-[150px] items-center justify-center rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'Advanced settings' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 font-['Mona_Sans',system-ui,sans-serif] text-[#111315] dark:text-[#F5F5F5]">
              <div className="mb-10">
                <div className="flex items-center gap-2">
                  <h1 className="m-0 text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">Advanced Settings</h1>
                  {(showSaved || isLoading) && (
                    <span className="flex items-center gap-1 text-[12px] font-medium text-[#FF8A00]">
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : 'Saved'}
                    </span>
                  )}
                </div>
                <p className="m-0 mt-1 text-[14px] leading-5 text-[#111315] dark:text-[#A0A0A0]">Fine tune desktop behavior, diagnostics, and maintenance options for this device.</p>
              </div>

              <div className="flex w-full max-w-[848px] flex-col items-start gap-6">
                <section className="flex w-full flex-col items-start gap-6">
                  <h3 className="m-0 w-full text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">System Behavior</h3>
                  <div className="flex w-full flex-col gap-2">
                    <AdvancedCheckbox
                      checked={advLaunchMinimized}
                      label="Start Remote365 minimized to the system tray (needs restart)."
                      onChange={(next) => {
                        saveAdvancedFlag('pref_adv_launch_minimized', next, setAdvLaunchMinimized);
                        electronAPI()?.setAdvancedFlags?.({ launchMinimized: next }).catch(() => {});
                      }}
                    />
                    <AdvancedCheckbox
                      checked={advHardwareAcceleration}
                      label="Use hardware acceleration — turn off if you see black screens or rendering glitches (needs restart)."
                      onChange={(next) => {
                        saveAdvancedFlag('pref_adv_hardware_acceleration', next, setAdvHardwareAcceleration);
                        electronAPI()?.setAdvancedFlags?.({ disableGpu: !next }).catch(() => {});
                      }}
                    />
                    <AdvancedCheckbox
                      checked={startWithWindows}
                      label="Start Remote365 when Windows starts."
                      onChange={(next) => {
                        setStartWithWindows(next);
                        applyStartWithWindowsPreference(next).then(setStartWithWindows);
                        triggerSave({ startWithWindows: next });
                      }}
                    />
                    <AdvancedCheckbox
                      checked={keepAgentRunning}
                      label="Keep Remote365 running in the tray after closing the window."
                      onChange={(next) => {
                        setKeepAgentRunning(next);
                        localStorage.setItem('pref_keep_agent', String(next));
                        electronAPI()?.setAdvancedFlags?.({ keepRunning: next }).catch(() => {});
                        triggerSave({ keepAgentRunning: next });
                      }}
                    />
                  </div>
                </section>

                <div className="h-px w-full bg-[rgba(26,29,33,0.3)] dark:bg-white/10" />

                <section className="flex w-full flex-col items-start gap-6">
                  <h3 className="m-0 w-full text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Incoming Connections</h3>
                  <div className="flex w-full flex-col gap-2">
                    <AdvancedCheckbox
                      checked={advDirectPeer}
                      label="Allow direct peer connections when available (turn off to force all traffic through the relay)."
                      onChange={(next) => {
                        saveAdvancedFlag('pref_adv_direct_peer', next, setAdvDirectPeer);
                        electronAPI()?.net?.setIcePolicy?.(next ? 'all' : 'relay').catch(() => {});
                      }}
                    />
                    <AdvancedCheckbox
                      checked={advConnectionDiagnostics}
                      label="Collect connection diagnostics for troubleshooting."
                      onChange={(next) => saveAdvancedFlag('pref_adv_connection_diagnostics', next, setAdvConnectionDiagnostics)}
                    />
                  </div>
                </section>

                <div className="h-px w-full bg-[rgba(26,29,33,0.3)] dark:bg-white/10" />

                <section className="flex w-full flex-col items-start gap-6">
                  <h3 className="m-0 w-full text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">Show File Logs</h3>
                  <div className="flex w-full flex-col gap-4">
                    <div className="flex min-h-10 w-full items-center justify-between gap-2">
                      <AdvancedCheckbox
                        checked={advDetailedLogs}
                        label="Keep detailed application logs."
                        onChange={(next) => {
                          saveAdvancedFlag('pref_adv_detailed_logs', next, setAdvDetailedLogs);
                          electronAPI()?.setAdvancedFlags?.({ detailedLogs: next }).catch(() => {});
                        }}
                      />
                      <button type="button" onClick={openAdvancedLogs} className="flex h-10 w-[278px] shrink-0 items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]">
                        Open Remote365 Log Folder
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <AdvancedCheckbox
                      checked={advCrashReports}
                      label="Include crash reports."
                      onChange={(next) => saveAdvancedFlag('pref_adv_crash_reports', next, setAdvCrashReports)}
                    />
                    <AdvancedCheckbox
                      checked={advUpdateLogs}
                      label="Include update logs."
                      onChange={(next) => saveAdvancedFlag('pref_adv_update_logs', next, setAdvUpdateLogs)}
                    />
                  </div>
                </section>

                <div className="h-px w-full bg-[rgba(26,29,33,0.3)] dark:bg-white/10" />

                <section className="flex w-full flex-col items-start gap-6">
                  <h3 className="m-0 w-full text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">More</h3>
                  <div className="flex w-full flex-col gap-2">
                    <div className="flex h-10 w-full items-center justify-between gap-2">
                      <p className="m-0 w-[560px] text-[16px] font-semibold leading-[23px] text-[#111315] dark:text-[#F5F5F5]">Export Diagnostic Bundle</p>
                      <button type="button" onClick={openAdvancedLogs} className="flex h-10 w-[111px] items-center justify-center rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]">Open</button>
                    </div>
                    <div className="flex h-10 w-full items-center justify-between gap-2">
                      <p className="m-0 w-[560px] text-[16px] font-semibold leading-[23px] text-[#111315] dark:text-[#F5F5F5]">Restore Advanced Defaults</p>
                      <button type="button" onClick={resetAdvancedSettings} className="flex h-10 w-[111px] items-center justify-center gap-2 rounded border border-[rgba(26,29,33,0.3)] bg-white px-4 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]">
                        Reset
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </section>

                <div className="flex w-full items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={resetAdvancedSettings} className="flex h-10 w-[150px] items-center justify-center rounded-[32px] border border-[#F3F4F6] bg-white px-4 text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.7)] transition-colors hover:bg-[#F9FAFB] dark:bg-transparent dark:text-[#F5F5F5]">Reset To Defaults</button>
                  <button
                    type="button"
                    onClick={() => {
                      // Each toggle already persists on change; Save re-applies the
                      // machine-level enforcement (idempotent) and confirms clearly.
                      const eAPI = (window as any).electronAPI;
                      eAPI?.setAdvancedFlags?.({
                        disableGpu: !advHardwareAcceleration,
                        launchMinimized: advLaunchMinimized,
                        keepRunning: keepAgentRunning,
                        detailedLogs: advDetailedLogs,
                      }).catch?.(() => {});
                      eAPI?.net?.setIcePolicy?.(advDirectPeer ? 'all' : 'relay').catch?.(() => {});
                      triggerSave({ startWithWindows, keepAgentRunning });
                      setShowSaved(true);
                      setTimeout(() => setShowSaved(false), 2000);
                    }}
                    className="flex h-10 w-[150px] items-center justify-center gap-2 rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90"
                  >
                    {showSaved ? <><Check size={16} /> Saved</> : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-[#757575] dark:text-[#A0A0A0] animate-in fade-in duration-300">
              <SettingsIcon size={48} className="mb-4 opacity-20" />
              <p className="text-base font-medium">{t('settings_soon', lang).replace('{tab}', activeTab)}</p>
            </div>
          )}
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 font-['Mona_Sans',system-ui,sans-serif]">
          <div className="mx-4 w-full max-w-md rounded-3xl border border-gray-100 bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-[#151515]">
            <div className="flex items-start justify-between border-b border-gray-100 p-6 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#FF8A00] dark:bg-[#FF8A00]/10">
                  <Key size={18} />
                </div>
                <div>
                  <h2 className="text-[18px] font-bold text-gray-900 dark:text-white">Reset Password</h2>
                  <p className="mt-1 text-[12px] text-gray-500 dark:text-[#A0A0A0]">Enter your current password and choose a new one.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetStatus === 'loading'}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/10"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-[13px] text-gray-700 dark:text-[#D1D1D1]">Current Password</label>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 focus-within:border-[#FF8A00] dark:border-white/10 dark:bg-[#0A0A0A]">
                  <input
                    type={showResetCurrent ? 'text' : 'password'}
                    value={resetCurrent}
                    onChange={(e) => setResetCurrent(e.target.value)}
                    disabled={resetStatus === 'loading'}
                    className="flex-1 bg-transparent text-[14px] text-gray-900 outline-none dark:text-white"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowResetCurrent(v => !v)} className="text-gray-400 hover:text-gray-600">
                    {showResetCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[13px] text-gray-700 dark:text-[#D1D1D1]">New Password</label>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 focus-within:border-[#FF8A00] dark:border-white/10 dark:bg-[#0A0A0A]">
                  <input
                    type={showResetNew ? 'text' : 'password'}
                    value={resetNew}
                    onChange={(e) => setResetNew(e.target.value)}
                    disabled={resetStatus === 'loading'}
                    className="flex-1 bg-transparent text-[14px] text-gray-900 outline-none dark:text-white"
                  />
                  <button type="button" onClick={() => setShowResetNew(v => !v)} className="text-gray-400 hover:text-gray-600">
                    {showResetNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {resetNew && (
                  <p className="mt-1 text-[11px]" style={{ color: getPasswordStrength(resetNew).color }}>
                    {getPasswordStrength(resetNew).label}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[13px] text-gray-700 dark:text-[#D1D1D1]">Confirm New Password</label>
                <input
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  disabled={resetStatus === 'loading'}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-[14px] text-gray-900 outline-none focus:border-[#FF8A00] dark:border-white/10 dark:bg-[#0A0A0A] dark:text-white"
                />
              </div>

              {resetStatus === 'error' && resetError && (
                <div className="flex items-center gap-2 text-[12px] text-red-600 dark:text-red-400">
                  <AlertTriangle size={12} />
                  {resetError}
                </div>
              )}
              {resetStatus === 'success' && (
                <div className="flex items-center gap-2 text-[12px] text-emerald-600">
                  <Check size={12} />
                  Password updated.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-6 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetStatus === 'loading'}
                className="rounded-xl px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:text-[#A0A0A0] dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={!resetCurrent || !resetNew || !resetConfirm || resetStatus === 'loading'}
                className="flex items-center gap-2 rounded-xl bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-5 py-2 text-[13px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetStatus === 'loading' && <Loader2 size={14} className="animate-spin" />}
                {resetStatus === 'loading' ? 'Saving...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {securityModal && (() => {
        const meta = {
          block: { icon: <Shield size={18} />, title: 'Block & Allow List', desc: 'Control exactly who can connect to this device.' },
          auth: { icon: <Key size={18} />, title: 'Authentication Settings', desc: 'Tune how incoming connections are authenticated.' },
          access: { icon: <ShieldCheck size={18} />, title: 'Access Control', desc: 'Decide what a connected user is allowed to do.' },
          redirection: { icon: <Usb size={18} />, title: 'Security Key Redirection', desc: 'Forward local security keys into the remote session.' },
        }[securityModal];
        const Row = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="m-0 text-[14px] font-medium text-gray-900 dark:text-white">{title}</p>
              {sub && <p className="m-0 mt-0.5 text-[12px] text-gray-500 dark:text-[#A0A0A0]">{sub}</p>}
            </div>
            {children}
          </div>
        );
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 font-['Mona_Sans',system-ui,sans-serif]">
            <div className="mx-4 w-full max-w-md rounded-3xl border border-gray-100 bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-[#151515]">
              <div className="flex items-start justify-between border-b border-gray-100 p-6 dark:border-white/5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#FF8A00] dark:bg-[#FF8A00]/10">
                    {meta.icon}
                  </div>
                  <div>
                    <h2 className="text-[18px] font-bold text-gray-900 dark:text-white">{meta.title}</h2>
                    <p className="mt-1 text-[12px] text-gray-500 dark:text-[#A0A0A0]">{meta.desc}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSecurityModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
                  <CloseIcon size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-5 overflow-y-auto p-6">
                {securityModal === 'block' && (
                  <>
                    {(['blockList', 'allowList'] as const).map((key) => {
                      const isBlock = key === 'blockList';
                      const value = isBlock ? secInput : allowInput;
                      const setValue = isBlock ? setSecInput : setAllowInput;
                      return (
                        <div key={key}>
                          <p className="mb-2 text-[13px] font-semibold text-gray-900 dark:text-white">{isBlock ? 'Blocked IDs' : 'Allowed IDs'}</p>
                          <div className="flex gap-2">
                            <input
                              value={value}
                              onChange={(e) => setValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { addToList(key, value); setValue(''); } }}
                              placeholder="Remote365 ID Or Email"
                              className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-[13px] text-gray-900 outline-none focus:border-[#FF8A00] dark:border-white/10 dark:bg-[#0A0A0A] dark:text-white"
                            />
                            <button type="button" onClick={() => { addToList(key, value); setValue(''); }} className="h-10 rounded-xl bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-4 text-[13px] font-semibold text-white">Add</button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {secSettings[key].length === 0 ? (
                              <span className="text-[12px] text-gray-400">{isBlock ? 'No one is blocked.' : 'Everyone allowed (no restriction).'}</span>
                            ) : secSettings[key].map((entry) => (
                              <span key={entry} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] ${isBlock ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'}`}>
                                {entry}
                                <button type="button" onClick={() => removeFromList(key, entry)} className="hover:opacity-70"><CloseIcon size={12} /></button>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {securityModal === 'auth' && (
                  <>
                    <Row title="Require Password Every Connection" sub="Always ask for the device password, even for trusted users.">
                      <SecToggle checked={secSettings.requirePassword} onChange={(v) => updateSec({ requirePassword: v })} />
                    </Row>
                    <Row title="Grant Easy Access" sub="Let your own account connect without a password prompt.">
                      <SecToggle checked={secSettings.easyAccess} onChange={(v) => updateSec({ easyAccess: v })} />
                    </Row>
                    <Row title="Confirm Each Incoming Connection" sub="Show an approval dialog before a session starts.">
                      <SecToggle checked={secSettings.confirmEachConnection} onChange={(v) => updateSec({ confirmEachConnection: v })} />
                    </Row>
                    <Row title="Lock Screen On Disconnect" sub="Automatically lock this device when a session ends.">
                      <SecToggle checked={secSettings.lockOnDisconnect} onChange={(v) => updateSec({ lockOnDisconnect: v })} />
                    </Row>
                  </>
                )}

                {securityModal === 'access' && (
                  <>
                    <Row title="Allow Remote Control" sub="Connected users can control mouse & keyboard.">
                      <SecToggle checked={secSettings.allowControl} onChange={(v) => updateSec({ allowControl: v })} />
                    </Row>
                    <Row title="Allow Clipboard Sharing" sub="Share copied text between both sides.">
                      <SecToggle checked={secSettings.allowClipboard} onChange={(v) => updateSec({ allowClipboard: v })} />
                    </Row>
                    <Row title="Allow File Transfer" sub="Permit sending and receiving files.">
                      <SecToggle checked={secSettings.allowFileTransfer} onChange={(v) => updateSec({ allowFileTransfer: v })} />
                    </Row>
                    <Row title="Max Participants" sub="How many end users can join one session.">
                      <StyledSelect
                        value={String(secSettings.maxParticipants)}
                        options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '5', label: '5' }, { value: '10', label: '10' }]}
                        onChange={(v) => updateSec({ maxParticipants: Number(v) })}
                      />
                    </Row>
                  </>
                )}

                {securityModal === 'redirection' && (
                  <div className="flex flex-col items-center gap-4 py-2 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-[#FF8A00] dark:bg-[#FF8A00]/10">
                      {secSettings.securityKeyInstalled ? <Check size={28} /> : <Usb size={28} />}
                    </div>
                    <p className="m-0 max-w-[320px] text-[13px] text-gray-600 dark:text-[#A0A0A0]">
                      {secSettings.securityKeyInstalled
                        ? 'The virtual security key driver is installed. Local security keys will be redirected into remote sessions.'
                        : 'Install the Remote365 virtual security key driver to redirect local security keys into your remote sessions.'}
                    </p>
                    <button
                      type="button"
                      onClick={installSecurityKey}
                      disabled={secSettings.securityKeyInstalled || installingKey}
                      className="flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-6 text-[13px] font-bold text-white disabled:opacity-60"
                    >
                      {installingKey && <Loader2 size={14} className="animate-spin" />}
                      {secSettings.securityKeyInstalled ? 'Installed' : installingKey ? 'Installing…' : 'Install Driver'}
                    </button>
                    {secSettings.securityKeyInstalled && (
                      <button type="button" onClick={() => updateSec({ securityKeyInstalled: false } as any)} className="text-[12px] text-gray-400 hover:text-gray-600">
                        Uninstall
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end border-t border-gray-100 p-6 dark:border-white/5">
                <button type="button" onClick={() => setSecurityModal(null)} className="rounded-xl bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] px-6 py-2 text-[13px] font-bold text-white">Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md mx-4 bg-white dark:bg-[#151515] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h2 className="text-[18px] font-bold text-gray-900 dark:text-white">{t('delete_account', lang)}</h2>
                  <p className="text-[12px] text-gray-500 dark:text-[#A0A0A0] mt-1">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteStatus === 'loading'}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 flex items-center justify-center disabled:opacity-50"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[13px] text-gray-700 dark:text-[#D1D1D1] leading-relaxed">
                {t('delete_account_desc', lang)}
              </p>
              <p className="text-[13px] text-gray-600 dark:text-[#A0A0A0]">
                {/* One text node so the translator handles the whole sentence; the
                    confirmation word stays "Delete" in every language because
                    that is the only word the check below accepts. */}
                To confirm, type &quot;Delete&quot; below.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type 'Delete' To Confirm"
                disabled={deleteStatus === 'loading'}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] text-[14px] text-gray-900 dark:text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:opacity-60"
                autoFocus
              />
              {deleteError && (
                <div className="flex items-center gap-2 text-[12px] text-red-600 dark:text-red-400">
                  <AlertTriangle size={12} />
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-6 border-t border-gray-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteStatus === 'loading'}
                className="px-4 py-2 rounded-xl text-[13px] font-medium text-gray-600 dark:text-[#A0A0A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || deleteStatus === 'loading'}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white text-[13px] font-bold transition-colors flex items-center gap-2"
              >
                {deleteStatus === 'loading' && <Loader2 size={14} className="animate-spin" />}
                {deleteStatus === 'loading' ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
