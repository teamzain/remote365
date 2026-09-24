import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, I18nManager, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_FONT_SCALE } from '../lib/responsive';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';
import { BusinessForm, stateLabel, validateAddressStep, validateBusinessEmail, validateCompanyStep } from './businessValidation';
import { COUNTRIES, fetchCities, fetchStates, localStatesFor } from './geo';
import { PrivacyPolicyScreen } from '../settings/PrivacyPolicyScreen';
import { TermsScreen } from '../settings/TermsScreen';

export const REMEMBER_KEY = 'remote365_mobile_remember_me';
type Payload = { accessToken: string; refreshToken?: string; user: any };
type Props = {
  initialMode: 'login' | 'signup';
  request: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onAuthenticated: (payload: Payload, remember: boolean) => Promise<void>;
  onOAuth: (provider: 'google' | 'microsoft', remember: boolean, business: boolean) => Promise<void>;
  onBack: () => void;
  initialError?: string | null;
};

function Field({ label, value, onChange, password = false, email = false, code = false, inputRef, returnKeyType, onSubmitEditing }: {
  label: string; value: string; onChange: (value: string) => void; password?: boolean; email?: boolean; code?: boolean;
  inputRef?: React.RefObject<TextInput | null>; returnKeyType?: 'next' | 'go' | 'done'; onSubmitEditing?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const { textSize } = useResponsive();
  const { t } = useTranslation();
  return <View style={s.field}>
    <Text style={[s.label, textSize(14)]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
    <View style={s.inputWrap}>
      <TextInput ref={inputRef} accessibilityLabel={label} style={[s.input, textSize(14)]} maxFontSizeMultiplier={MAX_FONT_SCALE} value={value} onChangeText={onChange}
        autoCapitalize={email || password ? 'none' : code ? 'characters' : 'sentences'}
        autoCorrect={!email && !password && !code} keyboardType={email ? 'email-address' : 'default'}
        maxLength={code ? 6 : undefined} secureTextEntry={password && !visible}
        autoComplete={password ? 'off' : email ? 'email' : code ? 'one-time-code' : 'off'}
        placeholder={email ? 'name@gmail.com' : password ? t('Enter your password') : code ? '000000' : label}
        returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} blurOnSubmit={returnKeyType !== 'next'}
        placeholderTextColor="#999" />
      {password && <Pressable accessibilityRole="button" accessibilityLabel={visible ? t('Hide password') : t('Show password')}
        accessibilityState={{ expanded: visible }} onPress={() => setVisible(v => !v)} style={s.eye}>
        <Feather name={visible ? 'eye-off' : 'eye'} size={18} color="#111315" />
      </Pressable>}
    </View>
  </View>;
}

function SelectField({ label, value, options, onChange, loading = false, allowCustom = false }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void;
  /** Options are still being fetched — the control is inert and says so. */
  loading?: boolean;
  /** Offer the typed text as a choice when nothing matches, so a missing entry
   *  in the geo data can never dead-end the form. */
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { gutter, textSize } = useResponsive();
  const { t } = useTranslation();
  const term = search.trim();
  const matches = options.filter(x => x.toLowerCase().includes(term.toLowerCase()));
  const showCustom = allowCustom && term.length > 1 && !matches.some(x => x.toLowerCase() === term.toLowerCase());
  return <View style={s.field}><Text style={[s.label, textSize(14)]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={loading}
      style={[s.inputWrap, s.select, loading && s.disabled]} onPress={() => { setSearch(''); setOpen(true); }}>
      <Text numberOfLines={1} style={[s.selectValue, textSize(14)]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{loading ? t('Loading…') : value || `${t('Select')} ${label.toLowerCase()}`}</Text>
      {loading ? <ActivityIndicator size="small" /> : <Feather name="chevron-down" size={16} />}
    </Pressable>
    <Modal visible={open} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={s.page}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.card, s.modalCard, gutter < 16 && { paddingHorizontal: gutter }]}>
            <Pressable style={s.linkButton} onPress={() => setOpen(false)}><Text style={[s.link, textSize(13)]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{t('Close')}</Text></Pressable>
            <Field label={`${t('Search')} ${label.toLowerCase()}`} value={search} onChange={setSearch} />
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {showCustom && <Pressable style={s.linkButton} onPress={() => { onChange(term); setOpen(false); }}><Text>{t('Use')} “{term}”</Text></Pressable>}
              {matches.map(x =>
                <Pressable key={x} style={s.linkButton} onPress={() => { onChange(x); setOpen(false); }}><Text>{x}</Text></Pressable>)}
              {!matches.length && !showCustom && <Text style={[s.label, textSize(14)]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{t('No matches.')}</Text>}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </View>;
}

export function AuthScreen({ initialMode, request, onAuthenticated, onOAuth, onBack, initialError }: Props) {
  const [mode, setMode] = useState<'login' | 'signup' | 'verify' | 'forgot' | 'reset' | '2fa'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);
  const [kind, setKind] = useState<'personal' | 'business'>('personal');
  const [step, setStep] = useState(1);
  const { gutter, compact, stackActions, type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  const passwordRef = useRef<TextInput>(null);
  const focusPassword = () => passwordRef.current?.focus();
  const [business, setBusiness] = useState<BusinessForm>({ companyName: '', businessNumber: '', website: '', country: '', state: '', city: '', addressLine: '', postalCode: '' });
  // Subdivisions and cities are looked up per country/state. An empty list means
  // "this place has none" OR "the lookup failed" — both render as a free-text
  // field rather than a picker, so neither can block sign-up.
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  // Country -> subdivisions. `active` guards against a slow response for a
  // country the user has already moved away from overwriting a newer result.
  useEffect(() => {
    if (!business.country) { setStates([]); return; }
    let active = true;
    const local = localStatesFor(business.country);
    if (local) { setStates(local); setLoadingStates(false); return; }
    setLoadingStates(true);
    fetchStates(business.country)
      .then(list => { if (active) setStates(list); })
      .finally(() => { if (active) setLoadingStates(false); });
    return () => { active = false; };
  }, [business.country]);

  // Country/state -> cities. Waits for the state when the country has one, so the
  // list is scoped to the state rather than the whole country.
  useEffect(() => {
    if (!business.country || (states.length > 0 && !business.state)) { setCities([]); return; }
    let active = true;
    setLoadingCities(true);
    fetchCities(business.country, states.length > 0 ? business.state : null)
      .then(list => { if (active) setCities(list); })
      .finally(() => { if (active) setLoadingCities(false); });
    return () => { active = false; };
  }, [business.country, business.state, states.length]);

  useEffect(() => { setError(initialError || ''); }, [initialError]);
  useEffect(() => { let active = true; AsyncStorage.getItem(REMEMBER_KEY).then(v => { if (active) setRemember(v !== 'false'); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(v => v - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const changeMode = (next: typeof mode) => { setMode(next); setError(''); setInfo(''); setCode(''); };
  const post = (path: string, body: object) => request<any>(`/api/auth/${path}`, { method: 'POST', body: JSON.stringify(body) });
  const extras = kind === 'business' ? { accountType: kind, ...business } : { accountType: kind };
  const sendCode = async () => {
    const result = await post('request-verification', { email: email.trim().toLowerCase(), ...extras });
    setInfo(result.emailSent === false
      ? t('We could not send the email. Please try again shortly.')
      : `${t('We emailed a 6-digit code to')} ${email.trim()}. ${t('It is valid for 10 minutes. Check your spam or junk folder.')}`);
    setCooldown(60); setMode('verify'); setCode('');
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (err: any) { setError(err?.message || t('Something went wrong. Please try again.')); } finally { setBusy(false); }
  };
  const submit = () => run(async () => {
    const targetEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) throw new Error(t('Enter a valid email address.'));
    if (mode === 'forgot') { await post('password/forgot', { email: targetEmail }); setMode('reset'); setPassword(''); setInfo(t('A reset code has been sent to your email. Check your spam or junk folder.')); return; }
    if (mode === 'reset') {
      if (code.length !== 6) throw new Error(t('Enter the 6-character reset code.'));
      if (password.length < 8) throw new Error(t('Password must be at least 8 characters.'));
      await post('password/reset', { email: targetEmail, code, newPassword: password });
      changeMode('login'); setPassword(''); setInfo(t('Password updated. Sign in with your new password.')); return;
    }
    if (mode === '2fa') {
      if (!/^\d{6}$/.test(code)) throw new Error(t('Enter the 6-digit authenticator code.'));
      await onAuthenticated(await post('verify-2fa', { tempToken, code }), remember); return;
    }
    if (!password) throw new Error(t('Enter your password.'));
    if (mode === 'login') {
      const result = await post('login', { email: targetEmail, password });
      if (result.twoFactorRequired) { setTempToken(result.tempToken); changeMode('2fa'); return; }
      await onAuthenticated(result, remember); return;
    }
    if (password.length < 8) throw new Error(t('Password must be at least 8 characters.'));
    if (kind === 'business') {
      const invalid = Object.values({ ...validateCompanyStep(business), ...validateAddressStep(business, states.length > 0) })[0] || validateBusinessEmail(targetEmail);
      if (invalid) throw new Error(invalid);
    }
    if (mode === 'signup') { await sendCode(); return; }
    if (!/^\d{6}$/.test(code)) throw new Error(t('Enter the 6-digit verification code.'));
    await onAuthenticated(await post('register', { email: targetEmail, password, verificationCode: code, name: targetEmail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), ...extras }), true);
  });
  const nextStep = () => {
    const invalid = Object.values(step === 1 ? validateCompanyStep(business) : validateAddressStep(business, states.length > 0))[0];
    setError(invalid || ''); if (!invalid) setStep(v => v + 1);
  };
  const companyField = (key: keyof BusinessForm, label: string) => <Field key={key} label={label} value={business[key]} onChange={v => setBusiness(b => ({ ...b, [key]: v }))} />;
  const businessDetails = mode === 'signup' && kind === 'business' && step < 3;
  const title = { login: t('Sign in to continue'), signup: t('Create your account'), verify: t('Verify your email'), forgot: t('Recover account'), reset: t('Update password'), '2fa': t('Two-factor authentication') }[mode];
  return <SafeAreaView style={s.page}>
    <StatusBar style="dark" />
    <Pressable accessibilityRole="button" accessibilityLabel={t('Back')} style={s.back} onPress={onBack}><Feather name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'} size={22} /></Pressable>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.content, gutter < 16 && { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={s.card}>
          <Image source={require('../../assets/logo.png')} resizeMode="contain" style={[s.logo, compact && s.logoCompact]} />
          <Text style={[s.title, textSize(22)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text><Text style={[s.subtitle, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Access remote devices securely.')}</Text>
          {mode === 'signup' && <View style={[s.row, stackActions && s.stack]}>{(['personal', 'business'] as const).map(k => <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: kind === k }} style={[s.segment, kind === k && s.selected]} onPress={() => { setKind(k); setStep(1); setError(''); }}><Text style={[kind === k ? s.white : s.label, textSize(kind === k ? 13 : 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{k === 'personal' ? t('Sign Up Personal Account') : t('Sign Up Business Account')}</Text></Pressable>)}</View>}
          {mode === 'signup' && kind === 'business' && <View style={s.row}>{['Company', 'Address', 'Account'].map((label, i) => <Pressable key={label} style={s.linkButton} disabled={i + 1 >= step} onPress={() => { setStep(i + 1); setError(''); }}><Text style={[step === i + 1 ? s.link : s.subtitle, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{i + 1}. {t(label)}</Text></Pressable>)}</View>}
          {businessDetails ? <>
            {step === 1 ? <>{companyField('companyName', t('Company Name'))}{companyField('businessNumber', t('Business No.'))}{companyField('website', t('Company Website (optional)'))}</> : <>
              <SelectField label={t('Country')} value={business.country} options={COUNTRIES} onChange={country => setBusiness(b => ({ ...b, country, state: '', city: '' }))} />
              {/* The state field appears only for countries that actually have
                  subdivisions, and is required when it does. Countries with none
                  (and lookup failures) simply do not render it. */}
              {(loadingStates || states.length > 0) && (
                <SelectField label={t(stateLabel(business.country))} value={business.state} options={states} loading={loadingStates}
                  onChange={state => setBusiness(b => ({ ...b, state, city: '' }))} />
              )}
              {/* City is a picker once suggestions exist, with `allowCustom` so a
                  place missing from the geo data can still be typed. */}
              {(loadingCities || cities.length > 0)
                ? <SelectField label={t('City')} value={business.city} options={cities} loading={loadingCities} allowCustom
                    onChange={city => setBusiness(b => ({ ...b, city }))} />
                : companyField('city', t('City'))}
              {companyField('addressLine', t('Address'))}{companyField('postalCode', t('Zip Code (optional)'))}
            </>}
            {step > 1 && <Pressable style={s.linkButton} onPress={() => setStep(v => v - 1)}><Text style={[s.link, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Back')}</Text></Pressable>}
          </> : mode === 'verify' || mode === '2fa' ? <Field label={mode === '2fa' ? t('Authenticator Code') : t('Verification Code')} value={code} onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))} code returnKeyType="go" onSubmitEditing={submit} /> : <>
            {mode !== 'reset' && <Field label={kind === 'business' && mode === 'signup' ? t('Company Email') : t('Email')} value={email} onChange={setEmail} email
              returnKeyType={mode === 'forgot' ? 'go' : 'next'} onSubmitEditing={mode === 'forgot' ? submit : focusPassword} />}
            {mode === 'reset' && <Field label={t('Reset Code')} value={code} onChange={v => setCode(v.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase())} code returnKeyType="next" onSubmitEditing={focusPassword} />}
            {mode !== 'forgot' && <Field label={mode === 'reset' ? t('New Password') : t('Password')} value={password} onChange={setPassword} password inputRef={passwordRef} returnKeyType="go" onSubmitEditing={submit} />}
          </>}
          {mode === 'login' && <View style={s.row}>
            <Pressable accessibilityRole="checkbox" accessibilityLabel={t('Remember me')} accessibilityState={{ checked: remember }} style={s.check} onPress={() => { const next = !remember; setRemember(next); void AsyncStorage.setItem(REMEMBER_KEY, String(next)).catch(() => {}); }}>
              <Feather name={remember ? 'check-square' : 'square'} size={21} color={remember ? '#FF8A00' : '#888'} /><Text style={[s.label, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Remember me')}</Text>
            </Pressable><Pressable style={s.linkButton} onPress={() => changeMode('forgot')}><Text style={[s.link, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Forgot password?')}</Text></Pressable>
          </View>}
          {!!info && <Text accessibilityLiveRegion="polite" style={[s.info, type(13, 1.46)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{info}</Text>}
          {!!error && <Text accessibilityRole="alert" style={[s.error, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} style={[s.button, busy && s.disabled]} onPress={businessDetails ? nextStep : submit}><Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%"><Defs><LinearGradient id="authButton" x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="38%" stopColor="#FF8A00" /><Stop offset="90%" stopColor="#FFB347" /></LinearGradient></Defs><Rect width="100%" height="100%" rx="4" fill="url(#authButton)" /></Svg><Text style={[s.buttonText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{busy ? t('Working...') : businessDetails ? t('Next') : ({ login: t('Sign In'), signup: t('Sign Up'), verify: t('Verify And Sign In'), forgot: t('Send Reset Code'), reset: t('Update Password'), '2fa': t('Verify And Sign In') }[mode])}</Text></Pressable>
          {mode === 'verify' && <View style={s.row}><Pressable style={s.linkButton} disabled={busy} onPress={() => changeMode('signup')}><Text style={[s.link, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Back')}</Text></Pressable><Pressable style={s.linkButton} disabled={busy || cooldown > 0} onPress={() => run(sendCode)}><Text style={[s.link, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{cooldown ? `${t('Resend Code In')} ${cooldown}s` : t('Resend Code')}</Text></Pressable></View>}
          {(mode === 'login' || mode === 'signup') ? <>
            <View style={s.row}><View style={s.line} /><Text style={[s.subtitle, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Or')}</Text><View style={s.line} /></View>
            {(['google', 'microsoft'] as const).map(provider => <Pressable key={provider} disabled={busy} style={s.google} onPress={() => run(() => onOAuth(provider, remember, mode === 'signup' && kind === 'business'))}>
              {provider === 'google' ? <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92c-.26 1.28-1.04 2.37-2.21 3.1v2.58h3.57c2.08-1.92 3.28-4.74 3.28-7.55z" fill="#4285F4" />
                <Path d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.58c-.98.66-2.24 1.06-3.71 1.06-2.87 0-5.3-1.94-6.17-4.54H2.18v2.84C3.99 20.72 7.7 23 12 23z" fill="#34A853" />
                <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </Svg> : <Svg width={20} height={20} viewBox="0 0 21 21"><Rect x="1" y="1" width="9" height="9" fill="#F25022" /><Rect x="11" y="1" width="9" height="9" fill="#7FBA00" /><Rect x="1" y="11" width="9" height="9" fill="#00A4EF" /><Rect x="11" y="11" width="9" height="9" fill="#FFB900" /></Svg>}
              <Text numberOfLines={2} style={[s.label, s.shrink, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{mode === 'signup'
                ? (provider === 'google' ? t('Sign Up With Google') : t('Sign Up With Microsoft'))
                : (provider === 'google' ? t('Sign In With Google') : t('Sign In With Microsoft'))}</Text>
            </Pressable>)}
            <Pressable style={s.linkButton} disabled={busy} onPress={() => changeMode(mode === 'login' ? 'signup' : 'login')}><Text style={[s.subtitle, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{mode === 'login' ? `${t("Don't have an account?")} ` : `${t('Already have an account?')} `}<Text style={[s.link, textSize(13)]}>{mode === 'login' ? t('Sign up') : t('Sign in')}</Text></Text></Pressable>
          </> : mode !== 'verify' && <Pressable style={s.linkButton} disabled={busy} onPress={() => { changeMode('login'); setPassword(''); }}><Text style={[s.link, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Back to sign in')}</Text></Pressable>}
          <Text style={[s.terms, type(11, 1.545)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('By continuing, you acknowledge that your data may be processed in accordance with our')} <Text accessibilityRole="link" onPress={() => setLegal('terms')} style={[s.link, textSize(13)]}>{t('terms')}</Text>.</Text>
          <Pressable style={s.linkButton} onPress={() => setLegal('privacy')}><Text style={[s.label, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Privacy Policy')}</Text></Pressable>
          <Text style={[s.terms, type(11, 1.545)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Copyright 2026 © Remote 365. {t('All rights reserved.')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={legal !== null} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setLegal(null)}>
      {legal === 'privacy' ? <PrivacyPolicyScreen onBack={() => setLegal(null)} /> : <TermsScreen onBack={() => setLegal(null)} />}
    </Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' }, flex: { flex: 1 }, back: { padding: 12, alignSelf: 'flex-start', marginStart: 12 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 8 },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 16, flexShrink: 1 }, modalCard: { flex: 1, paddingHorizontal: 24 },
  logo: { width: 180, height: 50, alignSelf: 'center' }, logoCompact: { width: 122, height: 34 },
  title: { fontFamily: 'MonaSans-SemiBold', textAlign: 'center', color: '#111315' }, subtitle: { fontFamily: 'MonaSans-Regular', color: '#737579', textAlign: 'center' },
  field: { gap: 8 }, label: { fontFamily: 'MonaSans-Regular', color: '#111315' }, inputWrap: { minHeight: 44, borderWidth: 1, borderColor: '#babcbd', borderRadius: 4, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingVertical: 10, color: '#111315', fontFamily: 'MonaSans-Regular' }, eye: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  select: { paddingHorizontal: 16, justifyContent: 'space-between' }, selectValue: { flexShrink: 1, minWidth: 0, marginEnd: 8 },
  shrink: { flexShrink: 1, minWidth: 0 }, stack: { flexDirection: 'column', alignItems: 'stretch' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, check: { flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 44 },
  link: { color: '#d97000', fontFamily: 'MonaSans-SemiBold' }, linkButton: { minHeight: 44, justifyContent: 'center' },
  button: { backgroundColor: '#FF9B23', borderRadius: 4, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#111315', fontFamily: 'MonaSans-Medium' }, disabled: { opacity: 0.5 },
  google: { borderWidth: 1, borderColor: '#babcbd', borderRadius: 4, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, googleMark: { color: '#4285F4', fontSize: 22, fontWeight: '700' },
  line: { height: 1, backgroundColor: '#d8d9da', flex: 1 }, segment: { flex: 1, minHeight: 52, padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#babcbd', justifyContent: 'center' }, selected: { backgroundColor: '#111315' }, white: { color: '#fff' },
  error: { color: '#b42318' }, info: { color: '#27724a' }, terms: { color: '#737579', textAlign: 'center' },
});
