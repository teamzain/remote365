import { useResponsive } from './src/lib/useResponsive';
import { ResponsivePanel } from './src/components/ResponsivePanel';
import { AuthScreen, REMEMBER_KEY } from './src/auth/AuthScreen';
import { createSessionManager } from './src/auth/session';
import React, { useEffect, useRef, useState } from 'react';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { MeetingHome } from './src/meetings/MeetingHome';
import { MeetingRoom } from './src/meetings/MeetingRoom';
import { MeetingPreview } from './src/meetings/MeetingPreview';
import { ChatThread } from './src/chat/ChatThread';
import { ChatEmpty } from './src/chat/ChatEmpty';
import { AddContactModal, type AddContactResult } from './src/chat/AddContactModal';
import { ChatToast } from './src/components/ChatToast';
import { useChatSocket } from './src/chat/useChatSocket';
import { SESSION_INVITE_PREFIX, humanizeDeviceMentions, parseSessionInvite, structuredMessagePreview } from './src/chat/chatApi';
import {
  addNotificationTapListener,
  registerPushToken,
  setupNotifications,
} from './src/lib/pushNotifications';

setupNotifications();
import { ConnectHome } from './src/connect/ConnectHome';
import { ScreenBackground } from './src/components/ScreenBackground';
import { FadeInView } from './src/components/FadeInView';
import { IosBottomNav } from './src/components/IosBottomNav';
import { DeviceManagement, type DeviceMgmtAction } from './src/devices/DeviceManagement';
import { DevicesTour } from './src/devices/DevicesTour';
import { ServiceQueueScreen } from './src/connect/ServiceQueueScreen';
import { formatAccessKey } from './src/lib/accessKey';
import { monaFontStyles } from './src/lib/monaSans';
import { RemoteControl } from './src/remote/RemoteControl';
import { verifyDeviceAccess } from './src/remote/remoteApi';
import { AccountScreen as SettingsAccountScreen } from './src/settings/AccountScreen';
import { BiometricScreen as SettingsBiometricScreen } from './src/settings/BiometricScreen';
import { ChatSettingsScreen } from './src/settings/ChatSettingsScreen';
import { ConnectionLogsScreen } from './src/settings/ConnectionLogsScreen';
import { ControlSettingsScreen } from './src/settings/ControlSettingsScreen';
import { FeedbackScreen as SettingsFeedbackScreen } from './src/settings/FeedbackScreen';
import { LanguageScreen } from './src/settings/LanguageScreen';
import { LaunchSettingsScreen } from './src/settings/LaunchSettingsScreen';
import { PermissionsScreen as SettingsPermissionsScreen } from './src/settings/PermissionsScreen';
import { PrivacyPolicyScreen as SettingsPrivacyPolicyScreen } from './src/settings/PrivacyPolicyScreen';
import { PrivacySecurityScreen } from './src/settings/PrivacySecurityScreen';
import { SettingsScreen as RemoteSettingsScreen } from './src/settings/SettingsScreen';
import { StreamingQualityScreen } from './src/settings/StreamingQualityScreen';
import { SystemLogsScreen } from './src/settings/SystemLogsScreen';
import { TermsScreen } from './src/settings/TermsScreen';
import { TrustedDevicesScreen as SettingsTrustedDevicesScreen } from './src/settings/TrustedDevicesScreen';
import { TwoFactorScreen } from './src/settings/TwoFactorScreen';
import { ChangePasswordScreen } from './src/settings/ChangePasswordScreen';
import { UpgradePlanScreen as SettingsUpgradePlanScreen } from './src/settings/UpgradePlanScreen';
import { LanguageProvider, useTranslation } from './src/lib/i18n';
import { NotificationProvider, makeNotificationId, useNotifications } from './src/lib/notificationStore';
import { NotificationsScreen } from './src/notifications/NotificationsScreen';
import { NotificationBell } from './src/notifications/NotificationBell';

WebBrowser.maybeCompleteAuthSession();

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

const logo = require('./assets/logo.png');
const noDeviceImage = require('./assets/no-device.png');
const launchImage = require('./assets/wait.png');
const noSignImage = require('./assets/no-sign.png');
const tabOrder: MainTab[] = ['chat', 'devices', 'connect', 'meeting', 'apps'];
// Plain member access only: Expo inlines `process.env.EXPO_PUBLIC_*` at bundle
// time, but NOT the optional-chained `process.env?.` form — which would leave
// release builds stuck on the fallback.
//
// The fallback is PROD on purpose. Forgetting the env var used to silently
// produce a preprod-pointing APK that could then be published to prod users;
// defaulting the other way makes the dangerous mistake impossible. Preprod
// builds must now pass EXPO_PUBLIC_API_BASE_URL=https://pp.remote365.ai
// explicitly, and the publish scripts verify the bundled host either way.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://remote365.ai';
const AUTH_STORAGE_KEY = 'remote365_mobile_auth';

type User = {
  id: string;
  email: string;
  name?: string | null;
};

type AuthPayload = {
  accessToken: string;
  refreshToken?: string;
  user: User;
};

type DeviceGroup = {
  id: string;
  name: string;
  color?: string | null;
  deviceIds: string[];
  deviceCount: number;
};

type DeviceItem = {
  id: string;
  name: string;
  accessKey: string;
  isOnline: boolean;
  /** A viewer is currently connected to this device. */
  inSession?: boolean;
  isOwned?: boolean;
  groups: DeviceGroup[];
  lastSeen?: string | null;
  type?: string | null;
};

type ConversationItem = {
  id: string;
  name: string;
  preview: string;
  date: string;
  isGroup?: boolean;
  unreadCount?: number;
  online?: boolean;
  status?: string;
  requestedById?: string;
  blockedById?: string;
  otherUserId?: string;
  otherEmail?: string;
  /** Set when the conversation's latest message is a joinable session invite. */
  inviteCode?: string;
  /** This user muted notifications for the conversation. */
  muted?: boolean;
};

type MeetingItem = {
  id: string;
  name: string;
  displayCode?: string;
  status?: string;
  createdAt?: string;
  /** GET /api/chat/meetings already returns meetings you were invited to (it matches
   *  collaborators by userId AND by email) — the mapper simply dropped the fields, so
   *  an invited meeting was indistinguishable from one you created. */
  createdById?: string;
  createdByName?: string;
};

async function rawApiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    signal: options.signal || controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {
    if (response.ok) throw new Error('Invalid server response. Please try again.');
  }

  if (!response.ok) {
    const error: any = new Error(data?.error || data?.message || 'Request failed');
    error.status = response.status;
    // Single-session policy: a sign-in elsewhere revokes this session.
    error.sessionRevoked = Boolean(data?.sessionRevoked);
    throw error;
  }

  return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

let onSessionChange: (session: AuthPayload | null) => void = () => {};
const sessionManager = createSessionManager({
  refresh: async (refreshToken) => normalizeAuthPayload(await rawApiFetch('/api/auth/refresh', {
    method: 'POST', body: JSON.stringify({ refreshToken }),
  })),
  persist: async (session) => session ? saveAuthSession(session) : clearAuthSession(),
  onChange: (session) => onSessionChange(session),
});

async function apiFetch<T>(path: string, options: RequestInit = {}, accessToken?: string | null): Promise<T> {
  const session = sessionManager.get();
  const version = sessionManager.version();
  const token = accessToken && session ? session.accessToken : accessToken;
  try {
    return await rawApiFetch<T>(path, options, token);
  } catch (error: any) {
    if (!token || !session || error.status !== 401 || error.sessionRevoked) throw error;
    if (sessionManager.version() !== version) throw error;
    const latest = sessionManager.get();
    if (latest && latest.accessToken !== token) return rawApiFetch<T>(path, options, latest.accessToken);
    const renewed = await sessionManager.refresh();
    if (!renewed) throw error;
    return rawApiFetch<T>(path, options, renewed.accessToken);
  }
}

async function getStoredAuthSession(): Promise<AuthPayload | null> {
  try {
    const savedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return savedSession ? JSON.parse(savedSession) as AuthPayload : null;
  } catch {
    return null;
  }
}

async function saveAuthSession(payload: AuthPayload) {
  try {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Expo Go can run without this native module loaded; sign-in should still continue.
  }
}

async function clearAuthSession() {
  try {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Best-effort only.
  }
}

function normalizeAuthPayload(data: any): AuthPayload {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user || {
      id: data.userId || '',
      email: data.email || '',
      name: data.name || '',
    },
  };
}

// Presence pushes identify devices by access key with inconsistent formatting
// (spaced for display, raw on the wire) — compare on a normalized form.
const normalizeAccessKey = (value?: string) => String(value || '').toLowerCase().replace(/\s/g, '');

