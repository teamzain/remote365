import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  initialsFor,
  Section,
  SettingsPage,
  SettingsRow,
  type SettingsUser,
} from './SettingsScaffold';
import { SETTING_KEYS, useSetting } from './settingsPrefs';
import { LANGUAGES, useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';

const QUALITY_LABELS: Record<string, string> = { auto: 'Auto', smooth: 'Smooth', hd: 'HD' };

export function SettingsScreen({
  onAccountPress,
  onBack,
  onBiometricPress,
  onChangePasswordPress,
  onChatPress,
  onConnectionLogsPress,
  onControlPress,
  onFeedbackPress,
  onLanguagePress,
  onLaunchPress,
  onLogout,
  onPermissionsPress,
  onPrivacyPress,
  onPrivacySecurityPress,
  onStreamingPress,
  onSystemLogsPress,
  onTermsPress,
  onTrustedDevicesPress,
  onTwoFactorPress,
  onUpgradePress,
  onSignInPress,
  user,
}: {
  onAccountPress: () => void;
  onBack: () => void;
  onBiometricPress: () => void;
  onChangePasswordPress: () => void;
  onChatPress: () => void;
  onConnectionLogsPress: () => void;
  onControlPress: () => void;
  onFeedbackPress: () => void;
  onLanguagePress: () => void;
  onLaunchPress: () => void;
  onLogout: () => void;
  onPermissionsPress: () => void;
  onPrivacyPress: () => void;
  onPrivacySecurityPress: () => void;
  onStreamingPress: () => void;
  onSystemLogsPress: () => void;
  onTermsPress: () => void;
  onTrustedDevicesPress: () => void;
  onTwoFactorPress: () => void;
  onUpgradePress: () => void;
  onSignInPress: () => void;
  user: SettingsUser | null;
}) {
  const { t, lang } = useTranslation();
  const displayName = user?.name || user?.email?.split('@')[0] || t('Remote 365 user');
  const initials = initialsFor(displayName);
  const [streamingQuality] = useSetting<string>(SETTING_KEYS.streamingQuality, 'auto');
  const [keepOnline] = useSetting(SETTING_KEYS.keepPresenceOnline, true);
  // Biometric row used to hardcode "Off" — read the persisted value so the row
  // reflects what BiometricScreen actually applied.
  const [biometricEnabled] = useSetting(SETTING_KEYS.biometricEnabled, false);
  const twoFactorDetail = (user as any)?.is_2fa_enabled ? t('On') : t('Off');
  const currentLangNative = LANGUAGES.find((l) => l.code === lang)?.native || 'English';
  const signedIn = Boolean(user && user.email);
  const { circle, type, maxFontSizeMultiplier } = useResponsive();

  return (
    <SettingsPage title={t('Settings')} onBack={onBack}>
        {signedIn ? (
          <Section title={t('Account')}>
            <Pressable style={styles.profileRow} onPress={onAccountPress}>
              <View style={[styles.avatar, circle(32)]}>
                <Text style={[styles.avatarText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={[styles.profileTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{displayName}</Text>
                <Text style={[styles.profileMeta, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{user?.email || t('Not signed in')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#858687" />
            </Pressable>
            <SettingsRow icon="bar-chart-2" title={t('Upgrade Remote 365')} onPress={onUpgradePress} />
            <SettingsRow icon="shield" title={t('Trusted devices')} onPress={onTrustedDevicesPress} />
            <SettingsRow icon="message-circle" title={t('Chat')} onPress={onChatPress} />
            <SettingsRow icon="mouse-pointer" title={t('Control')} onPress={onControlPress} />
            <SettingsRow icon="star" title={t('Feedback')} onPress={onFeedbackPress} />
          </Section>
        ) : (
          <Pressable style={styles.signInCta} onPress={onSignInPress}>
            <View style={styles.signInCtaIcon}>
              <Feather name="user" size={20} color="#FF8A00" />
            </View>
            <View style={styles.profileCopy}>
              <Text style={[styles.signInCtaTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Sign in to your account')}</Text>
              <Text style={[styles.profileMeta, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Access your devices, chats and meetings.')}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#858687" />
          </Pressable>
        )}

        <Section title={t('Configuration')}>
          <SettingsRow icon="globe" title={t('Language')} detail={currentLangNative} onPress={onLanguagePress} />
          {signedIn ? (
            <SettingsRow icon="wifi" title={t('Presence')} detail={keepOnline ? t('Online') : t('Off')} onPress={onLaunchPress} />
          ) : null}
          <SettingsRow icon="radio" title={t('Streaming quality')} detail={t(QUALITY_LABELS[streamingQuality] || 'Auto')} onPress={onStreamingPress} />
          <SettingsRow icon="check-circle" title={t('Permissions')} onPress={onPermissionsPress} />
        </Section>

        {signedIn ? (
          <Section title={t('Security')}>
            <SettingsRow icon="unlock" title={t('Biometric access')} detail={biometricEnabled ? t('On') : t('Off')} onPress={onBiometricPress} />
            <SettingsRow icon="key" title={t('Change password')} onPress={onChangePasswordPress} />
            <SettingsRow icon="lock" title={t('Two-factor authentication')} detail={twoFactorDetail} onPress={onTwoFactorPress} />
            <SettingsRow icon="shield" title={t('Privacy and security')} onPress={onPrivacySecurityPress} />
          </Section>
        ) : null}

        {signedIn ? (
          <Section title={t('Logs')}>
            <SettingsRow icon="file-text" title={t('Connection logs')} onPress={onConnectionLogsPress} />
            <SettingsRow icon="list" title={t('System info')} onPress={onSystemLogsPress} />
          </Section>
        ) : null}

        <Section title={t('About Remote 365')}>
          <SettingsRow icon="file" title={t('Terms of service')} onPress={onTermsPress} />
          <SettingsRow icon="file-text" title={t('Privacy policy')} onPress={onPrivacyPress} />
          <SettingsRow icon="info" title={t('Version')} detail="1.0.0" />
        </Section>

        {signedIn ? (
          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Feather name="log-out" size={16} color="#D92D20" />
            <Text style={[styles.logoutText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Log out')}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.signInButton} onPress={onSignInPress}>
            <Text style={[styles.signInButtonText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Sign in')}</Text>
          </Pressable>
        )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  signInCta: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    width: '100%',
  },
  signInCtaIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 138, 0, 0.12)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  signInCtaTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  signInButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
    paddingVertical: 12,
    width: '100%',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingVertical: 10,
    width: '100%',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F9F5FF',
    borderRadius: 100,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  avatarText: {
    color: '#7F56D9',
    fontWeight: '500',
    textAlign: 'center',
  },
  profileCopy: { flex: 1, minWidth: 0 },
  profileTitle: {
    color: '#111315',
    flexShrink: 1,
    fontWeight: '400',
  },
  profileMeta: {
    color: '#535862',
    flexShrink: 1,
    fontWeight: '400',
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: 'rgba(217, 45, 32, 0.25)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
    // 11, not 12: the 1dp border sits inside the box, so 20dp of text + 22 + 2 keeps
    // the pill at exactly the 44dp it measured before minHeight replaced height.
    paddingVertical: 11,
    width: '100%',
  },
  logoutText: {
    color: '#D92D20',
    fontWeight: '500',
  },
}));
