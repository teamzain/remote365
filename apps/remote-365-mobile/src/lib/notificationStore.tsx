import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Notification centre store for the mobile app.
 *
 * React context + useReducer-free useState (same shape as lib/i18n.tsx's
 * LanguageProvider) rather than zustand — the app has no zustand dependency and
 * this is not worth adding one for.
 *
 * What lives here: a capped, newest-first, AsyncStorage-backed log of things
 * that happened to the signed-in user (invites, contact requests, messages,
 * account changes). What does NOT live here: any UI, any navigation, and any
 * translation — callers pass strings that are ALREADY through t(), because the
 * list is persisted and re-read in whatever language the user is running now.
 *
 * Durability caveat, stated once: there is no /api/notifications endpoint, so
 * this is a device-local log of events the app was running to see. It cannot
 * back-fill anything that arrived while the app was killed, and read state does
 * not sync to web/desktop. A server-side Notification table is the fix; until
 * then the list degrades to "what this install witnessed".
 */

export type NotificationKind =
  /** Chat message in a conversation you are not looking at. */
  | 'message'
  /** You were invited to a video meeting. */
  | 'meeting-invite'
  /** You were invited to a remote-control session. */
  | 'session-invite'
  /** Someone joined a session you created. */
  | 'session-joined'
  /** Someone wants to add you as a contact. */
  | 'contact-request'
  /** A contact request you sent was accepted. */
  | 'contact-accepted'
  /** A contact request you sent was declined. */
  | 'contact-declined'
  /** You were added to a group conversation. */
  | 'group-added'
  /** Someone asked for (or answered a request for) remote access. */
  | 'remote-access'
  /** A meeting / remote session started or ended. */
  | 'session-status'
  /** A device came online or went offline (rolled up by the caller). */
  | 'host'
  /** Plan, permissions, sign-out and other account-level changes. */
  | 'account'
  /** Anything else. */
  | 'system';

/**
 * Where tapping an entry should go. Deliberately a tagged union of the shell's
 * own destinations, so the shell can `switch (target.screen)` exhaustively —
 * the store itself never navigates.
 */
export type NotificationTarget =
  | { screen: 'chat'; conversationId?: string }
  | { screen: 'chat-thread'; conversationId: string }
  | { screen: 'meeting'; code?: string; meetingId?: string }
  | { screen: 'connect'; sessionCode?: string }
  | { screen: 'devices'; accessKey?: string }
  | { screen: 'settings' };

export interface Notification {
  /** Stable, caller-supplied where possible (see makeNotificationId) so a socket event and its push cannot both land. */
  id: string;
  kind: NotificationKind;
  /** One line, already translated. */
  title: string;
  /** Optional second line (message preview, "Invited by Sam"), already translated. */
  body?: string;
  createdAt: number;
  read: boolean;
  /** Entries past this instant are dropped from the list (an invite that can no longer be joined). */
  expiresAt?: number;
  target?: NotificationTarget;
}

/** What callers hand to add(): id/createdAt/read are filled in when omitted. */
export type NotificationInput = Omit<Notification, 'id' | 'createdAt' | 'read'> & {
  id?: string;
  createdAt?: number;
  read?: boolean;
};

export interface NotificationStore {
  /** Newest first, expired entries already removed. */
  items: Notification[];
  unreadCount: number;
  /** Insert (or refresh, if the id already exists). Returns the entry's id. */
  add: (input: NotificationInput) => string;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  /** False until AsyncStorage has been read — let the screen hold its empty state until then. */
  hydrated: boolean;
}

/**
 * Feather (@expo/vector-icons) glyph for a kind. Exported as a NAME, never as a
 * component, so a persisted entry can be re-rendered from its kind alone.
 */
