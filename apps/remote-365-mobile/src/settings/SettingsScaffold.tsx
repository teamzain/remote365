import React from 'react';
import { useResponsive } from '../lib/useResponsive';
import { MIN_TOUCH } from '../lib/responsive';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { monaFontStyles } from '../lib/monaSans';

export type SettingsUser = {
  id: string;
  email: string;
  name?: string | null;
};

export function initialsFor(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'R';
}

export function SettingsHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { insets, headerHeight, type, maxFontSizeMultiplier } = useResponsive();

  return (
    <View style={[styles.header, { minHeight: headerHeight + insets.top, paddingTop: insets.top }]}>
      <Pressable style={styles.headerTitle} onPress={onBack}>
        <Feather name="arrow-left" size={20} color="#111315" />
        <Text style={[styles.title, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={2}>{title}</Text>
      </Pressable>
    </View>
  );
}

export function SettingsPage({
  children,
  contentStyle,
  onBack,
  scroll = true,
  title,
}: {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  onBack: () => void;
  scroll?: boolean;
  title: string;
}) {
  const { gutter } = useResponsive();
  // `contentStyle` lands on a ScrollView's contentContainerStyle, where `flex` pins the content to
  // exactly the viewport height and silently kills scrolling. Translate it to `flexGrow`.
  const { flex: contentFlex, ...restContentStyle } = (contentStyle ?? {}) as ViewStyle;
  const content = [
    styles.content,
    restContentStyle,
    typeof contentFlex === 'number' ? { flexGrow: contentFlex } : null,
    { paddingHorizontal: gutter },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <SettingsHeader title={title} onBack={onBack} />
      {/* Android declares windowSoftInputMode="adjustResize", so the window is already shrunk by the
          IME — behavior="height" would subtract the keyboard a second time. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={content}>{children}</View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function SettingsRow({
  detail,
  icon,
  iconColor = '#14AE5C',
  onPress,
  title,
}: {
  detail?: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  onPress?: () => void;
  title: string;
}) {
  const { stackActions, type, maxFontSizeMultiplier } = useResponsive();
  // The 45%-wide detail column cannot grow with the type, so on narrow screens / at large font
  // scale the value moves under the title instead of being ellipsised away.
  const stacked = Boolean(detail) && stackActions;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Feather name={icon} size={16} color={iconColor} />
        <View style={styles.rowLabelGroup}>
          <Text style={[styles.rowTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          {stacked ? (
            <Text style={[styles.rowMeta, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{detail}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {detail && !stacked ? (
          <Text style={[styles.rowMeta, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>{detail}</Text>
        ) : null}
        {onPress ? <Feather name="chevron-right" size={16} color="#858687" /> : null}
      </View>
    </Pressable>
  );
}

/** A row carrying a real, persisted switch. */
export function SettingsToggleRow({
  icon,
  iconColor = '#14AE5C',
  onValueChange,
  subtitle,
  title,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  onValueChange: (v: boolean) => void;
  subtitle?: string;
  title: string;
  value: boolean;
}) {
  const { type, maxFontSizeMultiplier } = useResponsive();

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Feather name={icon} size={16} color={iconColor} />
        <View style={styles.rowLabelGroup}>
          <Text style={[styles.rowTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          {subtitle ? <Text style={[styles.rowMeta, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{subtitle}</Text> : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor="#FFFFFF"
        trackColor={{ false: 'rgba(26,29,33,0.2)', true: '#FF8A00' }}
      />
    </View>
  );
}

/** A selectable (radio) row for choosing one option from a group. */
export function SettingsOptionRow({
  icon,
  onPress,
  selected,
  subtitle,
  title,
}: {
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  selected: boolean;
  subtitle?: string;
  title: string;
}) {
  const { type, maxFontSizeMultiplier } = useResponsive();

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        {icon ? <Feather name={icon} size={16} color={selected ? '#FF8A00' : '#858687'} /> : null}
        <View style={styles.rowLabelGroup}>
          <Text style={[styles.rowTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          {subtitle ? <Text style={[styles.rowMeta, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{subtitle}</Text> : null}
        </View>
      </View>
      {selected ? <Feather name="check" size={18} color="#FF8A00" /> : null}
    </Pressable>
  );
}

export function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const { type, maxFontSizeMultiplier } = useResponsive();

  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function SimpleSettingsScreen({
  body,
  onBack,
  rows,
  title,
}: {
  body?: string;
  onBack: () => void;
  rows?: Array<{ icon: keyof typeof Feather.glyphMap; title: string; detail?: string }>;
  title: string;
}) {
  const { type, maxFontSizeMultiplier } = useResponsive();

  return (
    <SettingsPage title={title} onBack={onBack}>
      {body ? (
        <View style={styles.intro}>
          <Text style={[styles.introTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          <Text style={[styles.introBody, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{body}</Text>
        </View>
      ) : null}
      {rows?.length ? (
        <Section>
          {rows.map((row) => (
            <SettingsRow key={row.title} icon={row.icon} title={row.title} detail={row.detail} />
          ))}
        </Section>
      ) : null}
    </SettingsPage>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  screen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    minHeight: MIN_TOUCH,
    minWidth: 0,
    flex: 1
  },
  title: {
    color: '#111315',
    flexShrink: 1,
    fontWeight: '600'
  },
  content: {
    gap: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 24,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    flexGrow: 1
  },
  section: {
    gap: 8,
    width: '100%',
  },
  sectionTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: 10,
    width: '100%',
    gap: 12
  },
  rowLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  rowLabelGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  rowRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    maxWidth: '45%',
    flexShrink: 1
  },
  rowTitle: {
    color: '#111315',
    flexShrink: 1,
    fontWeight: '400'
  },
  rowMeta: {
    color: '#535862',
    flexShrink: 1,
    fontWeight: '400',
  },
  intro: {
    gap: 4,
    width: '100%',
  },
  introTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  introBody: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
  },
}));

export const settingsSharedStyles = styles;
