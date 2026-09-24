import React, { useState } from 'react';
import { Shield, X, Eye, EyeOff, AlertCircle } from 'lucide-react';

export interface AccessPasswordModalProps {
  open: boolean;
  /** 'set' = first-time (no password yet, hosting blocked); 'change' = rotating an existing password. */
  mode: 'set' | 'change';
  onClose: () => void;
  onSubmit: (password: string) => void;
}

/**
 * Access-password dialog for this device (set on first host / change later),
 * styled to match the Add-remote-device dialog (extracted from App.tsx).
 */
export const AccessPasswordModal: React.FC<AccessPasswordModalProps> = ({ open, mode, onClose, onSubmit }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const isChange = mode === 'change';

  const reset = () => {
    setPassword('');
    setConfirm('');
    setShowPassword(false);
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!password) { setError('Please enter a password.'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    const value = password;
    reset();
    onSubmit(value);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.08)] animate-in zoom-in-95 duration-300">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#FFF4E5] rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-[#FF8A00]" />
            </div>
            <div>
              <h3 className="text-[20px] font-semibold text-[#111315] tracking-tight">
                {isChange ? 'Change Access Password' : 'Set Access Password'}
              </h3>
              <p className="text-[12px] text-[#757575]">
                {isChange ? 'Viewers will need the new password to connect' : 'Required Before This Device Can Host'}
              </p>
            </div>
          </div>
          <button onClick={close} className="p-2 -mr-2 text-gray-400 hover:text-[#111315] rounded-xl hover:bg-[#F9FAFB] transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-[13px] text-[#111315]/70 leading-relaxed mt-4 mb-5">
          {isChange
            ? 'Devices that remembered the old password will be asked to enter the new one before they can connect again.'
            : 'Anyone connecting to this device will be asked for this password. Choose something secure.'}
        </p>

        <div className="space-y-4 mb-5">
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-[#757575] ml-1">{isChange ? 'New Password' : 'Password'}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={isChange ? 'Enter New Password' : 'Create Password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full h-12 px-4 pr-11 bg-[#F9FAFB] border border-gray-200 rounded-xl text-[14px] font-medium focus:border-[#FF8A00] focus:bg-white outline-none transition-all placeholder:text-gray-400"
                autoFocus
              />
              <button
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-[#757575] ml-1">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat Password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              className="w-full h-12 px-4 bg-[#F9FAFB] border border-gray-200 rounded-xl text-[14px] font-medium focus:border-[#FF8A00] focus:bg-white outline-none transition-all placeholder:text-gray-400"
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-[#FEF3F2] px-3 py-2.5 text-[12px] font-medium text-[#D92D20]">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!password || !confirm}
          className={`w-full py-3 rounded-xl text-[14px] font-semibold transition-all ${!password || !confirm
            ? 'bg-[#F0F2F5] text-gray-400 cursor-not-allowed'
            : 'bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] text-black hover:brightness-105'}`}
        >
          {isChange ? 'Change Password' : 'Save & Start Hosting'}
        </button>
      </div>
    </div>
  );
};

export default AccessPasswordModal;
