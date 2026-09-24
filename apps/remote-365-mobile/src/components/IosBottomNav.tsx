import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';

/**
 * iOS-only bottom navigation: a floating white rounded bar where every tab
 * shows its icon above a label, and the active tab sits on a soft grey pill.
 * Screens can float a round action button next to the bar (e.g. the Devices
 * page "+"). Android keeps the original grey pill + raised orange circle
 * (see BottomNav in App.tsx).
 */
export function IosBottomNav<K extends string>({
  tabs,
  activeTab,
  onTabPress,
  renderIcon,
  action,
}: {
  tabs: ReadonlyArray<{ key: K; label: string }>;
  activeTab: K;
  onTabPress: (tab: K) => void;
  renderIcon: (tabKey: K, color: string, size: number) => React.ReactNode;
  action?: { onPress: () => void; icon?: React.ReactNode };
}) {
  const { insets, cappedFontScale, textSize, maxFontSizeMultiplier } = useResponsive();
  // Icons must grow with the label they caption, or the pair inverts at large
  // text sizes. Never shrinks below the design size (1.0 => 22, unchanged).
  const iconSize = Math.round(22 * Math.max(1, cappedFontScale));

  return (
    <View style={[styles.wrap, { bottom: 10 + insets.bottom }]} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        <View style={styles.bar}>
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tab, active && styles.tabActive]}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                onPress={() => onTabPress(tab.key)}
              >
                {renderIcon(tab.key, '#111315', iconSize)}
                <Text
                  style={[styles.label, textSize(11), active && styles.labelActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {action ? (
          <Pressable style={styles.fab} onPress={action.onPress}>
            {action.icon ?? <Feather name="plus" size={26} color="#FFFFFF" />}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create(
  monaFontStyles({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 50,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      width: '92%',
      maxWidth: 400,
      gap: 10,
    },
    bar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 32,
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 8,
      paddingVertical: 8,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#FF8A00',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      paddingVertical: 8,
      gap: 3,
    },
    tabActive: {
      backgroundColor: '#F2F3F5',
    },
    label: {
      fontWeight: '500',
      color: '#111315',
    },
    labelActive: {
      fontWeight: '600',
    },
  }),
);
