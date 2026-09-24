import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';
import { Activity, Ban, MessageCircle, Radio, ShieldCheck, User, UserCheck, UserX } from 'lucide-react';

// Web twin of the desktop notification centre: one list, titled entries with
// a destination, identical lines collapsing within a minute, and device
// online/offline changes rolled up into ONE refreshed summary instead of a
// line per event (ten devices flapping used to bury everything else).

export type NotificationKind = 'host' | 'security' | 'session' | 'system' | 'message' | 'accepted' | 'removed' | 'blocked';

export interface WebNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  action: string;
  createdAt: number;
  read: boolean;
  icon: LucideIcon;
  /** Where clicking the entry goes: { view, chatId?, meetingId?, sessionCode? } */
  target: Record<string, any> | null;
}

const ICONS: Record<NotificationKind, LucideIcon> = {
  host: Radio,
  security: ShieldCheck,
  session: User,
  system: Activity,
  message: MessageCircle,
  accepted: UserCheck,
  removed: UserX,
  blocked: Ban,
};

// Every entry opens the page it is about; callers may pass a more specific target.
const DEFAULT_TARGET: Record<NotificationKind, Record<string, any>> = {
  host: { view: 'devices' },
  system: { view: 'devices' },
  security: { view: 'settings' },
  session: { view: 'connect' },
  message: { view: 'chat' },
  accepted: { view: 'chat' },
  removed: { view: 'chat' },
  blocked: { view: 'chat' },
};

const MAX_ENTRIES = 30;
const DEVICE_STATUS_ROLLUP_ID = 'device-status-rollup';
const DEVICE_STATUS_WINDOW_MS = 45000;

interface NotificationState {
  notifications: WebNotification[];
  addNotification: (action: string, kind?: NotificationKind, title?: string, target?: Record<string, any> | null, options?: { id?: string }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  /** Presence change for a device; rolled up, see above. */
  queueDeviceStatusChange: (name: string, status: string) => void;
}

const statusRollup: { changes: Map<string, { name: string; first: string; last: string }>; timer: ReturnType<typeof setTimeout> | null } = { changes: new Map(), timer: null };

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  addNotification: (action, kind = 'system', title, target, options) => {
    const resolvedTitle = title || action;
    const entry: WebNotification = {
      id: options?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind,
      title: resolvedTitle,
      action: title ? action : '',
      createdAt: Date.now(),
      read: false,
      icon: ICONS[kind],
      target: target === undefined ? DEFAULT_TARGET[kind] : target,
    };
    set((state) => {
      // A fixed id (rolling entries) replaces its previous version.
      const prev = options?.id ? state.notifications.filter((item) => item.id !== options.id) : state.notifications;
      // Identical lines inside a minute just refresh the newest one.
      const last = prev[0];
      if (last && last.action === entry.action && last.title === entry.title && Date.now() - last.createdAt < 60000) {
        return { notifications: [{ ...last, createdAt: Date.now(), read: false }, ...prev.slice(1)] };
      }
      return { notifications: [entry, ...prev].slice(0, MAX_ENTRIES) };
    });
  },

  markRead: (id) => set((state) => ({ notifications: state.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)) })),
  markAllRead: () => set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })) })),
  dismiss: (id) => set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) })),
  clearAll: () => set({ notifications: [] }),

  queueDeviceStatusChange: (name, status) => {
    const key = String(name || '').trim() || 'Device';
    const normalized = status === 'online' ? 'online' : 'offline';
    const existing = statusRollup.changes.get(key);
    if (existing) existing.last = normalized;
    else statusRollup.changes.set(key, { name: key, first: normalized === 'online' ? 'offline' : 'online', last: normalized });
    if (statusRollup.timer) return;
    statusRollup.timer = setTimeout(() => {
      statusRollup.timer = null;
      const offline: string[] = [];
      const online: string[] = [];
      for (const change of statusRollup.changes.values()) {
        if (change.first === change.last) continue; // flapped back: nothing to say
        (change.last === 'online' ? online : offline).push(change.name);
      }
      statusRollup.changes.clear();
      if (!offline.length && !online.length) return;
      const names = (list: string[]) => (list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`);
      const parts: string[] = [];
      if (offline.length) parts.push(`Offline: ${names(offline)}`);
      if (online.length) parts.push(`Online: ${names(online)}`);
      const title = offline.length && !online.length
        ? (offline.length === 1 ? 'Device went offline' : `${offline.length} devices went offline`)
        : online.length && !offline.length
          ? (online.length === 1 ? 'Device came online' : `${online.length} devices came online`)
          : 'Device status changed';
      get().addNotification(parts.join(' · '), 'host', title, { view: 'devices' }, { id: DEVICE_STATUS_ROLLUP_ID });
    }, DEVICE_STATUS_WINDOW_MS);
  },
}));

/** Non-React entry point (stores, socket handlers). */
export const notifyCentre = (action: string, kind: NotificationKind = 'system', title?: string, target?: Record<string, any> | null) =>
  useNotificationStore.getState().addNotification(action, kind, title, target);
