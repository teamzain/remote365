import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { monaFontStyles } from '../lib/monaSans';
import { FadeInView } from '../components/FadeInView';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

const pendingImage = require('../../assets/pending.png');

/**
 * Shown in a chat thread whose contact request is still PENDING — mirrors the
 * desktop `PendingInvitation`:
 *  - isRequester (you sent it): "Invitation Sent" + waiting copy, no buttons.
 *  - otherwise (you received it): "Pending Invitation" + Accept / Decline.
 */
export function PendingInvitation({
  error,
  name,
  isRequester,
  submitting,
  onAccept,
  onDecline,
}: {
  /** Why the last accept/decline failed. Rendered here because this view REPLACES
   *  the message list, which is where thread errors are normally shown. */
  error?: string;
  name: string;
  isRequester: boolean;
  submitting?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { type, textSize, control, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  const title = isRequester ? t('Invitation Sent') : t('Pending Invitation');
  const description = isRequester
    ? `${t('Waiting for')} ${name} ${t("to accept your chat request. You can't send messages until they accept.")}`
    : `${name} ${t('wants to chat with you. Accept the invitation to start exchanging messages.')}`;

  return (
    // ScrollView, not View: at a large OS font scale (or in a short/landscape
    // window) the illustration + copy alone can exceed the region, and the
    // Accept / Decline buttons must stay reachable.
    <ScrollView style={styles.scroll} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <FadeInView style={styles.inner}>
        <Image source={pendingImage} resizeMode="contain" style={styles.illustration} />

        <View style={styles.textBlock}>
          <Text style={[styles.title, type(22, 30 / 22)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{title}</Text>
          <Text style={[styles.desc, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{description}</Text>

          {error ? (
            <Text style={[styles.error, type(13, 18 / 13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {error}
            </Text>
          ) : null}

          {!isRequester ? (
            <View style={styles.actions}>
              <Pressable style={[styles.acceptBtn, control(40)]} onPress={onAccept} disabled={submitting}>
                {/* viewBox + preserveAspectRatio="none" so the Rect fills a button
                    sized purely by flex layout (minHeight + padding, no explicit
                    numeric height) — the same pattern as ChatEmpty/MeetingHome. */}
                <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id="pendingAccept" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0.38" stopColor="#FF8A00" />
                      <Stop offset="0.89" stopColor="#FFB347" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="1" height="1" fill="url(#pendingAccept)" />
                </Svg>
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.acceptText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Accept')}</Text>
                )}
              </Pressable>
              <Pressable style={[styles.declineBtn, control(40)]} onPress={onDecline} disabled={submitting}>
                <Text style={[styles.declineText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Decline')}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  scroll: {
    flex: 1,
  },
  wrap: {
    alignItems: 'center',
    flexGrow: 1,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  inner: {
    alignItems: 'center',
    gap: 36,
    maxWidth: 340,
    width: '100%',
  },
  illustration: {
    // Explicit box (220 × 1214/1767 ≈ 151), NOT aspectRatio + maxHeight —
    // release-build Yoga can measure that combo at the bitmap's intrinsic
    // height and blow up the surrounding layout (see ChatEmpty).
    // flexShrink so the artwork is what gives way first on a short window.
    flexShrink: 1,
    height: 151,
    width: 220,
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
  desc: {
    color: '#000000',
    fontWeight: '500',
    textAlign: 'center',
  },
  error: {
    color: '#FF383C',
    fontWeight: '500',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    width: '100%',
  },
  acceptBtn: {
    alignItems: 'center',
    borderRadius: 4,
    flex: 1,
    // minHeight (via control(40)) so a scaled label grows the box instead of
    // being cropped by `overflow: 'hidden'`.
    justifyContent: 'center',
    overflow: 'hidden',
    // NO padding: Yoga insets an absolutely-positioned child by the parent's PADDING
    // box, so the gradient <Svg style={StyleSheet.absoluteFill}> would cover only the
    // content area, leaving part of the label on the bare background. The padding
    // moves to acceptText, which keeps the button the same size.
  },
  acceptText: {
    color: '#111315',
    fontWeight: '500',
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
  },
  declineBtn: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  declineText: {
    color: '#111315',
    fontWeight: '500',
    textAlign: 'center',
  },
}));