// Humanized offline meta, mirroring the web-mobile devices list.
function formatLastSeen(value: string | null | undefined, t: (key: string) => string): string {
  if (!value) return t('Offline');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('Offline');
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${t('Offline')} · ${mins}m ${t('ago')}`;
  if (mins < 60 * 24) return `${t('Offline')} · ${Math.round(mins / 60)}h ${t('ago')}`;
  return `${t('Offline')} · ${Math.round(mins / 1440)}d ${t('ago')}`;
}

function mapDeviceItem(row: any): DeviceItem {
  const groups = Array.isArray(row.device_groups)
    ? row.device_groups
    : Array.isArray(row.userGroups)
      ? row.userGroups
      : [];

  return {
    id: String(row.id || ''),
    name: row.device_name || row.name || 'Unknown device',
    accessKey: row.access_key || row.accessKey || '',
    isOnline: Boolean(row.is_online ?? row.isOnline),
    inSession: Boolean(row.in_session ?? row.inSession),
    isOwned: Boolean(row.is_owned ?? row.isOwned),
    groups: groups.map(mapDeviceGroup),
    lastSeen: row.last_seen_at || row.last_seen || row.lastSeen || null,
    type: row.device_type || row.deviceType || null,
  };
}

function mapDeviceGroup(row: any): DeviceGroup {
  const deviceIds = Array.isArray(row.deviceIds)
    ? row.deviceIds
    : Array.isArray(row.devices)
      ? row.devices.map((device: any) => String(device.id || device))
      : [];

  return {
    id: String(row.id || ''),
    name: String(row.name || 'Group'),
    color: row.color || null,
    deviceIds,
    deviceCount: Number(row.deviceCount ?? row._count?.devices ?? deviceIds.length ?? 0),
  };
}

function getConversationName(row: any, userId?: string): string {
  if (row.name) return row.name;
  const other = row.participants?.find((p: any) => p.userId !== userId)?.user
    || row.participants?.[0]?.user;
  return other?.name || other?.email || 'Conversation';
}

function getOtherParticipantId(row: any, userId?: string): string | undefined {
  const other = row.participants?.find((p: any) => p.userId !== userId);
  return other?.userId ? String(other.userId) : undefined;
}

function getOtherParticipantEmail(row: any, userId?: string): string | undefined {
  const other = row.participants?.find((p: any) => p.userId !== userId);
  return other?.user?.email || undefined;
}

function mapConversationItem(row: any, userId?: string): ConversationItem {
  const latest = row.messages?.[0];
  // A conversation whose newest message is a session invite belongs in the
  // service queue: someone is waiting for this user to join. Expired invites
  // (server-stamped expiresAt) don't count.
  const invite = parseSessionInvite(latest?.content);
  const inviteExpired = Boolean(invite?.expiresAt) && new Date(invite.expiresAt).getTime() <= Date.now();
  const inviteCode = invite && !inviteExpired ? String(invite.sessionCode || invite.code || '') : '';
  return {
    inviteCode: inviteCode || undefined,
    muted: Boolean(row.participants?.some((p: any) => p.userId === userId && p.muted)),
    id: String(row.id || ''),
    name: getConversationName(row, userId),
    otherUserId: row.isGroup ? undefined : getOtherParticipantId(row, userId),
    otherEmail: row.isGroup ? undefined : getOtherParticipantEmail(row, userId),
    online: Boolean(row.otherOnline),
    preview: structuredMessagePreview(latest?.content) || humanizeDeviceMentions(latest?.content) || 'No messages yet.',
    date: row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '',
    isGroup: Boolean(row.isGroup),
    unreadCount: row.unreadCount || 0,
    status: row.status,
    requestedById: row.requestedById ? String(row.requestedById) : undefined,
    blockedById: row.blockedById ? String(row.blockedById) : undefined,
  };
}

function mapMeetingItem(row: any): MeetingItem {
  return {
    id: String(row.id || ''),
    name: row.name || 'Remote 365 meeting',
    displayCode: row.displayCode || row.sessionCode,
    status: row.status,
    createdAt: row.createdAt,
    createdById: row.createdById ? String(row.createdById) : (row.createdBy?.id ? String(row.createdBy.id) : undefined),
    createdByName: row.createdBy?.name || row.createdBy?.email || undefined,
  };
}

function ConnectSvgIcon({ color = '#FF8A00', size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 11 13" fill="none">
      <Path
        d="M7.16634 5.83333L9.83301 3.16667L7.16634 0.5M9.83301 3.16667H0.499675M3.16634 7.16667L0.499675 9.83333L3.16634 12.5M0.499675 9.83333H9.83301"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The bell lives in eight different page headers. Prop-drilling it through every screen
 * component (the way onSettingsPress is threaded) would mean touching each signature, so
 * the count and opener come from context and each header just drops in <HeaderBell />.
 */
const NotificationBellContext = React.createContext<{ count: number; onPress: () => void }>({
  count: 0,
  onPress: () => {},
});

function HeaderBell() {
  const { count, onPress } = React.useContext(NotificationBellContext);
  return <NotificationBell count={count} onPress={onPress} />;
}

function HeaderFrame({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const styles = useAppStyles();
  const { insets, headerHeight } = useResponsive();

  return (
    <View style={[styles.headerFrame, style, styles.headerFlat, { height: undefined, minHeight: headerHeight + insets.top, paddingTop: insets.top }]}>
      {children}
    </View>
  );
}

function HeaderTopGlow() {
  const styles = useAppStyles();
  const { width } = useWindowDimensions();
  const glowWidth = Math.max(520, width * 1.35);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.headerTopGlow,
        {
          left: (width - glowWidth) / 2,
          width: glowWidth,
        },
      ]}
    >
      <Svg height="240" width="100%" viewBox="0 0 700 240" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="topOrangeGlow" cx="50%" cy="18%" r="64%">
            <Stop offset="0%" stopColor="#FF8A00" stopOpacity="0.5" />
            <Stop offset="28%" stopColor="#FFB347" stopOpacity="0.34" />
            <Stop offset="62%" stopColor="#FFD9A1" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="350" cy="58" rx="350" ry="170" fill="url(#topOrangeGlow)" />
      </Svg>
    </View>
  );
}

function SoftGlow({ progress }: { progress: Animated.Value }) {
  const styles = useAppStyles();
  const { width, height } = useWindowDimensions();
  const glowSize = Math.min(450, Math.max(width, height));
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 1],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.1, 0.9, 0.82],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.splashGlow,
        {
          height: glowSize,
          marginLeft: -glowSize / 2,
          marginTop: -glowSize / 2,
          opacity,
          width: glowSize,
          transform: [{ scale }],
        },
      ]}
    >
      <Svg height="100%" width="100%" viewBox="0 0 700 700">
        <Defs>
          <RadialGradient id="orangeGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF8A00" stopOpacity="0.5" />
            <Stop offset="24%" stopColor="#FFB347" stopOpacity="0.34" />
            <Stop offset="58%" stopColor="#FFD9A1" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="350" cy="350" r="350" fill="url(#orangeGlow)" />
      </Svg>
    </Animated.View>
  );
}

function SplashScreen() {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const glowProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(glowProgress, {
      toValue: 1,
      duration: 1900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [glowProgress]);

  return (
    <SafeAreaView style={styles.splashScreen}>
      <StatusBar style="dark" />
      <SoftGlow progress={glowProgress} />

      <View style={styles.brandBlock}>
        <View style={styles.brandStack}>
          <Image source={logo} style={styles.splashLogo} resizeMode="contain" />
          {/* Both rows are minHeight-based, so the brand lockup can scale with
              the OS font size (capped) instead of opting out of it entirely. */}
          <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.splashTitle, type(24, 34 / 24)]}>Remote 365</Text>
        </View>

        <View style={styles.taglineRow}>
          <View style={styles.rule} />
          <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.tagline, type(14, 20 / 14)]}>{t('Secure Node Mesh')}</Text>
          <View style={styles.rule} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function TopBar({ onSettingsPress }: { onSettingsPress: () => void }) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <HeaderFrame style={styles.topBar}>
      <View style={styles.topBrand}>
        <Image source={logo} style={styles.topLogo} resizeMode="contain" />
        <Text style={[styles.topTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Remote 365</Text>
      </View>
      <View style={styles.topActions}>
        <HeaderBell />
        <Pressable style={styles.iconButton} hitSlop={10} onPress={onSettingsPress}>
          <Feather name="settings" size={20} color="#111315" />
        </Pressable>
      </View>
    </HeaderFrame>
  );
}

type MainTab = 'connect' | 'devices' | 'chat' | 'meeting' | 'apps';
type DeviceScope = { type: 'all' | 'mine' | 'group'; groupId?: string; title: string };

function ConnectScreen({
  devices,
  loading,
  onSearchConnect,
  onSettingsPress,
  onControl,
  activeTab,
  onTabPress,
  recentDeviceIds,
}: {
  devices: DeviceItem[];
  loading: boolean;
  onSearchConnect: () => void;
  onSettingsPress: () => void;
  onControl: (device: DeviceItem) => void;
  activeTab: MainTab;
  onTabPress: (tab: MainTab) => void;
  recentDeviceIds?: string[];
}) {
  const styles = useAppStyles();
  return (
    <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <TopBar onSettingsPress={onSettingsPress} />

      <ConnectHome
        devices={devices}
        loading={loading}
        onSearchConnect={onSearchConnect}
        onControl={onControl}
        recentDeviceIds={recentDeviceIds}
      />

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

function DevicesScreen({
  activeTab,
  devices,
  deviceCount,
  groups,
  loading,
  onTabPress,
  onMonitoringPress,
  onManagedDevicesPress,
  onSettingsPress,
  onAddPress,
  onGroupLongPress,
  onServiceQueuePress,
  queueCount,
}: {
  activeTab: MainTab;
  devices: DeviceItem[];
  deviceCount: number;
  groups: DeviceGroup[];
  loading: boolean;
  onTabPress: (tab: MainTab) => void;
  onMonitoringPress: () => void;
  onManagedDevicesPress: (scope: DeviceScope) => void;
  onSettingsPress: () => void;
  onAddPress: () => void;
  onGroupLongPress: (group: DeviceGroup) => void;
  onServiceQueuePress: () => void;
  queueCount: number;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [tourReplay, setTourReplay] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();
  const ungroupedCount = devices.filter((device) => device.groups.length === 0).length;
  const visibleGroups = groups.filter((group) => group.name.toLowerCase().includes(normalizedQuery));
  const offlineCount = devices.filter((device) => !device.isOnline).length;
  const inSessionCount = devices.filter((device) => device.inSession).length;

  return (
    <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <HeaderFrame style={styles.devicesHeader}>
        <Text style={[styles.devicesTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Devices')}</Text>
        <View style={styles.devicesActions}>
          <HeaderBell />
          <Pressable style={styles.iconButton} hitSlop={10} onPress={() => setTourReplay((n) => n + 1)}>
            <Feather name="help-circle" size={20} color="#111315" />
          </Pressable>
          <Pressable style={styles.iconButton} hitSlop={10} onPress={() => setShowSearch((open) => !open)}>
            <Feather name="search" size={20} color="#111315" />
          </Pressable>
          <Pressable style={styles.iconButton} hitSlop={10} onPress={onSettingsPress}>
            <Feather name="settings" size={20} color="#111315" />
          </Pressable>
        </View>
      </HeaderFrame>

      <FadeInView style={styles.devicesScroll}>
      {/* A real fleet overflows the viewport (dozens of groups), so the body
          scrolls; the header, FAB and nav stay put. */}
      <ScrollView
        contentContainerStyle={styles.devicesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showSearch ? (
          <View style={styles.deviceSearchBox}>
            <Feather name="search" size={16} color="rgba(26, 29, 33, 0.5)" />
            <TextInput
              autoCapitalize="none"
              onChangeText={setQuery}
              placeholder={t('Search groups')}
              placeholderTextColor="rgba(17, 19, 21, 0.35)"
              style={[styles.deviceSearchInput, textSize(14)]}
              value={query}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            />
          </View>
        ) : null}

        <View style={styles.quickSection}>
          <Text style={[styles.sectionSmallTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Quick access')}</Text>
          <View style={styles.quickRows}>
            <DeviceQuickRow
              icon="star"
              label={`${t('Service queue')}${queueCount ? ` (${queueCount} ${t('waiting')})` : ''}`}
              onPress={onServiceQueuePress}
            />
            <DeviceQuickRow
              icon="monitor"
              label={`${t('Monitoring overview')}\n${offlineCount} ${t('offline')}, ${inSessionCount} ${t('in session')}`}
              tall
              onPress={onMonitoringPress}
            />
          </View>
        </View>

        <View style={styles.deviceDivider} />

        <View style={styles.deviceGroup}>
          <Text style={[styles.deviceGroupTitle, type(10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Managed devices')}</Text>
          <DeviceListRow
            icon="folder"
            label={loading ? t('Loading devices...') : `${t('All devices')}${deviceCount ? ` (${deviceCount})` : ''}`}
            sessionCount={inSessionCount}
            onPress={() => onManagedDevicesPress({ type: 'all', title: t('My Computers') })}
          />
        </View>

        <View style={styles.deviceDivider} />

        <View style={styles.deviceGroup}>
          <Text style={[styles.deviceGroupTitle, type(10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Groups')}</Text>
          <DeviceListRow
            icon="folder"
            label={`${t('My devices')}${ungroupedCount ? ` (${ungroupedCount})` : ''}`}
            onPress={() => onManagedDevicesPress({ type: 'mine', title: t('My devices') })}
          />
          {visibleGroups.length > 0 ? (
            visibleGroups.map((group) => (
              <DeviceListRow
                key={group.id}
                icon="folder"
                label={`${group.name}${group.deviceCount ? ` (${group.deviceCount})` : ''}`}
                compact
                sessionCount={devices.filter((d) => d.inSession && d.groups.some((g) => g.id === group.id)).length}
                onPress={() => onManagedDevicesPress({ type: 'group', groupId: group.id, title: group.name })}
                onLongPress={() => onGroupLongPress(group)}
              />
            ))
          ) : (
            <Text style={[styles.deviceEmptyText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{loading ? t('Loading groups...') : t('No groups yet')}</Text>
          )}
        </View>
      </ScrollView>
      </FadeInView>

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} action={{ onPress: onAddPress }} />

      {/* First-visit walkthrough (replayable via the ? header button) */}
      <DevicesTour replayToken={tourReplay} />
    </SafeAreaView>
  );
}

function DeviceQuickRow({
  icon,
  label,
  tall,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  tall?: boolean;
  onPress?: () => void;
}) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <Pressable style={[styles.quickRow, tall && styles.quickRowTall]} onPress={onPress}>
      <View style={styles.quickLeft}>
        <Feather name={icon} size={20} color="#111315" />
        <Text style={[styles.quickLabel, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{label}</Text>
      </View>
    </Pressable>
  );
}

function MonitoringOverviewScreen({
  activeTab,
  devices,
  onBack,
  onSettingsPress,
  onTabPress,
}: {
  activeTab: MainTab;
  devices: DeviceItem[];
  onBack: () => void;
  onSettingsPress: () => void;
  onTabPress: (tab: MainTab) => void;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const [monitorTab, setMonitorTab] = useState<'all' | 'offline' | 'in-session'>('all');
  const [showHelp, setShowHelp] = useState(false);

  const offlineDevices = devices.filter((device) => !device.isOnline);
  const inSessionDevices = devices.filter((device) => device.inSession);
  const visibleDevices =
    monitorTab === 'offline' ? offlineDevices : monitorTab === 'in-session' ? inSessionDevices : devices;
  const emptyText =
    monitorTab === 'offline'
      ? t('No offline devices — everything is reachable.')
      : monitorTab === 'in-session'
        ? t('No devices are in a remote session right now.')
        : t('No devices yet. Add one from the Devices page.');

  return (
    <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.monitorHeader}>
        <Pressable style={styles.monitorHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.monitorTitle, type(16, 23 / 16)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Monitoring Overview')}</Text>
        </Pressable>
        <View style={styles.monitorActions}>
          <HeaderBell />
          <Pressable style={styles.iconButton} hitSlop={10} onPress={() => setShowHelp(true)}>
            <Feather name="help-circle" size={20} color={showHelp ? '#FF8A00' : '#111315'} />
          </Pressable>
          <Pressable style={styles.iconButton} hitSlop={10} onPress={onSettingsPress}>
            <Feather name="settings" size={20} color="#111315" />
          </Pressable>
        </View>
      </HeaderFrame>

      <View style={styles.monitorContent}>
        <View style={styles.endpointSummary}>
          <View style={styles.endpointMain}>
            <Feather name="monitor" size={30} color="#111315" />
            <View style={styles.endpointCopy}>
              <Text style={[styles.endpointTitle, type(16, 22 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Endpoints usage')}</Text>
              <Text style={[styles.endpointSubtitle, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {`${inSessionDevices.length} ${t('of')} ${devices.length} ${devices.length === 1 ? t('endpoint in use') : t('endpoints in use')}`}
              </Text>
            </View>
          </View>

          <View style={styles.endpointStats}>
            <View style={styles.endpointStat}>
              <Feather name="alert-circle" size={20} color={offlineDevices.length ? '#FF383C' : '#111315'} />
              <Text style={[styles.endpointStatText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{offlineDevices.length} {t('Offline')}</Text>
            </View>
            <View style={styles.endpointStat}>
              <Feather name="cast" size={20} color={inSessionDevices.length ? '#14AE5C' : '#111315'} />
              <Text style={[styles.endpointStatText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{inSessionDevices.length} {t('In session')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.monitorTabs}>
          <Pressable
            style={[styles.monitorTab, monitorTab === 'all' && styles.monitorTabActive]}
            onPress={() => setMonitorTab('all')}
          >
            <Text numberOfLines={1} style={[styles.monitorTabText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('All')} ({devices.length})</Text>
          </Pressable>
          <Pressable
            style={[styles.monitorTab, monitorTab === 'offline' && styles.monitorTabActive]}
            onPress={() => setMonitorTab('offline')}
          >
            <Text numberOfLines={1} style={[styles.monitorTabText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Offline')} ({offlineDevices.length})</Text>
          </Pressable>
          <Pressable
            style={[styles.monitorTab, monitorTab === 'in-session' && styles.monitorTabActive]}
            onPress={() => setMonitorTab('in-session')}
          >
            <Text numberOfLines={1} style={[styles.monitorTabText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('In session')} ({inSessionDevices.length})</Text>
          </Pressable>
        </View>

        {visibleDevices.length > 0 ? (
          <ScrollView style={styles.monitorListScroll} contentContainerStyle={styles.monitorList}>
            {visibleDevices.map((device) => (
              <View key={device.id} style={styles.monitorRow}>
                <View
                  style={[
                    styles.monitorStatusDot,
                    { backgroundColor: device.inSession ? '#FF8A00' : device.isOnline ? '#14AE5C' : '#C8CACC' },
                  ]}
                />
                <View style={styles.monitorRowCopy}>
                  <Text style={[styles.monitorRowName, textSize(14)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{device.name}</Text>
                  <Text style={[styles.monitorRowMeta, textSize(12), !device.inSession && !device.isOnline && styles.managedDeviceMetaOffline]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                    {device.inSession
                      ? t('In session')
                      : device.isOnline
                        ? t('Online')
                        : `${t('Offline')}${device.lastSeen ? ` · ${t('last seen')} ${new Date(device.lastSeen).toLocaleDateString()}` : ''}`}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.monitorEmpty}>
            <View style={styles.monitorEmptyIcon}>
              <Feather name="check-circle" size={28} color="#1A1D21" />
            </View>
            <Text style={[styles.monitorEmptyText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{emptyText}</Text>
          </View>
        )}
      </View>

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />

      {showHelp && (
        <View style={styles.helpOverlay}>
          <ResponsivePanel style={styles.helpCard}>
            <View style={styles.helpTextBlock}>
              <Text style={[styles.helpTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Monitor your fleet')}</Text>
              <Text style={[styles.helpBody, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {t('Every device you manage shows its live status here: green is online, orange is in a remote session, red is offline with its last-seen date.')}
              </Text>
            </View>
            <Pressable onPress={() => setShowHelp(false)} style={styles.helpOkButton}>
              <Text style={[styles.helpOkText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('OK')}</Text>
            </Pressable>
          </ResponsivePanel>
        </View>
      )}
    </SafeAreaView>
  );
}

function DeviceListRow({
  icon,
  label,
  compact,
  sessionCount,
  onPress,
  onLongPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  compact?: boolean;
  /** Devices in this scope currently being controlled — shown as a pill. */
  sessionCount?: number;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <Pressable
      style={[styles.deviceListRow, compact && styles.deviceListRowCompact]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.deviceListInner}>
        <Feather name={icon} size={16} color="#111315" />
        <Text style={[styles.deviceListLabel, type(14, 20 / 14)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{label}</Text>
        {sessionCount ? (
          <View style={styles.inSessionPill}>
            <Text style={[styles.inSessionPillText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{sessionCount} {t('in session')}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function ManagedDevicesScreen({
  activeTab,
  devices,
  loading,
  onBack,
  onRefresh,
  onSettingsPress,
  onTabPress,
  onControl,
  onDeviceMenu,
  onAddDevice,
  title,
}: {
  activeTab: MainTab;
  devices: DeviceItem[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSettingsPress: () => void;
  onTabPress: (tab: MainTab) => void;
  onControl: (device: DeviceItem) => void;
  onDeviceMenu: (device: DeviceItem) => void;
  onAddDevice: () => void;
  title: string;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  // Web-mobile parity (MobileDevices): device search, All/Online filter, and
  // last-seen meta on offline rows.
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'in-session'>('all');

  const q = query.trim().toLowerCase();
  const onlineCount = devices.filter((device) => device.isOnline).length;
  const inSessionCount = devices.filter((device) => device.inSession).length;
  const visibleDevices = devices
    .filter((device) => {
      if (statusFilter === 'online') return device.isOnline;
      if (statusFilter === 'in-session') return device.inSession;
      return true;
    })
    .filter((device) => (q ? `${device.name} ${device.accessKey}`.toLowerCase().includes(q) : true));

  return (
    <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.managedHeader}>
        <Pressable style={styles.managedHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.managedTitle, type(16, 23 / 16)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
        </Pressable>
        <View style={styles.managedActions}>
          <HeaderBell />
          <Pressable style={styles.iconButton} hitSlop={10} onPress={() => { setShowSearch((open) => !open); setQuery(''); }}>
            <Feather name="search" size={20} color={showSearch ? '#FF8A00' : '#111315'} />
          </Pressable>
          {/* While refreshing, the icon itself becomes the spinner — the list stays
              on screen instead of being replaced, so the page never "blanks out". */}
          <Pressable style={styles.iconButton} hitSlop={10} onPress={onRefresh} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#FF8A00" />
              : <Feather name="refresh-cw" size={19} color="#111315" />}
          </Pressable>
          <Pressable style={styles.iconButton} hitSlop={10} onPress={onSettingsPress}>
            <Feather name="settings" size={20} color="#111315" />
          </Pressable>
        </View>
      </HeaderFrame>

      {/* Full-page loader ONLY on a cold load, when there is nothing to show yet.
          A refresh over existing devices keeps the list visible and reports itself
          through the header spinner and pull-to-refresh instead. */}
      {loading && devices.length === 0 ? (
        <View style={[styles.managedContent, styles.loadingBlock]}>
          <ActivityIndicator size="large" color="#FF8A00" />
          <Text style={[styles.sectionSmallTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Loading devices...')}</Text>
        </View>
      ) : devices.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.managedContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={['#FF8A00']} tintColor="#FF8A00" />
          }
        >
          {showSearch ? (
            <View style={styles.deviceSearchBox}>
              <Feather name="search" size={16} color="rgba(26, 29, 33, 0.5)" />
              <TextInput
                autoCapitalize="none"
                autoFocus
                onChangeText={setQuery}
                placeholder={t('Search devices')}
                placeholderTextColor="rgba(17, 19, 21, 0.35)"
                style={[styles.deviceSearchInput, textSize(14)]}
                value={query}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
              />
            </View>
          ) : null}

          <View style={styles.monitorTabs}>
            <Pressable
              style={[styles.monitorTab, statusFilter === 'all' && styles.monitorTabActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text numberOfLines={1} style={[styles.monitorTabText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('All')} ({devices.length})</Text>
            </Pressable>
            <Pressable
              style={[styles.monitorTab, statusFilter === 'online' && styles.monitorTabActive]}
              onPress={() => setStatusFilter('online')}
            >
              <Text numberOfLines={1} style={[styles.monitorTabText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Online')} ({onlineCount})</Text>
            </Pressable>
            {inSessionCount > 0 ? (
              <Pressable
                style={[styles.monitorTab, statusFilter === 'in-session' && styles.monitorTabActive]}
                onPress={() => setStatusFilter('in-session')}
              >
                <Text numberOfLines={1} style={[styles.monitorTabText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('In session')} ({inSessionCount})</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.sectionSmallTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{visibleDevices.length} {visibleDevices.length === 1 ? t('device') : t('devices')}</Text>
          {visibleDevices.length === 0 ? (
            <Text style={[styles.deviceEmptyText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('No devices match.')}</Text>
          ) : null}
          {visibleDevices.map((device) => (
            <Pressable
              key={device.id}
              style={styles.managedDeviceRow}
              onPress={() => device.isOnline && onControl(device)}
              onLongPress={() => onDeviceMenu(device)}
            >
              <View style={styles.managedDeviceIdentity}>
                <View style={[
                  styles.managedDeviceAvatar,
                  device.inSession && styles.managedDeviceAvatarInSession,
                  !device.inSession && !device.isOnline && styles.managedDeviceAvatarOffline,
                ]}>
                  <Feather
                    name="monitor"
                    size={16}
                    color={device.inSession ? '#8A4B00' : device.isOnline ? '#013218' : '#B91C1C'}
                  />
                </View>
                <View style={styles.managedDeviceText}>
                  <View style={styles.managedDeviceNameRow}>
                    <Text
                      style={[styles.managedDeviceName, type(12, 17 / 12), !device.isOnline && styles.managedDeviceNameOffline]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={maxFontSizeMultiplier}
                    >
                      {device.name}
                    </Text>
                    {/* Someone is controlling this device right now. */}
                    {device.inSession ? (
                      <View style={styles.inSessionPill}>
                        <Text style={[styles.inSessionPillText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('In session')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.managedDeviceMeta,
                      type(10, 14 / 10),
                      device.inSession && styles.managedDeviceMetaInSession,
                      !device.inSession && !device.isOnline && styles.managedDeviceMetaOffline,
                    ]}
                    maxFontSizeMultiplier={maxFontSizeMultiplier}
                  >
                    {device.inSession
                      ? t('Someone is connected right now')
                      : device.isOnline
                        ? `${t('Online')} ${device.accessKey ? `- ${device.accessKey}` : ''}`
                        : formatLastSeen(device.lastSeen, t)}
                  </Text>
                </View>
              </View>
              <View style={styles.managedDeviceActions}>
                <ConnectSvgIcon size={18} color={device.isOnline ? '#FF8A00' : 'rgba(17,19,21,0.25)'} />
                <Pressable hitSlop={10} onPress={() => onDeviceMenu(device)}>
                  <Feather name="more-vertical" size={18} color="rgba(17,19,21,0.55)" />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        // Scrollable: on short screens / large font settings the centred
        // illustration + copy + button is taller than the viewport, and the
        // "Add" button used to end up under the floating nav with no way back.
        <ScrollView
          style={styles.devicesScroll}
          contentContainerStyle={styles.noDeviceContent}
          showsVerticalScrollIndicator={false}
        >
          <Image source={noDeviceImage} style={styles.noDeviceImage} resizeMode="contain" />

          <View style={styles.noDeviceCopy}>
            <Text style={[styles.noDeviceTitle, type(24, 34 / 24)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Start by adding a device')}</Text>
            <Text style={[styles.noDeviceText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('There are no computers or contacts in this group. Please add a computer or contact.')}
            </Text>
          </View>

          <Pressable style={styles.noDeviceButton} onPress={onAddDevice}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={[styles.noDeviceButtonText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Add')}</Text>
          </Pressable>
        </ScrollView>
      )}

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

function ChatScreen({
  activeTab,
  conversations,
  typingConversations,
  onSettingsPress,
  onTabPress,
  onChatPress,
  onAddContact,
}: {
  activeTab: MainTab;
  conversations: ConversationItem[];
  typingConversations: Record<string, string | undefined>;
  onSettingsPress: () => void;
  onTabPress: (tab: MainTab) => void;
  onChatPress: (conversation: ConversationItem) => void;
  onAddContact: () => void;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const q = query.trim().toLowerCase();
  const matchesFilters = (conversation: ConversationItem) =>
    (!q
      || conversation.name.toLowerCase().includes(q)
      || conversation.preview.toLowerCase().includes(q))
    && (filter === 'all' || (conversation.unreadCount || 0) > 0);
  const directConversations = conversations.filter((conversation) => !conversation.isGroup && matchesFilters(conversation));
  const groupConversations = conversations.filter((conversation) => conversation.isGroup && matchesFilters(conversation));
  const isFiltering = Boolean(q) || filter === 'unread';
  const isEmpty = conversations.length === 0;

  return (
    <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.chatHeader}>
        <View style={styles.chatHeaderTitleRow}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.chatTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Chat')}</Text>
        </View>
        <View style={styles.chatActions}>
          <HeaderBell />
          <Pressable style={styles.iconButton} hitSlop={10} onPress={onSettingsPress}>
            <Feather name="settings" size={20} color="#111315" />
          </Pressable>
        </View>
      </HeaderFrame>

      {isEmpty ? (
        <ChatEmpty onStart={onAddContact} />
      ) : (
      <FadeInView style={styles.chatListScroll}>
      <ScrollView
        contentContainerStyle={styles.chatListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.chatTopControls}>
          <View style={styles.chatSearchBox}>
            <Feather name="search" size={16} color="rgba(26, 29, 33, 0.3)" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('Search for contact')}
              placeholderTextColor="rgba(17, 19, 21, 0.3)"
              style={[styles.chatSearchInput, textSize(14)]}
              autoCapitalize="none"
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            />
            {query ? (
              <Pressable hitSlop={8} onPress={() => setQuery('')}>
                <Feather name="x" size={14} color="rgba(26, 29, 33, 0.4)" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.chatFilterRow}>
            <View style={styles.chatChips}>
              <Pressable
                style={[styles.chatChip, filter === 'all' && styles.chatChipActive]}
                onPress={() => setFilter('all')}
              >
                <Text style={[styles.chatChipText, type(10, 14 / 10), filter === 'all' && styles.chatChipTextActive]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('All')}</Text>
              </Pressable>
              <Pressable
                style={[styles.chatChipWide, filter === 'unread' && styles.chatChipActive]}
                onPress={() => setFilter('unread')}
              >
                <Text style={[styles.chatChipText, type(10, 14 / 10), filter === 'unread' && styles.chatChipTextActive]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Unread')}</Text>
              </Pressable>
            </View>

            <View style={styles.chatTools}>
              <Pressable style={styles.chatToolButton} hitSlop={12}>
                <Feather name="filter" size={18} color="#111315" />
              </Pressable>
              {/* 18dp visual, 48dp-class touch target via hitSlop. */}
              <Pressable style={styles.chatSmallAdd} hitSlop={15} onPress={onAddContact}>
                <Feather name="plus" size={14} color="#14AE5C" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.directMessagesSection}>
          <Text style={[styles.chatSectionTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Direct Messages')}</Text>
          <View style={styles.chatRows}>
            {directConversations.length > 0 ? (
              directConversations.map((conversation, index) => (
                <ChatContactRow
                  key={conversation.id}
                  active={index === 0}
                  initials={conversation.name.slice(0, 2).toUpperCase()}
                  name={conversation.name}
                  date={conversation.date}
                  preview={conversation.preview}
                  typingName={typingConversations[conversation.id]}
                  online={!!conversation.online}
                  unreadCount={conversation.unreadCount}
                  onPress={() => onChatPress(conversation)}
                />
              ))
            ) : (
              <Text style={[styles.chatNoGroups, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isFiltering ? t('No matches.') : t('No direct messages yet.')}</Text>
            )}
          </View>
        </View>

        <View style={styles.groupMessagesSection}>
          <Text style={[styles.chatSectionTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Group Messages')}</Text>
          {groupConversations.length > 0 ? (
            <View style={styles.chatRows}>
              {groupConversations.map((conversation) => (
                <ChatContactRow
                  key={conversation.id}
                  initials={conversation.name.slice(0, 2).toUpperCase()}
                  name={conversation.name}
                  date={conversation.date}
                  preview={conversation.preview}
                  typingName={typingConversations[conversation.id]}
                  unreadCount={conversation.unreadCount}
                  onPress={() => onChatPress(conversation)}
                />
              ))}
            </View>
          ) : (
            <Text style={[styles.chatNoGroups, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{isFiltering ? t('No matches.') : t('No Groups yet.')}</Text>
          )}
        </View>
      </ScrollView>
      </FadeInView>
      )}

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} action={{ onPress: onAddContact }} />
    </SafeAreaView>
  );
}

function ChatContactRow({
  active,
  date = '11/16/19',
  initials,
  name = 'Andrew Parker',
  online,
  onPress,
  preview = 'What kind of strategy is better for this device?',
  typingName,
  unreadCount,
}: {
  active?: boolean;
  date?: string;
  initials: string;
  name?: string;
  online?: boolean;
  onPress: () => void;
  preview?: string;
  typingName?: string;
  unreadCount?: number;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { circle, type, maxFontSizeMultiplier } = useResponsive();
  const isTyping = Boolean(typingName);
  const hasUnread = !!unreadCount;
  return (
    <Pressable style={[styles.chatRow, active && styles.chatRowActive, hasUnread && styles.chatRowUnread]} onPress={onPress}>
      {/* circle() grows the avatar with the (capped) font scale so the
          initials inside it are never sliced by a fixed 40dp box. */}
      <View style={[styles.chatAvatar, circle(40)]}>
        <Text style={[styles.chatAvatarText, type(16, 1.5)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials}</Text>
        {online ? <View style={styles.chatOnlineDot} /> : null}
      </View>

      <View style={styles.chatRowBody}>
        <View style={styles.chatRowTop}>
          <Text style={[styles.chatContactName, type(14, 20 / 14), hasUnread && styles.chatUnreadStrong]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{name}</Text>
          <Text style={[styles.chatDate, type(10, 14 / 10), hasUnread && styles.chatUnreadDate]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{date}</Text>
        </View>
        <View style={styles.chatRowBottom}>
          <Text style={[styles.chatPreview, type(12, 17 / 12), hasUnread && styles.chatPreviewUnread, isTyping && styles.chatPreviewTyping]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {isTyping ? `${typingName} ${t('is typing...')}` : preview}
          </Text>
          {unreadCount ? (
            <View style={styles.chatUnreadBadge}>
              <Text style={[styles.chatUnreadText, type(10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ChatThreadScreen({
  apiBaseUrl,
  token,
  user,
  conversation,
  devices,
  onBack,
  onResolved,
  onJoinMeeting,
  onOpenDevice,
}: {
  apiBaseUrl: string;
  token: string | null;
  user: User | null;
  conversation: ConversationItem | null;
  devices?: DeviceItem[];
  onBack: () => void;
  onResolved?: () => void;
  onJoinMeeting?: (code: string) => void;
  onOpenDevice?: (device: { name: string; accessKey: string }) => void;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, maxFontSizeMultiplier } = useResponsive();
  if (!conversation) {
    return (
      <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        <HeaderFrame style={styles.chatHeader}>
          <Pressable style={styles.chatHeaderTitleRow} onPress={onBack}>
            <Feather name="arrow-left" size={20} color="#111315" />
            <Text style={[styles.chatTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Chat')}</Text>
          </Pressable>
        </HeaderFrame>
      </SafeAreaView>
    );
  }

  return (
    <ChatThread
      apiBaseUrl={apiBaseUrl}
      token={token}
      selfId={user?.id}
      selfName={user?.name}
      conversationId={conversation.id}
      conversationName={conversation.name}
      online={conversation.online}
      otherUserId={conversation.otherUserId}
      otherEmail={conversation.otherEmail}
      status={conversation.status}
      requestedById={conversation.requestedById}
      blockedById={conversation.blockedById}
      initialMuted={conversation.muted}
      devices={(devices || [])
        .filter((device) => device.accessKey)
        .map((device) => ({ name: device.name, accessKey: device.accessKey }))}
      onOpenDevice={onOpenDevice}
      onBack={onBack}
      onResolved={onResolved}
      onJoinMeeting={onJoinMeeting}
    />
  );
}

function MeetingScreen({
  activeTab,
  meetings,
  onMeetingsChange,
  onOpenMeeting,
  onSettingsPress,
  onTabPress,
  token,
  user,
}: {
  activeTab: MainTab;
  meetings: MeetingItem[];
  onMeetingsChange: (meetings: MeetingItem[]) => void;
  onOpenMeeting: (meetingId: string) => void;
  onSettingsPress: () => void;
  onTabPress: (tab: MainTab) => void;
  token: string | null;
  user: User | null;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, maxFontSizeMultiplier } = useResponsive();
  // Bumped by the nav-bar + button; MeetingHome opens its create-meeting preview.
  const [createToken, setCreateToken] = useState(0);

  return (
    <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.meetingHeader}>
        <Text style={[styles.meetingTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Meeting')}</Text>
        <View style={styles.meetingActions}>
          <HeaderBell />
          <Pressable style={styles.iconButton} hitSlop={10} onPress={onSettingsPress}>
            <Feather name="settings" size={20} color="#111315" />
          </Pressable>
        </View>
      </HeaderFrame>

      <FadeInView style={styles.flexOne}>
        <MeetingHome
          apiBaseUrl={API_BASE_URL}
          meetings={meetings}
          onMeetingsChange={onMeetingsChange}
          onOpenMeeting={onOpenMeeting}
          token={token}
          user={user}
          createRequestToken={createToken}
        />
      </FadeInView>

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} action={{ onPress: () => setCreateToken((n) => n + 1) }} />
    </SafeAreaView>
  );
}

// The Android host app registers this scheme; the APK alias is kept current
// by scripts/publish-mobile-host.sh on the same server this build talks to.
const HOST_APP_SCHEME = 'remote365host://';
const HOST_APK_URL = `${API_BASE_URL}/downloads/mobile/Remote365-Host.apk`;

function AppsScreen({
  activeTab,
  onSettingsPress,
  onTabPress,
}: {
  activeTab: MainTab;
  onSettingsPress: () => void;
  onTabPress: (tab: MainTab) => void;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const openHostApp = async () => {
    // Open the installed host app when present; otherwise fetch its APK.
    try {
      await Linking.openURL(HOST_APP_SCHEME);
    } catch {
      Linking.openURL(HOST_APK_URL).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.appsHeader}>
        <Text style={[styles.appsTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Apps')}</Text>
        <View style={styles.appsActions}>
          <HeaderBell />
          <Pressable style={styles.iconButton} hitSlop={10} onPress={onSettingsPress}>
            <Feather name="settings" size={20} color="#111315" />
          </Pressable>
        </View>
      </HeaderFrame>

      <FadeInView style={styles.appsFill}>
      <ScrollView
        style={styles.appsScroll}
        contentContainerStyle={styles.appsContent}
        showsVerticalScrollIndicator
      >
        <Text style={[styles.appsIntro, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {t('Discover our apps to level up your remote control experience!')}
        </Text>

        <View style={styles.appsList}>
          <AppDownloadRow
            title="Remote 365 Host"
            description={t('Set up unattended access for this device.')}
            onPress={openHostApp}
          />
        </View>
      </ScrollView>
      </FadeInView>

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

function AppDownloadRow({
  description,
  external,
  onPress,
  title,
}: {
  description: string;
  external?: boolean;
  onPress?: () => void;
  title: string;
}) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <Pressable style={styles.appDownloadCard} onPress={onPress}>
      <View style={styles.appDownloadInfo}>
        <Image source={logo} style={styles.appDownloadLogo} resizeMode="contain" />
        <View style={styles.appDownloadCopy}>
          <Text style={[styles.appDownloadTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          <Text style={[styles.appDownloadText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{description}</Text>
        </View>
      </View>
      <Feather name={external ? 'external-link' : 'download'} size={20} color="#111315" />
    </Pressable>
  );
}

function NoConnectScreen({
  onBack,
  onConnect,
  connecting,
  error,
}: {
  onBack: () => void;
  onConnect: (accessKey: string) => void;
  connecting?: boolean;
  error?: string | null;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const [query, setQuery] = useState('');
  const trimmed = query.replace(/\D/g, '');
  const submit = () => { if (trimmed) onConnect(trimmed); };
  // "123456789" → "123 456 789" while typing.
  const handleQueryChange = (text: string) => setQuery(formatAccessKey(text));

  return (
    <SafeAreaView style={styles.noConnectScreen} edges={['left', 'right']}>
      <StatusBar style="dark" />

      {/* The field autofocuses, so on iOS (which never resizes the window) the
          Connect bar below would sit behind the keyboard without this. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* The header itself is the search bar */}
      <HeaderFrame style={styles.noConnectHeader}>
        <Pressable style={styles.noConnectBack} hitSlop={8} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
        </Pressable>
        <View style={styles.searchField}>
          <Feather name="search" size={18} color="#858687" />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder={t('Enter support ID')}
            placeholderTextColor="rgba(17,19,21,0.4)"
            style={[styles.searchInput, textSize(14)]}
            keyboardType="number-pad"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={submit}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
          />
          {query ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Feather name="x" size={16} color="#858687" />
            </Pressable>
          ) : null}
        </View>
      </HeaderFrame>

      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={styles.emptySearchBody}>
        <View style={styles.emptySearchIcon}>
          <Feather name="search" size={26} color="#C8CACC" />
        </View>
        <Text style={[styles.emptySearchTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {trimmed ? `${t('Connect to')} ${query}` : t('No connection selected')}
        </Text>
        <Text style={[styles.emptySearchText, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {error
            ? error
            : trimmed
              ? t('Tap Connect to start a remote session with this support ID.')
              : t('Search for a support ID or choose a recent device to continue.')}
        </Text>
      </ScrollView>

      <View style={[styles.noConnectButtons, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.secondaryActionButton} onPress={onBack}>
          <Text style={[styles.secondaryActionText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryActionButton, (!trimmed || connecting) && styles.primaryActionDisabled]}
          onPress={submit}
          disabled={!trimmed || connecting}
        >
          <Text style={[styles.primaryActionText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{connecting ? t('Connecting…') : t('Connect')}</Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoginRequiredScreen({
  activeTab,
  onSettingsPress,
  onSignInPress,
  onSignUpPress,
  onTabPress,
}: {
  activeTab: MainTab;
  onSettingsPress: () => void;
  onSignInPress: () => void;
  onSignUpPress: () => void;
  onTabPress: (tab: MainTab) => void;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const tabLabel = tabs.find((tab) => tab.key === activeTab)?.label;
  const title = tabLabel ? t(tabLabel) : 'Remote 365';
  const gateMessage =
    activeTab === 'chat'
      ? t('Sign in or create an account to start sending messages.')
      : activeTab === 'devices'
        ? t('Sign in or create an account to manage your devices.')
        : activeTab === 'meeting'
          ? t('Sign in or create an account to start and join meetings.')
          : t('Sign in or create an account to explore our apps.');

  return (
    <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.loginHeader}>
        <Text style={[styles.loginHeaderTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
        <Pressable style={styles.iconButton} hitSlop={10} onPress={onSettingsPress}>
          <Feather name="settings" size={20} color="#111315" />
        </Pressable>
      </HeaderFrame>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.loginGateContent}>
        <Image source={noSignImage} style={styles.loginGateImage} resizeMode="contain" />
        <Text style={[styles.loginGateMessage, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{gateMessage}</Text>
        <View style={styles.loginGateButtons}>
          <Pressable style={styles.loginGatePrimary} onPress={onSignInPress}>
            <Text style={[styles.loginGatePrimaryText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Sign in')}</Text>
          </Pressable>
          <Pressable style={styles.loginGateSecondary} onPress={onSignUpPress}>
            <Text style={[styles.loginGateSecondaryText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Create an account')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

function LaunchingScreen({ onContinue }: { onContinue: () => void }) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <SafeAreaView style={styles.launchScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <HeaderTopGlow />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.launchContent}>
        <View style={styles.launchMain}>
          <Image source={launchImage} style={styles.launchImage} resizeMode="contain" />
          <View style={styles.launchCopy}>
            <Text style={[styles.launchTitle, type(24, 34 / 24)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Launching Remote 365')}</Text>
            <Text style={[styles.launchText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Allow your browser to launch the Remote 365 desktop application, to complete your Sign in.')}
            </Text>
          </View>
        </View>

        <Pressable style={styles.launchButton} onPress={onContinue}>
          <Text style={[styles.signInButtonText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Open Remote 365')}</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.signInFooter}>
        <Text style={[styles.signInFooterMain, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Privacy Policy')}</Text>
        <Text style={[styles.signInFooterSub, type(8, 11 / 8)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Copyright 2026 (c) Remote 365. All right reserved.')}</Text>
      </View>
    </SafeAreaView>
  );
}

function SettingsScreen({
  onAccountPress,
  onBack,
  onBiometricPress,
  onFeedbackPress,
  onLogout,
  onPermissionsPress,
  onPrivacyPress,
  onTrustedDevicesPress,
  onUpgradePress,
  user,
}: {
  onAccountPress: () => void;
  onBack: () => void;
  onBiometricPress: () => void;
  onFeedbackPress: () => void;
  onLogout: () => void;
  onPermissionsPress: () => void;
  onPrivacyPress: () => void;
  onTrustedDevicesPress: () => void;
  onUpgradePress: () => void;
  user: User | null;
}) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const displayName = user?.name || user?.email?.split('@')[0] || 'Remote 365 user';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'R';

  return (
    <SafeAreaView style={styles.settingsScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.settingsHeader}>
        <Pressable style={styles.settingsHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.settingsTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Settings</Text>
        </Pressable>
      </HeaderFrame>

      <ScrollView
        contentContainerStyle={styles.settingsContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Account</Text>
          <Pressable style={styles.settingsProfileRow} onPress={onAccountPress}>
            <View style={styles.settingsAvatar}>
              <Text style={[styles.settingsAvatarText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials}</Text>
            </View>
            <View style={styles.settingsProfileCopy}>
              <Text style={[styles.settingsRowTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{displayName}</Text>
              <Text style={[styles.settingsRowMeta, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{user?.email || 'Not signed in'}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#858687" />
          </Pressable>
          <SettingsRow icon="bar-chart-2" title="Upgrade Remote 365" onPress={onUpgradePress} />
          <SettingsRow icon="shield" title="Trusted devices" onPress={onTrustedDevicesPress} />
          <SettingsRow icon="message-circle" title="Chat" />
          <SettingsRow icon="mouse-pointer" title="Control" />
          <SettingsRow icon="star" title="Feedback" onPress={onFeedbackPress} />
        </View>

        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Configuration</Text>
          <SettingsRow icon="globe" title="Language" detail="English" />
          <SettingsRow icon="toggle-right" title="Start on launch" detail="On" />
          <SettingsRow icon="radio" title="Streaming quality" detail="Auto" />
        </View>

        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Security</Text>
          <SettingsRow icon="unlock" title="Biometric access" detail="Off" onPress={onBiometricPress} />
          <SettingsRow icon="check-circle" title="Permissions" onPress={onPermissionsPress} />
          <SettingsRow icon="key" title="Change password" />
          <SettingsRow icon="lock" title="Two-factor authentication" />
          <SettingsRow icon="shield" title="Privacy and security" />
        </View>

        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Logs</Text>
          <SettingsRow icon="file-text" title="Connection logs" />
          <SettingsRow icon="list" title="System logs" />
        </View>

        <View style={styles.settingsSection}>
          <Text style={[styles.settingsSectionTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>About Remote 365</Text>
          <SettingsRow icon="file" title="Terms of service" />
          <SettingsRow icon="file-text" title="Privacy policy" onPress={onPrivacyPress} />
          <SettingsRow icon="info" title="Version" detail="1.0.0" />
        </View>

        <Pressable style={styles.settingsLogoutButton} onPress={onLogout}>
          <Feather name="log-out" size={16} color="#D92D20" />
          <Text style={[styles.settingsLogoutText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function UpgradePlanScreen({ onBack }: { onBack: () => void }) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <SafeAreaView style={styles.upgradeScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.upgradeHeader}>
        <Pressable style={styles.upgradeHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.upgradeTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Upgrade Plan</Text>
        </Pressable>
      </HeaderFrame>

      <View style={styles.upgradeContent}>
        <Pressable style={styles.upgradeCurrentButton}>
          <View style={styles.upgradeCurrentLeft}>
            <Feather name="check-circle" size={16} color="#111315" />
            <Text style={[styles.upgradeCurrentText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Free Plan</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#111315" />
        </Pressable>

        <View style={styles.upgradePlanCard}>
          <View style={styles.upgradePlanCopy}>
            <Text style={[styles.upgradePlanTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Business Plan</Text>
            <View style={styles.upgradePlanDetails}>
              <Text style={[styles.upgradePlanUser, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Single user</Text>
              <Text style={[styles.upgradePlanPrice, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>$ 86.25/year</Text>
              <Text style={[styles.upgradePlanDescription, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                Get advanced remote access, secure meetings, chat, and business controls for one user.
              </Text>
            </View>
          </View>
          <Pressable style={styles.upgradeButton}>
            <Text style={[styles.upgradeButtonText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Upgrade</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.upgradeFooter}>
        <Text style={[styles.upgradeFooterMain, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Privacy Policy</Text>
        <Text style={[styles.upgradeFooterSub, type(8, 11 / 8)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Copyright 2026 (c) Remote 365. All right reserved.</Text>
      </View>
    </SafeAreaView>
  );
}

function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const [selectedSection, setSelectedSection] = useState('overview');
  const sections = [
    { id: 'overview', icon: 'eye', label: 'Privacy Overview' },
    { id: 'data', icon: 'database', label: 'Information We Collect' },
    { id: 'security', icon: 'lock', label: 'How We Protect Data' },
    { id: 'cookies', icon: 'circle', label: 'Cookies and Tracking' },
    { id: 'rights', icon: 'user-check', label: 'Your Privacy Rights' },
    { id: 'compliance', icon: 'shield', label: 'Security and Compliance' },
    { id: 'contact', icon: 'message-circle', label: 'Contact Us' },
  ] as const;

  return (
    <SafeAreaView style={styles.privacyScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.privacyHeader}>
        <Pressable style={styles.privacyHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.privacyTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Privacy Policy</Text>
        </Pressable>
      </HeaderFrame>

      <ScrollView contentContainerStyle={styles.privacyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.privacyIntro}>
          <Text style={[styles.privacyHeading, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Remote 365: Privacy Policy</Text>
          <Text style={[styles.privacyBodyText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            At Remote 365, your privacy and security are fundamental to everything we build. This Privacy Policy explains how we collect, use, store, and protect your information when you use our remote access platform and related services.
          </Text>
          <Text style={[styles.privacyDate, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Effective Date: May 23, 2026</Text>
        </View>

        <View style={styles.privacySections}>
          {sections.map((section) => {
            const selected = selectedSection === section.id;
            return (
              <Pressable
                key={section.id}
                style={[styles.privacySectionRow, selected && styles.privacySectionRowActive]}
                onPress={() => setSelectedSection(section.id)}
              >
                <Feather name={section.icon} size={16} color={selected ? '#FFFFFF' : '#111315'} />
                <Text style={[styles.privacySectionText, type(14, 20 / 14), selected && styles.privacySectionTextActive]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {section.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedSection === 'overview' ? (
          <View style={styles.privacyDetailBlock}>
            <Text style={[styles.privacyLongText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              Welcome to Remote 365. Remote 365 ("Remote 365", "we", "our", or "us") provides secure remote desktop access, device management, collaboration, and support services for individuals, businesses, and enterprise organizations. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you access our website, create an account, use our desktop or mobile applications, initiate or receive remote support sessions, communicate with our support team, or use any related services offered by Remote 365. By using Remote 365, you agree to the practices described in this Privacy Policy.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionsScreen({ onBack }: { onBack: () => void }) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <SafeAreaView style={styles.permissionsScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.permissionsHeader}>
        <Pressable style={styles.permissionsHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.permissionsTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Permissions</Text>
        </Pressable>
      </HeaderFrame>

      <ScrollView contentContainerStyle={styles.permissionsContent} showsVerticalScrollIndicator={false}>
        <View style={styles.permissionsSection}>
          <Text style={[styles.permissionsSectionTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Recommended</Text>
          <PermissionRow icon="bell" title="Notification" status="On" />
        </View>

        <View style={styles.permissionsSection}>
          <Text style={[styles.permissionsSectionTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Optional</Text>
          <View style={styles.permissionsRows}>
            <PermissionRow icon="camera" title="Camera" status="On" />
            <PermissionRow icon="map-pin" title="Location" status="On" />
            <PermissionRow icon="mic" title="Microphone" status="On" />
            <PermissionRow icon="folder" title="Files" status="On" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TrustedDevicesScreen({ onBack }: { onBack: () => void }) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const trustedDevices = [
    { id: 'mobile', name: 'This mobile device', detail: 'Current session', status: 'Trusted', icon: 'smartphone' },
    { id: 'desktop', name: 'Remote 365 Desktop', detail: 'Last active recently', status: 'Trusted', icon: 'monitor' },
    { id: 'browser', name: 'Web sign-in', detail: 'Account access', status: 'Review', icon: 'globe' },
  ] as const;

  return (
    <SafeAreaView style={styles.trustedScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.trustedHeader}>
        <Pressable style={styles.trustedHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.trustedTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Trusted Devices</Text>
        </Pressable>
      </HeaderFrame>

      <ScrollView contentContainerStyle={styles.trustedContent} showsVerticalScrollIndicator={false}>
        <View style={styles.trustedIntro}>
          <Text style={[styles.trustedIntroTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Manage trusted devices</Text>
          <Text style={[styles.trustedIntroText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            Review devices and sessions that can access your Remote 365 account.
          </Text>
        </View>

        <View style={styles.trustedRows}>
          {trustedDevices.map((device) => (
            <View key={device.id} style={styles.trustedRow}>
              <View style={styles.trustedRowLeft}>
                <View style={styles.trustedIconWrap}>
                  <Feather name={device.icon} size={16} color="#111315" />
                </View>
                <View style={styles.trustedRowCopy}>
                  <Text style={[styles.trustedRowTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{device.name}</Text>
                  <Text style={[styles.trustedRowMeta, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{device.detail}</Text>
                </View>
              </View>
              <View style={[styles.trustedStatusPill, device.status === 'Review' && styles.trustedStatusReview]}>
                <Text style={[styles.trustedStatusText, type(10, 14 / 10), device.status === 'Review' && styles.trustedStatusReviewText]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {device.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedbackScreen({ onBack }: { onBack: () => void }) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleCancel = () => {
    setRating(0);
    setFeedback('');
    onBack();
  };

  const handleSend = () => {
    setRating(0);
    setFeedback('');
    onBack();
  };

  return (
    <SafeAreaView style={styles.feedbackScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.feedbackHeader}>
        <Pressable style={styles.feedbackHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.feedbackTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Feedback</Text>
        </Pressable>
      </HeaderFrame>

      <KeyboardAvoidingView
        behavior={'padding'}
        style={styles.feedbackKeyboard}
      >
        <View style={styles.feedbackContent}>
          <View style={styles.feedbackIntro}>
            <Text style={[styles.feedbackHeading, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Share your Feedback</Text>
            <Text style={[styles.feedbackSubtitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>How satisfied are you with the Remote 365 app?</Text>
          </View>

          <View style={styles.feedbackForm}>
            <View style={styles.feedbackRatingBlock}>
              <Text style={[styles.feedbackRatingTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Rate Us</Text>
              <View style={styles.feedbackStars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable key={value} hitSlop={8} onPress={() => setRating(value)}>
                    <Feather
                      name="star"
                      size={24}
                      color="#1A1D21"
                      fill={value <= rating ? '#FFB347' : 'transparent'}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            <TextInput
              multiline
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Write your feedback here..."
              placeholderTextColor="rgba(17, 19, 21, 0.3)"
              style={[styles.feedbackInput, type(10, 14 / 10)]}
              textAlignVertical="top"
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            />
          </View>

          <View style={styles.feedbackActions}>
            <Pressable style={styles.feedbackCancelButton} onPress={handleCancel}>
              <Text style={[styles.feedbackCancelText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.feedbackSendButton} onPress={handleSend}>
              <Text style={[styles.feedbackSendText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BiometricScreen({ onBack }: { onBack: () => void }) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [lockSheetOpen, setLockSheetOpen] = useState(false);
  const [lockDelay, setLockDelay] = useState('immediate');
  const lockOptions = [
    { id: 'immediate', label: 'Immediately' },
    { id: '1m', label: 'After 1 minute' },
    { id: '5m', label: 'After 5 minutes' },
    { id: '15m', label: 'After 15 minutes' },
  ];

  return (
    <SafeAreaView style={styles.biometricScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.biometricHeader}>
        <Pressable style={styles.biometricHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.biometricTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Unlock with Biometrics</Text>
        </Pressable>
      </HeaderFrame>

      <View style={styles.biometricContent}>
        <View style={styles.biometricRows}>
          <View style={styles.biometricRow}>
            <View style={styles.biometricRowLeft}>
              <Feather name="unlock" size={16} color="#111315" />
              <View style={styles.biometricRowCopy}>
                <Text style={[styles.biometricRowTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Unlock with biometrics</Text>
                <Text style={[styles.biometricRowMeta, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{biometricEnabled ? 'Enabled' : 'Disabled'}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: biometricEnabled }}
              onPress={() => setBiometricEnabled((enabled) => !enabled)}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
              style={[styles.accountToggle, biometricEnabled && styles.accountToggleOn]}
            >
              <View style={[styles.accountToggleKnob, biometricEnabled && styles.accountToggleKnobOn]} />
            </Pressable>
          </View>

          <Pressable style={styles.biometricRow} onPress={() => setLockSheetOpen(true)}>
            <View style={styles.biometricRowLeft}>
              <Feather name="lock" size={16} color="#111315" />
              <View style={styles.biometricRowCopy}>
                <Text style={[styles.biometricRowTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Password</Text>
                <Text style={[styles.biometricRowMeta, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Required</Text>
              </View>
            </View>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={lockSheetOpen}
        onRequestClose={() => setLockSheetOpen(false)}
      >
        <Pressable style={styles.lockSheetBackdrop} onPress={() => setLockSheetOpen(false)}>
          <ResponsivePanel style={styles.lockSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.lockSheetTitleRow}>
              <Feather name="lock" size={16} color="#111315" />
              <Text style={[styles.lockSheetTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Lock app</Text>
            </View>

            {lockOptions.map((option) => (
              <Pressable
                key={option.id}
                style={styles.lockOptionRow}
                onPress={() => setLockDelay(option.id)}
              >
                <Text style={[styles.lockOptionText, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{option.label}</Text>
                <Feather
                  name={lockDelay === option.id ? 'circle' : 'circle'}
                  size={16}
                  color="#111315"
                  fill={lockDelay === option.id ? '#111315' : 'transparent'}
                />
              </Pressable>
            ))}

            <View style={styles.lockSheetActions}>
              <Pressable style={styles.lockCancelButton} onPress={() => setLockSheetOpen(false)}>
                <Text style={[styles.lockCancelText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.lockSaveButton} onPress={() => setLockSheetOpen(false)}>
                <Text style={[styles.lockSaveText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Save Setting</Text>
              </Pressable>
            </View>
          </ResponsivePanel>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function PermissionRow({
  icon,
  status,
  title,
}: {
  icon: keyof typeof Feather.glyphMap;
  status: string;
  title: string;
}) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <Pressable style={styles.permissionRow}>
      <View style={styles.permissionRowLeft}>
        <Feather name={icon} size={16} color="#111315" />
        <View style={styles.permissionRowCopy}>
          <Text style={[styles.permissionRowTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          <Text style={[styles.permissionRowStatus, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{status}</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color="#858687" />
    </Pressable>
  );
}

function AccountScreen({
  onBack,
  onLogout,
  user,
}: {
  onBack: () => void;
  onLogout: () => void;
  user: User | null;
}) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const displayName = user?.name || user?.email?.split('@')[0] || 'Remote 365 user';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'R';

  return (
    <SafeAreaView style={styles.accountScreen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      <HeaderFrame style={styles.accountHeader}>
        <Pressable style={styles.accountHeaderTitle} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.accountTitle, type(16, 23 / 16)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Account</Text>
        </Pressable>
      </HeaderFrame>

      <ScrollView contentContainerStyle={styles.accountContent} showsVerticalScrollIndicator={false}>
        <View style={styles.accountProfileRow}>
          <View style={styles.accountAvatar}>
            <Text style={[styles.accountAvatarText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{initials}</Text>
          </View>
          <View style={styles.accountProfileCopy}>
            <Text style={[styles.accountName, type(12, 17 / 12)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{displayName}</Text>
            <Text style={[styles.accountMeta, type(12, 17 / 12)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{user?.email || 'Not signed in'}</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#858687" />
        </View>

        <View style={styles.accountRowsGroup}>
          <AccountInfoRow
            icon="mail"
            title="Email address"
            subtitle={user?.email || 'Not signed in'}
          />
          <AccountInfoRow
            icon="check-circle"
            iconColor="#14AE5C"
            title="Account status"
            subtitle={isLoggedAccount(user) ? 'Active' : 'Signed out'}
          />
          <View style={[styles.accountInfoRow, styles.accountInfoRowLast]}>
            <View style={styles.accountInfoLeft}>
              <Feather name="bell" size={16} color="#111315" />
              <View style={styles.accountInfoCopy}>
                <Text style={[styles.accountInfoTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Notifications</Text>
                <Text style={[styles.accountInfoSubtitle, type(10, 14 / 10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {notificationsEnabled ? 'Enabled for account alerts' : 'Disabled for account alerts'}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: notificationsEnabled }}
              onPress={() => setNotificationsEnabled((enabled) => !enabled)}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
              style={[styles.accountToggle, notificationsEnabled && styles.accountToggleOn]}
            >
              <View style={[styles.accountToggleKnob, notificationsEnabled && styles.accountToggleKnobOn]} />
            </Pressable>
          </View>
        </View>

        <View style={styles.accountActionsGroup}>
          <Pressable style={styles.accountActionRow} onPress={onLogout}>
            <Feather name="log-out" size={16} color="#14AE5C" />
            <Text style={[styles.accountActionText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Logout</Text>
          </Pressable>
          <Pressable style={styles.accountActionRow}>
            <Feather name="trash-2" size={16} color="#14AE5C" />
            <Text style={[styles.accountActionText, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function isLoggedAccount(user: User | null) {
  return Boolean(user?.id || user?.email);
}

function AccountInfoRow({
  icon,
  iconColor = '#111315',
  subtitle,
  title,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  subtitle: string;
  title: string;
}) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <View style={styles.accountInfoRow}>
      <View style={styles.accountInfoLeft}>
        <Feather name={icon} size={16} color={iconColor} />
        <View style={styles.accountInfoCopy}>
          <Text style={[styles.accountInfoTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          <Text style={[styles.accountInfoSubtitle, type(10, 14 / 10)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

function SettingsRow({
  detail,
  icon,
  onPress,
  title,
}: {
  detail?: string;
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  title: string;
}) {
  const styles = useAppStyles();
  const { type, maxFontSizeMultiplier } = useResponsive();
  return (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <View style={styles.settingsRowLeft}>
        <Feather name={icon} size={16} color="#14AE5C" />
        <Text style={[styles.settingsRowTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {detail ? <Text style={[styles.settingsRowMeta, type(12, 18 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{detail}</Text> : null}
        <Feather name="chevron-right" size={16} color="#858687" />
      </View>
    </Pressable>
  );
}

const tabs: Array<{ key: MainTab; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: 'chat', label: 'Chat', icon: 'message-circle' },
  { key: 'devices', label: 'Devices', icon: 'monitor' },
  { key: 'connect', label: 'Connect', icon: 'radio' },
  { key: 'meeting', label: 'Meeting', icon: 'video' },
  { key: 'apps', label: 'Apps', icon: 'grid' },
];

// Per-tab icons chosen to match the navbar design (network, monitor, chat,
// video, app blocks). Active tab renders white inside the raised orange circle.
// Chat bubble icon from assets/chat.svg (stroked outline), tintable via `color`.
const CHAT_ICON_PATH =
  'M6.80371 0.789062C8.61137 0.305431 10.5283 0.431637 12.2568 1.14844C13.9853 1.8653 15.4294 3.13291 16.3643 4.75391C17.299 6.37489 17.672 8.25923 17.4268 10.1143C17.1814 11.9694 16.3309 13.6923 15.0068 15.0146C13.6829 16.3367 11.9597 17.1847 10.1045 17.4277C8.24913 17.6707 6.36494 17.2952 4.74512 16.3584L4.5498 16.2451L4.33594 16.3164L0.829102 17.4863C0.785928 17.5007 0.739728 17.5031 0.695312 17.4932C0.650885 17.4832 0.610032 17.4612 0.577148 17.4297C0.544307 17.3982 0.520659 17.3584 0.508789 17.3145C0.496948 17.2706 0.497268 17.2244 0.509766 17.1807L1.57812 13.4434L1.63379 13.2471L1.53613 13.0674C0.856161 11.8191 0.500533 10.4195 0.500977 8.99805C0.501407 7.12685 1.1193 5.30846 2.25879 3.82422C3.39839 2.33988 4.99596 1.27279 6.80371 0.789062ZM9.00098 0.998047C7.58847 0.997958 6.20066 1.37215 4.97949 2.08203C3.75835 2.79191 2.74675 3.81258 2.04785 5.04004C1.34904 6.26743 0.987281 7.65798 1 9.07031C1.01195 10.3944 1.35277 11.6935 1.98926 12.8516L2.12012 13.0811C2.13736 13.1103 2.14903 13.1431 2.15332 13.1768C2.15754 13.2104 2.15491 13.2448 2.14551 13.2773L2.14453 13.2783L1.38086 15.9482L1.12109 16.8594L2.01953 16.5605L4.50684 15.7324C4.54204 15.7207 4.58035 15.7162 4.61719 15.7207C4.65388 15.7252 4.68947 15.738 4.7207 15.7578C5.76899 16.4212 6.95717 16.8318 8.19141 16.957C9.42575 17.0822 10.6728 16.919 11.833 16.4795C12.9932 16.0399 14.0354 15.3364 14.877 14.4248C15.7185 13.5132 16.3371 12.4182 16.6826 11.2266C17.0281 10.035 17.0914 8.77903 16.8682 7.55859C16.6449 6.33818 16.1405 5.1864 15.3955 4.19434C14.6504 3.20226 13.685 2.39644 12.5752 1.8418C11.4654 1.28721 10.2416 0.99839 9.00098 0.998047ZM6.75098 10.248H9.75098C9.81712 10.2482 9.88096 10.2745 9.92773 10.3213C9.97449 10.3681 10.0009 10.4319 10.001 10.498C10.001 10.5642 9.97441 10.628 9.92773 10.6748C9.88096 10.7216 9.81712 10.7479 9.75098 10.748H6.75098C6.68473 10.748 6.62109 10.7216 6.57422 10.6748C6.52733 10.6279 6.50098 10.5644 6.50098 10.498C6.50103 10.4318 6.52739 10.3681 6.57422 10.3213C6.62107 10.2746 6.68483 10.248 6.75098 10.248ZM6.75098 7.24805H11.251C11.3171 7.24817 11.381 7.27451 11.4277 7.32129C11.4745 7.36811 11.5009 7.43188 11.501 7.49805C11.501 7.56419 11.4744 7.62795 11.4277 7.6748C11.381 7.72158 11.3171 7.74793 11.251 7.74805H6.75098C6.68473 7.74805 6.62109 7.72161 6.57422 7.6748C6.52733 7.62792 6.50098 7.56435 6.50098 7.49805C6.50103 7.43182 6.52739 7.36812 6.57422 7.32129C6.62107 7.27462 6.68483 7.24805 6.75098 7.24805Z';

function ChatNavIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d={CHAT_ICON_PATH} stroke={color} strokeWidth={1} />
    </Svg>
  );
}

function NavTabIcon({ tabKey, color, size = 24 }: { tabKey: MainTab; color: string; size?: number }) {
  switch (tabKey) {
    case 'connect':
      return <MaterialCommunityIcons name="sitemap-outline" size={size} color={color} />;
    case 'devices':
      return <Feather name="monitor" size={size} color={color} />;
    case 'chat':
      return <ChatNavIcon size={size} color={color} />;
    case 'meeting':
      return <Feather name="video" size={size} color={color} />;
    case 'apps':
      return <MaterialCommunityIcons name="view-grid-outline" size={size} color={color} />;
    default:
      return null;
  }
}

function BottomNav({
  activeTab,
  onTabPress,
  action,
}: {
  activeTab: MainTab;
  onTabPress: (tab: MainTab) => void;
  /** iOS only: round action button floated next to the nav bar. */
  action?: { onPress: () => void };
}) {
  const styles = useAppStyles();
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'ios') {
    return (
      <IosBottomNav
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={onTabPress}
        action={action}
        renderIcon={(tabKey, color, size) => (
          <NavTabIcon tabKey={tabKey} color={color} size={size} />
        )}
      />
    );
  }

  return (
    <View style={[styles.navWrap, { bottom: 12 + insets.bottom }]} pointerEvents="box-none">
      {/* When a page has an add action, the pill shrinks and the orange +
          sits inline on its right (same arrangement as the iOS nav). */}
      <View style={styles.navRow} pointerEvents="box-none">
        <View style={[styles.navPill, action ? styles.navPillShrunk : null]}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          const iconColor = active ? '#FFFFFF' : '#111315';
          const icon = <NavTabIcon tabKey={tab.key} color={iconColor} size={21} />;
          return (
            <Pressable
              key={tab.key}
              style={styles.navTab}
              hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
              onPress={() => onTabPress(tab.key)}
            >
              {active ? (
                <View style={styles.navHalo}>
                  <View style={styles.navRaised}>
                    <Svg width={46} height={46} style={StyleSheet.absoluteFill}>
                      <Defs>
                        <LinearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor="#FF8A00" />
                          <Stop offset="1" stopColor="#FFB347" />
                        </LinearGradient>
                      </Defs>
                      <Circle cx={23} cy={23} r={23} fill="url(#navGrad)" />
                    </Svg>
                    <NavTabIcon tabKey={tab.key} color="#FFFFFF" size={18} />
                  </View>
                </View>
              ) : (
                icon
              )}
            </Pressable>
          );
        })}
        </View>
        {action ? (
          <Pressable style={styles.navAddFab} onPress={action.onPress}>
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function App() {
  // initialMetrics: without it the provider renders null until the first
  // native inset event arrives, which is a blank frame on every cold start and
  // on every Activity recreation (fold/unfold, split-screen, display-size).
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><LanguageProvider><NotificationProvider><AppContent /></NotificationProvider></LanguageProvider></SafeAreaProvider>;
}

function AppContent() {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { textSize, maxFontSizeMultiplier } = useResponsive();
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<
    'connect' | 'no-connect' | 'monitoring' | 'managed-devices' | 'service-queue' | 'chat-thread' | 'sign-in' | 'sign-up' | 'settings' | 'account' | 'upgrade-plan' | 'permissions' | 'trusted-devices' | 'feedback' | 'biometric' | 'privacy-policy' | 'chat-settings' | 'control-settings' | 'language-settings' | 'launch-settings' | 'streaming-quality' | 'two-factor' | 'change-password' | 'privacy-security' | 'connection-logs' | 'system-logs' | 'terms' | 'notifications' | 'launching' | 'meeting-room' | 'remote-control'
  >('connect');
  const [activeTab, setActiveTab] = useState<MainTab>('connect');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [chatToast, setChatToast] = useState<{ convId: string; name: string; text: string } | null>(null);
  const [typingConversations, setTypingConversations] = useState<Record<string, string | undefined>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [deviceScope, setDeviceScope] = useState<DeviceScope>({ type: 'all', title: t('My Computers') });
  const [deviceMgmtAction, setDeviceMgmtAction] = useState<DeviceMgmtAction | null>(null);
  // Device ids of the latest real connections, most recent first (persisted).
  const [recentConnections, setRecentConnections] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('remote365_recent_connections')
      .then((raw) => {
        const ids = raw ? JSON.parse(raw) : [];
        if (Array.isArray(ids)) setRecentConnections(ids.map(String));
      })
      .catch(() => {});
  }, []);

  const rememberRecentConnection = (deviceId: string) => {
    if (!deviceId) return;
    setRecentConnections((current) => {
      const next = [deviceId, ...current.filter((id) => id !== deviceId)].slice(0, 5);
      AsyncStorage.setItem('remote365_recent_connections', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [previewMeetingId, setPreviewMeetingId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  // Remote-control session state.
  const [remoteSession, setRemoteSession] = useState<{ accessKey: string; token: string; deviceName: string; deviceType?: string | null } | null>(null);
  const [remoteConnecting, setRemoteConnecting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ device: DeviceItem } | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const viewerClientIdRef = useRef<string>(`mobile-${Math.random().toString(36).slice(2, 10)}`);
  const typingTimersRef = useRef<Record<string, any>>({});

  const startRemoteControl = async (device: DeviceItem, password?: string) => {
    const accessKey = String(device.accessKey || '').replace(/\D/g, '');
    if (!accessKey) return;
    setRemoteConnecting(true);
    setRemoteError(null);
    try {
      const result = await verifyDeviceAccess(API_BASE_URL, authToken, { accessKey, password });
      setRemoteSession({ accessKey, token: result.token, deviceName: device.name || t('Remote device'), deviceType: device.type || null });
      setPasswordPrompt(null);
      setPasswordValue('');
      rememberRecentConnection(device.id);
      setScreen('remote-control');
    } catch (err: any) {
      // 401 = the device needs its access password.
      if (err?.status === 401) {
        setPasswordPrompt({ device });
        setRemoteError(password ? t('Incorrect password. Try again.') : null);
      } else {
        setPasswordPrompt(null);
        setRemoteError(err?.message || t('Could not connect to this device.'));
      }
    } finally {
      setRemoteConnecting(false);
    }
  };

  const goToTab = (tab: MainTab) => {
    setScreen('connect');
    setActiveTab(tab);
  };

  const goBackOneScreen = () => {
    if (showSplash) return true;
    if (screen === 'chat-thread') {
      setActiveConversation(null);
      setScreen('connect');
      setActiveTab('chat');
      return true;
    }
    if (screen === 'meeting-room') {
      setScreen('connect');
      setActiveTab('meeting');
      setActiveMeetingId(null);
      return true;
    }
    if (screen === 'remote-control') {
      setRemoteSession(null);
      setScreen('connect');
      setActiveTab('devices');
      return true;
    }
    if (screen === 'account') {
      setScreen('settings');
      return true;
    }
    if (screen === 'upgrade-plan') {
      setScreen('settings');
      return true;
    }
    if (screen === 'permissions') {
      setScreen('settings');
      return true;
    }
    if (screen === 'trusted-devices') {
      setScreen('settings');
      return true;
    }
    if (screen === 'feedback') {
      setScreen('settings');
      return true;
    }
    if (screen === 'biometric') {
      setScreen('settings');
      return true;
    }
    if (screen === 'privacy-policy') {
      setScreen('settings');
      return true;
    }
    if (
      screen === 'chat-settings'
      || screen === 'control-settings'
      || screen === 'language-settings'
      || screen === 'launch-settings'
      || screen === 'streaming-quality'
      || screen === 'two-factor'
      || screen === 'privacy-security'
      || screen === 'connection-logs'
      || screen === 'system-logs'
      || screen === 'terms'
    ) {
      setScreen('settings');
      return true;
    }
    if (screen !== 'connect') {
      setScreen('connect');
      return true;
    }
    if (activeTab !== 'connect') {
      setActiveTab('connect');
      return true;
    }
    return false;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBackOneScreen);
    return () => subscription.remove();
  }, [screen, activeTab, showSplash]);

  const goToAdjacentTab = (direction: 1 | -1) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < tabOrder.length) {
      goToTab(tabOrder[nextIndex]);
    }
  };

  const openSettings = () => setScreen('settings');
  const openNotifications = () => setScreen('notifications');

  const {
    items: notifications,
    unreadCount: unreadNotifications,
    add: addNotification,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    clearAll: clearNotifications,
  } = useNotifications();

  /** Tapping a notification marks it read and routes to whatever it points at. */
  const openNotification = (item: { id: string; target?: any }) => {
    markNotificationRead(item.id);
    const target = item.target;
    if (!target) return;
    switch (target.screen) {
      case 'chat-thread':
        if (target.conversationId) { openConversationById(String(target.conversationId)); return; }
        goToTab('chat');
        return;
      case 'chat': goToTab('chat'); return;
      case 'meeting': goToTab('meeting'); return;
      case 'devices': goToTab('devices'); return;
      case 'settings': openSettings(); return;
      case 'connect':
      default: goToTab('connect');
    }
  };

  const swipeNavigator = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => (
      screen === 'connect'
      && Math.abs(gestureState.dx) > 22
      && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25
    ),
    onMoveShouldSetPanResponderCapture: (_, gestureState) => (
      screen === 'connect'
      && Math.abs(gestureState.dx) > 22
      && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25
    ),
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx <= -42 || gestureState.vx <= -0.45) {
        goToAdjacentTab(1);
      }

      if (gestureState.dx >= 42 || gestureState.vx >= 0.45) {
        goToAdjacentTab(-1);
      }
    },
  });

  // Mona Sans (design font). Requires a dev-client rebuild since expo-font is a
  // native module. If loading errors, we don't block the app — it falls back to
  // the system font rather than getting stuck on the splash.
  const [fontsLoaded, fontError] = useFonts({
    'MonaSans-Regular': require('./assets/fonts/MonaSans-Regular.ttf'),
    'MonaSans-Medium': require('./assets/fonts/MonaSans-Medium.ttf'),
    'MonaSans-SemiBold': require('./assets/fonts/MonaSans-SemiBold.ttf'),
  });
  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    onSessionChange = (payload) => {
      setAuthToken(payload?.accessToken || null);
      setUser(payload?.user || null);
      setIsLoggedIn(Boolean(payload));
    };
    return () => { onSessionChange = () => {}; };
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const payload = await getStoredAuthSession();
        if (!payload?.accessToken || !payload?.user) return;

        await sessionManager.set(payload);
        // Validate/refresh before exposing restored credentials to protected screens.
        try {
          await apiFetch('/api/auth/me', {}, payload.accessToken);
        } catch (err: any) {
          if (err?.status === 401 || err?.status === 403 || err?.sessionRevoked) {
            await sessionManager.set(null);
            setAuthError(err?.message || t('Please sign in again.'));
            setScreen('sign-in');
            return;
          }
          // Offline/server failures preserve the session for the next retry.
        }
        await loadAccountData(sessionManager.get()?.accessToken, payload.user);
      } catch {
        await clearAuthSession();
      } finally {
        setAuthRestoring(false);
      }
    };

    void restoreSession();
  }, []);

  const applyAuth = async (payload: AuthPayload, showLaunchScreen = true, remember = true) => {
    await sessionManager.set(payload, remember);
    setAuthError(null);
    await AsyncStorage.setItem(REMEMBER_KEY, String(remember)).catch(() => {});
    setScreen(showLaunchScreen ? 'launching' : 'connect');
    await loadAccountData(payload.accessToken, payload.user);
  };

  const handleLogout = async () => {
    await sessionManager.set(null);
    setAuthToken(null);
    setUser(null);
    setIsLoggedIn(false);
    setAuthError(null);
    setDevices([]);
    setDeviceGroups([]);
    setConversations([]);
    setMeetings([]);
    setActiveTab('connect');
    setDeviceScope({ type: 'all', title: t('My Computers') });
    setScreen('sign-in');
  };

  // Single-session policy: the backend revokes this session when the account
  // signs in anywhere else. Check on foreground and once a minute; on a kick,
  // sign out locally and tell the user why on the sign-in screen.
  useEffect(() => {
    if (authRestoring || !isLoggedIn || !authToken) return;
    let cancelled = false;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      const version = sessionManager.version();
      try {
        await apiFetch('/api/auth/me', {}, authToken);
      } catch (err: any) {
        if (cancelled || sessionManager.version() !== version || (!err?.sessionRevoked && err?.status !== 401 && err?.status !== 403)) return;
        await handleLogout();
        setAuthError(
          err?.sessionRevoked
            ? err.message
            : err?.status === 403 ? err.message : t('Your session has expired. Please sign in again.'),
        );
      } finally {
        checking = false;
      }
    };
    check();
    const interval = setInterval(check, 60_000);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [isLoggedIn, authToken, authRestoring]);

  const loadAccountData = async (token = authToken, currentUser = user) => {
    if (!token) return;
    setDataLoading(true);
    try {
      const [deviceRows, groupPayload, conversationRows, meetingRows] = await Promise.all([
        apiFetch<any[]>('/api/devices/mine', {}, token).catch(() => []),
        apiFetch<{ groups?: any[] }>('/api/devices/user-groups', {}, token).catch(() => ({ groups: [] })),
        apiFetch<any[]>('/api/chat/conversations', {}, token).catch(() => []),
        apiFetch<any[]>('/api/chat/meetings', {}, token).catch(() => []),
      ]);

      setDevices(deviceRows.map(mapDeviceItem));
      setDeviceGroups((groupPayload.groups || []).map(mapDeviceGroup));
      setConversations(conversationRows.map((row) => mapConversationItem(row, currentUser?.id)));
      setMeetings(meetingRows.map(mapMeetingItem));
    } finally {
      setDataLoading(false);
    }
  };

  // Silent devices+groups refetch for realtime sync pushes — no spinner, and
  // chat/meeting state is left alone (web parity: fetchDevices(true)).
  const refreshDevices = async (token = authToken) => {
    if (!token) return;
    try {
      const [deviceRows, groupPayload] = await Promise.all([
        apiFetch<any[]>('/api/devices/mine', {}, token),
        apiFetch<{ groups?: any[] }>('/api/devices/user-groups', {}, token).catch(() => ({ groups: [] })),
      ]);
      setDevices(deviceRows.map(mapDeviceItem));
      setDeviceGroups((groupPayload.groups || []).map(mapDeviceGroup));
    } catch {
      // Keep showing the last known list; the poll fallback will retry.
    }
  };

  // Patch one device in place from a presence/session push — a full refetch
  // for every online/offline flip would hammer the API on large fleets. The
  // no-op guard matters just as much: presence heartbeats re-announce the same
  // status, and with a 100+ device fleet an unconditional new-array state set
  // per push re-renders the whole app continuously (web parity: the store's
  // patchDeviceByKey has the same guard).
  const patchDeviceByKey = (accessKey: string, patch: Partial<DeviceItem>) => {
    const key = normalizeAccessKey(accessKey);
    if (!key) return;
    setDevices((current) => {
      let changed = false;
      const next = current.map((device) => {
        if (normalizeAccessKey(device.accessKey) !== key) return device;
        const fields = Object.entries(patch) as [keyof DeviceItem, unknown][];
        if (fields.every(([field, value]) => device[field] === value)) return device;
        changed = true;
        return { ...device, ...patch };
      });
      return changed ? next : current;
    });
  };

  // Presence watch list bookkeeping for the app-level socket (web parity:
  // useDeviceMonitor). Signature-deduped so pushes that rebuild the device
  // array don't re-send identical subscriptions.
  const subscribedKeysRef = useRef('');
  const deviceSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appSocketReadyRef = useRef(false);

  // App-level chat socket: keeps the user "online" whenever the app is open and
  // surfaces an in-app toast for messages arriving in conversations you're not viewing.
  const openConversationById = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    const opened = { ...conv, unreadCount: 0 };
    setConversations((current) => current.map((item) => (
      item.id === convId ? { ...item, unreadCount: 0 } : item
    )));
    setActiveConversation(opened);
    setActiveTab('chat');
    setScreen('chat-thread');
  };

  const appSocket = useChatSocket(API_BASE_URL, isLoggedIn ? authToken : null, {
    onMessage: (message, convId) => {
      setTypingConversations((current) => ({ ...current, [convId]: undefined }));
      const isMine = !!user && message.senderId === user.id;
      const viewingThis = screen === 'chat-thread' && activeConversation?.id === convId;
      if (!user || isMine || viewingThis) return;
      const conv = conversations.find((c) => c.id === convId);
      const preview = message.content?.startsWith?.(SESSION_INVITE_PREFIX)
        ? t('Sent an invite')
        : (message.content || t('📎 Photo'));
      const messageTime = new Date(message.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setConversations((current) => current.map((item) => (
        item.id === convId
          ? { ...item, preview, date: messageTime, unreadCount: (item.unreadCount || 0) + 1 }
          : item
      )));
      setChatToast({ convId, name: conv?.name || t('New message'), text: preview });
      addNotification({
        // Keyed on the message id so the socket event and its push cannot both land.
        id: makeNotificationId.message(message.id),
        kind: 'message',
        title: conv?.name || t('New message'),
        body: preview,
        target: { screen: 'chat-thread', conversationId: convId },
      });
    },
    // The event that was being dropped entirely: someone invited this user to a
    // session or meeting. Raised as a notification AND as the usual toast.
    onSessionInvite: (invite: any) => {
      if (!invite) return;
      const code = String(invite.sessionCode || invite.code || invite.displayCode || '');
      const from = String(invite.fromName || invite.from?.name || invite.sessionName || t('Someone'));
      const isMeeting = String(invite.type || '') === 'meeting' || !!invite.meetingId;
      addNotification({
        id: code ? makeNotificationId.sessionCode(code) : makeNotificationId.invite(String(invite.id || invite.remoteSessionId || Date.now())),
        kind: isMeeting ? 'meeting-invite' : 'session-invite',
        title: isMeeting ? t('Meeting invitation') : t('Session invitation'),
        body: `${from}${code ? ` · ${code}` : ''}`,
        target: isMeeting ? { screen: 'meeting', code } : { screen: 'connect', sessionCode: code },
      });
      void loadAccountData();
    },
    onContactRequest: (conversation: any) => {
      if (!conversation?.id) return;
      addNotification({
        id: makeNotificationId.conversation(String(conversation.id), 'invited'),
        kind: 'contact-request',
        title: t('New contact request'),
        body: String(conversation.name || ''),
        target: { screen: 'chat' },
      });
    },
    onTyping: (convId, userId, userName, isTyping) => {
      if (!convId || userId === user?.id) return;
      if (typingTimersRef.current[convId]) clearTimeout(typingTimersRef.current[convId]);
      setTypingConversations((current) => ({
        ...current,
        [convId]: isTyping ? (userName || t('Someone')) : undefined,
      }));
      if (isTyping) {
        typingTimersRef.current[convId] = setTimeout(() => {
          setTypingConversations((current) => ({ ...current, [convId]: undefined }));
        }, 4000);
      }
    },
    onConversationUpdated: () => { loadAccountData(); },
    onAuthenticated: () => {
      // Fresh (re)connect: the list may have changed while the socket was down,
      // and the server-side watch set is empty again — resync both.
      subscribedKeysRef.current = '';
      refreshDevices();
    },
    onAccountSync: (scope) => {
      if (scope !== 'devices') return;
      // Group/device mutations arrive in bursts (assign fires one per device);
      // trailing-debounce the refetch instead of refetching per event.
      if (deviceSyncTimerRef.current) clearTimeout(deviceSyncTimerRef.current);
      deviceSyncTimerRef.current = setTimeout(() => { refreshDevices(); }, 800);
    },
    onDevicePresence: (accessKey, online) => patchDeviceByKey(accessKey, { isOnline: online }),
    onDeviceSessionStatus: (accessKey, inSession) => patchDeviceByKey(accessKey, { inSession }),
  });
  appSocketReadyRef.current = appSocket.ready;

  // Keep the presence watch list in step with the device list without tearing
  // down the socket; subscribing replaces the set server-side.
  useEffect(() => {
    if (!appSocket.ready) {
      subscribedKeysRef.current = '';
      return;
    }
    const keys = devices.map((device) => normalizeAccessKey(device.accessKey)).filter(Boolean).sort();
    const signature = keys.join(',');
    if (!signature || signature === subscribedKeysRef.current) return;
    subscribedKeysRef.current = signature;
    appSocket.subscribePresence(keys);
  }, [appSocket.ready, devices]);

  // Fallback + catch-up (web parity): a slow poll covers a dead socket, and
  // returning to the foreground refetches so the fleet is never silently stale.
  useEffect(() => {
    if (!isLoggedIn || !authToken) return;
    const poll = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      if (!appSocketReadyRef.current) refreshDevices();
    }, 30_000);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshDevices();
    });
    return () => {
      clearInterval(poll);
      appStateSub.remove();
      if (deviceSyncTimerRef.current) clearTimeout(deviceSyncTimerRef.current);
    };
  }, [isLoggedIn, authToken]);

  // Register for push notifications once logged in, and open the right chat on tap.
  useEffect(() => {
    if (isLoggedIn && authToken) registerPushToken(API_BASE_URL, authToken);
  }, [isLoggedIn, authToken]);

  useEffect(() => {
    const unsubscribe = addNotificationTapListener((convId) => openConversationById(convId));
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // Add-contact / create-group — same backend as the desktop chat feature.
  const createContactRequest = async (email: string): Promise<AddContactResult> => {
    try {
      await apiFetch('/api/chat/conversations', { method: 'POST', body: JSON.stringify({ email }) }, authToken);
      await loadAccountData();
      return { ok: true };
    } catch (err: any) {
      const message = err?.message === 'User not found'
        ? t('User not found. They must have a Remote 365 account.')
        : err?.message || t('Could not send the invitation.');
      return { ok: false, error: message };
    }
  };

  const createGroupRequest = async (name: string, emails: string[]): Promise<AddContactResult> => {
    try {
      await apiFetch('/api/chat/groups', { method: 'POST', body: JSON.stringify({ name, emails }) }, authToken);
      await loadAccountData();
      return { ok: true };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || t('Could not create group. Check that every email has a Remote 365 account.'),
      };
    }
  };

  const openManagedDevices = (scope: DeviceScope) => {
    setDeviceScope(scope);
    setScreen('managed-devices');
  };

  const scopedDevices = devices.filter((device) => {
    if (deviceScope.type === 'mine') return device.groups.length === 0;
    if (deviceScope.type === 'group') {
      return device.groups.some((group) => group.id === deviceScope.groupId)
        || deviceGroups.find((group) => group.id === deviceScope.groupId)?.deviceIds.includes(device.id);
    }
    return true;
  });

  const handleOAuth = async (provider: 'google' | 'microsoft', remember = true, business = false) => {
    setAuthError(null);

    try {
      const redirectUri = AuthSession.makeRedirectUri({ path: 'auth/callback' });
      const authUrl = `${API_BASE_URL}/api/auth/oauth/${provider}?platform=mobile&returnUrl=${encodeURIComponent(redirectUri)}${business ? '&accountType=business' : ''}`;
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri,
      );

      if (result.type !== 'success' || !result.url) {
        throw new Error(t('Social sign in was cancelled.'));
      }

      const parsedUrl = new URL(result.url);
      const oauthError = parsedUrl.searchParams.get('error');
      if (oauthError) throw new Error(oauthError);
      const accessToken = parsedUrl.searchParams.get('accessToken');
      const refreshToken = parsedUrl.searchParams.get('refreshToken') || undefined;

      if (!accessToken) {
        throw new Error(t('Social sign in did not return an access token.'));
      }

      const userProfile = await apiFetch<User>('/api/auth/me', {}, accessToken);
      await applyAuth({ accessToken, refreshToken, user: userProfile }, false, remember);
    } catch (error: any) {
      throw new Error(error.message || t('Social sign in failed'));
    }
  };

  const openMeetingRoom = (meetingId: string) => {
    setActiveMeetingId(meetingId);
    setPreviewMeetingId(null);
    setScreen('meeting-room');
  };

  const openMeetingPreview = (meetingId: string) => {
    setPreviewMeetingId(meetingId);
  };

  const protectedTab = screen === 'monitoring' || screen === 'managed-devices' || screen === 'service-queue'
    ? 'devices'
    : screen === 'chat-thread'
      ? 'chat'
      : activeTab;
  const shouldShowLoginGate = !authRestoring && !isLoggedIn && screen !== 'no-connect' && protectedTab !== 'connect';

  return (
    <NotificationBellContext.Provider value={{ count: unreadNotifications, onPress: openNotifications }}>
      <View style={styles.appRoot} {...swipeNavigator.panHandlers}>
        {/* Shared orange gradient backdrop shown on every screen (splash draws its own). */}
        {!showSplash && fontsReady ? <ScreenBackground /> : null}
        {showSplash || !fontsReady || authRestoring ? (
          <SplashScreen />
        ) : screen === 'remote-control' && remoteSession ? (
          <RemoteControl
            apiBaseUrl={API_BASE_URL}
            authToken={authToken}
            accessKey={remoteSession.accessKey}
            accessToken={remoteSession.token}
            deviceName={remoteSession.deviceName}
            deviceType={remoteSession.deviceType}
            viewerClientId={viewerClientIdRef.current}
            onExit={() => {
              setRemoteSession(null);
              setScreen('connect');
              setActiveTab('devices');
            }}
          />
        ) : screen === 'meeting-room' && activeMeetingId ? (
          <MeetingRoom
            apiBaseUrl={API_BASE_URL}
            meetingId={activeMeetingId}
            onLeave={() => {
              setActiveMeetingId(null);
              setScreen('connect');
              setActiveTab('meeting');
              loadAccountData();
            }}
            token={authToken}
            user={user}
          />
        ) : screen === 'launching' ? (
          <LaunchingScreen onContinue={() => setScreen('connect')} />
        ) : screen === 'privacy-policy' ? (
          <SettingsPrivacyPolicyScreen onBack={() => setScreen('settings')} />
        ) : screen === 'biometric' ? (
          <SettingsBiometricScreen onBack={() => setScreen('settings')} />
        ) : screen === 'feedback' ? (
          <SettingsFeedbackScreen onBack={() => setScreen('settings')} apiBaseUrl={API_BASE_URL} authToken={authToken} />
        ) : screen === 'trusted-devices' ? (
          <SettingsTrustedDevicesScreen onBack={() => setScreen('settings')} apiBaseUrl={API_BASE_URL} authToken={authToken} />
        ) : screen === 'permissions' ? (
          <SettingsPermissionsScreen onBack={() => setScreen('settings')} />
        ) : screen === 'chat-settings' ? (
          <ChatSettingsScreen onBack={() => setScreen('settings')} />
        ) : screen === 'control-settings' ? (
          <ControlSettingsScreen onBack={() => setScreen('settings')} />
        ) : screen === 'language-settings' ? (
          <LanguageScreen onBack={() => setScreen('settings')} />
        ) : screen === 'launch-settings' ? (
          <LaunchSettingsScreen onBack={() => setScreen('settings')} />
        ) : screen === 'streaming-quality' ? (
          <StreamingQualityScreen onBack={() => setScreen('settings')} />
        ) : screen === 'two-factor' ? (
          <TwoFactorScreen
            onBack={() => setScreen('settings')}
            apiBaseUrl={API_BASE_URL}
            authToken={authToken}
            user={user}
            onRefreshUser={() => loadAccountData()}
          />
        ) : screen === 'change-password' ? (
          <ChangePasswordScreen
            onBack={() => setScreen('settings')}
            apiBaseUrl={API_BASE_URL}
            authToken={authToken}
            hasPassword={(user as any)?.hasPassword !== false}
            provider={(user as any)?.provider}
          />
        ) : screen === 'privacy-security' ? (
          <PrivacySecurityScreen onBack={() => setScreen('settings')} />
        ) : screen === 'connection-logs' ? (
          <ConnectionLogsScreen onBack={() => setScreen('settings')} />
        ) : screen === 'system-logs' ? (
          <SystemLogsScreen onBack={() => setScreen('settings')} />
        ) : screen === 'terms' ? (
          <TermsScreen onBack={() => setScreen('settings')} />
        ) : screen === 'upgrade-plan' ? (
          <SettingsUpgradePlanScreen
            onBack={() => setScreen('settings')}
            apiBaseUrl={API_BASE_URL}
            authToken={authToken}
            onViewPrivacy={() => setScreen('privacy-policy')}
          />
        ) : screen === 'account' ? (
          <SettingsAccountScreen
            onBack={() => setScreen('settings')}
            onLogout={handleLogout}
            user={user}
            apiBaseUrl={API_BASE_URL}
            authToken={authToken}
          />
        ) : screen === 'notifications' ? (
          <NotificationsScreen
            items={notifications}
            onBack={() => setScreen('connect')}
            onClear={clearNotifications}
            onMarkAllRead={markAllNotificationsRead}
            onOpen={openNotification}
          />
        ) : screen === 'settings' ? (
          <RemoteSettingsScreen
            onAccountPress={() => setScreen('account')}
            onBack={() => setScreen('connect')}
            onBiometricPress={() => setScreen('biometric')}
            onChangePasswordPress={() => setScreen('change-password')}
            onChatPress={() => setScreen('chat-settings')}
            onConnectionLogsPress={() => setScreen('connection-logs')}
            onControlPress={() => setScreen('control-settings')}
            onFeedbackPress={() => setScreen('feedback')}
            onLanguagePress={() => setScreen('language-settings')}
            onLaunchPress={() => setScreen('launch-settings')}
            onLogout={handleLogout}
            onPermissionsPress={() => setScreen('permissions')}
            onPrivacyPress={() => setScreen('privacy-policy')}
            onPrivacySecurityPress={() => setScreen('privacy-security')}
            onStreamingPress={() => setScreen('streaming-quality')}
            onSystemLogsPress={() => setScreen('system-logs')}
            onTermsPress={() => setScreen('terms')}
            onTrustedDevicesPress={() => setScreen('trusted-devices')}
            onTwoFactorPress={() => setScreen('two-factor')}
            onUpgradePress={() => setScreen('upgrade-plan')}
            onSignInPress={() => setScreen('sign-in')}
            user={user}
          />
        ) : screen === 'no-connect' ? (
          <NoConnectScreen
            onBack={() => setScreen('connect')}
            onConnect={(accessKey) => startRemoteControl({ accessKey, name: `${t('Support ID')} ${accessKey}` } as DeviceItem)}
            connecting={remoteConnecting}
            error={remoteError}
          />
        ) : screen === 'sign-in' || screen === 'sign-up' ? (
          <AuthScreen
            key={screen}
            initialMode={screen === 'sign-up' ? 'signup' : 'login'}
            initialError={authError}
            request={apiFetch}
            onAuthenticated={(payload, remember) => applyAuth(normalizeAuthPayload(payload), true, remember)}
            onOAuth={handleOAuth}
            onBack={() => { setAuthError(null); setScreen('connect'); }}
          />
        ) : shouldShowLoginGate ? (
          <LoginRequiredScreen
            activeTab={protectedTab}
            onSettingsPress={openSettings}
            onSignInPress={() => setScreen('sign-in')}
            onSignUpPress={() => setScreen('sign-up')}
            onTabPress={goToTab}
          />
        ) : screen === 'monitoring' ? (
          <MonitoringOverviewScreen
            activeTab="devices"
            devices={devices}
            onBack={() => setScreen('connect')}
            onSettingsPress={openSettings}
            onTabPress={goToTab}
          />
        ) : screen === 'service-queue' ? (
          <ServiceQueueScreen
            items={conversations
              .filter((conversation) => conversation.inviteCode)
              .map((conversation) => ({
                conversationId: conversation.id,
                from: conversation.name,
                date: conversation.date,
                code: conversation.inviteCode as string,
              }))}
            onBack={() => setScreen('connect')}
            onJoin={(code) => openMeetingPreview(code)}
            onOpenChat={(conversationId) => openConversationById(conversationId)}
            header={(content) => (
              <HeaderFrame style={styles.managedHeader}>
                {content}
                <View style={styles.managedActions}>
                  <HeaderBell />
                  <Pressable style={styles.iconButton} hitSlop={10} onPress={openSettings}>
                    <Feather name="settings" size={20} color="#111315" />
                  </Pressable>
                </View>
              </HeaderFrame>
            )}
            bottomNav={<BottomNav activeTab="devices" onTabPress={goToTab} />}
          />
        ) : screen === 'managed-devices' ? (
          <ManagedDevicesScreen
            activeTab="devices"
            devices={scopedDevices}
            loading={dataLoading}
            onBack={() => setScreen('connect')}
            onRefresh={() => loadAccountData()}
            onSettingsPress={openSettings}
            onTabPress={goToTab}
            onControl={(device) => startRemoteControl(device)}
            onDeviceMenu={(device) => setDeviceMgmtAction({ kind: 'device-menu', device })}
            onAddDevice={() => setDeviceMgmtAction({ kind: 'add-device' })}
            title={deviceScope.title}
          />
        ) : screen === 'chat-thread' ? (
          <ChatThreadScreen
            apiBaseUrl={API_BASE_URL}
            token={authToken}
            user={user}
            conversation={activeConversation}
            devices={devices}
            onBack={() => setScreen('connect')}
            onResolved={() => loadAccountData()}
            onJoinMeeting={(code) => openMeetingPreview(code)}
            onOpenDevice={(mention) =>
              startRemoteControl({
                id: `mention-${mention.accessKey}`,
                name: mention.name,
                accessKey: mention.accessKey,
                isOnline: true,
                groups: [],
              })
            }
          />
        ) : activeTab === 'devices' ? (
          <DevicesScreen
            activeTab={activeTab}
            devices={devices}
            deviceCount={devices.length}
            groups={deviceGroups}
            loading={dataLoading}
            onManagedDevicesPress={openManagedDevices}
            onMonitoringPress={() => setScreen('monitoring')}
            onSettingsPress={openSettings}
            onTabPress={goToTab}
            onAddPress={() => setDeviceMgmtAction({ kind: 'add-menu' })}
            onGroupLongPress={(group) => setDeviceMgmtAction({ kind: 'group-menu', group })}
            onServiceQueuePress={() => setScreen('service-queue')}
            queueCount={conversations.filter((conversation) => conversation.inviteCode).length}
          />
        ) : activeTab === 'chat' ? (
          <ChatScreen
            activeTab={activeTab}
            conversations={conversations}
            typingConversations={typingConversations}
            onAddContact={() => setShowAddContact(true)}
            onChatPress={(conversation) => {
              setConversations((current) => current.map((item) => (
                item.id === conversation.id ? { ...item, unreadCount: 0 } : item
              )));
              setActiveConversation({ ...conversation, unreadCount: 0 });
              setScreen('chat-thread');
            }}
            onSettingsPress={openSettings}
            onTabPress={goToTab}
          />
        ) : activeTab === 'meeting' ? (
          <MeetingScreen
            activeTab={activeTab}
            meetings={meetings}
            onMeetingsChange={setMeetings}
            onOpenMeeting={openMeetingRoom}
            onSettingsPress={openSettings}
            onTabPress={goToTab}
            token={authToken}
            user={user}
          />
        ) : activeTab === 'apps' ? (
          <AppsScreen activeTab={activeTab} onSettingsPress={openSettings} onTabPress={goToTab} />
        ) : (
          <ConnectScreen
            activeTab={activeTab}
            devices={devices}
            loading={dataLoading}
            onSettingsPress={openSettings}
            onSearchConnect={() => setScreen('no-connect')}
            onControl={(device) => startRemoteControl(device)}
            onTabPress={goToTab}
            recentDeviceIds={recentConnections}
          />
        )}

        <MeetingPreview
          mode="join"
          onCancel={() => setPreviewMeetingId(null)}
          onConfirm={() => {
            if (previewMeetingId) openMeetingRoom(previewMeetingId);
          }}
          visible={Boolean(previewMeetingId)}
        />

        {/* Add contact / create group modal */}
        <AddContactModal
          visible={showAddContact}
          onClose={() => setShowAddContact(false)}
          onCreateContact={createContactRequest}
          onCreateGroup={createGroupRequest}
        />

        {/* Device / group management sheets & dialogs (Devices tab) */}
        <DeviceManagement
          action={deviceMgmtAction}
          groups={deviceGroups}
          apiBaseUrl={API_BASE_URL}
          token={authToken}
          onClose={() => setDeviceMgmtAction(null)}
          onAction={setDeviceMgmtAction}
          onChanged={() => loadAccountData()}
          onConnect={(device) => startRemoteControl(device as unknown as DeviceItem)}
        />

        {/* In-app message notification banner */}
        {chatToast ? (
          <ChatToast
            name={chatToast.name}
            text={chatToast.text}
            onPress={() => { const id = chatToast.convId; setChatToast(null); openConversationById(id); }}
            onDismiss={() => setChatToast(null)}
          />
        ) : null}

        {/* Device password prompt for untrusted connections */}
        {passwordPrompt ? (
          <KeyboardAvoidingView
            style={styles.passwordOverlay}
            behavior={'padding'}
          >
            <Pressable
              style={styles.passwordBackdrop}
              onPress={() => { setPasswordPrompt(null); setPasswordValue(''); setRemoteError(null); }}
            />
            <ResponsivePanel style={styles.passwordCard}>
              <Text style={[styles.passwordTitle, textSize(18)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Enter device password')}</Text>
              <Text style={[styles.passwordSubtitle, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {passwordPrompt.device.name} {t('requires a password to connect.')}
              </Text>
              <TextInput
                autoFocus
                secureTextEntry
                value={passwordValue}
                onChangeText={setPasswordValue}
                placeholder={t('Password')}
                placeholderTextColor="rgba(17, 19, 21, 0.3)"
                style={[styles.passwordPromptInput, textSize(15)]}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                onSubmitEditing={() => startRemoteControl(passwordPrompt.device, passwordValue)}
              />
              {remoteError ? <Text style={[styles.passwordError, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{remoteError}</Text> : null}
              <View style={styles.passwordActions}>
                <Pressable
                  style={styles.passwordCancel}
                  onPress={() => { setPasswordPrompt(null); setPasswordValue(''); setRemoteError(null); }}
                >
                  <Text style={[styles.passwordCancelText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
                </Pressable>
                <Pressable
                  style={styles.passwordConnect}
                  onPress={() => startRemoteControl(passwordPrompt.device, passwordValue)}
                  disabled={remoteConnecting || !passwordValue}
                >
                  <Text style={[styles.passwordConnectText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{remoteConnecting ? t('Connecting…') : t('Connect')}</Text>
                </Pressable>
              </View>
            </ResponsivePanel>
          </KeyboardAvoidingView>
        ) : null}

        {/* Connecting / error banner while verify-access runs (no password path) */}
        {(remoteConnecting && !passwordPrompt) || (remoteError && !passwordPrompt) ? (
          <View style={styles.connectToast}>
            {remoteConnecting ? (
              <Text style={[styles.connectToastText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Connecting…')}</Text>
            ) : (
              <Pressable onPress={() => setRemoteError(null)}>
                <Text style={[styles.connectToastError, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{remoteError}</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </NotificationBellContext.Provider>
  );
}

const baseStyles = StyleSheet.create(monaFontStyles({
  appRoot: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  splashScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splashGlow: {
    left: '50%',
    position: 'absolute',
    top: '50%',
  },
  brandBlock: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
    paddingHorizontal: 0
  },
  brandStack: {
    alignItems: 'center',
    gap: 16,
    minHeight: 110,
    justifyContent: 'center',
    width: '100%'
  },
  splashLogo: {
    height: 60,
    width: 60,
  },
  splashTitle: {
    color: '#111315',
    fontWeight: '700',
    textAlign: 'center',
  },
  taglineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 20,
    width: '100%',
  },
  rule: {
    backgroundColor: '#1A1D21',
    borderRadius: 2,
    flex: 1,
    maxWidth: 50,
    height: 2
  },
  tagline: {
    color: '#1A1D21',
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1
  },
  homeScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  noConnectScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  headerFrame: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Makes the header blend into the page (single unit): no bar background,
  // shadow, elevation or divider — the shared gradient shows through instead.
  // Applied after each screen's own header style so it overrides them.
  headerFlat: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  headerTopGlow: {
    height: 240,
    position: 'absolute',
    top: -150,
  },
  noConnectHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 12,
    height: 60,
    paddingHorizontal: 16,
  },
  noConnectBack: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 24,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    // minHeight, not height: the support-ID text now scales with the OS font
    // setting, so the field has to grow with it.
    minHeight: 40,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#111315',
    flex: 1,
    fontFamily: 'MonaSans-Regular',
    minHeight: 40,
    paddingVertical: 0,
  },
  noConnectTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 40,
  },
  noConnectHeaderText: {
    color: '#111315',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  emptySearchBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    flexGrow: 1,
    paddingBottom: 16,
    paddingTop: 16
  },
  emptySearchIcon: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 16,
    width: 56,
  },
  emptySearchTitle: {
    color: '#111315',
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySearchText: {
    color: 'rgba(26, 29, 33, 0.62)',
    fontWeight: '500',
    textAlign: 'center',
  },
  noConnectButtons: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // No-op on phones; stops the two 158dp buttons from being flung to
    // opposite edges of a tablet / unfolded foldable.
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  secondaryActionButton: {
    alignItems: 'center',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    flex: 1,
    maxWidth: 158,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  secondaryActionText: {
    color: '#FF8A00',
    fontWeight: '500',
  },
  primaryActionButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    justifyContent: 'center',
    flex: 1,
    maxWidth: 158,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  primaryActionDisabled: {
    opacity: 0.5,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  topBrand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
    minWidth: 0
  },
  topLogo: {
    height: 32,
    width: 32,
  },
  topTitle: {
    color: '#111315',
    fontWeight: '600',
    flexShrink: 1
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    flexShrink: 0,
  },
  iconButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  devicesHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  devicesTitle: {
    color: '#111315',
    fontWeight: '600',
    flexShrink: 1
  },
  devicesActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    flexShrink: 0,
  },
  devicesContent: {
    gap: 12,
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 24,
    width: '100%',
  },
  devicesScroll: {
    flex: 1,
    width: '100%',
  },
  deviceSearchBox: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    // minHeight, not height: the input inside scales with the OS font size.
    minHeight: 42,
    paddingHorizontal: 12,
    width: '100%',
  },
  deviceSearchInput: {
    color: '#111315',
    flex: 1,
    fontWeight: '500',
    // minHeight so scaled text grows the field instead of being clipped by it.
    minHeight: 40,
    padding: 0,
  },
  quickSection: {
    gap: 16,
    width: '100%',
  },
  sectionSmallTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  quickRows: {
    gap: 8,
  },
  quickRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 32,
    paddingVertical: 5,
    width: '100%',
  },
  quickRowTall: {
    // Two-line label ("Monitoring overview" + the offline/in-session counts)
    // needs room for both lines — a fixed 41px clipped the second line.
    height: undefined,
    minHeight: 48,
    alignItems: 'flex-start',
    paddingVertical: 7,
  },
  quickLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 19,
  },
  quickLabel: {
    color: '#111315',
    fontWeight: '500',
  },
  deviceDivider: {
    backgroundColor: 'rgba(26, 29, 33, 0.3)',
    height: 1,
    width: '100%',
  },
  deviceGroup: {
    width: '100%',
  },
  deviceGroupTitle: {
    color: '#111315',
    fontWeight: '400',
    // minHeight, not height: a fixed dp height does not scale while the text
    // inside it does, which cropped the caption. fontSize/lineHeight come from
    // type(10) at the render site so the line box grows with the font scale.
    minHeight: 14,
  },
  deviceEmptyText: {
    color: 'rgba(26, 29, 33, 0.55)',
    fontWeight: '400',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  deviceListRow: {
    justifyContent: 'center',
    // minHeight: rows can carry an "In session" pill and scaled text.
    minHeight: 40,
    paddingVertical: 4,
    width: '100%',
  },
  deviceListRowCompact: {
    minHeight: 40,
  },
  deviceListInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    // No fixed height — the in-session pill is taller than the bare label.
    minHeight: 20,
    paddingHorizontal: 16,
  },
  deviceListLabel: {
    color: '#111315',
    fontWeight: '500',
    // RN defaults flexShrink to 0, so a long group name used to push the
    // "n in session" pill off the right edge instead of ellipsising itself.
    flexShrink: 1,
    minWidth: 0,
  },
  managedHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  managedHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    // The title is a user-supplied group name; without these the whole title
    // row refuses to shrink and pushes the action cluster off-screen.
    flexShrink: 1,
    minWidth: 0,
  },
  managedTitle: {
    color: '#111315',
    fontWeight: '600',
    flexShrink: 1
  },
  managedActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    flexShrink: 0,
  },
  managedContent: {
    gap: 16,
    // Clears the bottom nav so the last device row is reachable when scrolled.
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 12,
    width: '100%',
  },
  managedDeviceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    // minHeight: the name row now carries an "In session" pill, and the meta
    // line grows with the OS font size — a fixed 34 made rows collide.
    minHeight: 44,
    justifyContent: 'space-between',
    paddingVertical: 5,
    width: '100%',
  },
  managedDeviceIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 19,
  },
  managedDeviceActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  managedDeviceAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 174, 92, 0.3)',
    borderRadius: 16,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  managedDeviceNameOffline: {
    color: 'rgba(17, 19, 21, 0.55)',
  },
  managedDeviceText: { flex: 1 },
  managedDeviceNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  managedDeviceAvatarInSession: {
    backgroundColor: 'rgba(255, 138, 0, 0.28)',
  },
  // Offline: red tint to match the red status line beneath it.
  managedDeviceAvatarOffline: {
    backgroundColor: 'rgba(220, 38, 38, 0.18)',
  },
  managedDeviceMetaInSession: {
    color: '#B45309',
  },
  // Cold-load state: spinner above the label, centred in the empty page.
  loadingBlock: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    paddingTop: 48,
  },
  // Offline reads as a fault state, not just an absence — red, matching the
  // error colour used elsewhere (#FF383C is the form-error red).
  managedDeviceMetaOffline: {
    color: '#DC2626',
  },
  inSessionPill: {
    backgroundColor: 'rgba(255, 138, 0, 0.14)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    // Keeps its intrinsic width while the label beside it shrinks.
    flexShrink: 0,
  },
  inSessionPillText: {
    color: '#B45309',
    fontWeight: '600',
  },
  managedDeviceName: {
    color: '#111315',
    fontWeight: '500',
    // Long hostnames used to shove the "In session" pill out of the row.
    flexShrink: 1,
    minWidth: 0,
  },
  managedDeviceMeta: {
    color: 'rgba(26, 29, 33, 0.62)',
    fontWeight: '400',
  },
  noDeviceContent: {
    alignItems: 'center',
    // flexGrow (not flex) — this is a ScrollView contentContainer, so it must
    // fill the viewport when short and grow past it when the content is tall.
    flexGrow: 1,
    gap: 45,
    justifyContent: 'center',
    paddingBottom: 150,
    paddingHorizontal: 16,
    width: '100%',
  },
  noDeviceImage: {
    height: 171,
    maxWidth: '70%',
    width: 200,
  },
  noDeviceCopy: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 420,
    width: '100%',
  },
  noDeviceTitle: {
    color: '#000000',
    fontWeight: '500',
    textAlign: 'center',
  },
  noDeviceText: {
    color: '#1A1D21',
    fontWeight: '500',
    textAlign: 'center',
  },
  noDeviceButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 8,
    // minHeight: the only way out of the empty state, so its label must never
    // be clipped by the pill at raised font sizes.
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: 8,
    maxWidth: '70%',
    width: 200,
  },
  noDeviceButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  chatHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  chatTitle: {
    color: '#111315',
    fontWeight: '600',
    flexShrink: 1,
  },
  chatHeaderTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    // Must be able to give way, or the settings button is pushed off-screen.
    flexShrink: 1,
    minWidth: 0,
  },
  chatActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    // Added with the notification bell — this row previously held a single icon.
    gap: 18,
  },
  chatListContent: {
    gap: 30,
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 20,
    width: '100%',
  },
  chatListScroll: {
    flex: 1,
    width: '100%',
  },
  chatTopControls: {
    gap: 12,
    maxWidth: 440,
    // alignSelf: the scroll content is capped at 720 and centred on tablets,
    // so a 440-wide section without this hugs the left edge of that column.
    alignSelf: 'center',
    width: '100%',
  },
  chatSearchBox: {
    alignItems: 'center',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    // minHeight so the field grows with the OS font size instead of cropping.
    minHeight: 40,
    paddingHorizontal: 16,
    width: '100%',
  },
  chatSearchPlaceholder: {
    color: 'rgba(17, 19, 21, 0.3)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  chatFilterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 25,
    width: '100%',
  },
  chatChips: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  chatChip: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 32,
    // minHeight: the 10sp/14dp label grows with the OS font size.
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chatChipWide: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 32,
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chatChipText: {
    color: '#000000',
    fontWeight: '400',
  },
  chatChipActive: {
    backgroundColor: '#111315',
  },
  chatChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chatSearchInput: {
    flex: 1,
    fontWeight: '500',
    color: '#111315',
    paddingVertical: 0,
  },
  chatTools: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  chatToolButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  chatSmallAdd: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  directMessagesSection: {
    gap: 12,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  groupMessagesSection: {
    gap: 12,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  chatSectionTitle: {
    color: '#000000',
    fontWeight: '600',
  },
  chatRows: {
    gap: 8,
    width: '100%',
  },
  chatRow: {
    alignItems: 'center',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
  },
  chatRowActive: {
    backgroundColor: '#F3F4F6',
  },
  chatRowUnread: {
    backgroundColor: 'rgba(39, 174, 96, 0.06)',
  },
  chatAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 179, 71, 0.3)',
    justifyContent: 'center',
    // height / width / borderRadius come from circle(40) at the render site so
    // the circle tracks the font scale.
    width: 40,
  },
  chatAvatarText: {
    color: '#111315',
    fontWeight: '500',
    textAlign: 'center',
  },
  chatOnlineDot: {
    backgroundColor: '#34C759',
    borderColor: '#FFFFFF',
    borderRadius: 3,
    borderWidth: 0.5,
    bottom: 2,
    height: 8,
    position: 'absolute',
    right: 2,
    width: 8,
  },
  chatRowBody: {
    flex: 1,
    minWidth: 0,
  },
  chatRowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  chatContactName: {
    color: '#000000',
    flex: 1,
    fontWeight: '500',
  },
  chatUnreadStrong: {
    fontWeight: '700',
  },
  chatDate: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
    textAlign: 'right',
  },
  chatUnreadDate: {
    color: '#27AE60',
    fontWeight: '700',
  },
  chatRowBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 12,
    width: '100%',
  },
  chatPreview: {
    color: 'rgba(26, 29, 33, 0.7)',
    flex: 1,
    fontWeight: '400',
  },
  chatPreviewTyping: {
    color: '#14AE5C',
    fontWeight: '500',
  },
  chatPreviewUnread: {
    color: '#111315',
    fontWeight: '600',
  },
  chatUnreadBadge: {
    alignItems: 'center',
    backgroundColor: '#27AE60',
    borderRadius: 91,
    // minHeight, not height: the count scales with the OS font size and used
    // to be sliced top and bottom inside a fixed 18dp pill.
    minHeight: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
  },
  chatUnreadText: {
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  threadContactBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 72,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
  },
  threadContactInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  threadAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 179, 71, 0.3)',
    borderRadius: 200,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  threadAvatarText: {
    color: '#111315',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    textAlign: 'center',
  },
  threadContactCopy: {
    gap: 4,
  },
  threadName: {
    color: 'rgba(0, 0, 0, 0.85)',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 18,
  },
  threadStatus: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16,
  },
  threadDivider: {
    backgroundColor: 'rgba(26, 29, 33, 0.3)',
    height: 1,
    marginHorizontal: 16,
  },
  threadBody: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 92,
    paddingHorizontal: 15,
    width: '100%',
  },
  sessionOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 8,
    gap: 8,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: -4, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    width: 229,
  },
  sessionOptionRow: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 8,
    minHeight: 53,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  sessionOptionText: {
    color: '#111315',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  messageComposer: {
    alignItems: 'center',
    bottom: 18,
    flexDirection: 'row',
    gap: 12,
    left: 16,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 16,
  },
  messageIconButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  messageInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    flex: 1,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  messagePlaceholder: {
    color: 'rgba(0, 0, 0, 0.45)',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
  },
  chatNoGroups: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
    textAlign: 'center',
    width: '100%',
  },
  meetingHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  meetingTitle: {
    color: '#111315',
    fontWeight: '600',
    flexShrink: 1,
  },
  meetingActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    // Added with the notification bell — this row previously held a single icon.
    gap: 18,
  },
  meetingContent: {
    gap: 48,
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 30,
    width: '100%',
  },
  meetingIntro: {
    gap: 16,
    maxWidth: 420,
    width: '100%',
  },
  meetingTimeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
  },
  meetingTime: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 25,
  },
  meetingDot: {
    backgroundColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 2,
    height: 3,
    width: 3,
  },
  meetingDate: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  meetingDescription: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    maxWidth: 327,
  },
  meetingSections: {
    gap: 24,
    maxWidth: 420,
    width: '100%',
  },
  newMeetingBlock: {
    gap: 24,
    width: '100%',
  },
  meetingCopyBlock: {
    gap: 4,
    width: '100%',
  },
  meetingSectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 25,
  },
  meetingBodyText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  newMeetingButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 8,
    height: 40,
    justifyContent: 'center',
    width: '100%',
  },
  newMeetingButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  quickJoinBlock: {
    gap: 12,
    width: '100%',
  },
  quickJoinForm: {
    gap: 8,
    width: '100%',
  },
  quickJoinLabel: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  quickJoinRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  meetingInput: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    height: 40,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 16,
  },
  meetingInputPlaceholder: {
    color: 'rgba(17, 19, 21, 0.3)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    width: '100%',
  },
  joinButton: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderColor: '#F3F4F6',
    borderRadius: 4,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 90,
  },
  joinButtonText: {
    color: 'rgba(26, 29, 33, 0.3)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  meetingListRow: {
    alignItems: 'center',
    borderColor: 'rgba(26, 29, 33, 0.18)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  meetingListTitle: {
    color: '#111315',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  meetingListMeta: {
    color: 'rgba(26, 29, 33, 0.62)',
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  appsHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  appsTitle: {
    color: '#111315',
    fontWeight: '600',
    flexShrink: 1,
  },
  appsActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    flexShrink: 0,
  },
  appsFill: {
    // flexGrow with the default auto basis instead of `flex: 1`: a bad measure
    // pass can collapse basis-0 containers to zero height and blank the page
    // (same failure ChatEmpty hit).
    flexGrow: 1,
    flexShrink: 0,
    width: '100%',
  },
  appsScroll: {
    flex: 1,
    width: '100%',
  },
  appsContent: {
    gap: 22,
    paddingBottom: 150,
    paddingHorizontal: 16,
    paddingTop: 20,
    width: '100%',
  },
  appsIntro: {
    color: '#111315',
    fontWeight: '400',
    width: '100%',
  },
  appsList: {
    gap: 16,
    width: '100%',
  },
  appDownloadCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 0.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%',
    gap: 12
  },
  appDownloadInfo: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    minWidth: 0
  },
  appDownloadLogo: {
    borderRadius: 8,
    height: 32,
    width: 32,
  },
  appDownloadCopy: {
    gap: 4,
    flex: 1,
    minWidth: 0
  },
  appDownloadTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  appDownloadText: {
    color: '#111315',
    fontWeight: '400',
  },
  chatContent: {
    alignItems: 'center',
    flex: 1,
    gap: 45,
    justifyContent: 'center',
    paddingBottom: 120,
    paddingHorizontal: 16,
    paddingTop: 24,
    width: '100%',
  },
  chatImage: {
    height: 171,
    maxWidth: '70%',
    width: 200,
  },
  chatCopy: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 328,
    width: '100%',
  },
  chatEmptyTitle: {
    color: '#111315',
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 34,
    textAlign: 'center',
  },
  chatEmptyBody: {
    color: '#1A1D21',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    height: 40,
    justifyContent: 'center',
    maxWidth: '70%',
    width: 200,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  monitorHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  monitorHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    // Mirrors managedHeaderTitle: without these the title row cannot give way
    // and pushes the help/settings buttons off the right edge.
    flexShrink: 1,
    minWidth: 0,
  },
  monitorTitle: {
    color: '#111315',
    fontWeight: '600',
    flexShrink: 1,
  },
  monitorActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    flexShrink: 0,
  },
  monitorContent: {
    alignItems: 'center',
    flex: 1,
    // No bottom padding: the list inside scrolls all the way down and carries
    // its own clearance, which gives it the most usable height.
    paddingTop: 16,
    width: '100%',
  },
  // Compact, left-aligned header: the old version forced the text into a 146px
  // column (so every label wrapped onto extra lines) and stacked everything
  // vertically, which ate roughly half the screen before the list even started.
  endpointSummary: {
    alignSelf: 'stretch',
    gap: 12,
    paddingHorizontal: 20,
  },
  endpointMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  endpointCopy: {
    flex: 1,
    gap: 2,
  },
  endpointTitle: {
    color: '#000000',
    fontWeight: '600',
  },
  endpointSubtitle: {
    color: '#1A1D21',
    fontWeight: '400',
  },
  endpointStats: {
    alignItems: 'center',
    flexDirection: 'row',
    // No fixed height/width — the labels grow with the OS font-size setting.
    flexWrap: 'wrap',
    gap: 22,
  },
  endpointStat: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  endpointStatText: {
    color: '#111315',
    fontWeight: '400',
  },
  monitorTabs: {
    elevation: 8,
    flexDirection: 'row',
    minHeight: 40,
    marginTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: '100%',
  },
  monitorTab: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    // minHeight so a wrapped/scaled label is never clipped.
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  monitorTabActive: {
    backgroundColor: 'rgba(255, 179, 71, 0.3)',
    borderBottomColor: 'rgba(0, 0, 0, 0.7)',
    borderBottomWidth: 1,
  },
  monitorTabText: {
    color: '#111315',
    fontWeight: '500',
  },
  monitorEmpty: {
    alignItems: 'center',
    gap: 16,
    marginTop: 28,
    maxWidth: 250,
    width: '80%',
  },
  monitorListScroll: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: 20,
  },
  monitorList: {
    paddingTop: 4,
    // Clears the floating nav pill so the last device can scroll fully into
    // view instead of being cut off at the bottom.
    paddingBottom: 140,
    gap: 2,
  },
  monitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,29,33,0.08)',
  },
  monitorStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  monitorRowCopy: { flex: 1 },
  monitorRowName: { fontWeight: '500', color: '#111315' },
  monitorRowMeta: { color: 'rgba(17,19,21,0.55)', fontFamily: 'MonaSans-Regular' },
  monitorEmptyIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    elevation: 5,
    height: 40,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 40,
  },
  monitorEmptyText: {
    color: '#000000',
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
  monitorEmptyTextWide: {
    maxWidth: 196,
  },
  monitorEmptyTextAcknowledge: {
    maxWidth: 250,
  },
  helpOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(243, 244, 246, 0.7)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  helpCard: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    gap: 12,
    // minHeight, and widths in % — the fixed 139/83/233 combination clipped
    // roughly half the body text and overflowed narrow (320dp) screens.
    justifyContent: 'center',
    maxWidth: 281,
    minHeight: 139,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '86%',
  },
  helpTextBlock: {
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
  },
  helpTitle: {
    color: '#111315',
    fontWeight: '500',
    width: '100%',
  },
  helpBody: {
    color: '#111315',
    fontWeight: '400',
    width: '100%',
  },
  helpOkButton: {
    width: '100%',
  },
  helpOkText: {
    color: '#111315',
    fontWeight: '500',
    textAlign: 'right',
  },
  connectContent: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 40,
    width: '100%',
  },
  connectLabel: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  previewPanel: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    height: 150,
    justifyContent: 'center',
    maxWidth: 420,
    overflow: 'hidden',
    width: '100%',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  previewMonitor: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E7EB',
    borderRadius: 6,
    borderWidth: 1,
    height: 80,
    justifyContent: 'center',
    width: 118,
  },
  previewBar: {
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    height: 8,
    marginBottom: 12,
    width: 42,
  },
  previewLine: {
    backgroundColor: '#D7DADE',
    borderRadius: 2,
    height: 4,
    marginTop: 6,
    width: 72,
  },
  previewLineShort: {
    width: 48,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
  },
  outlineButtonText: {
    color: '#111315',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  buttonLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  recentCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    height: 142,
    width: '100%',
  },
  recentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 36,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardDivider: {
    backgroundColor: 'rgba(26, 29, 33, 0.3)',
    height: 1,
    marginHorizontal: 16,
    marginTop: 16,
  },
  recentList: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  recentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 24,
    justifyContent: 'space-between',
  },
  recentIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 19,
  },
  recentAvatar: {
    alignItems: 'center',
    borderRadius: 16,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  recentName: {
    color: '#111315',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    maxWidth: 180,
  },
  recentCopy: {
    minWidth: 0,
  },
  recentStatus: {
    color: 'rgba(26, 29, 33, 0.55)',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
  },
  recentEmptyText: {
    color: 'rgba(26, 29, 33, 0.55)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    paddingBottom: 4,
    paddingHorizontal: 24,
  },
  recentActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  actionsMenu: {
    borderRadius: 4,
    elevation: 8,
    position: 'absolute',
    right: 19,
    shadowColor: '#000000',
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    top: 502,
    width: 130,
    zIndex: 80,
  },
  menuBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 70,
  },
  actionMenuRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 8,
    height: 37,
    paddingHorizontal: 16,
  },
  actionMenuTop: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  actionMenuBottom: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  actionMenuText: {
    color: '#111315',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  loginHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  loginHeaderTitle: {
    color: '#111315',
    fontWeight: '600',
    flexShrink: 1
  },
  loginGateContent: {
    alignItems: 'center',
    gap: 40,
    justifyContent: 'center',
    paddingBottom: 90,
    paddingHorizontal: 16,
    flexGrow: 1
  },
  loginGateImage: {
    height: 171,
    maxWidth: '80%',
    width: 200,
  },
  loginGateMessage: {
    color: '#000000',
    fontWeight: '400',
    maxWidth: 328,
    textAlign: 'center',
  },
  loginGateButtons: {
    gap: 12,
    maxWidth: 360,
    width: '100%',
  },
  loginGatePrimary: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    // minHeight: the label wraps at large font sizes and a fixed 44dp pill
    // clipped the second line.
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  loginGatePrimaryText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  loginGateSecondary: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  loginGateSecondaryText: {
    color: '#111315',
    fontWeight: '500',
  },
  signInScreen: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  authScroll: {
    width: '100%',
  },
  authKeyboardView: {
    flex: 1,
    width: '100%',
  },
  authScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    // Clears the absolutely-positioned footer so the sign-up link and terms
    // never scroll underneath it on short screens / with the keyboard up.
    paddingBottom: 88,
    paddingTop: 52,
  },
  signInBackButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    top: 48,
    width: 40,
    zIndex: 5,
  },
  signInModal: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 20,
    maxWidth: 390,
    paddingVertical: 8,
    width: '92%',
  },
  signInBrand: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  signInLogo: {
    height: 40,
    width: 40,
  },
  signInIntro: {
    alignItems: 'center',
    width: '100%',
  },
  signInKicker: {
    color: 'rgba(26, 29, 33, 0.5)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    minHeight: 24,
    textAlign: 'center',
  },
  signInSubtitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  signInForm: {
    gap: 14,
    width: '100%',
  },
  formFields: {
    gap: 10,
    width: '100%',
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    color: '#111315',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 4,
  },
  signInInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    color: '#111315',
    fontSize: 14,
    fontWeight: '500',
    height: 44,
    paddingHorizontal: 14,
    width: '100%',
  },
  passwordInputWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: 16,
    width: '100%',
  },
  passwordInput: {
    color: '#111315',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    height: 42,
    padding: 0,
  },
  signInMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 24,
    width: '100%',
  },
  rememberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  rememberText: {
    color: '#1A1D21',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
  },
  forgotText: {
    color: '#FF8A00',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
  },
  signInActions: {
    gap: 8,
    width: '100%',
  },
  signInButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    height: 44,
    justifyContent: 'center',
    width: '100%',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.65,
  },
  authErrorText: {
    color: '#D92D20',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    textAlign: 'center',
  },
  authInfoText: {
    color: '#14AE5C',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    textAlign: 'center',
  },
  orRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    height: 20,
    justifyContent: 'center',
    width: '100%',
  },
  orLine: {
    backgroundColor: 'rgba(26, 29, 33, 0.3)',
    flex: 1,
    height: 1,
  },
  orText: {
    color: 'rgba(26, 29, 33, 0.3)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  googleButton: {
    alignItems: 'center',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: 44,
    justifyContent: 'center',
    width: '100%',
  },
  googleMark: {
    color: '#4285F4',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  googleButtonText: {
    color: '#111315',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  signInTerms: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
    maxWidth: 300,
    textAlign: 'center',
  },
  authSwitchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 24,
  },
  authSwitchMuted: {
    color: 'rgba(26, 29, 33, 0.65)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  authSwitchLink: {
    color: '#FF8A00',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  signInFooter: {
    alignItems: 'center',
    bottom: 16,
    position: 'absolute',
  },
  signInFooterMain: {
    color: 'rgba(26, 29, 33, 0.5)',
    fontWeight: '400',
    textAlign: 'center',
  },
  signInFooterSub: {
    color: 'rgba(26, 29, 33, 0.5)',
    fontWeight: '400',
    textAlign: 'center',
  },
  launchScreen: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  launchContent: {
    alignItems: 'center',
    gap: 60,
    justifyContent: 'center',
    maxWidth: 420,
    paddingBottom: 90,
    paddingTop: 70,
    width: '100%',
    flexGrow: 1
  },
  launchMain: {
    alignItems: 'center',
    gap: 45,
    width: '100%',
  },
  launchImage: {
    height: 170,
    width: 200,
    maxWidth: '100%'
  },
  launchCopy: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  launchTitle: {
    color: '#000000',
    fontWeight: '500',
    textAlign: 'center',
  },
  launchText: {
    color: '#000000',
    fontWeight: '400',
    maxWidth: 328,
    textAlign: 'center',
  },
  launchButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    // minHeight: the only CTA on this screen — its label must be allowed to
    // wrap into the button instead of spilling out of a fixed 40dp pill.
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 220,
    width: '61%',
  },
  settingsScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  settingsHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: 'rgba(26, 29, 33, 0.3)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  settingsHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  settingsTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  settingsContent: {
    gap: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  settingsSection: {
    gap: 8,
    width: '100%',
  },
  settingsSectionTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  settingsProfileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingVertical: 10,
    width: '100%',
  },
  settingsAvatar: {
    alignItems: 'center',
    backgroundColor: '#F9F5FF',
    borderRadius: 100,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  settingsAvatarText: {
    color: '#7F56D9',
    fontWeight: '500',
    textAlign: 'center',
  },
  settingsProfileCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: 10,
    width: '100%',
  },
  settingsRowLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  settingsRowRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  settingsRowTitle: {
    color: '#111315',
    flexShrink: 1,
    fontWeight: '400',
  },
  settingsRowMeta: {
    color: '#535862',
    flexShrink: 1,
    fontWeight: '400',
  },
  settingsLogoutButton: {
    alignItems: 'center',
    borderColor: 'rgba(217, 45, 32, 0.25)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 44,
    justifyContent: 'center',
    marginTop: 8,
    width: '100%',
  },
  settingsLogoutText: {
    color: '#D92D20',
    fontWeight: '500',
  },
  upgradeScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  upgradeHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  upgradeHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  upgradeTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  upgradeContent: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 24,
    width: '100%',
  },
  upgradeCurrentButton: {
    alignItems: 'center',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 40,
    justifyContent: 'space-between',
    maxWidth: 420,
    // Without alignSelf the capped card hugs the left edge on a wide screen.
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
  },
  upgradeCurrentLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  upgradeCurrentText: {
    color: '#111315',
    fontWeight: '500',
  },
  upgradePlanCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 18,
    maxWidth: 420,
    alignSelf: 'center',
    minHeight: 159,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '100%',
  },
  upgradePlanCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  upgradePlanTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  upgradePlanDetails: {
    gap: 16,
  },
  upgradePlanUser: {
    color: '#111315',
    fontWeight: '400',
  },
  upgradePlanPrice: {
    color: '#111315',
    fontWeight: '600',
  },
  upgradePlanDescription: {
    color: '#111315',
    fontWeight: '400',
  },
  upgradeButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    minHeight: 28,
    justifyContent: 'center',
    marginTop: 110,
    paddingHorizontal: 10,
    // minWidth, not width: a scaled "Upgrade" wraps inside a locked 68dp box.
    minWidth: 68,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  upgradeFooter: {
    alignItems: 'center',
    alignSelf: 'center',
    bottom: 16,
    position: 'absolute',
    width: 226,
  },
  upgradeFooterMain: {
    color: 'rgba(26, 29, 33, 0.5)',
    fontWeight: '400',
    textAlign: 'center',
    width: '100%',
  },
  upgradeFooterSub: {
    color: 'rgba(26, 29, 33, 0.5)',
    fontWeight: '400',
    textAlign: 'center',
    width: '100%',
  },
  privacyScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  privacyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  privacyHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  privacyTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  privacyContent: {
    alignItems: 'center',
    gap: 48,
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  privacyIntro: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  privacyHeading: {
    color: '#000000',
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  privacyBodyText: {
    color: '#000000',
    fontWeight: '400',
    textAlign: 'center',
    width: '100%',
  },
  privacyDate: {
    color: '#000000',
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
  privacySections: {
    gap: 4,
    width: '100%',
  },
  privacySectionRow: {
    alignItems: 'center',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  privacySectionRowActive: {
    backgroundColor: '#FF8A00',
  },
  privacySectionText: {
    color: '#111315',
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
  },
  privacySectionTextActive: {
    color: '#FFFFFF',
  },
  privacyDetailBlock: {
    gap: 8,
    width: '100%',
  },
  privacyLongText: {
    color: '#000000',
    fontWeight: '400',
    width: '100%',
  },
  permissionsScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  permissionsHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  permissionsHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  permissionsTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  permissionsContent: {
    gap: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  permissionsSection: {
    gap: 16,
    width: '100%',
  },
  permissionsSectionTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  permissionsRows: {
    gap: 8,
    width: '100%',
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 51,
    paddingVertical: 10,
    width: '100%',
  },
  permissionRowLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  permissionRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  permissionRowTitle: {
    color: '#111315',
    fontWeight: '400',
  },
  permissionRowStatus: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
  },
  trustedScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  trustedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  trustedHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  trustedTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  trustedContent: {
    gap: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  trustedIntro: {
    gap: 4,
    width: '100%',
  },
  trustedIntroTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  trustedIntroText: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
  },
  trustedRows: {
    gap: 8,
    width: '100%',
  },
  trustedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 51,
    paddingVertical: 10,
    width: '100%',
  },
  trustedRowLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  trustedIconWrap: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  trustedRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  trustedRowTitle: {
    color: '#111315',
    fontWeight: '400',
  },
  trustedRowMeta: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
  },
  trustedStatusPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 174, 92, 0.12)',
    borderRadius: 10,
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trustedStatusReview: {
    backgroundColor: 'rgba(255, 138, 0, 0.12)',
  },
  trustedStatusText: {
    color: '#14AE5C',
    fontWeight: '500',
  },
  trustedStatusReviewText: {
    color: '#FF8A00',
  },
  feedbackScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  feedbackHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  feedbackHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  feedbackTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  feedbackKeyboard: {
    flex: 1,
  },
  feedbackContent: {
    gap: 22,
    paddingHorizontal: 17,
    paddingTop: 24,
    width: '100%',
  },
  feedbackIntro: {
    gap: 0,
    width: '100%',
  },
  feedbackHeading: {
    color: '#111315',
    fontWeight: '500',
  },
  feedbackSubtitle: {
    color: '#111315',
    fontWeight: '400',
  },
  feedbackForm: {
    alignItems: 'center',
    gap: 24,
    width: '100%',
  },
  feedbackRatingBlock: {
    alignItems: 'center',
    gap: 12,
    width: 160,
  },
  feedbackRatingTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  feedbackStars: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    height: 24,
    justifyContent: 'center',
    width: 160,
  },
  feedbackInput: {
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    color: '#111315',
    fontWeight: '400',
    // minHeight so the visible line count does not collapse as text scales.
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 8,
    // minHeight: the flex:1 buttons inherited this as a hard cap on their
    // labels, which cropped "Cancel"/"Send" at large font sizes.
    minHeight: 40,
    width: '100%',
  },
  feedbackCancelButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  feedbackCancelText: {
    color: '#111315',
    fontWeight: '500',
  },
  feedbackSendButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    flex: 1,
    justifyContent: 'center',
  },
  feedbackSendText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  biometricScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  biometricHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  biometricHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  biometricTitle: {
    color: '#111315',
    flexShrink: 1,
    fontWeight: '600',
  },
  biometricContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    width: '100%',
  },
  biometricRows: {
    gap: 8,
    width: '100%',
  },
  biometricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 51,
    paddingVertical: 10,
    width: '100%',
  },
  biometricRowLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  biometricRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  biometricRowTitle: {
    color: '#111315',
    fontWeight: '400',
  },
  biometricRowMeta: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
  },
  lockSheetBackdrop: {
    backgroundColor: 'rgba(243, 244, 246, 0.7)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  lockSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  lockSheetTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    width: '100%',
  },
  lockSheetTitle: {
    color: '#111315',
    fontWeight: '500',
  },
  lockOptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 36,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
  },
  lockOptionText: {
    color: '#111315',
    fontWeight: '400',
    flexShrink: 1,
    minWidth: 0,
  },
  lockSheetActions: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8,
    width: '100%',
    paddingHorizontal: 16
  },
  lockCancelButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    flex: 1,
    minHeight: 44,
    paddingVertical: 10
  },
  lockCancelText: {
    color: '#111315',
    fontWeight: '500',
  },
  lockSaveButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    justifyContent: 'center',
    flex: 1,
    minHeight: 44,
    paddingVertical: 10
  },
  lockSaveText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  accountScreen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  accountHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  accountHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  accountTitle: {
    color: '#111315',
    fontWeight: '600',
  },
  accountContent: {
    gap: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  accountProfileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 34,
    width: '100%',
  },
  accountAvatar: {
    alignItems: 'center',
    backgroundColor: '#F9F5FF',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  accountAvatarText: {
    color: '#7F56D9',
    fontWeight: '400',
    textAlign: 'center',
  },
  accountProfileCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    color: '#111315',
    fontWeight: '500',
  },
  accountMeta: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
  },
  accountRowsGroup: {
    gap: 8,
    width: '100%',
  },
  accountInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 51,
    paddingVertical: 10,
    width: '100%',
  },
  accountInfoRowLast: {
    borderBottomColor: 'rgba(26, 29, 33, 0.3)',
    borderBottomWidth: 1,
  },
  accountInfoLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  accountInfoCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountInfoTitle: {
    color: '#111315',
    fontWeight: '400',
  },
  accountInfoSubtitle: {
    color: 'rgba(26, 29, 33, 0.7)',
    fontWeight: '400',
  },
  accountToggle: {
    alignItems: 'center',
    backgroundColor: '#E4E7EB',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 2,
    width: 36,
  },
  accountToggleOn: {
    backgroundColor: '#FF8A00',
  },
  accountToggleKnob: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  accountToggleKnobOn: {
    alignSelf: 'flex-end',
  },
  accountActionsGroup: {
    gap: 8,
    width: '100%',
  },
  accountActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 37,
    paddingVertical: 10,
    width: '100%',
  },
  accountActionText: {
    color: '#111315',
    fontWeight: '400',
  },
  androidBottomBar: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    bottom: 0,
    elevation: 20,
    height: 64,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 50,
  },
  androidNavItems: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    height: 44,
    justifyContent: 'space-between',
    maxWidth: 328,
    width: '91%',
  },
  androidNavItem: {
    alignItems: 'center',
    borderRadius: 4,
    height: 44,
    justifyContent: 'center',
    width: 52,
  },
  androidNavItemActive: {
    backgroundColor: '#FFFFFF',
  },
  androidNavText: {
    color: '#111315',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
    textAlign: 'center',
    width: 52,
  },
  androidNavTextActive: {
    color: '#FF8A00',
  },
  bottomWrap: {
    alignItems: 'center',
    bottom: 20,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
  },
  navWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 12,
    gap: 8
  },
  navPillShrunk: {
    alignSelf: 'auto',
    width: undefined,
    flexShrink: 1,
    gap: 2,
    paddingHorizontal: 4,
    flex: 1
  },
  navAddFab: {
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    flexShrink: 0
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    overflow: 'visible',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4
  },
  navTab: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    flex: 1,
    minWidth: 0
  },
  // White circle centered on the pill's top edge → cuts a notch into the grey
  // pill and leaves a white gap around the orange button (the "puzzle" slot).
  navHalo: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -26 }],
    width: 44,
    height: 52,
    borderRadius: 26
  },
  navRaised: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FF8A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  passwordOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  passwordBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  passwordCard: {
    width: '86%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  passwordTitle: { fontWeight: '700', color: '#111315' },
  passwordSubtitle: { color: 'rgba(17,19,21,0.6)', fontFamily: 'MonaSans-Regular' },
  passwordPromptInput: {
    // minHeight: the typed characters scale with the OS font size and were
    // being cropped by a fixed 46dp field.
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.2)',
    paddingHorizontal: 14,
    color: '#111315',
    fontFamily: 'MonaSans-Regular',
  },
  passwordError: { color: '#D92D20', fontFamily: 'MonaSans-Regular' },
  // flexWrap + shrink: the card is clipped (overflow hidden), so without these
  // the buttons overflow to the LEFT and Cancel is drawn outside the dialog.
  passwordActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 10, rowGap: 8, marginTop: 4 },
  passwordCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, flexShrink: 1 },
  passwordCancelText: { fontWeight: '500', color: 'rgba(17,19,21,0.6)' },
  passwordConnect: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FF8A00',
    flexShrink: 1,
  },
  passwordConnectText: { fontWeight: '600', color: '#fff' },
  connectToast: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: 'rgba(17,19,21,0.9)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    zIndex: 90,
    maxWidth: '92%'
  },
  connectToastText: { color: '#fff', fontWeight: '500' },
  connectToastError: { color: '#FFB347', fontWeight: '500' },
}));

function useAppStyles() {
  const r = useResponsive();
  const content = { width: '100%' as const, maxWidth: 720, alignSelf: 'center' as const, paddingHorizontal: r.gutter };
  const navContent = { ...content, paddingBottom: r.navClearance };
  return {
    ...baseStyles,
    // Typed as keys of baseStyles so a renamed/typo'd style is a compile error
    // instead of being silently dropped by a `key in baseStyles` filter.
    ...Object.fromEntries((['devicesContent','managedContent','chatListContent','appsContent'] as (keyof typeof baseStyles)[]).map(key => [key, { ...(baseStyles as any)[key], ...navContent }])),
    // Monitoring lays its own horizontal padding out per-section, so it only
    // takes the large-screen width cap, not the gutter.
    monitorContent: { ...baseStyles.monitorContent, maxWidth: 720, alignSelf: 'center' as const },
    // Math.max keeps the shipped 140dp on a phone at font scale 1 and grows it
    // when a taller nav pill / bottom inset needs more clearance.
    monitorList: { ...baseStyles.monitorList, paddingBottom: Math.max(140, r.navClearance) },
    // Never taller than the design's 171dp, but shrinks on short viewports.
    noDeviceImage: { ...baseStyles.noDeviceImage, height: Math.min(171, r.illustrationHeight) },
    loginGateContent: { ...baseStyles.loginGateContent, ...navContent, paddingTop: r.compact ? 16 : 32 },
    loginGateImage: { ...baseStyles.loginGateImage, height: r.illustrationHeight, width: Math.min(200, r.contentWidth) },
    launchContent: { ...baseStyles.launchContent, ...content, paddingTop: r.insets.top + 16, paddingBottom: 24 },
    launchImage: { ...baseStyles.launchImage, height: r.illustrationHeight },
    brandBlock: { ...baseStyles.brandBlock, width: r.splashWidth },
    passwordOverlay: { ...baseStyles.passwordOverlay, paddingTop: r.insets.top + 12, paddingBottom: r.insets.bottom + 12 },
    connectToast: { ...baseStyles.connectToast, top: r.insets.top + 12 },
  };
}
