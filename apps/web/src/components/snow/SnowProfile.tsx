import React, { useState } from 'react';
import {
  User,
  Shield,
  Key,
  Camera,
  MapPin,
  ChevronRight,
  LogOut,
  Bell,
  Lock,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  QrCode,
  X
} from 'lucide-react';
import api from '../../lib/api';

export const SnowProfile: React.FC<{ user: any; logout: () => void }> = ({ user, logout }) => {
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  // Google-OAuth accounts have no password yet (/me returns hasPassword:false):
  // the form becomes "set a password" — no current-password field, and the
  // backend accepts the first set without one.
  const hasPassword = user?.hasPassword !== false;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pwError, setPwError] = useState('');

  // Notification & 2FA state
  const [notifySessionAlert, setNotifySessionAlert] = useState(user?.notify_session_alert ?? true);
  const [notifyDisconnectAlert, setNotifyDisconnectAlert] = useState(user?.notify_disconnect_alert ?? true);
  const [notifySoundEffects, setNotifySoundEffects] = useState(user?.notify_sound_effects ?? true);
  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.is_2fa_enabled ?? false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [twoFaStatus, setTwoFaStatus] = useState<'idle' | 'loading' | 'verifying' | 'done' | 'error'>('idle');
  const [twoFaError, setTwoFaError] = useState('');

  // Close Account modal state
  const [showCloseAccountModal, setShowCloseAccountModal] = useState(false);
  const [closeAccountStatus, setCloseAccountStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [closeAccountError, setCloseAccountError] = useState('');

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    setSaveStatus('saving');
    setSaveError('');
    try {
      await api.patch('/api/auth/me', { name: name.trim() });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.response?.data?.error || 'Failed to save changes');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleChangePassword = async () => {
    if ((hasPassword && !currentPassword) || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      setPwStatus('error');
      setTimeout(() => setPwStatus('idle'), 3000);
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters');
      setPwStatus('error');
      setTimeout(() => setPwStatus('idle'), 3000);
      return;
    }
    setPwStatus('saving');
    setPwError('');
    try {
      await api.patch('/api/auth/me', hasPassword
        ? { current_password: currentPassword, password: newPassword }
        : { password: newPassword });
      setPwStatus('saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setPwStatus('idle'); setShowPasswordSection(false); }, 2500);
    } catch (err: any) {
      setPwStatus('error');
      setPwError(err?.response?.data?.error || 'Failed to update password');
      setTimeout(() => setPwStatus('idle'), 3000);
    }
  };

  const handleToggleNotification = async (key: string, val: boolean) => {
    // Optimistic update
    if (key === 'notify_session_alert') setNotifySessionAlert(val);
    if (key === 'notify_disconnect_alert') setNotifyDisconnectAlert(val);
    if (key === 'notify_sound_effects') setNotifySoundEffects(val);

    try {
      await api.patch('/api/auth/me', { [key]: val });
    } catch (err) {
      console.error('Failed to update notification setting', err);
      // Rollback
      if (key === 'notify_session_alert') setNotifySessionAlert(!val);
      if (key === 'notify_disconnect_alert') setNotifyDisconnectAlert(!val);
      if (key === 'notify_sound_effects') setNotifySoundEffects(!val);
    }
  };

  const handleEnable2FA = async () => {
    setShow2FAModal(true);
    setTwoFaStatus('loading');
    setTwoFaError('');
    try {
      const { data } = await api.post('/api/auth/2fa/enable');
      setQrCode(data.qr_code);
      setTwoFaStatus('idle');
    } catch (err: any) {
      setTwoFaError(err?.response?.data?.error || 'Failed to generate QR code');
      setTwoFaStatus('error');
    }
  };

  const handleVerify2FA = async () => {
    if (!totpCode.trim()) return;
    setTwoFaStatus('verifying');
    setTwoFaError('');
    try {
      await api.post('/api/auth/2fa/verify', { code: totpCode });
      setIs2FAEnabled(true);
      setTwoFaStatus('done');
      setTimeout(() => { setShow2FAModal(false); setTotpCode(''); setTwoFaStatus('idle'); }, 1800);
    } catch (err: any) {
      setTwoFaError(err?.response?.data?.error || 'Invalid code. Try again.');
      setTwoFaStatus('error');
    }
  };

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

  const planLabel = user?.plan || 'FREE';

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700 font-lato pb-20">

      {/* Profile Header Card */}
      <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] -mr-32 -mt-32 rounded-full" />

        <div className="relative group">
          <div className="w-24 h-24 rounded-[32px] bg-[rgba(28,28,28,0.04)] flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
            {user?.avatar
              ? <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
              : <div className="text-2xl font-bold text-[#1C1C1C]">{(name || email || 'U').slice(0, 2).toUpperCase()}</div>}
          </div>
          <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-[#1C1C1C] text-white flex items-center justify-center border-2 border-white hover:scale-105 transition-transform">
            <Camera size={14} />
          </button>
        </div>

        <div className="flex flex-col text-center md:text-left">
          <h1 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2">{name || email}</h1>
          <div className="flex items-center justify-center md:justify-start gap-4 text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><Shield size={12} className="text-blue-500" /> {planLabel} Plan</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[rgba(28,28,28,0.1)]" />
            <span className="flex items-center gap-1.5"><MapPin size={12} /> Global Nodes</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Personal Information */}
        <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight flex items-center gap-2">
            <User size={16} className="text-blue-500" /> Personal Details
          </h3>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.02)]">
              <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase">Display Name</span>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setSaveStatus('idle'); }}
                className="bg-transparent text-sm font-semibold text-[#1C1C1C] outline-none"
                placeholder="Your name"
              />
            </div>
            <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.02)]">
              <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase">Email Address</span>
              <span className="text-sm font-semibold text-[#1C1C1C] leading-none py-1 opacity-60">{email}</span>
            </div>
            <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.02)]">
              <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase">Member Since</span>
              <span className="text-sm font-semibold text-[#1C1C1C] leading-none py-1">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'March 2026'}
              </span>
            </div>
          </div>

          {saveStatus === 'error' && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <span className="text-[11px] text-red-600 font-medium">{saveError}</span>
            </div>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={saveStatus === 'saving' || !name.trim()}
            className="mt-5 w-full h-10 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
          >
            {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin" />}
            {saveStatus === 'saved' && <Check size={14} />}
            {saveStatus === 'saved' ? 'Saved!' : saveStatus === 'saving' ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Security */}
        <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm">
          <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight flex items-center gap-2">
            <Lock size={16} className="text-purple-500" /> Security
          </h3>

          <div className="flex flex-col gap-3">
            <div
              onClick={() => setShowPasswordSection(v => !v)}
              className="flex items-center justify-between p-3.5 hover:bg-[#F9F9FA] rounded-xl border border-transparent hover:border-[rgba(28,28,28,0.04)] transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,0,0,0.02)] flex items-center justify-center text-[rgba(28,28,28,0.3)] group-hover:text-black">
                  <Key size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#1C1C1C]">Password Protection</span>
                  <span className="text-[10px] text-[rgba(28,28,28,0.4)]">Change your account password</span>
                </div>
              </div>
              <ChevronRight size={14} className={`text-[rgba(28,28,28,0.2)] transition-transform ${showPasswordSection ? 'rotate-90' : ''}`} />
            </div>

            {showPasswordSection && (
              <div className="px-2 pb-2 space-y-3 animate-in slide-in-from-top-2 duration-200">
                {!hasPassword && (
                  <p className="text-[11px] font-medium text-[rgba(28,28,28,0.45)]">You signed in with Google — set a password to also sign in with email and password.</p>
                )}
                {hasPassword && (
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={e => { setCurrentPassword(e.target.value); setPwStatus('idle'); }}
                    className="w-full px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.06)] text-sm font-medium text-[#1C1C1C] outline-none pr-10"
                  />
                  <button onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]">
                    {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                )}
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    placeholder="New password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPwStatus('idle'); }}
                    className="w-full px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.06)] text-sm font-medium text-[#1C1C1C] outline-none pr-10"
                  />
                  <button onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]">
                    {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setPwStatus('idle'); }}
                  className="w-full px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.06)] text-sm font-medium text-[#1C1C1C] outline-none"
                />
                {pwStatus === 'error' && (
                  <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle size={13} className="text-red-500 shrink-0" />
                    <span className="text-[10px] text-red-600 font-medium">{pwError}</span>
                  </div>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={pwStatus === 'saving' || (hasPassword && !currentPassword) || !newPassword || !confirmPassword}
                  className="w-full h-9 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                >
                  {pwStatus === 'saving' && <Loader2 size={13} className="animate-spin" />}
                  {pwStatus === 'saved' && <Check size={13} />}
                  {pwStatus === 'saved' ? 'Password Updated!' : pwStatus === 'saving' ? 'Updating…' : hasPassword ? 'Update Password' : 'Set Password'}
                </button>
              </div>
            )}

            {/* Notifications Section */}
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center gap-2 mb-1">
                <Bell size={14} className="text-orange-400" />
                <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Notifications</span>
              </div>

              {/* New Session Alert */}
              <div className="flex items-center justify-between p-3.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.04)]">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#1C1C1C]">New Session Alert</span>
                  <span className="text-[10px] text-[rgba(28,28,28,0.4)]">Notify when a viewer connects to this device</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifySessionAlert} onChange={e => handleToggleNotification('notify_session_alert', e.target.checked)} />
                  <div className="w-9 h-5 bg-[rgba(28,28,28,0.1)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1C1C1C]" />
                </label>
              </div>

              {/* Disconnect Alert */}
              <div className="flex items-center justify-between p-3.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.04)]">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#1C1C1C]">Disconnect Alert</span>
                  <span className="text-[10px] text-[rgba(28,28,28,0.4)]">Notify when a remote session ends unexpectedly</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifyDisconnectAlert} onChange={e => handleToggleNotification('notify_disconnect_alert', e.target.checked)} />
                  <div className="w-9 h-5 bg-[rgba(28,28,28,0.1)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1C1C1C]" />
                </label>
              </div>

              {/* Sound Effects */}
              <div className="flex items-center justify-between p-3.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.04)]">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#1C1C1C]">Sound Effects</span>
                  <span className="text-[10px] text-[rgba(28,28,28,0.4)]">Play audio cues for connection events</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifySoundEffects} onChange={e => handleToggleNotification('notify_sound_effects', e.target.checked)} />
                  <div className="w-9 h-5 bg-[rgba(28,28,28,0.1)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1C1C1C]" />
                </label>
              </div>
            </div>

            {/* 2FA Status */}
            <div className="flex items-center justify-between p-3.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.04)]">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${is2FAEnabled ? 'bg-green-50 text-green-500' : 'bg-white text-[rgba(28,28,28,0.3)]'}`}>
                  <Shield size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#1C1C1C]">Two-Factor Authentication</span>
                  <span className={`text-[10px] font-medium ${is2FAEnabled ? 'text-green-500' : 'text-[rgba(28,28,28,0.4)]'}`}>
                    {is2FAEnabled ? 'Enabled — TOTP Active' : 'Not configured — click to enable'}
                  </span>
                </div>
              </div>
              {is2FAEnabled ? (
                <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[9px] font-bold uppercase tracking-wider border border-green-100">Active</span>
              ) : (
                <button onClick={handleEnable2FA} className="px-3 py-1.5 bg-[#1C1C1C] text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all">
                  Enable
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center px-4 py-3 bg-[#FFF5F5] border border-red-50 rounded-2xl">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-red-600">Danger Zone</span>
          <span className="text-[10px] text-red-400">Permanently remove all your nodes and account data.</span>
        </div>
        <button
          onClick={() => { setShowCloseAccountModal(true); setCloseAccountStatus('idle'); setCloseAccountError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors shadow-sm"
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

      {/* 2FA Setup Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[28px] shadow-2xl border border-[rgba(28,28,28,0.06)] p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center"><QrCode size={18} className="text-green-500" /></div>
                <div>
                  <h3 className="text-sm font-bold text-[#1C1C1C]">Enable Two-Factor Auth</h3>
                  <p className="text-[10px] text-[rgba(28,28,28,0.4)]">Scan with an authenticator app</p>
                </div>
              </div>
              <button onClick={() => { setShow2FAModal(false); setTotpCode(''); setTwoFaStatus('idle'); }} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] rounded-xl hover:bg-[#F9F9FA] transition-colors">
                <X size={16} />
              </button>
            </div>

            {twoFaStatus === 'loading' && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} className="animate-spin text-[rgba(28,28,28,0.2)]" />
              </div>
            )}

            {twoFaStatus === 'done' && (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={24} className="text-green-500" />
                </div>
                <h4 className="text-sm font-bold text-[#1C1C1C] mb-1">2FA Enabled!</h4>
                <p className="text-xs text-[rgba(28,28,28,0.4)]">Your account is now protected.</p>
              </div>
            )}

            {(twoFaStatus === 'idle' || twoFaStatus === 'verifying' || twoFaStatus === 'error') && qrCode && (
              <>
                <div className="flex justify-center mb-5">
                  <div className="p-3 bg-white border-2 border-[rgba(28,28,28,0.06)] rounded-2xl">
                    <img src={qrCode} alt="2FA QR Code" className="w-40 h-40" />
                  </div>
                </div>
                <p className="text-[11px] text-[rgba(28,28,28,0.5)] text-center mb-5 leading-relaxed">
                  Scan with <strong>Google Authenticator</strong>, Authy, or any TOTP app. Then enter the 6-digit code.
                </p>
                <input
                  value={totpCode}
                  onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTwoFaError(''); }}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.06)] text-center text-lg font-mono font-bold text-[#1C1C1C] outline-none tracking-[0.3em] mb-3"
                  maxLength={6}
                />
                {twoFaError && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle size={13} className="text-red-500 shrink-0" />
                    <span className="text-[11px] text-red-600 font-medium">{twoFaError}</span>
                  </div>
                )}
                <button
                  onClick={handleVerify2FA}
                  disabled={totpCode.length !== 6 || twoFaStatus === 'verifying'}
                  className="w-full py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                >
                  {twoFaStatus === 'verifying' && <Loader2 size={14} className="animate-spin" />}
                  {twoFaStatus === 'verifying' ? 'Verifying…' : 'Activate 2FA'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