const ICON_NAMES: Record<NotificationKind, string> = {
  'message': 'message-circle',
  'meeting-invite': 'video',
  'session-invite': 'monitor',
  'session-joined': 'user-check',
  'contact-request': 'user-plus',
  'contact-accepted': 'user-check',
  'contact-declined': 'user-x',
  'group-added': 'users',
  'remote-access': 'shield',
  'session-status': 'radio',
  'host': 'hard-drive',
  'account': 'alert-circle',
  'system': 'activity',
};

export function notificationIconName(kind: NotificationKind): string {
  return ICON_NAMES[kind] ?? ICON_NAMES.system;
}

/**
 * Deterministic ids for the events that can arrive twice (once over the socket,
 * once as a push, once again after a reconnect replays it).
 */
export const makeNotificationId = {
  message: (messageId: string) => `msg:${messageId}`,
  invite: (remoteSessionId: string) => `invite:${remoteSessionId}`,
  sessionCode: (code: string) => `invite-code:${String(code).replace(/\D/g, '')}`,
  conversation: (conversationId: string, reason: string) => `conv:${conversationId}:${reason}`,
  joined: (sessionCode: string, joiner: string) => `joined:${sessionCode}:${joiner}`,
};

const STORAGE_KEY_BASE = 'remote365.notifications.v1';
const MAX_ENTRIES = 100;
const PERSIST_DEBOUNCE_MS = 400;
/** Identical consecutive lines inside this window refresh the newest entry instead of stacking. */
const COLLAPSE_WINDOW_MS = 60000;

const storageKeyFor = (scope?: string | null) => (scope ? `${STORAGE_KEY_BASE}:${scope}` : STORAGE_KEY_BASE);

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isLive = (item: Notification, now: number) => !item.expiresAt || item.expiresAt > now;

/** Newest first, one entry per id (the first occurrence wins), capped, expired dropped. */
function normalize(list: Notification[], now: number): Notification[] {
  const seen = new Set<string>();
  const out: Notification[] = [];
  for (const item of list) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) continue;
    if (!isLive(item, now)) continue;
    seen.add(item.id);
    out.push(item);
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out.length > MAX_ENTRIES ? out.slice(0, MAX_ENTRIES) : out;
}

