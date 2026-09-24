import React from 'react';
import { SimpleSettingsScreen } from './SettingsScaffold';
import { useTranslation } from '../lib/i18n';

export function TermsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <SimpleSettingsScreen
      title={t('Terms of service')}
      onBack={onBack}
      body="By using Remote 365, you agree to use the service responsibly, protect your credentials, and follow applicable laws while accessing remote devices."
    />
  );
}
