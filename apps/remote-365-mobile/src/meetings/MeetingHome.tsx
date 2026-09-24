import React, { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { createMeeting, fetchMeetings } from './meetingApi';
import { MeetingPreview } from './MeetingPreview';
import {
  extractMeetingCode,
  formatMeetingCode,
  isMeetingJoinable,
  MeetingItem,
  MeetingUser,
} from './meetingUtils';

type PreviewTarget = { mode: 'create' } | { mode: 'join'; code: string };

type MeetingHomeProps = {
  apiBaseUrl: string;
  meetings: MeetingItem[];
  onMeetingsChange: (meetings: MeetingItem[]) => void;
  onOpenMeeting: (meetingCode: string) => void;
  token: string | null;
  user: MeetingUser | null;
  /** Bump to open the create-meeting preview from outside (e.g. the nav-bar + button). */
  createRequestToken?: number;
};

// The Figma frame is drawn at 360pt and its dp values are used verbatim: spacing
// and box metrics are fixed dp (they must not shrink on a narrow phone, which is
// exactly where a 32dp button becomes untappable), while type comes from the
// shared `type()` ramp so it follows the OS font-size setting up to MAX_FONT_SCALE.
// Extra width just becomes breathing room around the `page` max-width.

/** Fills its parent with the Figma button gradient (110.89deg, #FF8A00 → #FFB347). */
function ButtonGradient({ id }: { id: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="0.35">
          <Stop offset="0.36" stopColor="#FF8A00" />
          <Stop offset="0.94" stopColor="#FFB347" />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
    </Svg>
  );
}

export function MeetingHome({
  apiBaseUrl,
  meetings,
  onMeetingsChange,
  onOpenMeeting,
  token,
  user,
  createRequestToken = 0,
}: MeetingHomeProps) {
  const { type, textSize, control, scale, navClearance, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  const scrollRef = useRef<ScrollView>(null);
  const quickJoinRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const codeFocusedRef = useRef(false);
  const [codeFocused, setCodeFocused] = useState(false);

  // When Quick-join is focused, scroll it clear of the on-screen keyboard.
  const ensureQuickJoinVisible = (keyboardHeight: number) => {
    const target = quickJoinRef.current;
    if (!target || keyboardHeight <= 0) return;
    target.measureInWindow((_x, y, _w, h) => {
      const keyboardTop = Dimensions.get('window').height - keyboardHeight;
      const overlap = y + h - keyboardTop + 24;
      if (overlap > 0) {
        scrollRef.current?.scrollTo({ y: scrollYRef.current + overlap, animated: true });
      }
    });
  };

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      if (codeFocusedRef.current) ensureQuickJoinVisible(event.endCoordinates?.height || 0);
    });
    return () => show.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [meetingCode, setMeetingCode] = useState('');
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  // Nav-bar + button: same path as the "Start a new meeting" button below.
  useEffect(() => {
    if (createRequestToken > 0) setPreview({ mode: 'create' });
  }, [createRequestToken]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      onMeetingsChange(await fetchMeetings(apiBaseUrl, token));
    } catch (err: any) {
      setError(err.message || t('Could not load meetings.'));
    } finally {
      setLoading(false);
    }
  };

  const openJoinPreview = (value: string) => {
    const code = formatMeetingCode(extractMeetingCode(value));
    if (!code) return;
    setError('');
    setPreview({ mode: 'join', code });
  };

  const confirmPreview = async () => {
    if (!preview) return;

    if (preview.mode === 'join') {
      setPreview(null);
      onOpenMeeting(preview.code);
      return;
    }

    if (!token) {
      setError(t('Sign in to create a meeting.'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      const meeting = await createMeeting(apiBaseUrl, token, `${user?.name || 'Remote 365'} meeting`);
      onMeetingsChange([meeting, ...meetings.filter((item) => item.id !== meeting.id)]);
      setPreview(null);
      onOpenMeeting(meeting.displayCode || meeting.sessionCode || meeting.id);
    } catch (err: any) {
      setError(err.message || t('Could not create meeting.'));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code: string) => {
    const normalized = code.replace(/\s|-/g, '');
    await Clipboard.setStringAsync(normalized);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode((value) => (value === code ? null : value)), 1500);
  };

  // Invite people the same way desktop/web do: hand out the meeting code and
  // the deep link. The OS share sheet covers WhatsApp/SMS/email/etc.
  const shareMeeting = async (name: string, code: string) => {
    const normalized = code.replace(/\s|-/g, '');
    try {
      await Share.share({
        message:
          `${t('Join my Remote 365 meeting')} "${name || 'Remote 365 meeting'}".\n` +
          `${t('Meeting code:')} ${formatMeetingCode(normalized)}\n` +
          `${t('Open the Remote 365 app and enter the code, or tap:')} remote365://join?code=${encodeURIComponent(normalized)}`,
      });
    } catch { /* user dismissed the share sheet */ }
  };

  const formattedTime = currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const canJoin = Boolean(meetingCode.trim());

  return (
    <>
      <KeyboardAvoidingView style={styles.scroll} behavior={'padding'}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: scale(28), paddingBottom: Math.max(130, navClearance) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          {/* Time + intro copy */}
          <View style={[styles.intro, { gap: scale(16) }]}>
            <View style={styles.timeRow}>
              <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.timeText, type(18, 25 / 18)]}>{formattedTime}</Text>
              <View style={styles.timeDot} />
              <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.dateText, type(14, 20 / 14)]}>{formattedDate}</Text>
            </View>
            <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.description, type(14, 20 / 14)]}>
              {t('Start secure meetings, collaborate with your team, and connect instantly from anywhere.')}
            </Text>
          </View>

          {/* The big vertical rhythm is scaled too, not just the type: on a 339dp
              phone a fixed 48dp section gap plus 24dp inner gaps is what makes the
              page read as loose and oversized even once the text has shrunk.
              Box metrics and touch targets stay fixed dp — only the air scales. */}
          <View style={[styles.sections, { gap: scale(24), marginTop: scale(48) }]}>
            {/* Start a new meeting */}
            <View style={[styles.actionBlock, { gap: scale(24) }]}>
              <View style={styles.copyBlock}>
                <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.sectionTitle, type(16, 22 / 16)]}>{t('Start a new meeting')}</Text>
                <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.bodyText, type(14, 20 / 14)]}>{t('Create an instant meeting')}</Text>
              </View>
              <Pressable style={[styles.primaryButton, control(40)]} onPress={() => setPreview({ mode: 'create' })}>
                <ButtonGradient id="new-meeting" />
                <Feather name="video" size={16} color="#FFFFFF" />
                <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.primaryButtonText, type(14, 20 / 14)]}>{t('New meeting')}</Text>
              </Pressable>
            </View>

            {/* Quick join */}
            <View ref={quickJoinRef} collapsable={false} style={styles.quickJoinBlock}>
              <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.sectionTitle, type(16, 22 / 16)]}>{t('Quick join')}</Text>
              <View style={styles.quickJoinForm}>
                <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.inputLabel, type(14, 20 / 14)]}>{t('Enter code or link')}</Text>
                <View style={styles.quickJoinRow}>
                  <TextInput
                    maxFontSizeMultiplier={maxFontSizeMultiplier}
                    autoCapitalize="characters"
                    onChangeText={setMeetingCode}
                    onSubmitEditing={() => openJoinPreview(meetingCode)}
                    onFocus={() => { codeFocusedRef.current = true; setCodeFocused(true); }}
                    onBlur={() => { codeFocusedRef.current = false; setCodeFocused(false); }}
                    placeholder={t('e.g 123-456-789')}
                    placeholderTextColor="rgba(17,19,21,0.3)"
                    style={[styles.input, control(40), textSize(14)]}
                    value={meetingCode}
                  />
                  <Pressable
                    style={[styles.joinButton, control(40), !canJoin && styles.joinButtonDisabled]}
                    onPress={() => openJoinPreview(meetingCode)}
                    disabled={!canJoin}
                  >
                    <Text
                      maxFontSizeMultiplier={maxFontSizeMultiplier}
                      style={[styles.joinButtonText, type(14, 20 / 14), !canJoin && styles.joinButtonTextDisabled]}
                    >
                      {t('Join')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {error ? <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.errorText, type(12, 17 / 12)]}>{error}</Text> : null}

            {/* Recent meetings */}
            <View style={styles.recentBlock}>
              <View style={styles.recentHeader}>
                <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.sectionTitle, styles.flexTitle, type(16, 22 / 16)]}>{t('Recent meetings')}</Text>
                <Pressable hitSlop={8} style={styles.refreshButton} onPress={refresh} disabled={loading}>
                  {loading
                    ? <ActivityIndicator size="small" color="#FF8A00" />
                    : <Feather name="refresh-cw" size={15} color="#111315" />}
                </Pressable>
              </View>

              {meetings.length === 0 ? (
                <View style={[styles.emptyRecent, control(40)]}>
                  <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.bodyText, type(14, 20 / 14)]}>{t('No meetings yet.')}</Text>
                </View>
              ) : (
                meetings.slice(0, 8).map((meeting) => {
                  const code = formatMeetingCode(meeting.displayCode || meeting.sessionCode || meeting.id);
                  const joinable = isMeetingJoinable(meeting);
                  return (
                    <View key={meeting.id} style={styles.meetingRow}>
                      <Pressable
                        disabled={!joinable}
                        style={styles.meetingRowMain}
                        onPress={() => joinable && openJoinPreview(code)}
                      >
                        <Feather name="clock" size={18} color="#111315" />
                        <View style={styles.meetingCopy}>
                          <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.meetingName, type(14, 20 / 14)]} numberOfLines={1}>{meeting.name}</Text>
                          {/* Meetings created by someone else are ones you were invited to. */}
                          {meeting.createdById && user?.id && meeting.createdById !== user.id ? (
                            <Text
                              maxFontSizeMultiplier={maxFontSizeMultiplier}
                              style={[styles.invitedBadge, type(11, 15 / 11)]}
                              numberOfLines={1}
                            >
                              {meeting.createdByName
                                ? `${t('Invited by')} ${meeting.createdByName}`
                                : t('You are invited')}
                            </Text>
                          ) : null}
                          <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.meetingCode, type(12, 17 / 12)]}>
                            {code} {joinable ? '' : `- ${t('Expired')}`}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable hitSlop={8} style={styles.copyButton} onPress={() => copyCode(code)}>
                        <Feather name={copiedCode === code ? 'check-circle' : 'copy'} size={15} color={copiedCode === code ? '#14AE5C' : '#858687'} />
                      </Pressable>
                      {joinable ? (
                        <Pressable hitSlop={8} style={styles.copyButton} onPress={() => shareMeeting(meeting.name, code)}>
                          <Feather name="share-2" size={15} color="#858687" />
                        </Pressable>
                      ) : null}
                      <Feather name="chevron-right" size={16} color="#858687" />
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </View>
        {codeFocused ? <View style={styles.keyboardSpacer} /> : null}
      </ScrollView>
      </KeyboardAvoidingView>

      <MeetingPreview
        busy={busy}
        error={error}
        mode={preview?.mode || 'join'}
        onCancel={() => setPreview(null)}
        onConfirm={confirmPreview}
        visible={Boolean(preview)}
      />
    </>
  );
}

