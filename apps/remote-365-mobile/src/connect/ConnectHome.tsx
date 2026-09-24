import React, { useRef, useState } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FadeInView } from '../components/FadeInView';
import { useTranslation } from '../lib/i18n';
import { fitPopover } from '../lib/responsive';
import { useResponsive } from '../lib/useResponsive';

const heroImage = require('../../assets/recent.png');

export type ConnectDevice = {
  id: string;
  name: string;
  isOnline: boolean;
};

const MENU_WIDTH = 132;
const BORDER = 'rgba(26, 29, 33, 0.3)';
const FONT_REGULAR = 'MonaSans-Regular';
const FONT_MEDIUM = 'MonaSans-Medium';

/* tabler:arrows-sort rotated 90deg (per Figma) */
function SortArrowsIcon({ size = 20, color = '#111315' }: { size?: number; color?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: [{ rotate: '90deg' }] }}
    >
      <Path d="M3 9l4-4 4 4M7 5v14" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 15l-4 4-4-4M17 19V5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* weui:arrow-filled */
function FilledChevron({ color = '#111315', rotated = false }: { color?: string; rotated?: boolean }) {
  return (
    <Svg
      width={9}
      height={18}
      viewBox="0 0 12 24"
      fill="none"
      style={rotated ? { transform: [{ rotate: '90deg' }] } : undefined}
    >
      <Path d="M2.6 3.2L11 12l-8.4 8.8L1 19.2 7.9 12 1 4.8z" fill={color} />
    </Svg>
  );
}

