import React, { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsPage } from './SettingsScaffold';
import { fetchSessions, revokeSession, type AuthSession } from './accountApi';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

function deviceOf(ua = '', t: (s: string) => string): { icon: keyof typeof Feather.glyphMap; label: string } {
  const s = ua.toLowerCase();
  // Most-specific first. The desktop app's Electron UA *also* contains
  // "Windows", so the app checks must run before the plain OS/browser ones or
  // every desktop-app login shows up as a generic "Windows desktop".
  if (s.includes('electron') || s.includes('remote 365') || s.includes('remote365') || s.includes('remotelink')) {
    return { icon: 'monitor', label: `Remote 365 ${t('Desktop')}` };
  }
  if (s.includes('okhttp') || s.includes('expo') || s.includes('reactnative') || s.includes('react-native') || s.includes('cfnetwork') || s.includes('darwin')) {
    return { icon: 'smartphone', label: `Remote 365 ${t('mobile app')}` };
  }
  const os = s.includes('windows') ? 'Windows'
    : s.includes('mac os') || s.includes('macintosh') ? 'Mac'
    : s.includes('android') ? 'Android'
    : s.includes('iphone') || s.includes('ipad') ? 'iOS'
    : s.includes('linux') ? 'Linux'
    : '';
  const browser = s.includes('edg/') ? 'Edge'
    : s.includes('opr/') || s.includes('opera') ? 'Opera'
    : s.includes('chrome') ? 'Chrome'
    : s.includes('firefox') ? 'Firefox'
    : s.includes('safari') ? 'Safari'
    : '';
  if (browser && os) return { icon: os === 'Android' || os === 'iOS' ? 'smartphone' : 'globe', label: `${browser} ${t('on')} ${os}` };
  if (browser) return { icon: 'globe', label: `${browser} ${t('browser')}` };
  if (os === 'Android') return { icon: 'smartphone', label: `Android ${t('device')}` };
  if (os === 'iOS') return { icon: 'smartphone', label: `iOS ${t('device')}` };
  if (os) return { icon: 'monitor', label: `${os} ${t('desktop')}` };
  return { icon: 'globe', label: t('Web session') };
}

function timeAgo(iso: string | undefined, t: (s: string) => string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('Active now');
  if (m < 60) return `${m}${t('m ago')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${t('h ago')}`;
  return `${Math.floor(h / 24)}${t('d ago')}`;
}

export function TrustedDevicesScreen({
  apiBaseUrl,
  authToken,
  onBack,
}: {
  apiBaseUrl: string;
  authToken: string | null;
  onBack: () => void;
}) {
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  const load = async () => {
    setLoading(true);
    setSessions(await fetchSessions(apiBaseUrl, authToken));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRevoke = async (id: string) => {
    setBusyId(id);
    const res = await revokeSession(apiBaseUrl, authToken, id);
    setBusyId(null);
    if (res.ok) setSessions((cur) => cur.filter((s) => s.id !== id));
  };

  return (
    <SettingsPage title={t('Trusted Devices')} onBack={onBack}>
      <View style={styles.intro}>
        <Text style={[styles.introTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Manage trusted devices')}</Text>
        <Text style={[styles.introText, type(11, 16 / 11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t("These devices and browsers are currently signed in to your account. Sign out any you don't recognise.")}</Text>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color="#FF8A00" /></View>
      ) : sessions.length === 0 ? (
        <Text style={[styles.empty, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('No active sessions found.')}</Text>
      ) : (
        <View style={styles.rows}>
          {sessions.map((session) => {
            const meta = deviceOf(session.userAgent, t);
            const busy = busyId === session.id;
            return (
              <View key={session.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.iconWrap}>
                    <Feather name={meta.icon} size={16} color="#111315" />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{meta.label}</Text>
                    <Text style={[styles.rowMeta, type(11, 15 / 11)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>
                      {session.isCurrent ? t('This device') : timeAgo(session.lastSeen, t)}
                      {session.ip ? ` · ${session.ip}` : ''}
                    </Text>
                  </View>
                </View>
                {session.isCurrent ? (
                  <View style={styles.pill}><Text style={[styles.pillText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Current')}</Text></View>
                ) : busy ? (
                  <ActivityIndicator size="small" color="#D92D20" />
                ) : (
                  <Pressable hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }} onPress={() => handleRevoke(session.id)}>
                    <Text style={[styles.revoke, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Sign out')}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  intro: { gap: 4, width: '100%' },
  introTitle: { color: '#111315', fontWeight: '500' },
  // fontWeight '400' is the RN default, but monaFontStyles only injects the Mona Sans family into
  // entries that carry a text property — stripping fontSize/lineHeight would otherwise drop these
  // back to the platform font.
  introText: { color: 'rgba(26, 29, 33, 0.7)', fontWeight: '400' },
  loading: { paddingVertical: 32 },
  empty: { color: 'rgba(17,19,21,0.55)', fontWeight: '400', paddingVertical: 12 },
  rows: { gap: 8, width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 51, paddingVertical: 10 },
  rowLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  iconWrap: { alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#111315', fontWeight: '400' },
  rowMeta: { color: 'rgba(26, 29, 33, 0.7)', fontWeight: '400' },
  pill: { alignItems: 'center', backgroundColor: 'rgba(20, 174, 92, 0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { color: '#14AE5C', fontWeight: '600' },
  revoke: { color: '#D92D20', fontWeight: '600' },
}));
