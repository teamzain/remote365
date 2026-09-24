import React, { useCallback, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ResponsivePanel } from '../components/ResponsivePanel';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SettingsPage, type SettingsUser } from './SettingsScaffold';
import { twoFactorDisable, twoFactorEnable, twoFactorVerify } from './accountApi';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

/**
 * Full 2FA management. Backend flow:
 *   POST /2fa/enable  → returns qr_code (data URL) + writes a pending
 *                       twoFactorSecret to the user row (is2FAEnabled still
 *                       false until the code is verified).
 *   POST /2fa/verify  → validates the 6-digit TOTP against that secret and
 *                       sets is2FAEnabled=true.
 *   POST /2fa/disable → clears the secret + turns is2FAEnabled off.
 * The mobile client keeps its own optimistic enabled flag and asks the caller
 * for a fresh /me refresh via onRefreshUser after each state change so the
 * Settings row detail stays honest.
 */
export function TwoFactorScreen({
  apiBaseUrl,
  authToken,
  onBack,
  onRefreshUser,
  user,
}: {
  apiBaseUrl: string;
  authToken: string | null;
  onBack: () => void;
  onRefreshUser?: () => void;
  user: SettingsUser | null;
}) {
  const initialEnabled = Boolean((user as any)?.is_2fa_enabled);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'enable' | 'verify' | 'disable' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  const beginEnable = useCallback(async () => {
    setError(null);
    setBusy('enable');
    const res = await twoFactorEnable(apiBaseUrl, authToken);
    setBusy(null);
    if (!res.ok || !res.data?.qr_code) {
      setError(res.error || t('Could not start 2FA setup. Try again.'));
      return;
    }
    setQrCode(res.data.qr_code);
    setCode('');
  }, [apiBaseUrl, authToken, t]);

  const submitCode = useCallback(async () => {
    if (code.trim().length !== 6) {
      setError(t('Enter the 6-digit code from your authenticator app.'));
      return;
    }
    setError(null);
    setBusy('verify');
    const res = await twoFactorVerify(apiBaseUrl, authToken, code.trim());
    setBusy(null);
    if (!res.ok) {
      setError(res.error || t('Verification failed. Check the code and try again.'));
      return;
    }
    setEnabled(true);
    setQrCode(null);
    setCode('');
    onRefreshUser?.();
  }, [apiBaseUrl, authToken, code, onRefreshUser, t]);

  const confirmDisable = useCallback(async () => {
    setShowDisableConfirm(false);
    setError(null);
    setBusy('disable');
    const res = await twoFactorDisable(apiBaseUrl, authToken);
    setBusy(null);
    if (!res.ok) {
      setError(res.error || t('Could not disable 2FA.'));
      return;
    }
    setEnabled(false);
    onRefreshUser?.();
  }, [apiBaseUrl, authToken, onRefreshUser, t]);

  const status = useMemo(() => {
    if (busy === 'enable') return t('Preparing your QR code…');
    if (busy === 'verify') return t('Verifying code…');
    if (busy === 'disable') return t('Disabling 2FA…');
    if (qrCode) return t('Scan the QR with your authenticator, then enter the 6-digit code below.');
    if (enabled) return t('Two-factor authentication is on. You will be asked for a code at sign-in.');
    return t('Add an authenticator app (Google Authenticator, Authy, 1Password…) for a second sign-in step.');
  }, [busy, qrCode, enabled, t]);

  return (
    <SettingsPage title={t('Two-factor authentication')} onBack={onBack}>
      <View style={styles.container}>
        <View style={styles.statusCard}>
          <View style={[styles.statusPill, enabled ? styles.statusPillOn : styles.statusPillOff]}>
            <Feather name={enabled ? 'shield' : 'shield-off'} size={12} color={enabled ? '#14AE5C' : '#858687'} />
            <Text style={[styles.statusPillText, textSize(12), { color: enabled ? '#14AE5C' : '#858687' }]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{enabled ? t('Enabled') : t('Disabled')}</Text>
          </View>
          <Text style={[styles.statusText, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{status}</Text>
        </View>

        {qrCode ? (
          <View style={styles.enrollCard}>
            <View style={styles.qrHolder}>
              <Image source={{ uri: qrCode }} style={styles.qrImage} resizeMode="contain" />
            </View>
            <Text style={[styles.enrollHint, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Open your authenticator app, tap the + / add-account button, then scan this code. The app will start showing a fresh 6-digit code every 30 seconds — enter the current one below.')}
            </Text>
            <TextInput
              style={[styles.codeInput, textSize(22)]}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
              value={code}
              onChangeText={(text) => { setCode(text.replace(/\D/g, '').slice(0, 6)); setError(null); }}
              keyboardType="number-pad"
              placeholder="123 456"
              placeholderTextColor="#B0B3B8"
              maxLength={6}
              autoFocus
            />
            <Pressable style={[styles.primaryButton, busy && styles.buttonBusy]} onPress={submitCode} disabled={!!busy}>
              {busy === 'verify' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.primaryButtonText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Verify & enable')}</Text>}
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => { setQrCode(null); setCode(''); setError(null); }} disabled={!!busy}>
              <Text style={[styles.ghostButtonText, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel setup')}</Text>
            </Pressable>
          </View>
        ) : enabled ? (
          <Pressable style={[styles.destructiveButton, busy && styles.buttonBusy]} onPress={() => setShowDisableConfirm(true)} disabled={!!busy}>
            {busy === 'disable' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.destructiveButtonText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Turn off 2FA')}</Text>}
          </Pressable>
        ) : (
          <Pressable style={[styles.primaryButton, busy && styles.buttonBusy]} onPress={beginEnable} disabled={!!busy}>
            {busy === 'enable' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.primaryButtonText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Set up 2FA')}</Text>}
          </Pressable>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#D92D20" />
            <Text style={[styles.errorText, type(12, 16 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{error}</Text>
          </View>
        ) : null}
      </View>

      <Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent visible={showDisableConfirm} onRequestClose={() => setShowDisableConfirm(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDisableConfirm(false)} />
          <ResponsivePanel style={styles.dialog}>
            <View style={styles.dialogIcon}>
              <Feather name="shield-off" size={22} color="#D92D20" />
            </View>
            <Text style={[styles.dialogTitle, textSize(17)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Turn off 2FA?')}</Text>
            <Text style={[styles.dialogText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Your account will only need a password to sign in. You can set 2FA up again anytime.')}
            </Text>
            <View style={styles.dialogButtons}>
              <Pressable style={[styles.dialogButton, styles.dialogGhost]} onPress={() => setShowDisableConfirm(false)}>
                <Text style={[styles.dialogGhostText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.dialogButton, styles.dialogDanger]} onPress={confirmDisable}>
                <Text style={[styles.dialogDangerText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Turn off')}</Text>
              </Pressable>
            </View>
          </ResponsivePanel>
        </View>
      </Modal>
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  container: { gap: 16, width: '100%' },
  statusCard: { backgroundColor: '#FFFFFF', borderColor: 'rgba(26,29,33,0.10)', borderRadius: 10, borderWidth: 1, gap: 10, padding: 14 },
  statusPill: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillOn: { backgroundColor: 'rgba(20,174,92,0.10)' },
  statusPillOff: { backgroundColor: 'rgba(133,134,135,0.14)' },
  statusPillText: { fontWeight: '600' },
  statusText: { color: 'rgba(26,29,33,0.75)' },
  enrollCard: { backgroundColor: '#FFFFFF', borderColor: 'rgba(26,29,33,0.10)', borderRadius: 10, borderWidth: 1, gap: 12, padding: 14 },
  qrHolder: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 8 },
  qrImage: {
    height: 220,
    width: 220,
    maxWidth: '100%'
  },
  enrollHint: { color: 'rgba(26,29,33,0.7)' },
  codeInput: { backgroundColor: '#F8FAFC', borderColor: 'rgba(26,29,33,0.15)', borderRadius: 8, borderWidth: 1, color: '#111315', letterSpacing: 6, minHeight: 52, paddingHorizontal: 16, paddingVertical: 10, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 6, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, width: '100%' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', textAlign: 'center' },
  ghostButton: { alignItems: 'center', borderColor: 'rgba(26,29,33,0.20)', borderRadius: 6, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 12, paddingVertical: 10, width: '100%' },
  ghostButtonText: { color: '#111315', fontWeight: '500', textAlign: 'center' },
  destructiveButton: { alignItems: 'center', backgroundColor: '#D92D20', borderRadius: 6, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, width: '100%' },
  destructiveButtonText: { color: '#FFFFFF', fontWeight: '600' },
  buttonBusy: { opacity: 0.7 },
  errorBox: { alignItems: 'center', backgroundColor: 'rgba(217,45,32,0.08)', borderRadius: 6, flexDirection: 'row', gap: 8, padding: 10 },
  errorText: { color: '#D92D20', flex: 1 },
  dialogBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 16, maxWidth: 360, padding: 20, width: '100%' },
  dialogIcon: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(217,45,32,0.1)', borderRadius: 22, height: 44, justifyContent: 'center', marginBottom: 12, width: 44 },
  dialogTitle: { color: '#111315', fontWeight: '600', textAlign: 'center' },
  dialogText: { color: 'rgba(17,19,21,0.65)', marginTop: 6, textAlign: 'center' },
  dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  dialogButton: { alignItems: 'center', borderRadius: 6, flex: 1, justifyContent: 'center', paddingVertical: 12 },
  dialogGhost: { borderColor: 'rgba(26,29,33,0.3)', borderWidth: 1 },
  dialogGhostText: { color: '#111315', fontWeight: '500' },
  dialogDanger: { backgroundColor: '#D92D20' },
  dialogDangerText: { color: '#FFFFFF', fontWeight: '600' },
}));
