import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { chatFetch } from '../chat/chatApi';

// Optional native modules: a dev build that predates them won't have the native
// side, and a static import would crash at load. Load them defensively — push
// simply stays off until the app is rebuilt with these modules compiled in.
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Device = require('expo-device');
} catch {
  Device = null;
}

export const pushAvailable = !!Notifications;

/** Foreground behaviour + Android channel. Safe to call once at startup. */
export function setupNotifications() {
  if (!Notifications) return;
  // We already show an in-app toast in the foreground, so keep OS alerts quiet
  // while the app is open (push only really fires when the app is backgrounded).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF8A00',
    }).catch(() => {});
    // Session/meeting invites are time-sensitive and get their own channel, so the
    // user can silence chatter without silencing an invite. The server tags these
    // pushes with channelId 'invites'; without this channel Android would drop them
    // onto the default one.
    Notifications.setNotificationChannelAsync('invites', {
      name: 'Invitations',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF8A00',
    }).catch(() => {});
  }
}

/** Ask for permission, get the Expo push token, and register it with the backend. */
export async function registerPushToken(apiBaseUrl: string, authToken: string | null) {
  if (!Notifications || !Device || !authToken) return;
  try {
    if (!Device.isDevice) return; // push doesn't work on simulators/emulators
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoToken = tokenResponse?.data;
    if (!expoToken) return;
    await chatFetch(apiBaseUrl, '/api/chat/push-token', {
      method: 'POST',
      body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
    }, authToken);
  } catch {
    /* non-fatal: push just won't be active */
  }
}

/**
 * Subscribe to notification taps; returns an unsubscribe function.
 *
 * `onOpenInvite` exists because the payload is no longer chat-only: the server now
 * tags invite pushes with `kind` and `sessionCode`, and routing those to a chat
 * thread (the old behaviour, which only ever read conversationId) would land the
 * user nowhere.
 */
export function addNotificationTapListener(
  onOpenConversation: (conversationId: string) => void,
  onOpenInvite?: (data: { kind: string; sessionCode?: string }) => void,
) {
  if (!Notifications) return () => {};
  const route = (data: any) => {
    if (!data) return;
    const kind = data.kind ? String(data.kind) : '';
    if (kind && kind !== 'message' && onOpenInvite) {
      onOpenInvite({ kind, sessionCode: data.sessionCode ? String(data.sessionCode) : undefined });
      return;
    }
    if (data.conversationId) onOpenConversation(String(data.conversationId));
  };
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    route(response?.notification?.request?.content?.data);
  });
  // A tap that COLD-STARTS the app is not delivered to the listener above — it is only
  // available from this one-shot, so without it a push into a closed app opened the
  // home screen and lost the destination.
  Notifications.getLastNotificationResponseAsync?.()
    .then((response: any) => route(response?.notification?.request?.content?.data))
    .catch(() => {});
  return () => sub.remove();
}
