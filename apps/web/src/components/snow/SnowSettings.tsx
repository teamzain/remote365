import React, { useState, useEffect } from 'react';
import {
  Server,
  Play,
  Tag,
  Bell,
  Shield,
  Monitor,
  Wifi,
  Save,
  Check,
  ChevronRight,
  RotateCcw,
  Volume2,
  VolumeX,
  Package,
  Zap,
  Star,
  Crown,
  CheckCircle2,
  ArrowUpRight,
  X,
  User,
  Lock,
  Eye,
  EyeOff,
  Video,
  Info,
  RefreshCw,
  AlertCircle,
  Loader2,
  Smartphone,
  Globe,
  Trash2,
  LogOut,
  QrCode,
  Camera,
  Settings
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { hasUserPermission } from '../../lib/permissions';
import { LicensesPanel } from '../settings/LicensesPanel';
import api from '../../lib/api';
import { applyEasyAccess, isEasyAccessEnabled, subscribeEasyAccess } from '../../lib/easyAccess';

interface SnowSettingsProps {
  serverIP: string;
  isAutoHostEnabled: boolean;
  setIsAutoHostEnabled: (val: boolean) => void;
  onRenameDevice: () => void;
  onClose: () => void;
  logout?: () => void;
}

// Multicolor Google "G" logo.
const GoogleIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

type TabType = 'General' | 'Account' | 'Licenses' | 'Security' | 'Remote control' | 'Meeting' | 'Audio conferencing' | 'Video' | 'Custom invitation' | 'Advanced';

export const SnowSettings: React.FC<SnowSettingsProps> = ({
  serverIP,
  isAutoHostEnabled,
  setIsAutoHostEnabled,
  onRenameDevice,
  onClose,
  logout
}) => {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => !!s.user);
  // Google accounts have no local password — it's managed by Google.
  const isGoogleAccount = user?.provider === 'google' || user?.hasPassword === false;
  const [activeTab, setActiveTab] = useState<TabType>('General');
  const [saved, setSaved] = useState(false);

  // Settings states
  const [quality, setQuality] = useState(localStorage.getItem('stream_quality') || 'auto');
  const [notifySession, setNotifySession] = useState(localStorage.getItem('pref_notify_session') !== 'false');
  const [notifyDisconnect, setNotifyDisconnect] = useState(localStorage.getItem('pref_notify_disconnect') !== 'false');
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('pref_sound_enabled') !== 'false');
  const [reducedMotion, setReducedMotion] = useState(localStorage.getItem('reduced_motion') === 'true');
  const [displayName, setDisplayName] = useState(localStorage.getItem('pref_display_name') || user?.name || 'DESKTOP-QT99CCQ');
  const [theme, setTheme] = useState(localStorage.getItem('pref_theme') || 'Light');
  const [insiderBuilds, setInsiderBuilds] = useState(localStorage.getItem('pref_insider_builds') === 'true');
  const [removeWallpaper, setRemoveWallpaper] = useState(localStorage.getItem('pref_remove_wallpaper') === 'true');
  const [showRemoteCursor, setShowRemoteCursor] = useState(localStorage.getItem('pref_show_remote_cursor') !== 'false');
  // Shared "Easy Access / Unattended access" flag (see lib/easyAccess).
  const [grantEasyAccess, setGrantEasyAccess] = useState(() => isEasyAccessEnabled());
  useEffect(() => subscribeEasyAccess(setGrantEasyAccess), []);
  const [logSessions, setLogSessions] = useState(localStorage.getItem('pref_log_sessions') === 'true');
  const [showCommentWindow, setShowCommentWindow] = useState(localStorage.getItem('pref_show_comment') === 'true');
  const [volume, setVolume] = useState(Number(localStorage.getItem('pref_volume')) || 80);
  const [mirrorVideo, setMirrorVideo] = useState(localStorage.getItem('pref_mirror_video') === 'true');
  const [separateGroups, setSeparateGroups] = useState(localStorage.getItem('pref_separate_groups') !== 'false');
  const [notifyIncoming, setNotifyIncoming] = useState(localStorage.getItem('pref_notify_incoming') !== 'false');
  const [notifyPartnerSignIn, setNotifyPartnerSignIn] = useState(localStorage.getItem('pref_notify_partner') !== 'false');
  const [notifyServiceCase, setNotifyServiceCase] = useState(localStorage.getItem('pref_notify_service') !== 'false');
  const [showMarketing, setShowMarketing] = useState(localStorage.getItem('pref_marketing') !== 'false');

  // Random Password strength
  const [pwStrength, setPwStrength] = useState(localStorage.getItem('pref_pw_strength') || '8 characters');

  const savePreferences = () => {
    localStorage.setItem('stream_quality', quality);
    localStorage.setItem('pref_notify_session', String(notifySession));
    localStorage.setItem('pref_notify_disconnect', String(notifyDisconnect));
    localStorage.setItem('pref_sound_enabled', String(soundEnabled));
    localStorage.setItem('reduced_motion', String(reducedMotion));
    localStorage.setItem('pref_display_name', displayName);
    localStorage.setItem('pref_theme', theme);
    localStorage.setItem('pref_insider_builds', String(insiderBuilds));
    localStorage.setItem('pref_pw_strength', pwStrength);
    localStorage.setItem('pref_remove_wallpaper', String(removeWallpaper));
    localStorage.setItem('pref_show_remote_cursor', String(showRemoteCursor));
    localStorage.setItem('pref_log_sessions', String(logSessions));
    localStorage.setItem('pref_show_comment', String(showCommentWindow));
    localStorage.setItem('pref_volume', String(volume));
    localStorage.setItem('pref_mirror_video', String(mirrorVideo));
    localStorage.setItem('pref_separate_groups', String(separateGroups));
    localStorage.setItem('pref_notify_incoming', String(notifyIncoming));
    localStorage.setItem('pref_notify_partner', String(notifyPartnerSignIn));
    localStorage.setItem('pref_notify_service', String(notifyServiceCase));
    localStorage.setItem('pref_marketing', String(showMarketing));
    
    // Apply theme
    if (theme === 'Dark') document.documentElement.classList.add('dark');
    else if (theme === 'Light') document.documentElement.classList.remove('dark');
    else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  // Licenses is billing: visible when the owner allows the licenses page for
  // this member's role and they hold billing:view (owners always do).
  const canSeeLicenses = (user?.features ? (user.features as any).licenses !== false : true)
    && hasUserPermission(user, 'billing:view');
  const tabs: TabType[] = [
    'General',
    'Account',
    ...(canSeeLicenses ? (['Licenses'] as TabType[]) : []),
    'Security',
    'Remote control',
    'Meeting',
    'Audio conferencing',
    'Video',
    'Custom invitation',
    'Advanced',
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Licenses':
        return <LicensesPanel user={user} />;
      case 'General':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-[#1C1C1C]">Most popular options</h2>
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                <Info size={16} />
                <span>Hover your mouse over options to get additional info</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Important options for working with Remote365
              </div>
              <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#1C1C1C]">Your display name</span>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-60 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#1C1C1C]">Choose a theme</span>
                  <select 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-60 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none shadow-sm"
                  >
                    <option>Light</option>
                    <option>Dark</option>
                    <option>System</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-[10px] text-white">?</div>
                  <input 
                    type="checkbox" 
                    checked={insiderBuilds}
                    onChange={(e) => setInsiderBuilds(e.target.checked)}
                    className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0"
                  />
                  <span className="text-xs text-[#1C1C1C]">Receive insider builds</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Network settings
              </div>
              <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#1C1C1C]">Proxy settings</span>
                  <button className="w-48 bg-white border border-[rgba(28,28,28,0.15)] rounded px-4 py-1.5 text-xs font-medium text-[#1C1C1C] hover:bg-[#F9F9FA] transition-colors shadow-sm">Configure...</button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#1C1C1C]">Wake-on-LAN</span>
                  <button className="w-48 bg-white border border-[rgba(28,28,28,0.15)] rounded px-4 py-1.5 text-xs font-medium text-[#1C1C1C] hover:bg-[#F9F9FA] transition-colors shadow-sm">Configure...</button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#1C1C1C]">Incoming LAN connections</span>
                  <select className="w-48 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none opacity-50 cursor-not-allowed shadow-sm">
                    <option>deactivated</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Account assignment
              </div>
              <div className="px-2 space-y-4">
                <p className="text-xs text-[rgba(28,28,28,0.6)] leading-relaxed">
                  By assigning this device to a Remote365 account it can be remotely managed and monitored.
                </p>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1C1C1C]">
                        {user ? `Assigned to: ${user.email}` : 'No assignment yet.'}
                    </span>
                    {!user && (
                        <button className="w-48 bg-white border border-[rgba(28,28,28,0.15)] rounded px-4 py-1.5 text-xs font-medium text-[#1C1C1C] hover:bg-[#F9F9FA] transition-colors shadow-sm">Assign to account...</button>
                    )}
                </div>
              </div>
            </div>
          </div>
        );
      case 'Account':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold text-[#1C1C1C]">Options for your Remote365 account</h2>
            
            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Account settings
              </div>
              
              <div className="flex gap-8 px-2">
                <div className="flex-1 space-y-4">
                  {[
                    { id: 'offline', label: 'Offline computers & contacts in separate group', checked: separateGroups, onChange: setSeparateGroups },
                    { id: 'notify_messages', label: 'Notify me of incoming messages', checked: notifyIncoming, onChange: setNotifyIncoming },
                    { id: 'notify_signin', label: 'Notify me when partners sign in', checked: notifyPartnerSignIn, onChange: setNotifyPartnerSignIn },
                    { id: 'notify_service', label: 'Notify me about service case changes', checked: notifyServiceCase, onChange: setNotifyServiceCase },
                    { id: 'log_sessions', label: 'Log sessions for connection reporting', checked: logSessions, onChange: setLogSessions, info: true },
                    { id: 'show_comment', label: 'Show comment window after each session', checked: showCommentWindow, onChange: setShowCommentWindow, info: true },
                    { id: 'marketing', label: 'Show in-product marketing messages', checked: showMarketing, onChange: setShowMarketing }
                  ].map(item => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      {item.info && <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-[10px] text-white">?</div>}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={item.checked} 
                            onChange={item.onChange ? (e) => item.onChange(e.target.checked) : undefined}
                            className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0" 
                        />
                        <span className="text-xs text-[#1C1C1C]">{item.label}</span>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="w-32 h-32 bg-[#F8F9FA] border border-[rgba(28,28,28,0.1)] rounded-lg flex items-center justify-center shadow-inner">
                  <User size={64} className="text-[rgba(28,28,28,0.1)]" />
                </div>
              </div>

              <div className="space-y-4 pt-6 px-2">
                <div className="grid grid-cols-[120px_1fr] items-center gap-x-6 gap-y-4">
                  <span className="text-xs text-[#1C1C1C]">Your name</span>
                  <input type="text" value={user?.name || ''} readOnly className="bg-white border border-[rgba(28,28,28,0.15)] rounded px-3 py-1.5 text-xs outline-none shadow-sm" />
                  
                  <span className="text-xs text-[#1C1C1C]">Email</span>
                  <input type="text" value={user?.email || ''} readOnly className="bg-white border border-[rgba(28,28,28,0.15)] rounded px-3 py-1.5 text-xs outline-none shadow-sm" />
                  
                  <span className="text-xs text-[#1C1C1C]">Password</span>
                  {isGoogleAccount ? (
                    <div className="flex items-center gap-2 bg-white border border-[rgba(28,28,28,0.15)] rounded px-3 py-1.5 shadow-sm">
                      <GoogleIcon size={15} />
                      <span className="text-xs text-[#1C1C1C]">Signed in with Google</span>
                    </div>
                  ) : (
                    <input type="password" value="********" readOnly className="bg-white border border-[rgba(28,28,28,0.15)] rounded px-3 py-1.5 text-xs outline-none shadow-sm" />
                  )}
                </div>

                <div className="space-y-2 pt-4">
                    <button className="text-xs text-blue-600 hover:underline">Manage two factor authentication</button>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-[#1C1C1C]">Activated license</span>
                        <span className="text-xs font-bold text-[#1C1C1C]">{user?.plan || 'Free'}</span>
                    </div>
                </div>

                <div className="pt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked readOnly className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0" />
                        <span className="text-xs text-[#1C1C1C]">Only partners in my list may see my online status and send messages to me</span>
                    </label>
                </div>
              </div>
            </div>
          </div>
        );
      case 'Security':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold text-[#1C1C1C]">Options for access to this computer</h2>
            
            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Unattended Access
              </div>
              <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-[10px] text-white">?</div>
                        <input
                            type="checkbox"
                            checked={grantEasyAccess}
                            onChange={(e) => { setGrantEasyAccess(e.target.checked); applyEasyAccess(e.target.checked); }}
                            className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0"
                        />
                        <span className="text-xs text-[#1C1C1C]">Grant easy access</span>
                    </label>
                    <button className="w-48 bg-white border border-[rgba(28,28,28,0.15)] rounded px-4 py-1.5 text-xs font-medium text-[#1C1C1C] hover:bg-[#F9F9FA] transition-colors shadow-sm">Configure...</button>
                </div>
                <p className="text-xs text-[rgba(28,28,28,0.6)] leading-relaxed max-w-lg">
                  Easy Access is the recommended way to access your device remotely. To set a personal password instead, go to the Advanced tab.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Random password (for spontaneous access)
              </div>
              <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#1C1C1C]">Password strength</span>
                    <select 
                        value={pwStrength}
                        onChange={(e) => setPwStrength(e.target.value)}
                        className="w-60 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none shadow-sm"
                    >
                        <option>8 characters</option>
                        <option>10 characters</option>
                        <option>Standard (6 characters)</option>
                        <option>Secure (10 characters)</option>
                    </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0" />
                    <span className="text-xs text-[#1C1C1C]">Enable One-Time Access feature</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Rules for connections to this computer
              </div>
              <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#1C1C1C]">Windows logon</span>
                    <select className="w-60 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none shadow-sm">
                        <option>Not allowed</option>
                        <option>Allowed</option>
                    </select>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#1C1C1C]">Block and allowlist</span>
                    <button className="w-48 bg-white border border-[rgba(28,28,28,0.15)] rounded px-4 py-1.5 text-xs font-medium text-[#1C1C1C] hover:bg-[#F9F9FA] transition-colors shadow-sm">Configure...</button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Two-factor authentication for connections
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-[#1C1C1C]">Manage approval devices</span>
                <button className="w-48 bg-white border border-[rgba(28,28,28,0.15)] rounded px-4 py-1.5 text-xs font-medium text-[#1C1C1C] hover:bg-[#F9F9FA] transition-colors shadow-sm">Configure...</button>
              </div>
            </div>
          </div>
        );
      case 'Remote control':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold text-[#1C1C1C]">Options for remote control of other computers</h2>
            
            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Display
              </div>
              <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#1C1C1C]">Quality</span>
                    <select 
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        className="w-60 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none shadow-sm"
                    >
                        <option value="auto">Automatic selection</option>
                        <option value="speed">Optimize speed</option>
                        <option value="quality">Optimize quality</option>
                    </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={removeWallpaper}
                        onChange={(e) => setRemoveWallpaper(e.target.checked)}
                        className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0" 
                    />
                    <span className="text-xs text-[#1C1C1C]">Remove remote wallpaper</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={showRemoteCursor}
                        onChange={(e) => setShowRemoteCursor(e.target.checked)}
                        className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0" 
                    />
                    <span className="text-xs text-[#1C1C1C]">Show remote cursor</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Remote control defaults
              </div>
              <div className="space-y-4 px-2">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked readOnly className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0" />
                    <span className="text-xs text-[#1C1C1C]">Play computer sounds and music</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0" />
                    <span className="text-xs text-[#1C1C1C]">Record partner's video and VOIP</span>
                </label>
              </div>
            </div>
          </div>
        );
      case 'Audio conferencing':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold text-[#1C1C1C]">Options for audio conferencing</h2>
            
            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Voice transmission
              </div>
              <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#1C1C1C]">Microphone</span>
                    <select className="w-60 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none shadow-sm">
                        <option>Default Communication Device</option>
                        <option>Microphone (Realtek High Definition Audio)</option>
                    </select>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#1C1C1C]">Speakers</span>
                    <select className="w-60 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none shadow-sm">
                        <option>Default Communication Device</option>
                        <option>Speakers (Realtek High Definition Audio)</option>
                    </select>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#1C1C1C]">Volume</span>
                    <input 
                        type="range" 
                        min="0" max="100" 
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-60 h-1 bg-[rgba(28,28,28,0.1)] rounded-lg appearance-none cursor-pointer accent-[#0099FF]"
                    />
                </div>
              </div>
            </div>
          </div>
        );
      case 'Video':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold text-[#1C1C1C]">Options for video conferencing</h2>
            
            <div className="space-y-4">
              <div className="bg-[#F1F1F1] px-3 py-1.5 text-[11px] font-bold text-[#1C1C1C] rounded-sm">
                Video
              </div>
              <div className="space-y-4 px-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#1C1C1C]">Camera</span>
                    <select className="w-60 bg-white border border-[rgba(28,28,28,0.2)] rounded px-2 py-1 text-xs outline-none shadow-sm">
                        <option>Integrated Webcam</option>
                        <option>OBS Virtual Camera</option>
                    </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={mirrorVideo}
                        onChange={(e) => setMirrorVideo(e.target.checked)}
                        className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0" 
                    />
                    <span className="text-xs text-[#1C1C1C]">Mirror my video</span>
                </label>
              </div>
              <div className="w-full aspect-video bg-[#F8F9FA] border border-[rgba(28,28,28,0.1)] rounded-lg flex items-center justify-center relative overflow-hidden group">
                  <Video size={48} className="text-[rgba(28,28,28,0.1)] group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-widest">Camera Preview</span>
                  </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-[rgba(28,28,28,0.4)] animate-in fade-in duration-300">
            <Settings size={64} strokeWidth={1} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">Settings for {activeTab} will be available soon.</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 font-['Lato']">
      <div className="bg-white w-full max-w-4xl h-[650px] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border border-[rgba(28,28,28,0.1)]">
        
        {/* Window Title Bar */}
        <div className="bg-[#06113C] px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <img src="/logo.png" className="w-4 h-4 invert" alt="" />
            <span className="text-xs font-bold text-white opacity-90">Remote365 options</span>
          </div>
          <div className="flex items-center">
            <button onClick={onClose} className="text-white/60 hover:text-white hover:bg-red-500 p-1.5 rounded transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 bg-white border-r border-[rgba(28,28,28,0.1)] overflow-y-auto py-2">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-5 py-2.5 text-xs transition-all relative ${
                  activeTab === tab 
                    ? 'bg-[#0099FF] text-white border-y border-dashed border-white/20 font-bold' 
                    : 'text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.05)]'
                }`}
              >
                {activeTab === tab && <div className="absolute inset-0 border border-white/30" />}
                {tab}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-10 bg-white relative custom-scrollbar">
            {renderContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#F8F9FA] border-t border-[rgba(28,28,28,0.1)] px-8 py-4 flex items-center justify-end gap-3">
          <button 
            onClick={savePreferences}
            className="px-8 py-1.5 bg-white border border-[rgba(28,28,28,0.2)] rounded text-xs font-medium text-[#1C1C1C] hover:bg-[#F1F1F1] transition-all min-w-[100px] shadow-sm active:bg-[#E5E5E5]"
          >
            {saved ? 'Saved!' : 'OK'}
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-1.5 bg-white border border-[rgba(28,28,28,0.2)] rounded text-xs font-medium text-[#1C1C1C] hover:bg-[#F1F1F1] transition-all min-w-[100px] shadow-sm active:bg-[#E5E5E5]"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
