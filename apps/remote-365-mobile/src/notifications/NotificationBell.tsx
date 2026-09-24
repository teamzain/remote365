import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

/**
 * Header bell button with an unread-count badge.
 *
 * Sits next to the existing `settings` icon in every page header, so the glyph
 * is drawn in the same 28dp box as `styles.iconButton` in App.tsx, with the same
 * hitSlop={10}.
 *
 * Two things this deliberately avoids, both of which have bitten this codebase:
 *  - The badge is NOT a fixed-size circle. A fixed width/height around text that
 *    grows with the OS font scale clips the digits ("12" becoming "1"), so it is
 *    sized with minWidth + padding and a pill radius and simply grows.
 *  - The badge sits INSIDE the button's own box (overlapping the bell's corner)
 *    rather than hanging off it with negative offsets. Android clips children
 *    that overflow their parent, and a half-eaten badge is worse than none.
 *    Note Yoga insets an absolutely-positioned child by the parent's PADDING
 *    box, which is why this button carries no padding — top:0/right:0 then means
 *    the real corner.
 */
export function NotificationBell({
  color = '#111315',
  count,
  onPress,
  size = 20,
}: {
  color?: string;
  count: number;
  onPress: () => void;
  size?: number;
}) {
  const { textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  const unread = Math.max(0, Math.floor(count || 0));
  const label = unread > 99 ? '99+' : String(unread);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${t('Notifications')} (${label})` : t('Notifications')}
      hitSlop={10}
      onPress={onPress}
      style={styles.button}
    >
      <View style={styles.iconBox}>
        <Feather name="bell" size={size} color={color} />
      </View>
      {unread > 0 ? (
        <View style={styles.badge} pointerEvents="none">
          <Text
            style={[styles.badgeText, textSize(9)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    // Two dp of slack around the 28dp icon box so the badge has a corner to sit
    // in. NO padding — see the note above about Yoga's absolute-position box.
    minHeight: 30,
    minWidth: 30,
  },
  iconBox: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#E5484D',
    // Pill, not circle: minWidth + padding means the box grows with the digits
    // and with the OS font scale instead of cropping them.
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
}));
