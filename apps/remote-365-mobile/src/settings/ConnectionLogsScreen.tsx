import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SettingsPage } from './SettingsScaffold';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

/**
 * We don't persist a connection-event log on the device, so instead of fake
 * entries this shows an honest empty state.
 */
export function ConnectionLogsScreen({ onBack }: { onBack: () => void }) {
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  return (
    <SettingsPage title={t('Connection logs')} onBack={onBack} contentStyle={styles.center}>
      <View style={styles.empty}>
        <Feather name="activity" size={30} color="rgba(17,19,21,0.3)" />
        <Text style={[styles.emptyTitle, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('No recent connection issues')}</Text>
        <Text style={[styles.emptyBody, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Remote access problems on this device would be listed here.')}</Text>
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  center: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#111315',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    color: 'rgba(17,19,21,0.55)',
    textAlign: 'center',
  },
}));
