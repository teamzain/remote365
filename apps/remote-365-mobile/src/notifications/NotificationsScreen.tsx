import React, { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsPage } from '../settings/SettingsScaffold';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

/**
 * One entry in the notification centre.
 *
 * Deliberately tolerant about read-state and timestamps: the store may model
 * "read" either as a boolean (the web centre's shape) or as a `readAt` stamp
 * (the mobile store's shape), and timestamps may arrive as epoch ms or as an
 * ISO string straight off the wire. This screen normalises both rather than
 * forcing the store into one shape — it is presentational and takes everything
 * as props.
 */
export type NotificationItem = {
  id: string;
  /** e.g. 'meeting-invite' | 'chat-message' | 'contact-request' — see KIND_ICONS. */
  kind?: string | null;
  title: string;
  body?: string | null;
  actorName?: string | null;
  createdAt: number | string;
  /** Web-style read flag. */
  read?: boolean;
  /** Mobile-style read stamp. Either may be supplied; both are honoured. */
  readAt?: number | string | null;
  /** Invites go stale — an entry past this is shown dimmed and is not actionable. */
  expiresAt?: number | string | null;
  /** Presence of either marks the row as openable (chevron + "View"). */
  target?: unknown;
  deeplink?: unknown;
};

/**
 * Kind -> Feather glyph. Covers both the mobile record kinds and the web
 * centre's eight kinds, so the same screen can render either without the store
 * having to ship an icon component through props (icons must not be persisted).
 */
const KIND_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  // mobile record kinds
  'chat-message': 'message-circle',
  'meeting-invite': 'video',
  'meeting-invite-response': 'check-circle',
  'meeting-started': 'video',
  'meeting-status': 'video',
  'session-invite': 'user-plus',
  'session-joined': 'user-check',
  'session-status': 'activity',
  'contact-request': 'user-plus',
  'contact-accepted': 'user-check',
  'contact-declined': 'user-x',
  'group-added': 'users',
  'group-renamed': 'users',
  'remote-access-request': 'shield',
  'remote-access-response': 'shield',
  account: 'alert-triangle',
  'account-features': 'award',
  // web centre kinds
  host: 'radio',
  security: 'shield',
  session: 'user',
  system: 'activity',
  message: 'message-circle',
  accepted: 'user-check',
  removed: 'user-x',
  blocked: 'slash',
};

/** Kinds that read as "something needs you" rather than "here's what happened". */
const URGENT_KINDS = new Set([
  'meeting-invite',
  'session-invite',
  'contact-request',
  'remote-access-request',
  'account',
  'security',
]);

