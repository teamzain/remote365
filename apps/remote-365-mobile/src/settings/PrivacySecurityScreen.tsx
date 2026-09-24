import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsPage, SettingsRow, SettingsToggleRow, Section } from './SettingsScaffold';
import { clearLocalCache, SETTING_KEYS, useSetting } from './settingsPrefs';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';

export function PrivacySecurityScreen({ onBack }: { onBack: () => void }) {
  const [hidePreviews, setHidePreviews] = useSetting(SETTING_KEYS.privacyHidePreviews, false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState<string | null>(null);
  const { maxFontSizeMultiplier, type } = useResponsive();
  const { t } = useTranslation();

  const handleClear = async () => {
    setClearing(true);
    const removed = await clearLocalCache();
    setClearing(false);
    setCleared(
      removed > 0
        ? `${t('Cleared')} ${removed} ${removed === 1 ? t('cached item.') : t('cached items.')}`
        : t('Cache is already empty.'),
    );
    setTimeout(() => setCleared(null), 3500);
  };

  return (
    <SettingsPage title={t('Privacy and security')} onBack={onBack}>
      <Section title={t('Privacy')}>
        <SettingsRow icon="lock" iconColor="#14AE5C" title={t('Session encryption')} detail={t('Always on')} />
        <SettingsToggleRow
          icon="eye-off"
          title={t('Hide sensitive previews')}
          subtitle={t('Blur message and media previews in notifications.')}
          value={hidePreviews}
          onValueChange={setHidePreviews}
        />
      </Section>

      <Section title={t('Storage')}>
        <Pressable style={styles.dangerRow} onPress={handleClear} disabled={clearing}>
          <View style={styles.dangerLeft}>
            <Feather name="trash-2" size={16} color="#D92D20" />
            <Text style={[styles.dangerText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{clearing ? t('Clearing…') : t('Clear local cache')}</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#858687" />
        </Pressable>
        {cleared ? <Text style={[styles.clearedText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{cleared}</Text> : null}
      </Section>
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  dangerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: 10,
    width: '100%',
  },
  // Matches SettingsScaffold's rowLeft/rowTitle: without flex/minWidth/flexShrink the label
  // cannot give way and pushes the chevron past the row's right edge.
  dangerLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  dangerText: {
    color: '#D92D20',
    flexShrink: 1,
    fontWeight: '500',
  },
  clearedText: {
    color: '#14AE5C',
    fontWeight: '400',
  },
}));
