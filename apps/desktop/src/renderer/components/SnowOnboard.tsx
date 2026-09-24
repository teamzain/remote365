import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  ArrowRight,
  Loader2,
  User
} from 'lucide-react';
import api from '../lib/api';
import logo from '../../logo.png';
import { useAuthStore } from '../store/authStore';

interface SnowOnboardProps {
  token: string;
  onComplete: () => void;
}

export const SnowOnboard: React.FC<SnowOnboardProps> = ({ token, onComplete }) => {
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Full Name Is Required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords Do Not Match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/auth/onboard', { token, password, name });
      
      // Auto-login on success
      if (data.accessToken && data.user) {
        await setAuth(data.user, data.accessToken, data.refreshToken);
      }
      
      setIsSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to complete onboarding. Token may be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white font-lato animate-in fade-in duration-700">
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="w-20 h-20 rounded-[32px] bg-emerald-50 text-emerald-600 flex items-center justify-center mb-8 animate-bounce">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-black text-[#1C1C1C] tracking-tighter mb-4">Welcome to the Team!</h1>
          <p className="text-sm text-[rgba(28,28,28,0.4)] leading-relaxed">
            Your account has been secured. Redirecting you to the dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#F8F9FA] font-lato p-6">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-black/5 border border-[rgba(28,28,28,0.04)] p-10 md:p-12 animate-in zoom-in-95 duration-500">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#1C1C1C] flex items-center justify-center mb-6 shadow-xl shadow-black/10 overflow-hidden">
             <img src={logo} alt="Remote365" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Finalize Your Access</h1>
          <p className="text-sm text-[rgba(28,28,28,0.4)] mt-2">Set a password to join your organization on Remote365.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] ml-1">Full Name</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within:text-[#1C1C1C] transition-colors">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] rounded-[20px] pl-12 pr-4 py-4 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all placeholder:text-[rgba(28,28,28,0.2)]"
                value={name}
                placeholder="Enter Your Name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] ml-1">New Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within:text-[#1C1C1C] transition-colors">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] rounded-[20px] pl-12 pr-12 py-4 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all placeholder:text-[rgba(28,28,28,0.2)]"
                value={password}
                placeholder="At Least 8 Characters"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] ml-1">Confirm Password</label>
            <div className="relative">
               <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)]">
                <ShieldCheck size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] rounded-[20px] pl-12 pr-4 py-4 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all"
                value={confirmPassword}
                placeholder="Repeat Password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-3 animate-in shake duration-300">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-[#1C1C1C] text-white rounded-[20px] font-bold text-sm shadow-xl shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            COMPLETE ONBOARDING
          </button>
        </form>

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-[rgba(28,28,28,0.04)] pt-8">
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold uppercase tracking-widest">
                <Building2 size={10} /> Secure Corporate Invite
            </div>
            <p className="text-[10px] text-[rgba(28,28,28,0.3)] font-medium text-center leading-relaxed italic">
                By joining, you agree to your organization's device management policies and data privacy standards.
            </p>
        </div>
      </div>
    </div>
  );
};
