import { ResponsivePanel } from '../components/ResponsivePanel';
import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { mediaDevices, RTCView } from 'react-native-webrtc';
import { MEETING_PREF_KEYS, MeetingMediaPrefs } from './meetingUtils';

type MeetingPreviewProps = {
  busy?: boolean;
  error?: string;
  mode: 'create' | 'join';
  onCancel: () => void;
  onConfirm: (prefs: MeetingMediaPrefs) => void;
  visible: boolean;
};

export function MeetingPreview({
  busy,
  error,
  mode,
  onCancel,
  onConfirm,
  visible,
}: MeetingPreviewProps) {
  const { type, textSize, control, safeHeight, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  // The preview is the one elastic block in the card: on a short viewport it must
  // yield so the Cancel/Confirm row stays above the fold. 280 is the design size.
  const previewHeight = Math.min(280, Math.max(140, Math.round(safeHeight * 0.38)));

  const streamRef = useRef<any>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [mediaError, setMediaError] = useState('');

  const stopStream = () => {
    streamRef.current?.getTracks?.().forEach((track: any) => track.stop());
    streamRef.current = null;
    setStreamUrl('');
  };

  useEffect(() => {
    if (!visible) {
      stopStream();
      return;
    }

    let cancelled = false;

    const startPreview = async () => {
      try {
        const [savedAudio, savedVideo] = await Promise.all([
          AsyncStorage.getItem(MEETING_PREF_KEYS.audio).catch(() => null),
          AsyncStorage.getItem(MEETING_PREF_KEYS.video).catch(() => null),
        ]);
        const nextAudioOn = savedAudio !== 'false';
        const nextVideoOn = savedVideo !== 'false';
        setAudioOn(nextAudioOn);
        setVideoOn(nextVideoOn);

        const mediaStream = await mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) {
          mediaStream.getTracks().forEach((track: any) => track.stop());
          return;
        }

        mediaStream.getAudioTracks().forEach((track: any) => { track.enabled = nextAudioOn; });
        mediaStream.getVideoTracks().forEach((track: any) => { track.enabled = nextVideoOn; });
        streamRef.current = mediaStream;
        setStreamUrl(mediaStream.toURL());
        setMediaError('');
      } catch {
        if (!cancelled) {
          setMediaError(t('Camera or microphone unavailable. You can still join muted.'));
          setAudioOn(false);
          setVideoOn(false);
        }
      }
    };

    void startPreview();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [visible]);

  const toggleAudio = () => {
    const next = !audioOn;
    streamRef.current?.getAudioTracks?.().forEach((track: any) => { track.enabled = next; });
    setAudioOn(next);
  };

  const toggleVideo = () => {
    const next = !videoOn;
    streamRef.current?.getVideoTracks?.().forEach((track: any) => { track.enabled = next; });
    setVideoOn(next);
  };

  const confirm = async () => {
    await Promise.all([
      AsyncStorage.setItem(MEETING_PREF_KEYS.audio, String(audioOn)).catch(() => undefined),
      AsyncStorage.setItem(MEETING_PREF_KEYS.video, String(videoOn)).catch(() => undefined),
    ]);
    stopStream();
    onConfirm({ audioOn, videoOn });
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <ResponsivePanel style={styles.card}>
          <View style={styles.header}>
            <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.headerTitle, type(14, 20 / 14)]}>Remote 365 - {t('Meeting preview')}</Text>
            <Pressable hitSlop={8} style={styles.closeButton} onPress={onCancel} disabled={busy}>
              <Feather name="x" size={18} color="#111315" />
            </Pressable>
          </View>

          <View style={[styles.previewPanel, { height: previewHeight }]}>
            {streamUrl && videoOn ? (
              <RTCView objectFit="cover" streamURL={streamUrl} style={styles.previewVideo} mirror />
            ) : (
              <View style={styles.previewFallback}>
                <Feather name="video-off" size={30} color="rgba(26,29,33,0.45)" />
                <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.previewFallbackText, textSize(12)]}>{t('Camera is off')}</Text>
              </View>
            )}

            <View style={styles.previewControls}>
              <Pressable style={[styles.previewControlButton, control(54)]} onPress={toggleAudio}>
                <Feather name={audioOn ? 'mic' : 'mic-off'} size={20} color={audioOn ? '#111315' : '#D92D20'} />
                <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.previewControlText, type(10, 14 / 10)]}>{t('Audio')}</Text>
              </Pressable>
              <Pressable style={[styles.previewControlButton, control(54)]} onPress={toggleVideo}>
                <Feather name={videoOn ? 'video' : 'video-off'} size={20} color={videoOn ? '#111315' : '#D92D20'} />
                <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.previewControlText, type(10, 14 / 10)]}>{t('Video')}</Text>
              </Pressable>
            </View>
          </View>

          {mediaError || error ? (
            <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.errorText, type(12, 17 / 12)]}>{error || mediaError}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={[styles.cancelButton, control(42)]} onPress={onCancel} disabled={busy}>
              <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.cancelText, textSize(14)]}>{t('Cancel')}</Text>
            </Pressable>
            <Pressable style={[styles.confirmButton, control(42), busy && styles.disabled]} onPress={confirm} disabled={busy}>
              <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.confirmText, textSize(14)]}>{busy ? t('Starting...') : mode === 'create' ? t('Create') : t('Join')}</Text>
            </Pressable>
          </View>
        </ResponsivePanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: 'rgba(26,29,33,0.3)',
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: '#111315',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    gap: 18,
    maxWidth: 430,
    padding: 16,
    width: '92%',
  },
  closeButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 24,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 12,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#D92D20',
    fontWeight: '500',
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#111315',
    flexShrink: 1,
    fontWeight: '600',
    minWidth: 0,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    flex: 1,
    justifyContent: 'center',
  },
  previewControlButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 70,
    paddingHorizontal: 8,
  },
  previewControlText: {
    color: '#111315',
    marginTop: 2,
  },
  previewControls: {
    alignSelf: 'center',
    bottom: 10,
    flexDirection: 'row',
    gap: 10,
    position: 'absolute',
  },
  previewFallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  previewFallbackText: {
    color: 'rgba(26,29,33,0.55)',
    fontWeight: '500',
    marginTop: 8,
  },
  previewPanel: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  previewVideo: {
    height: '100%',
    width: '100%',
  },
}));
