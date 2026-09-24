import { ResponsivePanel } from '../components/ResponsivePanel';
import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';

const SEEN_KEY = 'remote365_devices_tour_seen_v1';

type Step = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text: string;
};

const STEPS: Step[] = [
  {
    icon: 'plus-circle',
    title: 'Add devices & groups',
    text: 'Tap the + button to add a device with its Remote 365 ID, or to create a new group.',
  },
  {
    icon: 'folder',
    title: 'Organize with groups',
    text: 'Press and hold a group name to rename or delete it. Tap it to see the devices inside.',
  },
  {
    icon: 'monitor',
    title: 'Manage a device',
    text: 'Inside a list, press and hold a device (or tap ⋮) to rename it, assign it to groups, or remove it.',
  },
  {
    icon: 'cast',
    title: 'Connect instantly',
    text: 'Tap any online device to start controlling it from your phone.',
  },
];

/**
 * First-visit walkthrough for the Devices page. Shows automatically once
 * (per install), and can be replayed via `replayToken` (bump the number).
 */
export function DevicesTour({ replayToken = 0 }: { replayToken?: number }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const { control, type, textSize, maxFontSizeMultiplier, modalMaxHeight } = useResponsive();
  const { t } = useTranslation();

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (seen) return;
        setStep(0);
        setVisible(true);
        // Marked seen as soon as it is SHOWN, not when it is dismissed. Writing on
        // dismiss meant any exit that skipped `finish()` — killing the app, an
        // unmount from a tab switch mid-tour, a failed write — left the flag unset
        // and the tour greeted the user again on the next launch.
        AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
      })
      .catch(() => { /* storage unavailable — skip the tour */ });
  }, []);

  useEffect(() => {
    if (replayToken > 0) {
      setStep(0);
      setVisible(true);
    }
  }, [replayToken]);

  if (!visible) return null;

  const finish = () => {
    setVisible(false);
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={finish} />
      {/* The panel caps itself against the safe area, which does not know about
          this overlay's own padding — subtract it so the card is never trimmed. */}
      <View style={[styles.cardWrap, { maxHeight: Math.max(0, modalMaxHeight - 56) }]}>
        <ResponsivePanel style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name={current.icon} size={26} color="#FF8A00" />
          </View>
          <Text style={[styles.title, textSize(17)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t(current.title)}</Text>
          <Text style={[styles.text, type(13, 19 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t(current.text)}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, index) => (
              <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.buttons}>
            <Pressable style={styles.skipButton} onPress={finish}>
              <Text style={[styles.skipText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Skip')}</Text>
            </Pressable>
            <Pressable
              style={[styles.nextButton, control(42)]}
              onPress={() => (isLast ? finish() : setStep((s) => s + 1))}
            >
              <Text style={[styles.nextText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isLast ? t('Done') : t('Next')}</Text>
            </Pressable>
          </View>
        </ResponsivePanel>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    zIndex: 90,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,19,21,0.55)',
  },
  cardWrap: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,138,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: { fontWeight: '600', color: '#111315', textAlign: 'center' },
  text: { color: 'rgba(17,19,21,0.65)', textAlign: 'center' },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(17,19,21,0.15)',
  },
  dotActive: {
    backgroundColor: '#FF8A00',
    width: 18,
  },
  buttons: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  skipButton: { paddingVertical: 10, paddingHorizontal: 8 },
  skipText: { color: 'rgba(17,19,21,0.55)' },
  nextButton: {
    minWidth: 96,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontWeight: '600', color: '#FFFFFF' },
}));
