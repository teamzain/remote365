import React, { useCallback, useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Section, SettingsPage } from './SettingsScaffold';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';

// Optional native modules — loaded defensively so a dev build missing one
// doesn't crash the settings screen.
let Notifications: any = null;
let ImagePicker: any = null;
try { Notifications = require('expo-notifications'); } catch { Notifications = null; }
try { ImagePicker = require('expo-image-picker'); } catch { ImagePicker = null; }

type Status = 'granted' | 'denied' | 'undetermined' | 'unknown';

const LABEL: Record<Status, string> = {
  granted: 'Allowed',
  denied: 'Denied',
  undetermined: 'Not set',
  unknown: 'Tap to manage',
};
const COLOR: Record<Status, string> = {
  granted: '#14AE5C',
  denied: '#D92D20',
  undetermined: '#B45309',
  unknown: '#858687',
};

function normalize(status?: string): Status {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  if (status === 'undetermined') return 'undetermined';
  return 'unknown';
}

export function PermissionsScreen({ onBack }: { onBack: () => void }) {
  const [notif, setNotif] = useState<Status>('unknown');
  const [camera, setCamera] = useState<Status>('unknown');
  const [media, setMedia] = useState<Status>('unknown');
  const { t } = useTranslation();

  const refresh = useCallback(async () => {
    try {
      if (Notifications?.getPermissionsAsync) {
        const p = await Notifications.getPermissionsAsync();
        setNotif(normalize(p?.status));
      }
      if (ImagePicker?.getCameraPermissionsAsync) {
        const c = await ImagePicker.getCameraPermissionsAsync();
        setCamera(normalize(c?.status));
      }
      if (ImagePicker?.getMediaLibraryPermissionsAsync) {
        const m = await ImagePicker.getMediaLibraryPermissionsAsync();
        setMedia(normalize(m?.status));
      }
    } catch {
      /* leave as 'unknown' */
    }
  }, []);

  // Re-check on mount and whenever the app returns to the foreground (the user
  // may have changed a permission in the OS settings screen).
  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const openSettings = () => { void Linking.openSettings(); };

  const requestNotif = async () => {
    if (notif === 'undetermined' && Notifications?.requestPermissionsAsync) {
      const p = await Notifications.requestPermissionsAsync();
      setNotif(normalize(p?.status));
    } else {
      openSettings();
    }
  };
  const requestCamera = async () => {
    if (camera === 'undetermined' && ImagePicker?.requestCameraPermissionsAsync) {
      const c = await ImagePicker.requestCameraPermissionsAsync();
      setCamera(normalize(c?.status));
    } else {
      openSettings();
    }
  };
  const requestMedia = async () => {
    if (media === 'undetermined' && ImagePicker?.requestMediaLibraryPermissionsAsync) {
      const m = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setMedia(normalize(m?.status));
    } else {
      openSettings();
    }
  };

  return (
    <SettingsPage title={t('Permissions')} onBack={onBack}>
      <Section title={t('Recommended')}>
        <PermissionRow icon="bell" title={t('Notifications')} status={notif} onPress={requestNotif} />
      </Section>
      <Section title={t('Used by meetings & chat')}>
        <PermissionRow icon="camera" title={t('Camera')} status={camera} onPress={requestCamera} />
        <PermissionRow icon="image" title={t('Photos & files')} status={media} onPress={requestMedia} />
        <PermissionRow icon="mic" title={t('Microphone')} status="unknown" onPress={openSettings} />
      </Section>
    </SettingsPage>
  );
}

function PermissionRow({
  icon,
  onPress,
  status,
  title,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  status: Status;
  title: string;
}) {
  const { maxFontSizeMultiplier, type } = useResponsive();
  const { t } = useTranslation();

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Feather name={icon} size={16} color="#111315" />
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          <Text style={[styles.rowStatus, type(10, 14 / 10), { color: COLOR[status] }]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t(LABEL[status])}</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color="#858687" />
    </Pressable>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 51, paddingVertical: 10, width: '100%' },
  rowLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#111315', fontWeight: '400' },
  rowStatus: { fontWeight: '500' },
}));
