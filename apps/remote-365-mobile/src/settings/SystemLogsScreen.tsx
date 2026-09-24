import React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { SettingsPage, SettingsRow, Section } from './SettingsScaffold';
import { useTranslation } from '../lib/i18n';

/** Real, read-only device & app diagnostics (nothing decorative). */
export function SystemLogsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const appVersion = (Constants.expoConfig as any)?.version || (Constants as any).nativeAppVersion || '1.0.0';
  const runtime = (Constants.expoConfig as any)?.runtimeVersion || (Constants as any).expoRuntimeVersion || '—';
  const deviceName = (Constants as any)?.deviceName || t('This device');
  const platform = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${String(Platform.Version)}`;

  return (
    <SettingsPage title={t('System info')} onBack={onBack}>
      <Section title={t('Application')}>
        <SettingsRow icon="info" iconColor="#14AE5C" title={t('App version')} detail={String(appVersion)} />
        <SettingsRow icon="layers" iconColor="#14AE5C" title={t('Runtime')} detail={String(runtime)} />
      </Section>
      <Section title={t('Device')}>
        <SettingsRow icon="smartphone" iconColor="#14AE5C" title={t('Device')} detail={String(deviceName)} />
        <SettingsRow icon="cpu" iconColor="#14AE5C" title={t('Platform')} detail={platform} />
      </Section>
    </SettingsPage>
  );
}
