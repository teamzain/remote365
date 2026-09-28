import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-react';
import logoAsset from '../../assets/logo.png';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import AuthResultModal, { type AuthResultState } from '../../components/auth/AuthResultModal';
import { Languages, ChevronDown, CircleHelp } from 'lucide-react';
import { ta } from '../../lib/authTranslations';
import { BusinessSignupSteps, BusinessStepper } from '../../components/auth/BusinessSignupSteps';
import { hasErrors, validateBusiness, validateBusinessEmail, validateCompanyStep } from '../../lib/businessValidation';
import { oauthStartUrl, persistRememberMe, rememberedEmail, rememberMeDefault, signInFailure, twoFactorFailure } from '../../lib/signIn';

const logo = logoAsset.src;

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const ORANGE_GRADIENT = 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)';
const MONA = "'Mona Sans', system-ui, sans-serif";

const inputClass =
  'w-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-[16px] py-[8px] text-[14px] focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]';

interface AuthScreenProps {
  initialMode?: AuthMode;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ initialMode = 'login' }) => {
  const navigate = useNavigate();
  const {
    login: storeLogin,
    register: storeRegister,
    requestVerification: storeRequestVerification,
    verify2fa: storeVerify2fa,
    start2faSetup,
    temp2faToken,
    temp2faSetup,
    setTemp2faToken,
    accessToken,
  } = useAuthStore();

  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  // Sign-in / sign-up outcome shown as an animated modal (tick or cross).
  const [authResult, setAuthResult] = useState<AuthResultState | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Language picker (same list as Settings). Signed out it is remembered
  // locally; the store applies it to the account after sign-in.
  const LANGUAGE_OPTIONS = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'German' },
    { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
  ];
  const [language, setLanguageChoice] = useState(() => {
    try { const stored = localStorage.getItem('pref_language') || 'en'; return LANGUAGE_OPTIONS.some((o) => o.value === stored) ? stored : 'en'; } catch { return 'en'; }
  });
  const [showLanguages, setShowLanguages] = useState(false);
  const chooseLanguage = (value: string) => {
    setLanguageChoice(value);
    setShowLanguages(false);
    try { localStorage.setItem('pref_language', value); } catch { /* storage unavailable */ }
    try {
      document.documentElement.lang = value;
      document.documentElement.dir = value === 'ar-SA' ? 'rtl' : 'ltr';
    } catch { /* not in a document */ }
  };
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(rememberMeDefault);

  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  // Sign-up account type. Business asks for company details and a company email.
  const [signupAccountType, setSignupAccountType] = useState<'personal' | 'business'>('personal');
  const [business, setBusiness] = useState({ companyName: '', businessNumber: '', website: '', country: '', state: '', city: '', addressLine: '', postalCode: '' });
  const [businessStep, setBusinessStep] = useState(1);
  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get('oauthError');
    if (!oauthError) return;
    setSignupAccountType('business');
    setBusinessStep(3);
    setAuthError(oauthError);
    setAuthResult({ kind: 'error', title: 'Company email required', message: oauthError });
    window.history.replaceState({}, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const updateBusiness = (key: keyof typeof business, value: string) => setBusiness((current) => ({ ...current, [key]: value }));
  const businessExtras = () => (signupAccountType === 'business' ? { accountType: 'business', ...business } : {});
  const businessMissing = () => signupAccountType === 'business' && hasErrors(validateBusiness(business));

  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 2FA
  const [totpCode, setTotpCode] = useState('');
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [isVerifying2fa, setIsVerifying2fa] = useState(false);
  // Required 2FA setup: the QR code to scan before the first code is entered.
  const [setupQr, setSetupQr] = useState<string | null>(null);
  useEffect(() => {
    if (!temp2faToken || !temp2faSetup) { setSetupQr(null); return; }
    let cancelled = false;
    start2faSetup()
      .then((qr) => { if (!cancelled) setSetupQr(qr || null); })
      .catch((err: any) => { if (!cancelled) setTwoFaError(err?.response?.data?.error || 'Could not start the two-factor setup. Sign in again.'); });
    return () => { cancelled = true; };
  }, [temp2faToken, temp2faSetup, start2faSetup]);

  // Already signed in → straight to the dashboard. Held while a sign-in
  // just succeeded, so the animated tick gets its moment on screen before
  // the auth screen unmounts; the modal closing releases it.
  const holdRedirectRef = useRef(false);
  useEffect(() => {
    if (accessToken && !holdRedirectRef.current) navigate('/dashboard');
  }, [accessToken, navigate]);

  const goDashboard = () => navigate('/dashboard');
  const closeAuthResult = () => {
    const wasSuccess = authResult?.kind === 'success';
    setAuthResult(null);
    holdRedirectRef.current = false;
    if (wasSuccess && useAuthStore.getState().accessToken) goDashboard();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      holdRedirectRef.current = true;
      const result = await storeLogin(email, password);
      persistRememberMe(email, rememberMe);
      if (result?.twoFactorRequired) { holdRedirectRef.current = false; return; } // store sets temp2faToken → 2FA panel shows
      setAuthResult({ kind: 'success', title: 'Signed in', message: 'Welcome back. Loading your dashboard.' });
    } catch (err: any) {
      holdRedirectRef.current = false;
      const failure = signInFailure(err);
      setAuthResult({ kind: 'error', ...failure });
      setAuthError(failure.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    if (!isAwaitingVerification) {
      if (!email.trim()) {
        setAuthError('Email is required.');
        setLoading(false);
        return;
      }
      if (!password || password.length < 8) {
        setAuthError('Password must be at least 8 characters.');
        setLoading(false);
        return;
      }
      if (businessMissing()) {
        setAuthError(ta('completeSteps', language));
        setBusinessStep(hasErrors(validateCompanyStep(business)) ? 1 : 2);
        setLoading(false);
        return;
      }
      if (signupAccountType === 'business') {
        const emailProblem = validateBusinessEmail(email);
        if (emailProblem) { setAuthError(emailProblem); setLoading(false); return; }
      }
      try {
        await storeRequestVerification(email, businessExtras());
        setIsAwaitingVerification(true);
      } catch (err: any) {
        setAuthError(err.response?.data?.error || 'Could not send verification code.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!verificationCode || verificationCode.length !== 6) {
        setAuthError('Please enter a valid 6-digit verification code.');
        setLoading(false);
        return;
      }
      try {
        const fallbackName =
          email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Remote365 User';
        holdRedirectRef.current = true;
        await storeRegister(fallbackName, email, password, verificationCode, businessExtras());
        setIsAwaitingVerification(false);
        setVerificationCode('');
        setAuthResult({ kind: 'success', title: 'Account created', message: 'Welcome to Remote365.' });
      } catch (err: any) {
        holdRedirectRef.current = false;
        const failure = err.response?.data?.error || 'Could not create account. Please try again.';
        setAuthResult({ kind: 'error', title: 'Sign up failed', message: failure });
        setAuthError(failure);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetMsg('');
    const targetEmail = (resetEmail || email).trim().toLowerCase();
    if (!targetEmail) {
      setAuthError('Enter your account email first.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/password/forgot', { email: targetEmail });
      setResetEmail(targetEmail);
      setResetMsg('A reset code has been sent to your email. Not in your inbox? Check your spam or junk folder.');
      setAuthMode('reset');
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Could not send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetMsg('');
    if (!resetEmail.trim() || !resetCode.trim() || !resetNewPassword) {
      setAuthError('Email, reset code, and new password are required.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/password/reset', {
        email: resetEmail.trim().toLowerCase(),
        code: resetCode.trim().toUpperCase(),
        newPassword: resetNewPassword,
      });
      setEmail(resetEmail.trim().toLowerCase());
      setPassword('');
      setResetCode('');
      setResetNewPassword('');
      setResetMsg('Password updated. Sign in with your new password.');
      setAuthResult({ kind: 'success', title: 'Password updated', message: 'Sign in with your new password.' });
      setAuthMode('login');
    } catch (err: any) {
      const failure = err.response?.data?.error || 'Could not reset password.';
      setAuthResult({ kind: 'error', title: 'Reset failed', message: failure });
      setAuthError(failure);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2faLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6 || !temp2faToken) return;
    setTwoFaError(null);
    setIsVerifying2fa(true);
    try {
      holdRedirectRef.current = true;
      await storeVerify2fa(totpCode, temp2faToken);
      setAuthResult({ kind: 'success', title: 'Signed in', message: 'Two-factor code accepted.' });
    } catch (err: any) {
      holdRedirectRef.current = false;
      const failure = twoFactorFailure(err);
      setAuthResult({ kind: 'error', ...failure });
      setTwoFaError(failure.message);
    } finally {
      setIsVerifying2fa(false);
    }
  };

  const oauthBusiness = authMode === 'signup' && signupAccountType === 'business';
  const handleGoogleLogin = () => { window.location.href = oauthStartUrl('google', { business: oauthBusiness }); };
  const handleMicrosoftLogin = () => { window.location.href = oauthStartUrl('microsoft', { business: oauthBusiness }); };

  const primaryButtonStyle: React.CSSProperties = {
    fontFamily: MONA,
    background: ORANGE_GRADIENT,
    height: '40px',
    borderRadius: '4px',
    color: 'var(--ink)',
    fontWeight: 500,
    fontSize: '14px',
  };

  // ── 2FA panel ─────────────────────────────────────────────────────────────
  if (temp2faToken) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white select-none" style={{ fontFamily: MONA }}>
        <div className="w-full max-w-sm p-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-[#1C1C1C] flex items-center justify-center shadow-xl shadow-black/10 overflow-hidden border border-white/5">
              <img src={logo} alt="Remote365" className="w-10 h-10 object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-[#1C1C1C] tracking-tighter leading-none">Remote365</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#1C1C1C] mt-1">{ta(temp2faSetup ? 'twoFactorSetupTag' : 'twoFactorTag', language)}</span>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2">{ta(temp2faSetup ? 'twoFactorSetupTitle' : 'twoFactorTitle', language)}</h1>
          <p className="text-sm font-medium text-[#1C1C1C] mb-8 leading-relaxed">
            {ta(temp2faSetup ? 'twoFactorSetupHint' : 'twoFactorHint', language)}
          </p>

          <form onSubmit={handleVerify2faLogin} className="space-y-6">
            <AuthResultModal state={authResult} onClose={closeAuthResult} />
            {temp2faSetup && (
              <div className="flex items-center justify-center rounded-2xl border border-[rgba(28,28,28,0.15)] bg-[#F8F9FA] p-4 min-h-[212px]">
                {setupQr
                  ? <img src={setupQr} alt="Two-factor authentication QR code" className="h-44 w-44" />
                  : <RefreshCw size={20} className="animate-spin text-[#1C1C1C]" />}
              </div>
            )}
            <input
              autoFocus
              type="text"
              maxLength={6}
              placeholder="000 000"
              className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.15)] text-[#1C1C1C] rounded-[24px] px-4 py-5 text-3xl font-mono font-bold tracking-[0.2em] focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />

            {twoFaError && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-xs font-semibold text-red-600 leading-relaxed">{twoFaError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying2fa || totpCode.length !== 6}
              className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl font-bold text-sm shadow-xl shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isVerifying2fa ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              VERIFY &amp; CONTINUE
            </button>

            <button
              type="button"
              onClick={() => {
                setTemp2faToken(null);
                setTotpCode('');
                setTwoFaError(null);
              }}
              className="w-full text-xs font-bold text-[#1C1C1C] uppercase tracking-widest hover:opacity-70 transition-colors"
            >
              Back to Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Sign-in / sign-up carry no caption; the password flows keep theirs.
  const captionCopy =
    authMode === 'forgot'
      ? ta('resetCaption', language)
      : authMode === 'reset'
      ? ta('newPasswordCaption', language)
      : '';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FFFFFF] select-none overflow-y-auto overflow-x-hidden relative py-16">
      {/* Ellipse gradient background */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 'calc(100% + 80px)',
          height: '517px',
          left: '-40px',
          top: '-400px',
          background:
            'linear-gradient(360deg, rgba(255, 255, 255, 0.375) -16.83%, rgba(255, 179, 71, 0.6) 29.84%, rgba(255, 138, 0, 0.75) 76.5%)',
          filter: 'blur(39.5px)',
        }}
      />

      {/* Back to landing */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute left-4 top-5 sm:left-[80px] sm:top-[60px] flex items-center gap-2 z-20 hover:opacity-80 transition-opacity"
      >
        <ArrowLeft size={16} color="#000000" />
        <span style={{ fontFamily: MONA, fontSize: '14px', fontWeight: 400, color: 'var(--ink)' }}>{ta('back', language)}</span>
      </button>

      {/* Card */}
      <div
        className="flex flex-col items-center bg-transparent relative z-10 w-full max-w-[468px]"
        style={{ minHeight: '468px', padding: '12px 24px', fontFamily: MONA }}
      >
        {/* Logo + headers */}
        <div className="flex flex-col items-center gap-[12px] w-full max-w-[420px] mb-4">
          <div className="w-[40px] h-[40px] flex items-center justify-center">
            <img src={logo} alt="Remote365" className="w-full h-full object-contain" />
          </div>

          <div
            className="w-full max-w-[420px] h-[24px] flex items-center justify-center gap-1"
            style={{ fontSize: 'clamp(12px, 0.9vw, 15px)', color: 'var(--ink-50)' }}
          >
            {authMode === 'login' || authMode === 'signup' ? (
              <>
                <span>{authMode === 'login' ? ta('noAccount', language) : ta('hasAccount', language)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setIsAwaitingVerification(false);
                    setVerificationCode('');
                    setAuthError(null);
                  }}
                  className="hover:underline"
                  style={{ color: '#FF8A00', fontWeight: 600 }}
                >
                  {authMode === 'login' ? ta('createAccount', language) : ta('signIn', language)}
                </button>
              </>
            ) : (
              <>
                <span>{authMode === 'forgot' ? ta('recoverAccount', language) : ta('updatePassword', language)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                    setResetMsg('');
                  }}
                  className="hover:underline"
                  style={{ color: '#FF8A00', fontWeight: 600 }}
                >
                  {ta('backToSignIn', language)}
                </button>
              </>
            )}
          </div>

          <div style={{ maxWidth: '100%', height: captionCopy ? '20px' : '0', fontSize: '14px', textAlign: 'center', color: 'var(--ink)' }}>
            {captionCopy}
          </div>
        </div>

        <div className="w-full max-w-[420px]" style={{ fontFamily: MONA }}>
          <AuthResultModal state={authResult} onClose={closeAuthResult} />
          {authMode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4 animate-fade-in">
              <div className="space-y-1.5">
                <div style={{ fontSize: '14px', color: 'var(--ink)', height: '24px' }}>{ta('accountEmail', language)}</div>
                <input
                  autoFocus
                  type="email"
                  required
                  value={resetEmail || email}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    setEmail(e.target.value);
                  }}
                  placeholder="name@gmail.com"
                  className={inputClass}
                  style={{ height: '40px' }}
                />
              </div>
              {authError && <p className="text-[11px] text-red-500 font-medium">{authError}</p>}
              <button type="submit" disabled={loading} style={primaryButtonStyle} className="w-full transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? ta('loading', language) : ta('sendResetCode', language)}
              </button>
            </form>
          ) : authMode === 'reset' ? (
            <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
              <div className="space-y-1.5">
                <div style={{ fontSize: '14px', color: 'var(--ink)', height: '24px' }}>{ta('resetCode', language)}</div>
                <input
                  autoFocus
                  type="text"
                  maxLength={6}
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
                  placeholder="ABC123"
                  className={`${inputClass} text-center text-xl font-mono font-bold tracking-[0.18em]`}
                  style={{ height: '40px' }}
                />
              </div>
              <div className="space-y-1.5">
                <div style={{ fontSize: '14px', color: 'var(--ink)', height: '24px' }}>{ta('newPassword', language)}</div>
                <div className="relative w-full h-[40px]">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder={ta('atLeast8', language)}
                    className={`${inputClass} pr-[44px]`}
                    style={{ height: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-[16px] top-1/2 -translate-y-1/2 flex items-center justify-center"
                    title={showResetPassword ? 'Hide password' : 'Show password'}
                    aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? <EyeOff size={16} color="#111315" /> : <Eye size={16} color="#111315" />}
                  </button>
                </div>
              </div>
              {resetMsg && <p className="text-[11px] text-emerald-600 font-medium">{resetMsg}</p>}
              {authError && <p className="text-[11px] text-red-500 font-medium">{authError}</p>}
              <button type="submit" disabled={loading} style={primaryButtonStyle} className="w-full transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? ta('loading', language) : ta('updatePassword', language)}
              </button>
            </form>
          ) : (
            /* --- LOGIN / SIGNUP FLOW --- */
            <div className="animate-fade-in">
              <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="flex flex-col gap-[16px]">
                {authMode === 'signup' && isAwaitingVerification ? (
                  <div className="flex flex-col gap-[8px]">
                    <div style={{ fontSize: '14px', color: 'var(--ink)', height: '24px' }}>{ta('verificationCode', language)}</div>
                    <input
                      autoFocus
                      inputMode="numeric"
                      type="text"
                      maxLength={6}
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className={`${inputClass} text-center text-xl font-mono font-bold tracking-[0.2em]`}
                      style={{ height: '40px' }}
                    />
                    <p className="text-[11px]" style={{ color: 'var(--ink-50)' }}>
                      {ta('codeSent', language, { email })}
                    </p>
                  </div>
                ) : (
                  <>
                    {authMode === 'signup' && (
                      <div className="flex rounded-[4px] border border-[rgba(26,29,33,0.3)] p-[3px]">
                        {(['personal', 'business'] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => { setSignupAccountType(kind); setBusinessStep(1); setAuthError(null); }}
                            className={`flex h-8 flex-1 items-center justify-center rounded-[3px] text-[13px] font-medium transition-colors ${signupAccountType === kind ? 'bg-[#111315] text-white' : 'text-[#111315] hover:bg-[#F3F4F6]'}`}
                          >
                            {ta(kind === 'personal' ? 'personalAccount' : 'businessAccount', language)}
                          </button>
                        ))}
                      </div>
                    )}
                    {authMode === 'signup' && signupAccountType === 'business' && (
                      <BusinessStepper step={businessStep} steps={[ta('stepCompany', language), ta('stepAddress', language), ta('stepAccount', language)]} onStep={setBusinessStep} />
                    )}
                    {authMode === 'signup' && signupAccountType === 'business' && businessStep < 3 && (
                      <BusinessSignupSteps
                        form={business}
                        onChange={(key, value) => updateBusiness(key, value)}
                        step={businessStep}
                        setStep={setBusinessStep}
                        labels={{ steps: [ta('stepCompany', language), ta('stepAddress', language), ta('stepAccount', language)], companyName: ta('companyName', language), businessNumber: ta('businessNumber', language), website: ta('companyWebsite', language), country: ta('country', language), state: ta('state', language), province: ta('province', language), city: ta('city', language), address: ta('address', language), zip: ta('zipCode', language), next: ta('next', language), back: ta('back', language) }}
                        inputClass={inputClass}
                      />
                    )}
                    <div className={authMode === 'signup' && signupAccountType === 'business' && businessStep < 3 ? 'hidden' : 'contents'}>
                    <div className="flex flex-col gap-[8px]">
                      <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--ink)', height: '24px' }}>{ta(authMode === 'signup' && signupAccountType === 'business' ? 'companyEmail' : 'email', language)}</div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={authMode === 'signup' && signupAccountType === 'business' ? 'name@company.com' : 'name@gmail.com'}
                        className={inputClass}
                        style={{ height: '40px' }}
                      />
                    </div>

                    <div className="flex flex-col gap-[8px]">
                      <div style={{ fontSize: '14px', fontWeight: 400, color: 'var(--ink)', height: '24px' }}>{ta('password', language)}</div>
                      <div className="relative w-full h-[40px]">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={ta('enterPassword', language)}
                          className="w-full h-full bg-white border border-[rgba(26,29,33,0.3)] text-slate-800 rounded-[4px] px-[16px] py-[8px] text-[14px] focus:border-orange-400 outline-none transition-all placeholder:text-[rgba(17,19,21,0.3)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-[16px] top-1/2 -translate-y-1/2 flex items-center justify-center"
                        >
                          {showLoginPassword ? <EyeOff size={16} color="#111315" /> : <Eye size={16} color="#111315" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  </>
                )}

                <div className={authMode === 'signup' && signupAccountType === 'business' && businessStep < 3 ? 'hidden' : 'contents'}>
                {authMode === 'login' && !isAwaitingVerification && (
                  <div className="flex justify-between items-center w-full h-[24px]">
                    <label className="flex items-center cursor-pointer h-[24px] gap-[4px]">
                      <div className="relative w-[20px] h-[20px] flex items-center justify-center">
                        <div className={`absolute w-[15px] h-[15px] rounded-[2px] transition-colors ${rememberMe ? 'bg-[#FF8A00]' : 'bg-[rgba(26,29,33,0.3)]'}`} />
                        {rememberMe && (
                          <svg className="absolute z-[5] pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="absolute w-[20px] h-[20px] opacity-0 cursor-pointer m-0 z-10"
                        />
                      </div>
                      <span style={{ fontFamily: MONA, fontSize: '13px', color: 'var(--ink)' }}>{ta('rememberMe', language)}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setResetMsg('');
                        setAuthError(null);
                        setAuthMode('forgot');
                      }}
                      className="hover:underline"
                      style={{ fontFamily: MONA, fontSize: '13px', fontWeight: 600, color: '#FF8A00' }}
                    >
                      {ta('forgotPassword', language)}
                    </button>
                  </div>
                )}

                {authError && <p className="text-[11px] text-red-500 font-medium" style={{ fontFamily: MONA }}>{authError}</p>}
                {resetMsg && authMode === 'login' && <p className="text-[11px] text-emerald-600 font-medium" style={{ fontFamily: MONA }}>{resetMsg}</p>}

                <button type="submit" disabled={loading} style={primaryButtonStyle} className="w-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-1">
                  {loading
                    ? ta('loading', language)
                    : authMode === 'signup' && isAwaitingVerification
                    ? ta('verifyAndSignIn', language)
                    : authMode === 'login'
                    ? ta('signIn', language)
                    : ta('signUp', language)}
                </button>
                </div>

                <div className="flex items-center gap-4 w-full h-[20px]">
                  <div className="flex-grow h-[1px] bg-[rgba(26,29,33,0.3)]" />
                  <span style={{ fontFamily: MONA, fontSize: '14px', color: 'var(--ink-30)' }}>{ta('or', language)}</span>
                  <div className="flex-grow h-[1px] bg-[rgba(26,29,33,0.3)]" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  style={{
                    height: '40px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-strong)',
                    fontFamily: MONA,
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                  className="w-full flex items-center justify-center gap-[12px] hover:bg-slate-50 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  {authMode === 'signup' ? ta('signUpWithGoogle', language) : ta('signInWithGoogle', language)}
                </button>

                <button
                  type="button"
                  onClick={handleMicrosoftLogin}
                  style={{
                    height: '40px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-strong)',
                    fontFamily: MONA,
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                  className="w-full flex items-center justify-center gap-[12px] hover:bg-slate-50 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                  </svg>
                  {authMode === 'signup' ? ta('signUpWithMicrosoft', language) : ta('signInWithMicrosoft', language)}
                </button>
              </form>
            </div>
          )}
        </div>

        {(authMode === 'login' || authMode === 'signup') && (
          <div
            style={{
              maxWidth: '253px',
              marginTop: 'auto',
              paddingTop: '24px',
              fontFamily: MONA,
              fontSize: '12px',
              lineHeight: '17px',
              textAlign: 'center',
              color: 'var(--ink)',
            }}
          >
            {ta('disclaimer', language)}
          </div>
        )}
      </div>

      <div className="absolute bottom-6 w-full px-4 text-center text-[13px] font-semibold text-[#1A1D21]" style={{ fontFamily: MONA }}>
        {ta('copyright', language)}
      </div>

      <div className="absolute right-6 top-6 z-20 flex items-center gap-2" style={{ fontFamily: MONA }}>
        <button
          type="button"
          onClick={() => navigate('/contact')}
          className="flex h-8 items-center gap-1.5 rounded border border-[rgba(26,29,33,0.15)] bg-white/70 px-2.5 text-[12px] font-medium text-[#1A1D21] hover:border-[#FF8A00] hover:text-[#FF8A00]"
        >
          <CircleHelp size={15} />
          <span>{ta('helpSupport', language)}</span>
        </button>
        <div className="relative">
        <button
          type="button"
          onClick={() => setShowLanguages((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={showLanguages}
          className="flex h-8 items-center gap-1.5 rounded border border-[rgba(26,29,33,0.15)] bg-white/70 px-2.5 text-[12px] font-medium text-[#1A1D21] hover:border-[#FF8A00]"
        >
          <Languages size={15} />
          <span>{LANGUAGE_OPTIONS.find((o) => o.value === language)?.label || 'English'}</span>
          <ChevronDown size={13} />
        </button>
        {showLanguages && (
          <>
            <button type="button" aria-label="Close" onClick={() => setShowLanguages(false)} className="fixed inset-0 cursor-default" />
            <ul role="listbox" className="absolute right-0 top-9 m-0 min-w-[200px] list-none rounded-lg border border-[rgba(26,29,33,0.12)] bg-white p-1 shadow-[0_12px_32px_rgba(26,29,33,0.16)]">
              {LANGUAGE_OPTIONS.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={language === option.value}
                    onClick={() => chooseLanguage(option.value)}
                    className={`h-8 w-full rounded-md px-2.5 text-left text-[13px] hover:bg-[#FFF4E5] ${language === option.value ? 'font-semibold text-[#FF8A00]' : 'text-[#1A1D21]'}`}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
