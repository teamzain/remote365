import React from 'react';
import { SettingsOptionRow, SettingsPage, Section } from './SettingsScaffold';
import { LANGUAGES, useTranslation } from '../lib/i18n';

export function LanguageScreen({ onBack }: { onBack: () => void }) {
  const { lang, setLang, t } = useTranslation();

  return (
    <SettingsPage title={t('Language')} onBack={onBack}>
      <Section title={t('App language')}>
        {LANGUAGES.map((item) => (
          <SettingsOptionRow
            key={item.code}
            icon="globe"
            title={item.native}
            subtitle={item.label !== item.native ? item.label : undefined}
            selected={lang === item.code}
            onPress={() => setLang(item.code)}
          />
        ))}
      </Section>
    </SettingsPage>
  );
}
