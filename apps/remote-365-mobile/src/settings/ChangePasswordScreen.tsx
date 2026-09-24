import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SettingsPage } from './SettingsScaffold';
import { changePassword } from './accountApi';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

/**
 * Change password from the mobile app. Backed by PATCH /api/auth/me, which
 * requires the current password before accepting a new one (bcrypt-compared
 * server-side). Google-OAuth accounts have no password yet (`hasPassword`
 * false from /me) — for them this screen becomes "set a password": the
 * current-password field is hidden, an explanatory notice is shown, and the
 * backend accepts the first set without one. Success just closes back to
 * Settings.
 *
 * NOTE on `provider`: /api/auth/me currently derives it as
 * `user.password ? 'local' : 'google'`, so EVERY passwordless account reports
 * 'google' — a Microsoft-OAuth user is mislabelled. Until that is fixed we do
 * not name Google on the strength of that value alone; 'google' (and anything
 * unknown) falls back to neutral wording, while a provider the backend states
 * explicitly (e.g. 'microsoft', 'apple') is named.
 */
export function ChangePasswordScreen({
  apiBaseUrl,
  authToken,
  hasPassword = true,
  provider,
  onBack,
}: {
  apiBaseUrl: string;
  authToken: string | null;
  /** false for OAuth-login accounts that never set a password. */
  hasPassword?: boolean;
  /** Sign-in provider from /api/auth/me, when it can be trusted. */
  provider?: string;
  onBack: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  // Wire values, never displayed as-is: 'local' means a real password exists and
  // 'google' is the backend's catch-all for any passwordless account.
  const rawProvider = (provider || '').trim().toLowerCase();
  const providerName =
    rawProvider === 'microsoft' ? 'Microsoft'
      : rawProvider === 'apple' ? 'Apple'
        : rawProvider === 'github' ? 'GitHub'
          : null;

  const validate = (): string | null => {
    if (hasPassword && !currentPassword) return t('Enter your current password.');
    if (newPassword.length < 8) return t('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return t('New passwords do not match.');
    if (hasPassword && newPassword === currentPassword) return t('New password must be different from your current password.');
    return null;
  };

  const submit = async () => {
    const validation = validate();
    if (validation) { setError(validation); return; }
    setError(null);
    setSubmitting(true);
    const res = await changePassword(apiBaseUrl, authToken, currentPassword, newPassword);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || t('Could not change password. Please try again.'));
      return;
    }
    setSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    // Give the confirmation a beat, then close.
    setTimeout(onBack, 1200);
  };

  const renderField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    show: boolean,
    setShow: (v: boolean) => void,
  ) => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, textSize(14)]}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          value={value}
          onChangeText={(text) => { setValue(text); setError(null); setSuccess(false); }}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={label}
          placeholderTextColor="#B0B3B8"
        />
        <Pressable onPress={() => setShow(!show)} hitSlop={8} style={styles.eyeButton}>
          <Feather name={show ? 'eye-off' : 'eye'} size={16} color="#858687" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SettingsPage title={hasPassword ? t('Change password') : t('Set a password')} onBack={onBack}>
      <View style={styles.container}>
        {hasPassword ? (
          <Text style={[styles.hint, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {t('Enter your current password and choose a new one. You will stay signed in on this device.')}
          </Text>
        ) : (
          <View style={styles.noticeBox}>
            <Feather name="info" size={14} color="#FF8A00" />
            <View style={styles.noticeTextWrap}>
              <Text style={[styles.noticeTitle, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {providerName
                  ? `${t('You signed in with')} ${providerName}`
                  : t('You signed in with a linked account (Google or Microsoft)')}
              </Text>
              <Text style={[styles.noticeText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {t('This account does not have a password yet. Set one below and you will also be able to sign in with your email address and password.')}
              </Text>
            </View>
          </View>
        )}

        {hasPassword ? renderField(t('Current password'), currentPassword, setCurrentPassword, showCurrent, setShowCurrent) : null}
        {renderField(t('New password'), newPassword, setNewPassword, showNew, setShowNew)}
        {renderField(t('Confirm new password'), confirmPassword, setConfirmPassword, showConfirm, setShowConfirm)}

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#D92D20" />
            <Text style={[styles.errorText, type(12, 16 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successBox}>
            <Feather name="check-circle" size={14} color="#14AE5C" />
            <Text style={[styles.successText, type(12, 16 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Password updated.')}</Text>
          </View>
        ) : null}

        <Pressable style={[styles.submitButton, submitting && styles.submitBusy]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.submitText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{hasPassword ? t('Update password') : t('Set password')}</Text>}
        </Pressable>
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  container: { gap: 16, width: '100%' },
  hint: { color: 'rgba(26, 29, 33, 0.7)' },
  noticeBox: { alignItems: 'flex-start', backgroundColor: 'rgba(255,138,0,0.10)', borderRadius: 6, flexDirection: 'row', gap: 8, padding: 10 },
  noticeTextWrap: { flex: 1, gap: 4 },
  noticeTitle: { color: '#111315', fontWeight: '600' },
  noticeText: { color: 'rgba(26, 29, 33, 0.7)' },
  field: { gap: 6, width: '100%' },
  fieldLabel: { color: '#111315', fontWeight: '500' },
  inputRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: 'rgba(26,29,33,0.15)', borderRadius: 8, borderWidth: 1, flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4 },
  input: { color: '#111315', flex: 1, minHeight: 40, paddingVertical: 8 },
  eyeButton: { padding: 4 },
  errorBox: { alignItems: 'center', backgroundColor: 'rgba(217,45,32,0.08)', borderRadius: 6, flexDirection: 'row', gap: 8, padding: 10 },
  errorText: { color: '#D92D20', flex: 1 },
  successBox: { alignItems: 'center', backgroundColor: 'rgba(20,174,92,0.10)', borderRadius: 6, flexDirection: 'row', gap: 8, padding: 10 },
  successText: { color: '#14AE5C', flex: 1 },
  submitButton: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 6, justifyContent: 'center', marginTop: 4, minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, width: '100%' },
  submitBusy: { opacity: 0.7 },
  submitText: { color: '#FFFFFF', fontWeight: '600', textAlign: 'center' },
}));
