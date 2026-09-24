import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';

export type ServiceQueueItem = {
  conversationId: string;
  from: string;
  date: string;
  code: string;
};

/**
 * Service queue: chats whose newest message is a session invite — people
 * currently waiting for this user to join their session. Join connects via
 * the invite code; opening the chat lets the user reply first.
 */
export function ServiceQueueScreen({
  items,
  onBack,
  onJoin,
  onOpenChat,
  header,
  bottomNav,
}: {
  items: ServiceQueueItem[];
  onBack: () => void;
  onJoin: (code: string) => void;
  onOpenChat: (conversationId: string) => void;
  /** App-styled header frame wrapper (keeps this file free of App.tsx styles). */
  header: (content: React.ReactNode) => React.ReactNode;
  bottomNav: React.ReactNode;
}) {
  const { control, type, textSize, maxFontSizeMultiplier, navClearance } = useResponsive();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      {header(
        <Pressable style={styles.headerTitleRow} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.headerTitle, textSize(18)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {t('Service queue')}
          </Text>
        </Pressable>,
      )}

      {items.length > 0 ? (
        <ScrollView style={styles.list} contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(130, navClearance) }]}>
          <Text style={[styles.sectionTitle, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {`${items.length} ${items.length === 1 ? t('pending request') : t('pending requests')}`}
          </Text>
          {items.map((item) => (
            <View key={item.conversationId} style={styles.row}>
              <View style={styles.rowIcon}>
                <Feather name="life-buoy" size={18} color="#FF8A00" />
              </View>
              <Pressable style={styles.rowCopy} onPress={() => onOpenChat(item.conversationId)}>
                <Text
                  style={[styles.rowName, textSize(14)]}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                  numberOfLines={1}
                >
                  {item.from}
                </Text>
                <Text
                  style={[styles.rowMeta, textSize(12)]}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                  numberOfLines={1}
                >
                  {`${t('Session invite')} · ${item.date}`}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.joinButton, control(34)]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => onJoin(item.code)}
              >
                <Text
                  style={[styles.joinText, type(13)]}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                  numberOfLines={1}
                >
                  {t('Join')}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        // Scrollable so the copy stays reachable in short windows (split-screen) and at large
        // font sizes; flexGrow keeps it centred whenever it does fit.
        <ScrollView style={styles.emptyScroll} contentContainerStyle={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="inbox" size={26} color="#C8CACC" />
          </View>
          <Text style={[styles.emptyTitle, textSize(16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {t('Queue is clear')}
          </Text>
          <Text style={[styles.emptyText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {t('When someone sends you a session invite in chat, it appears here so you can join with one tap.')}
          </Text>
        </ScrollView>
      )}

      {bottomNav}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  screen: { flex: 1 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitle: { fontWeight: '600', color: '#111315' },
  list: { flex: 1 },
  listContent: { padding: 20, gap: 10, paddingBottom: 130 },
  sectionTitle: { fontWeight: '600', color: 'rgba(17,19,21,0.55)', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,138,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1 },
  rowName: { fontWeight: '500', color: '#111315' },
  rowMeta: { color: 'rgba(17,19,21,0.55)' },
  joinButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinText: { fontWeight: '600', color: '#FFFFFF' },
  emptyScroll: { flex: 1 },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(17,19,21,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontWeight: '600', color: '#111315' },
  emptyText: { color: 'rgba(17,19,21,0.55)', textAlign: 'center', maxWidth: 260 },
}));
