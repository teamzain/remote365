import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SettingsHeader } from './SettingsScaffold';
import { submitFeedback } from './accountApi';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';
import { monaFontStyles } from '../lib/monaSans';

export function FeedbackScreen({
  apiBaseUrl,
  authToken,
  onBack,
}: {
  apiBaseUrl: string;
  authToken: string | null;
  onBack: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { gutter, stackActions, type, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();

  const close = () => {
    setRating(0);
    setFeedback('');
    onBack();
  };

  const handleSend = async () => {
    if (!rating && !feedback.trim()) {
      setError(t('Add a rating or a comment before sending.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await submitFeedback(apiBaseUrl, authToken, { rating, text: feedback.trim() });
    setSubmitting(false);
    if (res.ok) {
      setSent(true);
      setTimeout(close, 900);
    } else {
      setError(res.error || t('Could not send feedback. Please try again.'));
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <SettingsHeader title={t('Feedback')} onBack={onBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={'padding'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={[styles.heading, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Share your Feedback')}</Text>
            <Text style={[styles.subtitle, type(12, 17 / 12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('How satisfied are you with the Remote 365 app?')}</Text>
          </View>

          <View style={styles.ratingBlock}>
            <Text style={[styles.ratingTitle, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Rate Us')}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} hitSlop={8} onPress={() => setRating(value)}>
                  <Feather name="star" size={26} color={value <= rating ? '#FFB347' : '#1A1D21'} fill={value <= rating ? '#FFB347' : 'transparent'} />
                </Pressable>
              ))}
            </View>
          </View>

          <TextInput
            multiline
            value={feedback}
            onChangeText={(next) => { setFeedback(next); if (error) setError(null); }}
            placeholder={t('Write your feedback here...')}
            placeholderTextColor="rgba(17, 19, 21, 0.35)"
            style={[styles.input, type(13, 18 / 13)]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            textAlignVertical="top"
          />
          {error ? <Text style={[styles.errorText, type(11, 15 / 11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{error}</Text> : null}
          {sent ? <Text style={[styles.sentText, type(11, 15 / 11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Thanks! Your feedback was sent.')}</Text> : null}

          <View style={[styles.actions, stackActions && styles.actionsStacked]}>
            <Pressable style={styles.cancelButton} onPress={close} disabled={submitting}>
              <Text style={[styles.cancelText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
            </Pressable>
            <Pressable style={[styles.sendButton, submitting && styles.sendButtonBusy]} onPress={handleSend} disabled={submitting || sent}>
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.sendText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Send')}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  screen: { backgroundColor: 'transparent', flex: 1 },
  flex: { flex: 1 },
  content: { alignSelf: 'center', gap: 24, maxWidth: 720, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 24, width: '100%' },
  intro: { gap: 4, width: '100%' },
  heading: { color: '#111315', fontWeight: '500' },
  subtitle: { color: 'rgba(17,19,21,0.7)' },
  ratingBlock: { alignItems: 'center', gap: 12, marginTop: 8, width: '100%' },
  ratingTitle: { color: '#111315', fontWeight: '500' },
  stars: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'center' },
  input: {
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    color: '#111315',
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4, width: '100%' },
  actionsStacked: { flexDirection: 'column' },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  cancelText: { color: '#111315', fontWeight: '500', textAlign: 'center' },
  sendButton: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 4, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8, paddingVertical: 10 },
  sendButtonBusy: { opacity: 0.7 },
  sendText: { color: '#FFFFFF', fontWeight: '500', textAlign: 'center' },
  errorText: { color: '#D92D20' },
  sentText: { color: '#12B76A' },
}));