/* Same two-arrow glyph used across the app for "Control" */
function ControlArrowsIcon({ size = 15, color = '#111315' }: { size?: number; color?: string }) {
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

export function ConnectHome<T extends ConnectDevice>({
  devices,
  loading,
  onSearchConnect,
  onControl,
  recentDeviceIds,
}: {
  devices: T[];
  loading: boolean;
  onSearchConnect: () => void;
  onControl: (device: T) => void;
  /** Device ids of the latest actual connections, most recent first. */
  recentDeviceIds?: string[];
}) {
  const { control, type, maxFontSizeMultiplier, safeHeight, navClearance } = useResponsive();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState<
    | {
        device: T;
        top: number;
        left: number;
        /** Anchor geometry, kept so the menu can be re-placed once its real size is known. */
        anchorTop: number;
        anchorBottom: number;
        anchorRight: number;
      }
    | null
  >(null);
  const [rootSize, setRootSize] = useState({ width: 0, height: 0 });
  const rootRef = useRef<View>(null);
  const rowRefs = useRef<Record<string, View | null>>({});

  // Show truly recent connections first; fall back to the device list until
  // the user has connected somewhere.
  const byRecency = (recentDeviceIds || [])
    .map((id) => devices.find((device) => device.id === id))
    .filter((device): device is T => Boolean(device));
  const recentDevices = [
    ...byRecency,
    ...devices.filter((device) => !byRecency.some((recent) => recent.id === device.id)),
  ].slice(0, 3);

  const openMenu = (device: T) => {
    const rowNode = rowRefs.current[device.id];
    const rootNode = rootRef.current;
    if (!rowNode || !rootNode) return;
    rowNode.measureInWindow((x, y, rowWidth, rowHeight) => {
      rootNode.measureInWindow((rootX, rootY) => {
        const anchorTop = y - rootY;
        const anchorBottom = anchorTop + rowHeight;
        const anchorRight = x - rootX + rowWidth;
        setMenu({
          device,
          top: anchorBottom + 8,
          left: anchorRight - MENU_WIDTH,
          anchorTop,
          anchorBottom,
          anchorRight,
        });
      });
    });
  };

  /**
   * The popover can be wider/taller than MENU_WIDTH once the label grows with the OS font
   * setting, so re-place it from its measured size: keep it right-aligned to the row, flip it
   * above the row when it would run off the bottom, and clamp it inside the screen — above the
   * floating bottom nav, which is an absolutely positioned sibling that paints over this subtree.
   */
  const placeMenu = (menuWidth: number, menuHeight: number) => {
    setMenu((current) => {
      if (!current) return current;
      const boundsWidth = rootSize.width || menuWidth + 16;
      const rootHeight = rootSize.height || current.anchorBottom + 8 + menuHeight + 8;
      // Keep the popover out of the strip the nav pill covers, unless that leaves no room at all.
      const clear = rootHeight - navClearance;
      const boundsHeight = clear >= menuHeight + 16 ? clear : rootHeight;
      const below = current.anchorBottom + 8;
      const desiredTop =
        below + menuHeight + 8 > boundsHeight ? current.anchorTop - menuHeight - 8 : below;
      const next = fitPopover(
        current.anchorRight - menuWidth,
        desiredTop,
        menuWidth,
        menuHeight,
        boundsWidth,
        boundsHeight,
      );
      if (Math.abs(next.top - current.top) < 0.5 && Math.abs(next.left - current.left) < 0.5) {
        return current;
      }
      return { ...current, top: next.top, left: next.left };
    });
  };

  return (
    <View
      ref={rootRef}
      style={styles.root}
      collapsable={false}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setRootSize((current) =>
          current.width === width && current.height === height ? current : { width, height },
        );
      }}
    >
      <FadeInView style={styles.fill}>
        {/* Scrollable: with Recent connections expanded the stack is taller
            than a short phone, and the hero image was collapsing to make room. */}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(140, navClearance) }]} showsVerticalScrollIndicator={false}>
          <Text
            style={[styles.connectLabel, type(14)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
          >
            {t('Connect to provide support')}
          </Text>

          <View style={styles.stack}>
            <View
              style={[styles.heroFrame, { maxHeight: Math.max(120, Math.round(safeHeight * 0.3)) }]}
            >
              <Image source={heroImage} resizeMode="contain" style={styles.heroImage} />
            </View>

            <Pressable style={[styles.outlineButton, control(40)]} onPress={onSearchConnect}>
              <Text
                style={[styles.outlineButtonText, type(14)]}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                numberOfLines={1}
              >
                {t('Search and connect')}
              </Text>
              <SortArrowsIcon size={20} color="#111315" />
            </Pressable>

            <View style={styles.recentCard}>
              <Pressable
                style={[styles.recentHeader, control(38)]}
                onPress={() => {
                  setMenu(null);
                  setExpanded((value) => !value);
                }}
              >
                <View style={styles.buttonLeft}>
                  <MaterialCommunityIcons name="history" size={16} color="#111315" />
                  <Text
                    style={[styles.outlineButtonText, type(14)]}
                    maxFontSizeMultiplier={maxFontSizeMultiplier}
                    numberOfLines={1}
                  >
                    {t('Recent connections')}
                  </Text>
                </View>
                <FilledChevron color="#111315" rotated={expanded} />
              </Pressable>

              {expanded ? (
                <View style={styles.recentBody}>
                  <View style={styles.cardDivider} />
                  {loading ? (
                    <Text
                      style={[styles.recentEmptyText, type(12)]}
                      maxFontSizeMultiplier={maxFontSizeMultiplier}
                    >
                      {t('Loading recent connections...')}
                    </Text>
                  ) : recentDevices.length > 0 ? (
                    recentDevices.map((device) => (
                      <View
                        key={device.id}
                        collapsable={false}
                        ref={(node) => {
                          rowRefs.current[device.id] = node;
                        }}
                        style={styles.recentRow}
                      >
                        <View style={styles.recentIdentity}>
                          <View
                            style={[
                              styles.recentAvatar,
                              {
                                backgroundColor: device.isOnline
                                  ? 'rgba(20, 174, 92, 0.3)'
                                  : 'rgba(255, 179, 71, 0.3)',
                              },
                            ]}
                          >
                            <Feather
                              name="monitor"
                              size={14}
                              color={device.isOnline ? '#013218' : '#FF8A00'}
                            />
                          </View>
                          <View style={styles.recentCopy}>
                            <Text
                              style={[styles.recentName, type(12)]}
                              maxFontSizeMultiplier={maxFontSizeMultiplier}
                              numberOfLines={1}
                            >
                              {device.name}
                            </Text>
                            <Text
                              style={[styles.recentStatus, type(10)]}
                              maxFontSizeMultiplier={maxFontSizeMultiplier}
                            >
                              {device.isOnline ? t('Online') : t('Offline')}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.recentActions}>
                          <Feather name="shuffle" size={16} color="#FF8A00" />
                          <Pressable
                            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                            onPress={() => openMenu(device)}
                          >
                            <Feather name="more-vertical" size={16} color="#111315" />
                          </Pressable>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text
                      style={[styles.recentEmptyText, type(12)]}
                      maxFontSizeMultiplier={maxFontSizeMultiplier}
                    >
                      {t('No recent connections yet.')}
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </FadeInView>

      {menu ? (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenu(null)} />
          <View
            style={[styles.actionsMenu, { top: menu.top, left: menu.left }]}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              placeMenu(width, height);
            }}
          >
            <Pressable
              style={[styles.actionMenuRow, styles.actionMenuTop, control(37)]}
              onPress={() => {
                const device = menu.device;
                setMenu(null);
                onControl(device);
              }}
            >
              <ControlArrowsIcon size={15} color="#111315" />
              <Text
                style={[styles.actionMenuText, type(13)]}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                numberOfLines={1}
              >
                {t('Control')}
              </Text>
            </Pressable>
            <Pressable style={[styles.actionMenuRow, styles.actionMenuBottom, control(37)]}>
              <Feather name="upload" size={15} color="#111315" />
              <Text
                style={[styles.actionMenuText, type(13)]}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                numberOfLines={1}
              >
                {t('File Share')}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  fill: { flex: 1, width: '100%' },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: 28,
    paddingBottom: 140,
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  stack: {
    gap: 16,
    maxWidth: 420,
    width: '100%',
  },
  heroFrame: {
    // Explicit height, NOT aspectRatio + maxHeight: on phone widths the
    // aspect height always exceeded the 240 clamp anyway, and the aspectRatio
    // measure path can blow up release-build layout (see ChatEmpty).
    borderRadius: 4,
    flexShrink: 1,
    height: 240,
    overflow: 'hidden',
    width: '100%',
  },
  connectLabel: {
    color: '#000000',
    fontFamily: FONT_MEDIUM,
    textAlign: 'center',
    width: '100%',
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: BORDER,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
  },
  outlineButtonText: {
    color: '#111315',
    flexShrink: 1,
    fontFamily: FONT_MEDIUM,
    minWidth: 0,
  },
  buttonLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    minWidth: 0,
  },
  recentCard: {
    borderColor: BORDER,
    borderRadius: 4,
    borderWidth: 1,
    width: '100%',
  },
  recentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recentBody: {
    gap: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  cardDivider: {
    backgroundColor: BORDER,
    height: 1,
  },
  recentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  recentIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    paddingRight: 12,
  },
  recentAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  recentCopy: {
    flexShrink: 1,
  },
  recentName: {
    color: '#111315',
    fontFamily: FONT_MEDIUM,
  },
  recentStatus: {
    color: 'rgba(26, 29, 33, 0.55)',
    fontFamily: FONT_REGULAR,
  },
  recentActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  recentEmptyText: {
    color: 'rgba(26, 29, 33, 0.55)',
    fontFamily: FONT_REGULAR,
    paddingVertical: 2,
  },
  menuBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 90,
  },
  actionsMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    elevation: 8,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    minWidth: MENU_WIDTH,
    maxWidth: 240,
    zIndex: 100,
  },
  actionMenuRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionMenuTop: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  actionMenuBottom: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopColor: 'rgba(26, 29, 33, 0.12)',
    borderTopWidth: 1,
  },
  actionMenuText: {
    color: '#111315',
    flexShrink: 1,
    fontFamily: FONT_MEDIUM,
    minWidth: 0,
  },
});
