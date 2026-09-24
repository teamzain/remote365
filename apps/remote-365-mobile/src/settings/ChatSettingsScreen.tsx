import React from 'react';
import { SettingsOptionRow, SettingsPage, SettingsToggleRow, Section } from './SettingsScaffold';
import { SETTING_KEYS, useSetting } from './settingsPrefs';
import { useTranslation } from '../lib/i18n';

type AutoDownload = 'wifi' | 'always' | 'never';

export function ChatSettingsScreen({ onBack }: { onBack: () => void }) {
  const [notifications, setNotifications] = useSetting(SETTING_KEYS.chatNotifications, true);
  const [previews, setPreviews] = useSetting(SETTING_KEYS.chatPreviews, true);
  const [autoDownload, setAutoDownload] = useSetting<AutoDownload>(SETTING_KEYS.chatAutoDownload, 'wifi');
  const { t } = useTranslation();

  return (
    <SettingsPage title={t('Chat')} onBack={onBack}>
      <Section title={t('Notifications')}>
        <SettingsToggleRow
          icon="bell"
          title={t('Message notifications')}
          subtitle={t('Get notified about new chat messages.')}
          value={notifications}
          onValueChange={setNotifications}
        />
        <SettingsToggleRow
          icon="eye"
          title={t('Message previews')}
          subtitle={t('Show the message text in notifications.')}
          value={previews}
          onValueChange={setPreviews}
        />
      </Section>

      <Section title={t('Auto-download media')}>
        <SettingsOptionRow
          icon="wifi"
          title={t('On Wi-Fi only')}
          selected={autoDownload === 'wifi'}
          onPress={() => setAutoDownload('wifi')}
        />
        <SettingsOptionRow
          icon="download"
          title={t('Always')}
          selected={autoDownload === 'always'}
          onPress={() => setAutoDownload('always')}
        />
        <SettingsOptionRow
          icon="x-circle"
          title={t('Never')}
          selected={autoDownload === 'never'}
          onPress={() => setAutoDownload('never')}
        />
      </Section>
    </SettingsPage>
  );
}