function toMillis(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isUnread(item: NotificationItem): boolean {
  if (item.read === true) return false;
  if (item.readAt) return false;
  return true;
}

function isExpired(item: NotificationItem, now: number): boolean {
  const expires = toMillis(item.expiresAt);
  return expires > 0 && expires <= now;
}

/** Local midnight for the day `offset` days back from `now`. */
function startOfDay(now: number, offset = 0): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function relativeTime(createdAt: number, now: number, t: (s: string) => string): string {
  const diff = Math.max(0, now - createdAt);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('Just now');
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const d = new Date(createdAt);
  return `${d.getDate()} ${t(MONTHS[d.getMonth()])}`;
}

type Group = { key: string; title: string; items: NotificationItem[] };

/**
 * The notification centre page.
 *
 * Pure presentation: it owns the all/unread filter and the confirm dialog and
 * nothing else. Data and every side effect come in as props so the screen does
 * not care whether the store is context-backed, AsyncStorage-backed or, later,
 * server-backed.
 */
export function NotificationsScreen({
  items,
  onBack,
  onClear,
  onMarkAllRead,
  onOpen,
}: {
  items: NotificationItem[];
  onBack: () => void;
  onClear?: () => void;
  onMarkAllRead?: () => void;
  onOpen?: (item: NotificationItem) => void;
}) {
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  const [unreadOnly, setUnreadOnly] = useState(false);

  // A single `now` per render: every relative time and expiry check on the page
  // then agrees with the others, and nothing re-reads the clock mid-list.
  const now = Date.now();
  const unreadCount = useMemo(() => items.filter(isUnread).length, [items]);

  const groups = useMemo<Group[]>(() => {
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(now, 1);
    const visible = (unreadOnly ? items.filter(isUnread) : items)
      .slice()
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    const buckets: Group[] = [
      { key: 'today', title: t('Today'), items: [] },
      { key: 'yesterday', title: t('Yesterday'), items: [] },
      { key: 'older', title: t('Earlier'), items: [] },
    ];
    for (const item of visible) {
      const at = toMillis(item.createdAt);
      if (at >= todayStart) buckets[0].items.push(item);
      else if (at >= yesterdayStart) buckets[1].items.push(item);
      else buckets[2].items.push(item);
    }
    return buckets.filter((group) => group.items.length > 0);
  }, [items, now, t, unreadOnly]);

  const confirmClear = () => {
    if (!onClear) return;
    Alert.alert(
      t('Clear all notifications?'),
      t('This removes every notification from this device. It cannot be undone.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Clear all'), style: 'destructive', onPress: onClear },
      ],
    );
  };

  const empty = groups.length === 0;

  return (
    <SettingsPage
      title={unreadCount > 0 ? `${t('Notifications')} (${unreadCount})` : t('Notifications')}
      onBack={onBack}
      contentStyle={empty ? styles.centeredContent : undefined}
    >
      {items.length > 0 ? (
        <View style={styles.toolbar}>
          <View style={styles.filterGroup}>
            <FilterChip label={t('All')} selected={!unreadOnly} onPress={() => setUnreadOnly(false)} />
            <FilterChip
              label={unreadCount > 0 ? `${t('Unread')} (${unreadCount})` : t('Unread')}
              selected={unreadOnly}
              onPress={() => setUnreadOnly(true)}
            />
          </View>
          <View style={styles.toolbarActions}>
            {onMarkAllRead && unreadCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Mark all read')}
                hitSlop={8}
                onPress={onMarkAllRead}
                style={styles.toolbarButton}
              >
                <Feather name="check-circle" size={14} color="#FF8A00" />
                <Text style={[styles.toolbarButtonText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {t('Mark all read')}
                </Text>
              </Pressable>
            ) : null}
            {onClear ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Clear all')}
                hitSlop={8}
                onPress={confirmClear}
                style={styles.toolbarButton}
              >
                <Feather name="trash-2" size={14} color="rgba(17,19,21,0.55)" />
                <Text style={[styles.toolbarButtonMuted, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {t('Clear all')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {empty ? (
        <View style={styles.empty}>
          <Feather name="bell" size={30} color="rgba(17,19,21,0.3)" />
          <Text style={[styles.emptyTitle, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {unreadOnly ? t("You're all caught up.") : t('Nothing here yet')}
          </Text>
          <Text style={[styles.emptyBody, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {unreadOnly
              ? t('Every notification has been read.')
              : t("We'll let you know when something needs your attention — meeting invites, contact requests and session activity land here.")}
          </Text>
          {unreadOnly ? (
            <Pressable hitSlop={8} onPress={() => setUnreadOnly(false)} style={styles.emptyAction}>
              <Text style={[styles.emptyActionText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {t('Show all')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={[styles.groupTitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {group.title}
            </Text>
            <View style={styles.groupList}>
              {group.items.map((item) => (
                <NotificationRow key={item.id} item={item} now={now} onOpen={onOpen} />
              ))}
            </View>
          </View>
        ))
      )}
    </SettingsPage>
  );
}

function FilterChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { textSize, maxFontSizeMultiplier } = useResponsive();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text
        style={[styles.chipText, selected && styles.chipTextSelected, textSize(12)]}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NotificationRow({
  item,
  now,
  onOpen,
}: {
  item: NotificationItem;
  now: number;
  onOpen?: (item: NotificationItem) => void;
}) {
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  const unread = isUnread(item);
  const expired = isExpired(item, now);
  const icon = KIND_ICONS[item.kind || ''] || 'bell';
  const urgent = URGENT_KINDS.has(item.kind || '');
  const openable = Boolean(onOpen) && !expired && (item.target != null || item.deeplink != null);
  const meta = [item.actorName || null, relativeTime(toMillis(item.createdAt), now, t)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityState={{ disabled: expired }}
      disabled={!onOpen}
      onPress={() => onOpen?.(item)}
      style={[styles.row, unread && styles.rowUnread, expired && styles.rowExpired]}
    >
      <View style={[styles.rowIcon, urgent && styles.rowIconUrgent]}>
        <Feather name={icon} size={16} color={urgent ? '#FF8A00' : 'rgba(17,19,21,0.6)'} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text
            style={[styles.rowTitle, unread && styles.rowTitleUnread, type(14, 20 / 14)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        {item.body ? (
          <Text
            style={[styles.rowText, type(13, 18 / 13)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            numberOfLines={2}
          >
            {item.body}
          </Text>
        ) : null}
        <View style={styles.rowMetaLine}>
          <Text style={[styles.rowMeta, textSize(11)]} maxFontSizeMultiplier={maxFontSizeMultiplier} numberOfLines={1}>
            {meta}
          </Text>
          {expired ? (
            <Text style={[styles.rowExpiredTag, textSize(11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Expired')}
            </Text>
          ) : null}
        </View>
      </View>

      {openable ? <Feather name="chevron-right" size={16} color="#858687" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    width: '100%',
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolbarButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    // minHeight, never height: the label has to be able to grow the box.
    minHeight: 28,
  },
  toolbarButtonText: {
    color: '#FF8A00',
    fontWeight: '500',
  },
  toolbarButtonMuted: {
    color: 'rgba(17,19,21,0.55)',
    fontWeight: '500',
  },
  chip: {
    backgroundColor: 'rgba(17,19,21,0.05)',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipSelected: {
    backgroundColor: 'rgba(255,138,0,0.14)',
  },
  chipText: {
    color: 'rgba(17,19,21,0.6)',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FF8A00',
  },
  group: {
    gap: 8,
    width: '100%',
  },
  groupTitle: {
    color: 'rgba(17,19,21,0.55)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  groupList: {
    gap: 8,
    width: '100%',
  },
  row: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(17,19,21,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    // minHeight + padding so a two-line title grows the card instead of cropping.
    minHeight: 48,
    padding: 12,
    width: '100%',
  },
  rowUnread: {
    backgroundColor: 'rgba(255,138,0,0.06)',
    borderColor: 'rgba(255,138,0,0.35)',
  },
  rowExpired: {
    opacity: 0.55,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,19,21,0.05)',
    borderRadius: 999,
    justifyContent: 'center',
    // A tile, not a text box — a fixed square is safe here because nothing
    // inside it scales with the font.
    height: 32,
    width: 32,
  },
  rowIconUrgent: {
    backgroundColor: 'rgba(255,138,0,0.14)',
  },
  rowBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowTitleLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  rowTitle: {
    color: '#111315',
    flex: 1,
    fontWeight: '400',
  },
  rowTitleUnread: {
    fontWeight: '600',
  },
  unreadDot: {
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  rowText: {
    color: 'rgba(17,19,21,0.65)',
  },
  rowMetaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rowMeta: {
    color: 'rgba(17,19,21,0.45)',
    flexShrink: 1,
  },
  rowExpiredTag: {
    color: '#E5484D',
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#111315',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    color: 'rgba(17,19,21,0.55)',
    textAlign: 'center',
  },
  emptyAction: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  emptyActionText: {
    color: '#FF8A00',
    fontWeight: '600',
  },
}));
