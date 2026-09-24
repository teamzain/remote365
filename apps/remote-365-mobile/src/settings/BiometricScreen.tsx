import { ResponsivePanel } from '../components/ResponsivePanel';
import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsPage } from './SettingsScaffold';
import { accountToggleStyles } from './AccountScreen';
import { SETTING_KEYS, useSetting } from './settingsPrefs';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

// Optional native module — real biometric prompt when present, otherwise the
// preference still persists so the app can enforce it once the module ships.
let LocalAuth: any = null;
try { LocalAuth = require('expo-local-authentication'); } catch { LocalAuth = null; }

const LOCK_LABELS: Record<string, string> = {
  immediate: 'Immediately',
  '1m': 'After 1 minute',
  '5m': 'After 5 minutes',
  '15m': 'After 15 minutes',
};

export function BiometricScreen({ onBack }: { onBack: () => void }) {
  const [biometricEnabled, setBiometricEnabled] = useSetting(SETTING_KEYS.biometricEnabled, false);
  const [lockDelay, setLockDelay] = useSetting(SETTING_KEYS.biometricLockDelay, 'immediate');
  const [lockSheetOpen, setLockSheetOpen] = useState(false);
  const [pendingDelay, setPendingDelay] = useState(lockDelay);
  const [hasHardware, setHasHardware] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  const lockOptions = [
    { id: 'immediate', label: 'Immediately' },
    { id: '1m', label: 'After 1 minute' },
    { id: '5m', label: 'After 5 minutes' },
    { id: '15m', label: 'After 15 minutes' },
  ];

  useEffect(() => {
    (async () => {
      try {
        if (LocalAuth?.hasHardwareAsync) {
          const hw = await LocalAuth.hasHardwareAsync();
          const enrolled = await LocalAuth.isEnrolledAsync();
          setHasHardware(Boolean(hw && enrolled));
        } else {
          setHasHardware(null);
        }
      } catch {
        setHasHardware(null);
      }
    })();
  }, []);

  const toggleBiometric = async () => {
    if (biometricEnabled) {
      setBiometricEnabled(false);
      setNote(null);
      return;
    }
    // Enabling — confirm with a real biometric prompt when available.
    try {
      if (LocalAuth?.authenticateAsync && LocalAuth?.hasHardwareAsync) {
        const hw = await LocalAuth.hasHardwareAsync();
        const enrolled = await LocalAuth.isEnrolledAsync();
        if (!hw || !enrolled) {
          setNote(t('No biometrics are set up on this device. Add a fingerprint or face unlock first.'));
          return;
        }
        const result = await LocalAuth.authenticateAsync({ promptMessage: t('Confirm to enable biometric unlock') });
        if (!result?.success) {
          setNote(t('Biometric confirmation was cancelled.'));
          return;
        }
      }
      setBiometricEnabled(true);
      setNote(null);
    } catch {
      // Native module not ready yet (e.g. before a rebuild) — persist the choice.
      setBiometricEnabled(true);
      setNote(null);
    }
  };

  const openLockSheet = () => { setPendingDelay(lockDelay); setLockSheetOpen(true); };
  const saveLockDelay = () => { setLockDelay(pendingDelay); setLockSheetOpen(false); };

  return (
    <SettingsPage title={t('Unlock with Biometrics')} onBack={onBack}>
      <View style={styles.rows}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Feather name="unlock" size={20} color="#111315" />
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Unlock with biometrics')}</Text>
              <Text style={[styles.rowMeta, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{biometricEnabled ? t('Enabled') : t('Disabled')}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: biometricEnabled }}
            onPress={toggleBiometric}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            style={[accountToggleStyles.toggle, biometricEnabled && accountToggleStyles.toggleOn]}
          >
            <View style={[accountToggleStyles.toggleKnob, biometricEnabled && accountToggleStyles.toggleKnobOn]} />
          </Pressable>
        </View>

        <Pressable style={styles.row} onPress={openLockSheet} disabled={!biometricEnabled}>
          <View style={styles.rowLeft}>
            <Feather name="lock" size={20} color={biometricEnabled ? '#111315' : '#B0B3B8'} />
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, !biometricEnabled && styles.rowDisabled, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Lock app')}</Text>
              <Text style={[styles.rowMeta, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t(LOCK_LABELS[lockDelay] || 'Immediately')}</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#858687" />
        </Pressable>

        {note ? <Text style={[styles.note, type(11, 16 / 11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{note}</Text> : null}
        {hasHardware === false && !note ? (
          <Text style={[styles.note, type(11, 16 / 11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Set up a fingerprint or face unlock in your device settings to use this.')}</Text>
        ) : null}
      </View>

      <Modal animationType="slide" transparent statusBarTranslucent navigationBarTranslucent visible={lockSheetOpen} onRequestClose={() => setLockSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setLockSheetOpen(false)}>
          <ResponsivePanel style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetTitleRow}>
              <Feather name="lock" size={18} color="#111315" />
              <Text style={[styles.sheetTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Lock app')}</Text>
            </View>
            {lockOptions.map((option) => (
              <Pressable key={option.id} style={styles.optionRow} onPress={() => setPendingDelay(option.id)}>
                <Text style={[styles.optionText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t(option.label)}</Text>
                <Feather name={pendingDelay === option.id ? 'check-circle' : 'circle'} size={18} color={pendingDelay === option.id ? '#FF8A00' : '#B0B3B8'} />
              </Pressable>
            ))}
            <View style={styles.sheetActions}>
              <Pressable style={styles.cancelButton} onPress={() => setLockSheetOpen(false)}>
                <Text style={[styles.cancelText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveLockDelay}>
                <Text style={[styles.saveText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Save Setting')}</Text>
              </Pressable>
            </View>
          </ResponsivePanel>
        </Pressable>
      </Modal>
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  rows: { gap: 8, width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingVertical: 12, width: '100%' },
  rowLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#111315', fontWeight: '500' },
  rowDisabled: { color: '#B0B3B8' },
  // fontWeight '400' is the RN default, but monaFontStyles only injects the Mona Sans family into
  // entries that carry a text property — without it these fall back to the platform font.
  rowMeta: { color: 'rgba(26, 29, 33, 0.7)', fontWeight: '400' },
  note: { color: 'rgba(26, 29, 33, 0.6)', fontWeight: '400', paddingTop: 4 },
  sheetBackdrop: { backgroundColor: 'rgba(243, 244, 246, 0.7)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center'
  },
  sheetTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    minHeight: 48,
    paddingVertical: 10
  },
  sheetTitle: { color: '#111315', fontWeight: '600' },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 44,
    paddingVertical: 10,
    gap: 12
  },
  optionText: {
    color: '#111315',
    flex: 1,
    fontWeight: '400'
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'stretch'
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  cancelText: { color: '#111315', fontWeight: '500' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    justifyContent: 'center',
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  saveText: { color: '#FFFFFF', fontWeight: '500' },
}));
