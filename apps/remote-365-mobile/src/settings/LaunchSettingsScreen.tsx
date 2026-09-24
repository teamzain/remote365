import React from 'react';
import { SettingsPage, SettingsToggleRow, Section } from './SettingsScaffold';
import { SETTING_KEYS, useSetting } from './settingsPrefs';
import { useTranslation } from '../lib/i18n';

/**
 * Mobile has no "start on device boot", so this screen covers the presence
 * behaviour that actually applies on a phone.
 */
export function LaunchSettingsScreen({ onBack }: { onBack: () => void }) {
  const [keepOnline, setKeepOnline] = useSetting(SETTING_KEYS.keepPresenceOnline, true);
  const { t } = useTranslation();

  return (
    <SettingsPage title={t('Presence')} onBack={onBack}>
      <Section title={t('Availability')}>
        <SettingsToggleRow
          icon="wifi"
          title={t('Keep me online')}
          subtitle={t('Stay visible as online to your contacts while the app is open.')}
          value={keepOnline}
          onValueChange={setKeepOnline}
        />
      </Section>
    </SettingsPage>
  );
}
