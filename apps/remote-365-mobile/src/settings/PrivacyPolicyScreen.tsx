import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsPage } from './SettingsScaffold';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

type Section = { title: string; paragraphs: string[]; bullets?: string[] };

const SECTIONS: Section[] = [
  {
    title: '1. Introduction',
    paragraphs: [
      'Welcome to Remote 365. Remote 365 ("Remote 365", "we", "our", or "us") provides secure remote desktop access, device management, collaboration, and support services for individuals, businesses, and enterprise organizations.',
      'This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you:',
      'By using Remote 365, you agree to the practices described in this Privacy Policy.',
    ],
    bullets: [
      'Access our website',
      'Create an account',
      'Use our desktop or mobile applications',
      'Initiate or receive remote support sessions',
      'Communicate with our support team',
      'Use any related services offered by Remote 365',
    ],
  },
  {
    title: '2. Information We Collect',
    paragraphs: [
      'We collect the information needed to create your account, keep your devices connected, and provide secure remote access services.',
      'This can include account details, device identifiers, connection metadata, support messages, and diagnostic information that helps us keep Remote 365 reliable.',
    ],
  },
  {
    title: '3. How We Protect Data',
    paragraphs: [
      'We use technical and organizational safeguards designed to protect your information from unauthorized access, loss, misuse, or alteration.',
      'Remote sessions, account access, and device communication are handled with security controls that support safe use across desktop and mobile clients.',
    ],
  },
  {
    title: '4. Cookies and Tracking',
    paragraphs: [
      'We may use cookies and similar technologies to keep you signed in, remember preferences, improve reliability, and understand how Remote 365 is used.',
      'You can manage cookies through your browser settings where available.',
    ],
  },
  {
    title: '5. Your Privacy Rights',
    paragraphs: [
      'You may have rights to access, correct, delete, or request a copy of your personal information depending on your location and applicable law.',
      'You can contact Remote 365 support to request help with account or privacy-related actions.',
    ],
  },
  {
    title: '6. Security and Compliance',
    paragraphs: [
      'Remote 365 is built with security-conscious practices for remote access, account protection, and device management workflows.',
      'We review our controls as the product evolves and work to keep our services aligned with applicable privacy and security expectations.',
    ],
  },
  {
    title: '7. Contact Us',
    paragraphs: [
      'If you have questions about this Privacy Policy or how Remote 365 handles your information, contact our support team.',
      'We will review your request and respond through the appropriate account or support channel.',
    ],
  },
];

export function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
  // Accordion: exactly one section open at a time, the first open by default.
  const [openIndex, setOpenIndex] = useState(0);
  const { type, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  return (
    <SettingsPage title={t('Privacy Policy')} onBack={onBack} contentStyle={styles.content}>
      {/* Intro (Figma: centered title, summary, effective date) */}
      <View style={styles.intro}>
        <Text style={[styles.heading, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Remote 365: {t('Privacy Policy')}</Text>
        <Text style={[styles.summary, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
          At Remote 365, your privacy and security are fundamental to everything we build. This Privacy Policy explains how we collect, use, store, and protect your information when you use our remote access platform and related services.
        </Text>
        <Text style={[styles.date, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Effective Date')}: May 23, 2026</Text>
      </View>

      {/* Accordion sections — tapping a header opens it and closes the others. */}
      <View style={styles.document}>
        {SECTIONS.map((section, sectionIndex) => {
          const open = openIndex === sectionIndex;
          return (
            <View key={section.title} style={styles.section}>
              <Pressable
                style={[styles.sectionHeader, open && styles.sectionHeaderOpen]}
                onPress={() => setOpenIndex(open ? -1 : sectionIndex)}
              >
                <Text style={[styles.sectionHeaderText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={2}>{t(section.title)}</Text>
                <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#FFFFFF" />
              </Pressable>
              {open ? (
                <View style={styles.sectionBody}>
                  {section.paragraphs.map((paragraph, index) => (
                    <React.Fragment key={`${section.title}-${index}`}>
                      <Text style={[styles.bodyText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{paragraph}</Text>
                      {index === 1 && section.bullets ? (
                        <View style={styles.bulletList}>
                          {section.bullets.map((bullet) => (
                            <View key={bullet} style={styles.bulletRow}>
                              <Text style={[styles.bulletDot, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{'•'}</Text>
                              <Text style={[styles.bulletText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{bullet}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </React.Fragment>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  content: { alignItems: 'stretch', gap: 32 },
  intro: { alignItems: 'center', gap: 16, width: '100%' },
  heading: { color: '#000000', fontWeight: '600', textAlign: 'center' },
  summary: { color: '#000000', fontWeight: '400', textAlign: 'center' },
  date: { color: '#000000', fontWeight: '500', textAlign: 'center' },
  document: { gap: 12, width: '100%' },
  section: { gap: 8, width: '100%' },
  sectionHeader: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  sectionHeaderOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  sectionHeaderText: { color: '#FFFFFF', flexShrink: 1, fontWeight: '500' },
  sectionBody: { gap: 8, width: '100%' },
  bodyText: { color: '#000000', fontWeight: '400', width: '100%' },
  bulletList: { gap: 2, paddingLeft: 12, width: '100%' },
  bulletRow: { flexDirection: 'row', gap: 8, width: '100%' },
  // fontWeight '400' is the RN default, but monaFontStyles only injects the Mona Sans family into
  // entries that carry a text property — without it these fall back to the platform font.
  bulletDot: { color: '#000000', fontWeight: '400' },
  bulletText: { color: '#000000', flex: 1, fontWeight: '400' },
}));
