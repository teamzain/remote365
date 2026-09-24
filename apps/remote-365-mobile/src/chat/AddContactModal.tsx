import { ResponsivePanel } from '../components/ResponsivePanel';
import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { monaFontStyles } from '../lib/monaSans';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';

export type AddContactResult = { ok: boolean; error?: string };

/**
 * "Add contact to your list" modal — mirrors the desktop chat feature:
 *  - Contact mode: invite one person by email (POST /api/chat/conversations).
 *  - Group mode:   create a group by name + member emails (POST /api/chat/groups).
 * The network calls live in the parent (which owns apiFetch + refresh); this is
 * the presentational shell that matches the Figma design.
 */
export function AddContactModal({
  visible,
  onClose,
  onCreateContact,
  onCreateGroup,
}: {
  visible: boolean;
  onClose: () => void;
  onCreateContact: (email: string) => Promise<AddContactResult>;
  onCreateGroup: (name: string, emails: string[]) => Promise<AddContactResult>;
}) {
  const { width } = useWindowDimensions();
  const { type, textSize, control, stackActions, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'contact' | 'group'>('contact');
  const [email, setEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardWidth = Math.min(width - 40, 468);

  const reset = () => {
    setMode('contact');
    setEmail('');
    setGroupName('');
    setGroupEmails('');
    setError(null);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const canSubmit =
    mode === 'contact'
      ? email.trim().length > 0
      : groupName.trim().length > 0 && groupEmails.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let result: AddContactResult;
      if (mode === 'contact') {
        result = await onCreateContact(email.trim().toLowerCase());
      } else {
        const emails = groupEmails
          .split(/[\s,;]+/)
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);
        result = await onCreateGroup(groupName.trim(), emails);
      }
      if (result.ok) {
        reset();
        onClose();
      } else {
        setError(result.error || t('Could not complete the request.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={'padding'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <ResponsivePanel style={[styles.card, { width: cardWidth }]} onPress={() => {}}>
          {/* Toggle + close */}
          <View style={styles.header}>
            <View style={styles.toggle}>
              <Pressable
                style={[styles.toggleBtn, control(32), mode === 'contact' && styles.toggleBtnActive]}
                onPress={() => setMode('contact')}
              >
                <Text
                  style={[styles.toggleText, textSize(13), mode === 'contact' && styles.toggleTextActive]}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                >
                  {t('Contact')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, control(32), mode === 'group' && styles.toggleBtnActive]}
                onPress={() => setMode('group')}
              >
                <Text
                  style={[styles.toggleText, textSize(13), mode === 'group' && styles.toggleTextActive]}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                >
                  {t('Group')}
                </Text>
              </Pressable>
            </View>
            <Pressable hitSlop={10} onPress={close}>
              <Feather name="x" size={22} color="#111315" />
            </Pressable>
          </View>

          {/* Title + description */}
          <View style={styles.textBlock}>
            <Text style={[styles.title, type(17, 23 / 17)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {mode === 'contact' ? t('Add contact to your list') : t('Create a group')}
            </Text>
            <Text style={[styles.desc, type(12.5, 18 / 12.5)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {mode === 'contact'
                ? t('Once the contact accepts your invitation, you can easily start a remote session and exchange messages.')
                : t('Create a shared space for a team, project, or discussion. Members can start messaging right away.')}
            </Text>
          </View>

          {/* Inputs */}
          {mode === 'contact' ? (
            <View style={styles.field}>
              <Text style={[styles.label, type(12.5, 17 / 12.5)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Email')}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('Enter email address')}
                placeholderTextColor="rgba(17, 19, 21, 0.3)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                maxFontSizeMultiplier={maxFontSizeMultiplier}
                style={[styles.input, textSize(13), control(40)]}
                onSubmitEditing={submit}
                returnKeyType="send"
              />
            </View>
          ) : (
            <View style={styles.groupFields}>
              <View style={styles.field}>
                <Text style={[styles.label, type(12.5, 17 / 12.5)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Group name')}</Text>
                <TextInput
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder={t('Enter group name')}
                  placeholderTextColor="rgba(17, 19, 21, 0.3)"
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                  style={[styles.input, textSize(13), control(40)]}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, type(12.5, 17 / 12.5)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Members')}</Text>
                <TextInput
                  value={groupEmails}
                  onChangeText={setGroupEmails}
                  placeholder={t('Member emails, separated by commas')}
                  placeholderTextColor="rgba(17, 19, 21, 0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                  style={[styles.input, textSize(13), styles.inputMultiline, control(76)]}
                />
              </View>
            </View>
          )}

          {error ? (
            <Text style={[styles.error, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{error}</Text>
          ) : null}

          {/* Actions */}
          {/* On a narrow screen or at a large OS font the two capped buttons cannot
              hold their labels side by side, so they stack (primary on top). */}
          <View style={[styles.actions, stackActions && styles.actionsStacked]}>
            <Pressable
              style={[styles.cancelBtn, control(38), !stackActions && styles.cancelCap]}
              onPress={close}
            >
              <Text style={[styles.cancelText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Cancel')}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.submitBtn,
                control(38),
                !stackActions && styles.submitCap,
                !canSubmit && styles.submitDisabled,
              ]}
              onPress={submit}
              disabled={!canSubmit || submitting}
            >
              {/* viewBox + preserveAspectRatio="none" so the Rect fills a button
                  sized purely by flex layout (minHeight + padding, no explicit
                  numeric height) — the same pattern as ChatEmpty/MeetingHome. */}
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="addContactBtn" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0.38" stopColor="#FF8A00" />
                    <Stop offset="0.89" stopColor="#FFB347" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="1" height="1" fill="url(#addContactBtn)" />
              </Svg>
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.submitText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {mode === 'contact' ? t('Send invite') : t('Create group')}
                </Text>
              )}
            </Pressable>
          </View>
        </ResponsivePanel>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  toggle: {
    backgroundColor: '#F3F4F6',
    borderRadius: 9,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    padding: 4,
  },
  toggleBtn: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    // minHeight (via control(32)) rather than height, so a scaled label is not cropped.
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    color: 'rgba(17, 19, 21, 0.6)',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#111315',
  },
  textBlock: {
    gap: 5,
  },
  title: {
    color: '#111315',
    fontWeight: '700',
  },
  desc: {
    color: 'rgba(17, 19, 21, 0.7)',
    fontWeight: '400',
  },
  groupFields: {
    gap: 10,
  },
  field: {
    gap: 5,
  },
  label: {
    color: '#111315',
    fontWeight: '400',
  },
  input: {
    borderColor: 'rgba(26, 29, 33, 0.3)',
    borderRadius: 6,
    borderWidth: 1,
    color: '#111315',
    fontWeight: '500',
    // Height comes from control(40)/control(76) as a minHeight so the text box
    // grows with the OS font scale instead of clipping its own line box.
    paddingHorizontal: 14,
  },
  inputMultiline: {
    // Grows past its 76dp minimum, then scrolls internally.
    maxHeight: 140,
    paddingTop: 9,
    textAlignVertical: 'top',
  },
  error: {
    color: '#FF383C',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  actionsStacked: {
    // column-reverse keeps the primary action on top once stacked.
    alignItems: 'stretch',
    flexDirection: 'column-reverse',
  },
  // The design caps the two buttons; the caps are dropped when they stack.
  cancelCap: {
    maxWidth: 120,
  },
  submitCap: {
    maxWidth: 130,
  },
  cancelBtn: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E7EB',
    borderRadius: 19,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    color: 'rgba(26, 29, 33, 0.6)',
    fontWeight: '500',
    textAlign: 'center',
  },
  submitBtn: {
    alignItems: 'center',
    borderRadius: 19,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    // NO padding: Yoga insets an absolutely-positioned child by the parent's PADDING
    // box, so the gradient <Svg style={StyleSheet.absoluteFill}> would cover only the
    // content area and leave the label half on white. Padding lives on submitText,
    // which keeps the button exactly the same size. (cancelBtn keeps its padding —
    // it has a solid background, no Svg, so it is unaffected.)
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
}));
