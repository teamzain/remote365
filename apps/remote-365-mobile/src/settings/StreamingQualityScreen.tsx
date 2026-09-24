import React from 'react';
import { SettingsOptionRow, SettingsPage, Section } from './SettingsScaffold';
import { SETTING_KEYS, useSetting } from './settingsPrefs';
import { useTranslation } from '../lib/i18n';

type Quality = 'auto' | 'smooth' | 'hd';

export function StreamingQualityScreen({ onBack }: { onBack: () => void }) {
  const [quality, setQuality] = useSetting<Quality>(SETTING_KEYS.streamingQuality, 'auto');
  const { t } = useTranslation();

  return (
    <SettingsPage title={t('Streaming quality')} onBack={onBack}>
      <Section title={t('Quality')}>
        <SettingsOptionRow
          icon="sliders"
          title={t('Auto')}
          subtitle={t('Adapts to your connection automatically.')}
          selected={quality === 'auto'}
          onPress={() => setQuality('auto')}
        />
        <SettingsOptionRow
          icon="zap"
          title={t('Smooth')}
          subtitle={t('Lower resolution for the lowest latency.')}
          selected={quality === 'smooth'}
          onPress={() => setQuality('smooth')}
        />
        <SettingsOptionRow
          icon="monitor"
          title={t('HD')}
          subtitle={t('Highest resolution — best on Wi-Fi.')}
          selected={quality === 'hd'}
          onPress={() => setQuality('hd')}
        />
      </Section>
    </SettingsPage>
  );
}
