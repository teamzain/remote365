import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsive } from '../lib/useResponsive';

/** A dialog/sheet whose contents remain reachable on short screens and with a keyboard. */
export function ResponsivePanel({ children, style, onPress, ...props }: Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const { modalMaxHeight } = useResponsive();
  const outer = { ...StyleSheet.flatten(style) };
  const content: ViewStyle = {};
  // ScrollView's children live in its content container, not its viewport.
  const keys = ['padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical', 'gap', 'rowGap', 'columnGap', 'alignItems', 'justifyContent'] as const;
  for (const key of keys) {
    if (outer[key] !== undefined) { (content as any)[key] = outer[key]; delete outer[key]; }
  }
  const panelStyle: StyleProp<ViewStyle> = [outer, { flexShrink: 1, maxHeight: modalMaxHeight, overflow: 'hidden' }];
  const body = <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={content} keyboardShouldPersistTaps="handled" nestedScrollEnabled>{children}</ScrollView>;
  return onPress ? <Pressable {...props} onPress={onPress} style={panelStyle}>{body}</Pressable>
    : <View style={panelStyle}>{body}</View>;
}
