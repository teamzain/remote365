import React, { useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useResponsive } from '../lib/useResponsive';

/**
 * In-app notification banner shown when a chat message arrives while you're not
 * viewing that conversation. Slides in from the top, auto-dismisses, and opens
 * the conversation on tap.
 */
export function ChatToast({
  name,
  text,
  onPress,
  onDismiss,
}: {
  name: string;
  text: string;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const { insets, circle, textSize, maxFontSizeMultiplier } = useResponsive();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDismiss();
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, [anim, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          // Landscape (remote control) moves the cutout / system bars to the
          // sides, so the 12dp margin has to clear them too.
          left: 12 + insets.left,
          right: 12 + insets.right,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
        },
      ]}
    >
      <Pressable style={styles.card} onPress={onPress}>
        <View style={[styles.avatar, circle(40)]}>
          <Text style={[styles.avatarText, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {(name || '?').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.body}>
          <Text style={[styles.name, textSize(14)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{name}</Text>
          <Text style={[styles.text, textSize(13)]} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}>{text}</Text>
        </View>
        <Feather name="message-circle" size={18} color="#FF8A00" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // left/right are set inline so they can clear the side insets.
    position: 'absolute',
    alignItems: 'center',
    zIndex: 200,
  },
  card: {
    width: '100%',
    // Keeps the banner card-shaped on tablets/foldables instead of stretching
    // a 40dp avatar and two short strings across ~1000dp.
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  avatar: {
    // width/height/borderRadius come from circle(40) so the disc keeps up with
    // the initials at large font scales.
    backgroundColor: 'rgba(255,179,71,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '600', color: '#FF8A00' },
  body: { flex: 1 },
  name: { fontWeight: '600', color: '#111315' },
  text: { color: 'rgba(17,19,21,0.6)' },
});