// Figma dp values verbatim. Type metrics live in the JSX via `type()` so the OS
// font-size setting drives them; boxes that hold text get `control()` there too.
const styles = StyleSheet.create(monaFontStyles({
  actionBlock: {
    gap: 24,
  },
  bodyText: {
    color: '#000000',
    fontWeight: '400',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  copyBlock: {
    gap: 4,
  },
  copyButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dateText: {
    color: '#000000',
    fontWeight: '400',
  },
  description: {
    color: '#000000',
    fontWeight: '400',
  },
  emptyRecent: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    justifyContent: 'center',
  },
  errorText: {
    color: '#D92D20',
    fontWeight: '500',
  },
  // The heading half of a space-between row must be the side that gives way.
  flexTitle: {
    flexShrink: 1,
    minWidth: 0,
  },
  input: {
    borderColor: 'rgba(26,29,33,0.3)',
    borderRadius: 4,
    borderWidth: 1,
    color: '#111315',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  inputLabel: {
    color: '#1A1D21',
    fontWeight: '500',
  },
  intro: {
    gap: 16,
  },
  joinButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 12,
    width: 90,
  },
  joinButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  joinButtonTextDisabled: {
    color: 'rgba(26,29,33,0.3)',
  },
  keyboardSpacer: {
    height: 300,
  },
  invitedBadge: {
    color: '#B45309',
    fontWeight: '500',
  },
  meetingCode: {
    color: 'rgba(26,29,33,0.55)',
    fontFamily: 'monospace',
  },
  meetingCopy: {
    flex: 1,
    minWidth: 0,
  },
  meetingName: {
    color: '#111315',
    fontWeight: '400',
  },
  meetingRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(26,29,33,0.3)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingVertical: 8,
  },
  meetingRowMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  page: {
    alignSelf: 'center',
    maxWidth: 480,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    overflow: 'hidden',
    // NO paddingHorizontal. Yoga insets an absolutely-positioned child by the
    // parent's PADDING box, so <ButtonGradient> (StyleSheet.absoluteFill) stopped
    // 16dp short on each side: the button measured 307dp but its gradient only
    // 275dp, leaving the orange visibly out of line with the input row below it.
    // The row is centred, so the inset was never doing layout work anyway.
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  quickJoinBlock: {
    gap: 12,
  },
  quickJoinForm: {
    gap: 8,
  },
  quickJoinRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  recentBlock: {
    gap: 8,
  },
  recentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  refreshButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  sectionTitle: {
    color: '#000000',
    fontWeight: '500',
  },
  sections: {
    gap: 24,
    marginTop: 48,
  },
  timeDot: {
    backgroundColor: 'rgba(26,29,33,0.3)',
    borderRadius: 2,
    height: 3,
    width: 3,
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 13,
  },
  timeText: {
    color: '#000000',
    fontWeight: '500',
  },
}));
