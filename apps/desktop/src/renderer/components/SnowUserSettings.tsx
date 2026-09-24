import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Key,
  Bell,
  Monitor,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Smartphone,
  Globe,
  Trash2,
  LogOut,
  ChevronRight,
  ShieldCheck,
  QrCode,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  Camera
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function playUISound(type: 'toggle' | 'connect' | 'disconnect' | 'error') {
  if (localStorage.getItem('pref_sound_enabled') === 'false') return;
  try {
    const ctx = new AudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    const configs: Record<string, { freq: number[]; dur: number; wave: OscillatorType }> = {
      toggle:     { freq: [880],        dur: 0.08, wave: 'sine' },
      connect:    { freq: [523, 659],   dur: 0.12, wave: 'sine' },
      disconnect: { freq: [440, 330],   dur: 0.14, wave: 'sine' },
      error:      { freq: [220],        dur: 0.2,  wave: 'sawtooth' },
    };
    const c = configs[type];
    o.type = c.wave;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + c.dur * c.freq.length);
    c.freq.forEach((f, i) => {
      o.frequency.setValueAtTime(f, ctx.currentTime + i * c.dur);
    });
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + c.dur * c.freq.length + 0.05);
    o.onended = () => ctx.close();
  } catch {}
}

// Settings → Notifications: 'pref_windows_notification' is the master switch,
// 'pref_incoming_session_notification' additionally gates session start/end
// alerts (kind: 'session'). Missing keys default to enabled.
export function fireNotification(title: string, body: string, kind: 'general' | 'session' = 'general') {
  if (localStorage.getItem('pref_windows_notification') === 'false') return;
  if (kind === 'session' && localStorage.getItem('pref_incoming_session_notification') === 'false') return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.png', silent: true });
  }
}

interface SnowUserSettingsProps {
  serverIP: string;
  isAutoHostEnabled: boolean;
  setIsAutoHostEnabled: (val: boolean) => void;
  onRenameDevice: () => void;
  logout: () => void;
}

type Tab = 'account' | 'security' | 'preferences' | 'notifications';