/** Defensive parse: anything stored by an older/newer build that does not fit the shape is skipped, not thrown on. */
function parseStored(raw: string | null): Notification[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Notification[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const id = typeof entry.id === 'string' ? entry.id : '';
      const title = typeof entry.title === 'string' ? entry.title : '';
      const createdAt = typeof entry.createdAt === 'number' ? entry.createdAt : 0;
      if (!id || !title || !createdAt) continue;
      const kind: NotificationKind = (typeof entry.kind === 'string' && entry.kind in ICON_NAMES)
        ? entry.kind as NotificationKind
        : 'system';
      out.push({
        id,
        kind,
        title,
        body: typeof entry.body === 'string' ? entry.body : undefined,
        createdAt,
        read: entry.read === true,
        expiresAt: typeof entry.expiresAt === 'number' ? entry.expiresAt : undefined,
        target: entry.target && typeof entry.target === 'object' && typeof entry.target.screen === 'string'
          ? entry.target as NotificationTarget
          : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

const noop = () => {};

const NotificationContext = createContext<NotificationStore>({
  items: [],
  unreadCount: 0,
  add: () => '',
  markRead: noop,
  markAllRead: noop,
  remove: noop,
  clearAll: noop,
  hydrated: false,
});

/**
 * Events raised from outside the React tree (socket handlers, push receivers)
 * before the provider has mounted are buffered here and flushed on mount, so a
 * notification that arrives during cold start is not silently dropped.
 */
let liveAdd: ((input: NotificationInput) => string) | null = null;
const pending: NotificationInput[] = [];

/** Non-React entry point, the twin of web's notifyCentre(). Strings must already be translated. */
export function notify(input: NotificationInput): string {
  if (liveAdd) return liveAdd(input);
  const id = input.id || randomId();
  if (pending.length < MAX_ENTRIES) pending.push({ ...input, id });
  return id;
}

export function NotificationProvider({
  children,
  scope,
}: {
  children: React.ReactNode;
  /** Optional per-account suffix on the storage key, so a re-login cannot inherit the previous account's list. */
  scope?: string | null;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = storageKeyFor(scope);

  // Guards the persist effect: writing before (or during) hydration would save
  // an empty list over the stored one.
  const hydratedKeyRef = useRef<string | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const add = useCallback((input: NotificationInput): string => {
    const now = Date.now();
    const id = input.id || randomId();
    setItems((current) => {
      const existing = current.find((item) => item.id === id);
      const entry: Notification = {
        id,
        kind: input.kind,
        title: input.title,
        body: input.body,
        // A replayed event keeps the time it actually happened, not the time it
        // was replayed — otherwise a reconnect shuffles the whole list.
        createdAt: existing ? existing.createdAt : (input.createdAt ?? now),
        // ...and stays read if the user already read it.
        read: existing ? existing.read : (input.read === true),
        expiresAt: input.expiresAt,
        target: input.target,
      };
      const rest = existing ? current.filter((item) => item.id !== id) : current;
      // Same line twice within a minute (two sources, different ids) just
      // refreshes the newest entry rather than stacking a duplicate.
      if (!existing && !input.id) {
        const newest = rest[0];
        if (newest
          && newest.kind === entry.kind
          && newest.title === entry.title
          && (newest.body ?? '') === (entry.body ?? '')
          && now - newest.createdAt < COLLAPSE_WINDOW_MS) {
          return normalize([{ ...newest, createdAt: now, read: false }, ...rest.slice(1)], now);
        }
      }
      return normalize([entry, ...rest], now);
    });
    return id;
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        if (item.id !== id || item.read) return item;
        changed = true;
        return { ...item, read: true };
      });
      return changed ? next : current;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((current) => (
      current.some((item) => !item.read) ? current.map((item) => (item.read ? item : { ...item, read: true })) : current
    ));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => (current.some((item) => item.id === id) ? current.filter((item) => item.id !== id) : current));
  }, []);

  const clearAll = useCallback(() => {
    setItems((current) => (current.length ? [] : current));
  }, []);

  // Hydrate. Anything added while the read was in flight is merged and WINS by
  // id, so a notification arriving during cold start survives.
  useEffect(() => {
    let cancelled = false;
    if (hydratedKeyRef.current !== storageKey) {
      setHydrated(false);
      // Switched account: drop the previous account's entries before reading the
      // new key, or the merge below would carry them into the new list.
      if (hydratedKeyRef.current !== null) setItems([]);
      hydratedKeyRef.current = null;
    }
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled) return;
        const stored = parseStored(raw);
        setItems((current) => normalize([...current, ...stored], Date.now()));
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        hydratedKeyRef.current = storageKey;
        setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [storageKey]);

  // Persist, debounced. Never runs before this key finished hydrating.
  useEffect(() => {
    if (hydratedKeyRef.current !== storageKey) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      const payload = JSON.stringify(items);
      AsyncStorage.setItem(storageKey, payload).catch(() => {});
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [items, storageKey, hydrated]);

  // Publish add() to the non-React entry point and drain anything buffered
  // before mount.
  useEffect(() => {
    liveAdd = add;
    if (pending.length) {
      const queued = pending.splice(0, pending.length);
      for (const input of queued) add(input);
    }
    return () => {
      if (liveAdd === add) liveAdd = null;
    };
  }, [add]);

  const value = useMemo<NotificationStore>(() => {
    const now = Date.now();
    // Recomputed on every change, which is also when expired invites drop off.
    const live = items.filter((item) => isLive(item, now));
    return {
      items: live,
      unreadCount: live.reduce((count, item) => (item.read ? count : count + 1), 0),
      add,
      markRead,
      markAllRead,
      remove,
      clearAll,
      hydrated,
    };
  }, [items, add, markRead, markAllRead, remove, clearAll, hydrated]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationStore {
  return useContext(NotificationContext);
}
