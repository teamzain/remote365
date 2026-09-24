import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

const chatIllustration = require('../../assets/chat.png');

/**
 * Empty state for the Chat page (shown when there are no conversations yet).
 * Centered illustration + heading + subtitle + primary gradient button, per
 * the Figma "Start Chatting" design. Font comes from the app-wide Mona Sans
 * patch (weights via fontWeight).
 *
 * No fade-in animation here on purpose: this screen is the first thing a
 * fresh account sees, and an Animated.Value that never resolves (e.g. a
 * native-driver hiccup) previously left it permanently invisible — a plain,
 * always-opaque render is the reliable choice for a first-run screen.
 */
export function ChatEmpty({ onStart }: { onStart?: () => void }) {
  const { insets, headerHeight, navClearance, type, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  return (
    // Absolutely positioned between the header and the bottom nav, so no
    // flex negotiation with siblings can misplace it — release-build Yoga
    // passes twice collapsed a flex-sized wrapper here and flung the content
    // above the screen / over the header. It is a ScrollView so that a short
    // screen (or a large OS font) can reach the button instead of pushing it
    // under the floating nav pill.
    <ScrollView
      style={[styles.wrap, { top: insets.top + headerHeight }]}
      contentContainerStyle={[styles.wrapContent, { paddingBottom: Math.max(120, navClearance) }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        <Image source={chatIllustration} style={styles.illustration} resizeMode="contain" />

        <View style={styles.textBlock}>
          <Text style={[styles.title, type(24, 34 / 24)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {t('Start Chatting')}
          </Text>
          <Text style={[styles.subtitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {t('Select a contact to start chatting. Your messages are private here.')}
          </Text>
        </View>

        <Pressable style={styles.button} onPress={onStart}>
          {/* viewBox + preserveAspectRatio="none" is required for the Rect to
              fill a Pressable sized purely by flex layout (no explicit numeric
              width/height) — same pattern as MeetingHome's ButtonGradient. */}
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="chatEmptyBtn" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0.38" stopColor="#FF8A00" />
                <Stop offset="0.89" stopColor="#FFB347" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill="url(#chatEmptyBtn)" />
          </Svg>
          <Text style={[styles.buttonText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {t('Add contact')}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  wrap: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  wrapContent: {
    alignItems: 'center',
    // flexGrow (not flex) so the block stays centered while it fits and simply
    // scrolls once it no longer does.
    flexGrow: 1,
    justifyContent: 'center',
    // paddingBottom is applied inline as Math.max(120, navClearance): 120 is the
    // design value, and navClearance raises it once the floating nav pill grows
    // with the OS font scale, so the block stays above the pill rather than
    // hiding behind it.
    paddingHorizontal: 16,
  },
  inner: {
    alignItems: 'center',
    alignSelf: 'center',
    // NOT flexShrink: now that the parent is a ScrollView, shrinking is wrong —
    // a shrunk block makes the ScrollView measure the content as "fits", so it
    // refuses to scroll AND crops the button. Keeping the natural height lets
    // the ScrollView do its job.
    gap: 28,
    maxWidth: 328,
    width: '100%',
  },
  illustration: {
    // Explicit box, NOT aspectRatio + maxHeight: release-build Yoga measured
    // that combination at the bitmap's intrinsic 1559px height, blowing the
    // centered block ~1900px tall and flinging this whole screen's content
    // off-screen (the "empty chat page" bug). Do NOT add flexShrink here for the
    // same reason — a shrinkable box re-opens that measurement path. Overflow is
    // handled by the parent ScrollView instead.
    height: 200,
    width: 190,
  },
  textBlock: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  title: {
    color: '#000000',
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitle: {
    color: '#000000',
    fontWeight: '400',
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    borderRadius: 4,
    justifyContent: 'center',
    // minHeight + padding, not height: the label must be able to grow the box
    // instead of being cropped by `overflow: 'hidden'`.
    // flexShrink: 0 so the button is never the thing that gives way — with
    // `overflow: 'hidden'` above, any compression here crops the label.
    flexShrink: 0,
    minHeight: 40,
    overflow: 'hidden',
    // NO padding here. Yoga insets an absolutely-positioned child by its parent's
    // PADDING box, so `StyleSheet.absoluteFill` on the gradient <Svg> below would
    // only cover the content area — it rendered 283x23dp inside a 307x43dp button,
    // leaving the bottom half of the label sitting on white. The padding lives on
    // buttonText instead, which keeps the same visual box.
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
}));