export const SnowUserSettings: React.FC<SnowUserSettingsProps> = ({
  serverIP,
  isAutoHostEnabled,
  setIsAutoHostEnabled,
  onRenameDevice,
  logout
}) => {
  const user = useAuthStore(s => s.user);
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // --- Account State ---
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');

  // --- Security State ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [twoFaStatus, setTwoFaStatus] = useState<'idle' | 'loading' | 'verifying' | 'done' | 'error'>('idle');

  // Close Account modal state
  const [showCloseAccountModal, setShowCloseAccountModal] = useState(false);
  const [closeAccountStatus, setCloseAccountStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [closeAccountError, setCloseAccountError] = useState('');

  // --- Preferences State ---
  const [quality, setQuality] = useState(localStorage.getItem('stream_quality') || 'auto');
  const [reducedMotion, setReducedMotion] = useState(localStorage.getItem('reduced_motion') === 'true');

  // --- Notifications State (localStorage-backed so App.tsx can read them) ---
  const [notifySession, setNotifySession] = useState(() => localStorage.getItem('pref_notify_session') !== 'false');
  const [notifyDisconnect, setNotifyDisconnect] = useState(() => localStorage.getItem('pref_notify_disconnect') !== 'false');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('pref_sound_enabled') !== 'false');

  useEffect(() => {
    if (activeTab === 'security') fetchSessions();
  }, [activeTab]);

  const handleCloseAccount = async () => {
    setCloseAccountStatus('loading');
    setCloseAccountError('');
    try {
      await api.delete('/api/auth/me');
      setShowCloseAccountModal(false);
      logout();
    } catch (err: any) {
      console.error('Failed to close account', err);
      setCloseAccountStatus('error');
      setCloseAccountError(err?.response?.data?.error || 'Failed to close account. Please contact support.');
    }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const { data } = await api.get('/api/auth/sessions');
      setSessions(data);
    } catch (e) {
      console.error('Failed to fetch sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleSaveAccount = async () => {
    setSaveStatus('saving');
    try {
      await api.patch('/api/auth/me', { name });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMsg(err.response?.data?.error || 'Update Failed');
    }
  };

  // Google-OAuth accounts have no stored password (/me hasPassword:false) —
  // the form sets a first password and skips the current-password check.
  const hasPassword = user?.hasPassword !== false;

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
        setErrorMsg('Passwords Do Not Match');
        setSaveStatus('error');
        return;
    }
    setSaveStatus('saving');
    try {
      await api.patch('/api/auth/me', hasPassword
        ? { current_password: currentPassword, password: newPassword }
        : { password: newPassword });
      setSaveStatus('saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMsg(err.response?.data?.error || 'Password Update Failed');
    }
  };

  const handleToggle2FA = async () => {
    setShow2FAModal(true);
    setTwoFaStatus('loading');
    try {
      const { data } = await api.post('/api/auth/2fa/enable');
      setQrCode(data.qr_code);
      setTwoFaStatus('idle');
    } catch (err) {
      setTwoFaStatus('error');
    }
  };

  const handleVerify2FA = async () => {
    setTwoFaStatus('verifying');
    try {
      await api.post('/api/auth/2fa/verify', { code: totpCode });
      setTwoFaStatus('done');
      setTimeout(() => { setShow2FAModal(false); setTwoFaStatus('idle'); }, 1500);
    } catch (err) {
      setTwoFaStatus('error');
    }
  };

  const savePref = (key: string, val: any) => {
    localStorage.setItem(key, String(val));
    if (key === 'stream_quality') setQuality(val);
    if (key === 'reduced_motion') {
      setReducedMotion(val);
      document.documentElement.classList.toggle('reduce-motion', val);
    }
  };

  // Apply persisted reduced motion on mount
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, []);

  const toggleNotify = async (key: string, val: boolean) => {
    if (key === 'session') {
      setNotifySession(val);
      localStorage.setItem('pref_notify_session', String(val));
      if (val && Notification.permission === 'default') Notification.requestPermission();
    }
    if (key === 'disconnect') {
      setNotifyDisconnect(val);
      localStorage.setItem('pref_notify_disconnect', String(val));
      if (val && Notification.permission === 'default') Notification.requestPermission();
    }
    if (key === 'sound') {
      setSoundEnabled(val);
      localStorage.setItem('pref_sound_enabled', String(val));
      if (val) playUISound('toggle');
    }
    try {
      const apiKey = key === 'session' ? 'notify_session_alert' : key === 'disconnect' ? 'notify_disconnect_alert' : 'notify_sound_effects';
      await api.patch('/api/auth/me', { [apiKey]: val }).catch(() => {});
    } catch {}
  };

  const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
    <button 
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full transition-colors relative ${checked ? 'bg-[#1C1C1C]' : 'bg-[rgba(28,28,28,0.1)]'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'left-5' : 'left-1'}`} />
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto font-lato animate-in fade-in duration-500 pb-20">
      
      {/* Profile Mini Header */}
      <div className="flex items-center gap-6 mb-10 p-6 bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] shadow-sm">
        <div className="relative group cursor-pointer">
          <div className="w-20 h-20 rounded-[28px] bg-[rgba(28,28,28,0.04)] flex items-center justify-center text-2xl font-bold border-2 border-white shadow-sm overflow-hidden">
             {(name || user?.email || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#1C1C1C] text-white rounded-xl flex items-center justify-center border-2 border-white group-hover:scale-110 transition-transform">
            <Camera size={12} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1C1C1C] tracking-tight">{name || email}</h1>
          <p className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mt-1 flex items-center gap-2">
            <Shield size={12} className="text-[#D4A017]" />
            {user?.role?.replace('_', ' ')}
            {user?.role !== 'SUPER_ADMIN' && ` · ${user?.plan} Plan`}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-[rgba(28,28,28,0.03)] p-1 rounded-2xl mb-8 border border-[rgba(28,28,28,0.02)]">
        {(['account', 'security', 'preferences', 'notifications'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${activeTab === t ? 'bg-white text-[#1C1C1C] shadow-sm' : 'text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        
        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm space-y-6 animate-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Full Name</label>
                   <input 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-3 text-sm font-semibold text-[#1C1C1C] outline-none focus:border-[rgba(28,28,28,0.2)]"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Email Address</label>
                   <input 
                    value={email} 
                    disabled
                    className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-3 text-sm font-semibold text-[rgba(28,28,28,0.4)] cursor-not-allowed outline-none"
                   />
                </div>
             </div>
             <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleSaveAccount}
                  disabled={saveStatus === 'saving'}
                  className="px-8 py-3 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-black/5"
                >
                  {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin" /> : saveStatus === 'saved' ? <Check size={14} /> : null}
                  {saveStatus === 'saved' ? 'Saved' : 'Update Profile'}
                </button>
             </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            {/* Password Section */}
            <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
               <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 flex items-center gap-2 uppercase tracking-tight">
                  <Key size={16} className="text-purple-500" /> Password Protection
               </h3>
               {!hasPassword && (
                 <p className="mb-4 text-[11px] font-medium text-[rgba(28,28,28,0.45)]">You signed in with Google — set a password to also sign in with email and password.</p>
               )}
               <div className={`grid grid-cols-1 gap-4 ${hasPassword ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {hasPassword && (
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-2.5 text-sm font-medium outline-none"
                  />
                  )}
                  <input 
                    type={showPw ? "text" : "password"} 
                    placeholder="New Password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-2.5 text-sm font-medium outline-none"
                  />
                  <input 
                    type={showPw ? "text" : "password"} 
                    placeholder="Confirm New" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-2.5 text-sm font-medium outline-none"
                  />
               </div>
               <div className="mt-6 flex items-center justify-between">
                  <button onClick={() => setShowPw(!showPw)} className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] uppercase tracking-widest flex items-center gap-2">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />} {showPw ? "Hide" : "Show"} Passwords
                  </button>
                  <button onClick={handleChangePassword} className="px-6 py-2.5 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold hover:opacity-90">{hasPassword ? 'Update Password' : 'Set Password'}</button>
               </div>
            </div>

            {/* 2FA Section */}
            <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm flex items-center justify-between">
               <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${user?.is_2fa_enabled ? 'bg-green-50 text-green-500' : 'bg-[#F9F9FA] text-[rgba(28,28,28,0.2)]'}`}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1C1C1C]">Two-Factor Authentication</h4>
                    <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">{user?.is_2fa_enabled ? "Your account is secured with TOTP." : "Add an extra layer of security to your account."}</p>
                  </div>
               </div>
               <button 
                onClick={handleToggle2FA}
                disabled={user?.is_2fa_enabled}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${user?.is_2fa_enabled ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-[#1C1C1C] text-white shadow-lg shadow-black/5'}`}
               >
                 {user?.is_2fa_enabled ? "Enabled" : "Enable 2FA"}
               </button>
            </div>

            {/* Sessions Section */}
            <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-bold text-[#1C1C1C] flex items-center gap-2 uppercase tracking-tight">
                    <Globe size={16} className="text-blue-500" /> Active Sessions
                  </h3>
                  <button onClick={fetchSessions} className="p-2 text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] transition-colors"><RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} /></button>
               </div>
               <div className="space-y-3">
                  {sessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)]">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[rgba(28,28,28,0.3)] shadow-sm">
                             {s.userAgent.includes('Mobile') ? <Smartphone size={18} /> : <Monitor size={18} />}
                          </div>
                          <div>
                             <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#1C1C1C]">{s.ip}</span>
                                {s.isCurrent && <span className="px-1.5 py-0.5 bg-amber-50 text-[#D4A017] text-[8px] font-bold uppercase rounded-md tracking-wider">Current</span>}
                             </div>
                             <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mt-0.5">{s.userAgent}</p>
                          </div>
                       </div>
                       {!s.isCurrent && (
                         <button className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                       )}
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
             <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
                <h3 className="text-sm font-bold text-[#1C1C1C] mb-8 flex items-center gap-2 uppercase tracking-tight">
                   <Monitor size={16} className="text-orange-500" /> App Experience
                </h3>
                <div className="space-y-6">
                   <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
                      <div>
                        <span className="font-bold text-sm text-[#1C1C1C]">Auto-Host On Launch</span>
                        <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Automatically start broadcasting this device when app starts</p>
                      </div>
                      <Toggle checked={isAutoHostEnabled} onChange={setIsAutoHostEnabled} />
                   </div>
                   <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
                      <div>
                        <span className="font-bold text-sm text-[#1C1C1C]">Reduced Motion</span>
                        <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Disable animations and transitions for better performance</p>
                      </div>
                      <Toggle checked={reducedMotion} onChange={v => savePref('reduced_motion', v)} />
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
                <h3 className="text-sm font-bold text-[#1C1C1C] mb-8 flex items-center gap-2 uppercase tracking-tight">
                   <Smartphone size={16} className="text-green-500" /> Streaming Quality
                </h3>
                <div className="grid grid-cols-4 gap-3">
                   {['auto', 'high', 'medium', 'low'].map(q => (
                     <button 
                        key={q}
                        onClick={() => savePref('stream_quality', q)}
                        className={`p-4 rounded-2xl border transition-all ${quality === q ? 'bg-[#1C1C1C] text-white shadow-xl shadow-black/10' : 'bg-[#F9F9FA] text-[#1C1C1C] hover:border-[rgba(28,28,28,0.2)]'}`}
                      >
                        <span className="text-xs font-bold uppercase block">{q}</span>
                        <span className={`text-[9px] mt-1 block font-medium ${quality === q ? 'text-white/40' : 'text-[rgba(28,28,28,0.3)]'}`}>
                           {q === 'auto' ? 'Adaptive' : q === 'high' ? '4K / 60FPS' : q === 'medium' ? '1080P' : '720P'}
                        </span>
                     </button>
                   ))}
                </div>
             </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
           <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm space-y-6 animate-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-sm font-bold text-[#1C1C1C] mb-8 flex items-center gap-2 uppercase tracking-tight">
                 <Bell size={16} className="text-blue-500" /> Notification Alerts
              </h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
                    <div>
                      <span className="font-bold text-sm text-[#1C1C1C]">Session Connection</span>
                      <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Alert me when someone connects to this device</p>
                    </div>
                    <Toggle checked={notifySession} onChange={v => toggleNotify('session', v)} />
                 </div>
                 <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
                    <div>
                      <span className="font-bold text-sm text-[#1C1C1C]">Unexpected Disconnect</span>
                      <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Notify if a remote session ends abruptly</p>
                    </div>
                    <Toggle checked={notifyDisconnect} onChange={v => toggleNotify('disconnect', v)} />
                 </div>
                 <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[rgba(28,28,28,0.2)] shadow-sm">
                          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                       </div>
                       <div>
                        <span className="font-bold text-sm text-[#1C1C1C]">Interface Sounds</span>
                        <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Play audio cues for app events and alerts</p>
                       </div>
                    </div>
                    <Toggle checked={soundEnabled} onChange={v => toggleNotify('sound', v)} />
                 </div>
              </div>
           </div>
        )}

      </div>

      {/* Danger Zone */}
      <div className="mt-12 p-8 bg-red-50/30 border border-red-100 rounded-[32px] flex items-center justify-between">
         <div>
            <h4 className="text-sm font-bold text-red-600">Danger Zone</h4>
            <p className="text-[11px] font-medium text-red-400 mt-1">Revoke all access keys and permanently close your account.</p>
         </div>
         <button
            onClick={() => { setShowCloseAccountModal(true); setCloseAccountStatus('idle'); setCloseAccountError(''); }}
            className="px-6 py-2.5 bg-white border border-red-100 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-all flex items-center gap-2"
         >
            <LogOut size={14} /> Close Account
         </button>
      </div>

      {/* Close Account Confirmation Modal */}
      {showCloseAccountModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#1C1C1C]/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[28px] shadow-2xl border border-[rgba(28,28,28,0.06)] p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertCircle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1C1C1C]">Close Account</h3>
                <p className="text-[10px] text-[rgba(28,28,28,0.4)]">This action is permanent and irreversible</p>
              </div>
            </div>
            <p className="text-xs text-[rgba(28,28,28,0.6)] leading-relaxed mb-6">
              This will permanently delete your organization, all team members and subordinate accounts, all registered devices, and all session history. You cannot undo this.
            </p>
            {closeAccountError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 mb-4">
                <AlertCircle size={13} className="text-red-500 shrink-0" />
                <span className="text-[11px] text-red-600 font-medium">{closeAccountError}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseAccountModal(false)}
                disabled={closeAccountStatus === 'loading'}
                className="flex-1 py-2.5 rounded-xl border border-[rgba(28,28,28,0.1)] text-xs font-bold text-[#1C1C1C] hover:bg-[#F9F9FA] transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseAccount}
                disabled={closeAccountStatus === 'loading'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {closeAccountStatus === 'loading' && <Loader2 size={13} className="animate-spin" />}
                {closeAccountStatus === 'loading' ? 'Deleting…' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-200">
           <div className="w-full max-w-sm bg-white rounded-[28px] shadow-2xl border border-[rgba(28,28,28,0.06)] p-8 animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
                <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center"><QrCode size={18} className="text-green-500" /></div>
                <button onClick={() => setShow2FAModal(false)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors"><X size={18} /></button>
             </div>
             
             {twoFaStatus === 'loading' ? (
                <div className="py-12 flex justify-center"><Loader2 size={32} className="animate-spin text-[rgba(28,28,28,0.1)]" /></div>
             ) : twoFaStatus === 'done' ? (
                <div className="text-center py-8">
                   <div className="w-14 h-14 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={28} /></div>
                   <h4 className="font-bold text-[#1C1C1C]">2FA Activated</h4>
                   <p className="text-xs text-[rgba(28,28,28,0.4)] mt-1">Your account is now more secure.</p>
                </div>
             ) : (
                <>
                  <h3 className="text-lg font-bold text-[#1C1C1C] mb-1">Setup 2FA</h3>
                  <p className="text-[11px] text-[rgba(28,28,28,0.4)] mb-6 leading-relaxed">Scan this QR with Google Authenticator or Authy, then enter the 6-digit code.</p>
                  <div className="flex justify-center mb-6">
                     <div className="p-3 bg-white border-2 border-[rgba(28,28,28,0.04)] rounded-2xl shadow-sm">
                        <img src={qrCode} alt="2FA QR" className="w-40 h-40" />
                     </div>
                  </div>
                  <input 
                    maxLength={6}
                    placeholder="000 000"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-2xl px-4 py-4 text-center text-3xl font-mono font-bold tracking-[0.2em] outline-none focus:border-[rgba(28,28,28,0.2)] mb-4"
                  />
                  <button 
                    onClick={handleVerify2FA}
                    disabled={totpCode.length !== 6 || twoFaStatus === 'verifying'}
                    className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
                  >
                    {twoFaStatus === 'verifying' && <Loader2 size={16} className="animate-spin" />}
                    {twoFaStatus === 'verifying' ? 'Verifying...' : 'Complete Setup'}
                  </button>
                </>
             )}
           </div>
        </div>
      )}

    </div>
  );
};
