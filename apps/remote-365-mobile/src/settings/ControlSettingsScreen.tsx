import React from 'react';
import { SettingsOptionRow, SettingsPage, SettingsToggleRow, Section } from './SettingsScaffold';
import { SETTING_KEYS, useSetting } from './settingsPrefs';
import { useTranslation } from '../lib/i18n';

type PointerMode = 'touch' | 'trackpad';

export function ControlSettingsScreen({ onBack }: { onBack: () => void }) {
  const [pointerMode, setPointerMode] = useSetting<PointerMode>(SETTING_KEYS.controlPointerMode, 'touch');
  const [keyboard, setKeyboard] = useSetting(SETTING_KEYS.controlKeyboard, true);
  const [askBefore, setAskBefore] = useSetting(SETTING_KEYS.controlAskBeforeControl, true);
  const { t } = useTranslation();

  return (
    <SettingsPage title={t('Control')} onBack={onBack}>
      <Section title={t('Pointer mode')}>
        <SettingsOptionRow
          icon="mouse-pointer"
          title={t('Touch')}
          subtitle={t('Tap where you want to click.')}
          selected={pointerMode === 'touch'}
          onPress={() => setPointerMode('touch')}
        />
        <SettingsOptionRow
          icon="square"
          title={t('Trackpad')}
          subtitle={t('Drag to move a cursor, tap to click.')}
          selected={pointerMode === 'trackpad'}
          onPress={() => setPointerMode('trackpad')}
        />
      </Section>

      <Section title={t('Input')}>
        <SettingsToggleRow
          icon="type"
          title={t('Keyboard input')}
          subtitle={t('Allow typing on the remote device.')}
          value={keyboard}
          onValueChange={setKeyboard}
        />
        <SettingsToggleRow
          icon="shield"
          title={t('Ask before control')}
          subtitle={t('Require the host to approve before controlling.')}
          value={askBefore}
          onValueChange={setAskBefore}
        />
      </Section>
    </SettingsPage>
  );
}
