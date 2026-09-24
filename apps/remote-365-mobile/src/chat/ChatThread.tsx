import { ResponsivePanel } from '../components/ResponsivePanel';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
// `familyForWeight()` is spelled out on the entries below whose only text
// property WAS `fontSize`: monaFontStyles injects the Mona Sans family solely
// into styles that carry a text property, so once fontSize moves inline to
// textSize()/type() those entries would silently fall back to the system font.
import { familyForWeight, monaFontStyles } from '../lib/monaSans';
import { MAX_FONT_SCALE } from '../lib/responsive';
import { useResponsive } from '../lib/useResponsive';
import { useTranslation } from '../lib/i18n';
// Optional native module: a dev build that predates `expo-image-picker` won't
// have the native side, and a static import would crash the whole chat thread at
// load. Load it defensively so chat still works — photos activate after rebuild.
let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}
import {
  acceptInvite,
  attachmentSrc,
  blockConversation,
  ChatMessage,
  createMeetingSessionInvite,
  createClientMessageId,
  deleteConversation,
  deleteMessage,
  DEVICE_MENTION_REGEX,
  editMessage,
  fetchConversationMessages,
  humanizeDeviceMentions,
  muteConversation,
  parseSessionInvite,
  reactToMessage,
  tokenizeDeviceMentions,
  rejectInvite,
  unblockConversation,
  unfriendConversation,
  uploadChatFile,
} from './chatApi';
import { useChatSocket } from './useChatSocket';
import { PendingInvitation } from './PendingInvitation';

type ChatThreadProps = {
  apiBaseUrl: string;
  token: string | null;
  selfId?: string;
  selfName?: string | null;
  conversationId: string;
  conversationName: string;
  online?: boolean;
  otherUserId?: string;
  otherEmail?: string;
  status?: string;
  requestedById?: string;
  blockedById?: string;
  onBack: () => void;
  onResolved?: () => void;
  onStartMeeting?: () => void;
  onJoinMeeting?: (code: string) => void;
  onStartRemoteControl?: () => void;
  /** Whether this user has muted the conversation (from the conversation list). */
  initialMuted?: boolean;
  /** The user's devices, for @-mentions in the composer. */
  devices?: Array<{ name: string; accessKey: string }>;
  /** Tap on a mentioned device chip → connect to it. */
  onOpenDevice?: (device: { name: string; accessKey: string }) => void;
};

// You can delete your own message only within this window after sending it.
const DELETE_WINDOW_MS = 60 * 60 * 1000; // 1 hour, WhatsApp-style
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '✅', '🎉'];

function canDeleteMessage(message: ChatMessage, isMine: boolean): boolean {
  if (!isMine || message.deletedAt || message.pending) return false;
  const age = Date.now() - new Date(message.createdAt).getTime();
  return age >= 0 && age < DELETE_WINDOW_MS;
}

function initialsOf(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// `t` is passed in (not a hook call) because this is a plain helper, not a component.
function lastSeenLabel(iso: string | null, t: (s: string) => string): string {
  if (!iso) return t('Offline');
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t('Offline');
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t('Last seen just now');
  if (mins < 60) return `${t('Last seen')} ${mins}m ${t('ago')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${t('Last seen')} ${hours}h ${t('ago')}`;
  return `${t('Last seen')} ${Math.floor(hours / 24)}d ${t('ago')}`;
}

export function ChatThread({
  apiBaseUrl,
  token,
  selfId,
  selfName,
  conversationId,
  conversationName,
  online,
  otherUserId,
  otherEmail,
  status,
  requestedById,
  blockedById,
  onBack,
  onResolved,
  onStartMeeting,
  onJoinMeeting,
  onStartRemoteControl,
  initialMuted,
  devices,
  onOpenDevice,
}: ChatThreadProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { circle, type, textSize, cappedFontScale, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  // Keyboard visibility drives two layout decisions: the bottom safe-area inset
  // (the keyboard already covers it) and re-anchoring the thread to the newest
  // message once the list has been shortened by the keyboard.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Bottom edge of the contact bar, measured so the ⋮ dropdown hangs below the
  // real chrome instead of a constant that stops being true once text scales.
  const [contactBarBottom, setContactBarBottom] = useState(0);
  const [localStatus, setLocalStatus] = useState(status);
  const isBlocked = localStatus === 'BLOCKED';
  const isBlockedByMe = isBlocked && !!blockedById && blockedById === selfId;
  // Real presence for the other participant (seeded from the list, updated live).
  const [contactOnline, setContactOnline] = useState<boolean>(!!online);
  const [contactLastSeen, setContactLastSeen] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const isPending = localStatus === 'PENDING';
  const isRequester = !!requestedById && requestedById === selfId;

  // Errors here used to go to `setError`, which is only rendered inside the message
  // list — and the message list is exactly what the pending-invite branch replaces.
  // So a failed accept/decline set an error nobody could ever see, and the buttons
  // looked completely dead. This state is rendered by PendingInvitation itself.
  const [inviteError, setInviteError] = useState('');

  const handleAcceptInvite = async () => {
    setInviteSubmitting(true);
    setInviteError('');
    try {
      await acceptInvite(apiBaseUrl, conversationId, token);
      setLocalStatus('ACCEPTED');
      onResolved?.();
    } catch (err: any) {
      console.warn('[chat] accept invite failed:', err?.message, err);
      setInviteError(err?.message || t('Could not accept the invitation.'));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleDeclineInvite = async () => {
    setInviteSubmitting(true);
    setInviteError('');
    try {
      await rejectInvite(apiBaseUrl, conversationId, token);
      onResolved?.();
      onBack();
    } catch (err: any) {
      console.warn('[chat] decline invite failed:', err?.message, err);
      setInviteError(err?.message || t('Could not decline the invitation.'));
      setInviteSubmitting(false);
    }
  };

  // Header ⋮ menu (block / unfriend / delete) — same endpoints as the desktop.
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const runConversationAction = async (action: () => Promise<unknown>) => {
    if (actionBusy) return;
    setActionBusy(true);
    setShowActionsMenu(false);
    try {
      await action();
      onResolved?.();
      onBack();
    } catch (err: any) {
      setError(err?.message || t('Could not complete that action.'));
    } finally {
      setActionBusy(false);
    }
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  // "@Name" mentions typed so far → accessKey, applied as tokens on send.
  const [mentionedDevices, setMentionedDevices] = useState<Record<string, string>>({});
  const [actionSheet, setActionSheet] = useState<ChatMessage | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  // Gallery viewer: index into galleryImages (all photos in this chat).
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerPage, setViewerPage] = useState(0);
  const [muted, setMuted] = useState(!!initialMuted);
  const [remoteInfoOpen, setRemoteInfoOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const handleUnblock = async () => {
    setActionBusy(true);
    try {
      await unblockConversation(apiBaseUrl, conversationId, token);
      setLocalStatus('ACCEPTED');
      onResolved?.();
    } catch (err: any) {
      setError(err?.message || t('Could not unblock.'));
    } finally {
      setActionBusy(false);
    }
  };
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showSessionOptions, setShowSessionOptions] = useState(false);
  const [meetingInviteSending, setMeetingInviteSending] = useState(false);
  // Latest read timestamp per other participant → drives the seen/blue ticks.
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const galleryRef = useRef<FlatList<{ url: string; name: string }> | null>(null);
  const typingTimerRef = useRef<any>(null);
  const lastTypingSentRef = useRef(0);
  // The newest read time across everyone else — a 1:1 "seen" cutoff.
  const latestReadAt = useMemo(() => {
    const times = Object.values(readReceipts).map((t) => new Date(t).getTime());
    return times.length ? Math.max(...times) : 0;
  }, [readReceipts]);

  const upsertMessage = (incoming: ChatMessage) => {
    setMessages((prev) => {
      // Reconcile an optimistic message by clientMessageId, else de-dupe by id.
      const byClient = incoming.clientMessageId
        ? prev.findIndex((m) => m.clientMessageId && m.clientMessageId === incoming.clientMessageId)
        : -1;
      if (byClient > -1) {
        const next = [...prev];
        next[byClient] = { ...incoming, pending: false };
        return next;
      }
      if (prev.some((m) => m.id === incoming.id)) {
        return prev.map((m) => (m.id === incoming.id ? { ...m, ...incoming, pending: false } : m));
      }
      return [...prev, incoming];
    });
  };

  const socket = useChatSocket(apiBaseUrl, token, {
    onMessage: (message, convId) => {
      if (convId !== conversationId) return;
      upsertMessage(message);
      // We're viewing this thread, so anything from the other side is now read.
      if (message.senderId !== selfId) socket.markRead(conversationId);
    },
    onMessageUpdated: (message, convId) => {
      if (convId !== conversationId) return;
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ...message } : m)));
    },
    onTyping: (convId, userId, userName, isTyping) => {
      if (convId !== conversationId || userId === selfId) return;
      setTypingUser(isTyping ? (userName || t('Someone')) : null);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTyping) typingTimerRef.current = setTimeout(() => setTypingUser(null), 4000);
    },
    onReadReceipt: (convId, userId, readAt) => {
      if (convId !== conversationId || userId === selfId) return;
      setReadReceipts((prev) => ({ ...prev, [userId]: readAt }));
    },
    onConversationUpdated: (conversation) => {
      if (conversation?.id !== conversationId) return;
      // e.g. the other person accepted — update the pending state live.
      if (conversation.status) setLocalStatus(conversation.status);
      onResolved?.();
    },
    onConversationRemoved: (convId) => {
      if (convId !== conversationId) return;
      onResolved?.();
      onBack();
    },
    onPresence: (userId, isOnline, lastSeen) => {
      if (!otherUserId || userId !== otherUserId) return;
      setContactOnline(isOnline);
      if (!isOnline && lastSeen) setContactLastSeen(lastSeen);
    },
    onPresenceSnapshot: (onlineMap, lastSeenMap) => {
      if (!otherUserId) return;
      setContactOnline(!!onlineMap[otherUserId]);
      if (lastSeenMap[otherUserId]) setContactLastSeen(lastSeenMap[otherUserId]);
    },
    onAuthenticated: () => socket.markRead(conversationId),
  });

  // Once the invite is accepted (locally or in real time), pull the message history.
  useEffect(() => {
    if (localStatus && localStatus !== 'PENDING') {
      fetchConversationMessages(apiBaseUrl, conversationId, token)
        .then(setMessages)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStatus]);

  // Mark the thread read as soon as the socket is ready (covers the case where
  // it authenticated before this conversation was opened).
  useEffect(() => {
    if (socket.ready) socket.markRead(conversationId);
  }, [socket.ready, conversationId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchConversationMessages(apiBaseUrl, conversationId, token)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || t('Could not load messages.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, conversationId, token]);

  useEffect(() => {
    // Scroll to the newest message whenever the list grows.
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  useEffect(() => {
    // The keyboard shrinks the list by its own height while contentOffset is
    // preserved, so the newest messages slide below the fold. Re-anchor to the
    // end (and record the state so the composer can drop the bottom inset).
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, () => {
      setKeyboardOpen(true);
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const handleSend = () => {
    const raw = input.trim();
    if (!raw) return;
    // Same wire format as desktop: "@Name" → "@[Name](device:KEY)" tokens.
    const content = tokenizeDeviceMentions(raw, mentionedDevices);
    setMentionedDevices({});
    // Editing an existing message: PATCH it instead of sending a new one.
    if (editingMessage) {
      const target = editingMessage;
      setEditingMessage(null);
      setInput('');
      editMessage(apiBaseUrl, target.id, content, token)
        .then((updated: any) => { if (updated?.id) upsertMessage(updated); })
        .catch((err: any) => setError(err?.message || t('Could not edit the message.')));
      return;
    }
    const clientMessageId = createClientMessageId();
    const replyToId = replyTarget?.id;
    const optimistic: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      conversationId,
      senderId: selfId || 'me',
      content,
      createdAt: new Date().toISOString(),
      pending: true,
      replyToId,
      replyTo: replyTarget
        ? { id: replyTarget.id, content: replyTarget.content, senderId: replyTarget.senderId, sender: replyTarget.sender }
        : null,
    };
    setMessages((prev) => [...prev, optimistic]);
    socket.sendMessage({ conversationId, content, clientMessageId, replyToId });
    setInput('');
    setReplyTarget(null);
  };

  const [attachmentSending, setAttachmentSending] = useState(false);

  const handlePickImage = async () => {
    setShowSessionOptions(false);
    if (!ImagePicker) {
      setError(t('Photo attachments need the latest app build.'));
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(t('Photo access is needed to attach an image.'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      const asset = result.assets[0];
      setAttachmentSending(true);
      const name = asset.fileName || `photo-${Date.now()}.jpg`;
      const type = asset.mimeType || 'image/jpeg';
      const uploaded = await uploadChatFile(apiBaseUrl, { name, type, base64: asset.base64! }, token);
      const clientMessageId = createClientMessageId();
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        conversationId,
        senderId: selfId || 'me',
        content: '',
        createdAt: new Date().toISOString(),
        pending: true,
        attachmentUrl: uploaded.url,
        attachmentName: uploaded.name,
        attachmentType: uploaded.type,
        attachmentSize: uploaded.size,
      };
      setMessages((prev) => [...prev, optimistic]);
      socket.sendMessage({ conversationId, content: '', clientMessageId, attachment: uploaded });
    } catch (err: any) {
      setError(err?.message || t('Could not send the photo.'));
    } finally {
      setAttachmentSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m)));
    try {
      await deleteMessage(apiBaseUrl, messageId, token);
    } catch {
      /* the socket update will correct state if this fails */
    }
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    try {
      const updated = await reactToMessage(apiBaseUrl, messageId, emoji, token);
      setMessages((prev) => prev.map((message) => (message.id === updated.id ? updated : message)));
    } catch (err: any) {
      setError(err?.message || t('Could not update reaction.'));
    }
  };

  // + → Meeting session: generate a code and drop an invite card in the chat
  // (same structured message the desktop sends). Tap the card to join.
  const handleStartMeeting = async () => {
    if (meetingInviteSending) return;
    setShowSessionOptions(false);
    if (!token) {
      setError(t('Sign in to send a meeting invite.'));
      return;
    }
    setMeetingInviteSending(true);
    setError('');
    try {
      const result = await createMeetingSessionInvite(apiBaseUrl, {
        conversationId,
        sessionName: `${conversationName} meeting`,
      }, token);
      if (result.message) upsertMessage(result.message);
      onStartMeeting?.();
    } catch (err: any) {
      setError(err?.message || t('Could not send meeting invite.'));
    } finally {
      setMeetingInviteSending(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      socket.sendTyping(conversationId, selfName || undefined, true);
    }
  };

  const rendered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) =>
      String(m.content || m.attachmentName || '').toLowerCase().includes(q),
    );
  }, [messages, searchQuery]);

  // Every photo in the conversation, oldest → newest, for the swipeable viewer.
  const galleryImages = useMemo(
    () =>
      messages
        .filter((m) => !m.deletedAt && m.attachmentUrl && String(m.attachmentType || '').startsWith('image'))
        .map((m) => ({ url: attachmentSrc(apiBaseUrl, m.attachmentUrl!), name: m.attachmentName || 'Photo' })),
    [messages, apiBaseUrl],
  );

  const openImageViewer = (uri: string) => {
    const index = galleryImages.findIndex((image) => image.url === uri);
    const start = index >= 0 ? index : 0;
    setViewerPage(start);
    setViewerIndex(start);
  };
  const closeImageViewer = () => setViewerIndex(null);

  useEffect(() => {
    // A FlatList keeps its pixel contentOffset, not its page, across a width
    // change (rotation, fold/unfold, split-screen resize) — so re-anchor to the
    // page the counter is showing instead of landing between two photos.
    if (viewerIndex === null || galleryImages.length === 0) return;
    const index = Math.max(0, Math.min(viewerPage, galleryImages.length - 1));
    galleryRef.current?.scrollToIndex({ index, animated: false });
    // Only the width change should re-anchor; paging itself must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowWidth]);

  // "@par" at the caret → matching devices to suggest (composer bar above input).
  const mentionQuery = useMemo(() => {
    const match = /@([^\s@]*)$/.exec(input);
    return match ? match[1].toLowerCase() : null;
  }, [input]);
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || !devices?.length) return [];
    return devices
      .filter((device) => device.accessKey && device.name.toLowerCase().startsWith(mentionQuery))
      .slice(0, 4);
  }, [mentionQuery, devices]);

  const insertMention = (device: { name: string; accessKey: string }) => {
    setInput((current) => current.replace(/@([^\s@]*)$/, `@${device.name} `));
    setMentionedDevices((current) => ({ ...current, [device.name]: device.accessKey }));
  };

  const handleToggleMute = async () => {
    setShowActionsMenu(false);
    const next = !muted;
    setMuted(next);
    try {
      await muteConversation(apiBaseUrl, conversationId, next, token);
    } catch (err: any) {
      setMuted(!next);
      setError(err?.message || t('Could not update notification settings.'));
    }
  };

  return (
    <SafeAreaView
      style={styles.screen}
      // While the keyboard is up it already covers the bottom inset; keeping the
      // padding leaves a dead band between the composer and the keys.
      edges={keyboardOpen ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={'padding'}
      >
      <View style={styles.header}>
        <Pressable style={styles.headerLeft} onPress={onBack} hitSlop={10}>
          <Feather name="arrow-left" size={20} color="#111315" />
          <Text style={[styles.headerTitle, textSize(18)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>{t('Chat')}</Text>
        </Pressable>
      </View>

      <View
        style={styles.contactBar}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          setContactBarBottom(y + height);
        }}
      >
        <View style={styles.contactInfo}>
          <View style={styles.avatar}>
            <Text style={[styles.avatarText, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {initialsOf(conversationName)}
            </Text>
            {contactOnline ? <View style={styles.onlineDot} /> : null}
          </View>
          <Pressable style={styles.contactNameWrap} onPress={() => setShowProfile(true)}>
            <Text
              style={[styles.contactName, textSize(15)]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {conversationName}
            </Text>
            <Text
              style={[styles.contactStatus, textSize(12), contactOnline && styles.contactStatusOnline]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {contactOnline ? t('Online') : lastSeenLabel(contactLastSeen, t)}
            </Text>
          </Pressable>
        </View>
        <View style={styles.contactActions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => { setSearchOpen((v) => !v); setSearchQuery(''); }}
            hitSlop={8}
          >
            <Feather name="search" size={20} color="#111315" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setShowActionsMenu((v) => !v)} hitSlop={8}>
            <Feather name="more-vertical" size={22} color="#111315" />
          </Pressable>
        </View>
      </View>

      {searchOpen && !isPending && !isBlocked ? (
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="rgba(17,19,21,0.4)" />
          <TextInput
            autoFocus
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('Search messages')}
            placeholderTextColor="rgba(17,19,21,0.4)"
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            style={[styles.searchInput, textSize(14)]}
          />
          {searchQuery ? (
            <Pressable hitSlop={8} onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="rgba(17,19,21,0.4)" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showActionsMenu ? (
        <>
        <Pressable style={styles.menuBackdrop} onPress={() => setShowActionsMenu(false)} />
        <View
          style={[
            styles.actionsMenu,
            // Hang below the measured chrome (which grows with the OS font size)
            // rather than a constant, and never wider than the window allows.
            { top: Math.max(96, contactBarBottom), maxWidth: Math.max(188, Math.min(280, windowWidth - 24)) },
          ]}
        >
          <Pressable style={styles.sessionOptionRow} onPress={handleToggleMute}>
            <Feather name={muted ? 'bell' : 'bell-off'} size={16} color="#111315" />
            <Text style={[styles.sessionOptionText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {muted ? t('Unmute notifications') : t('Mute notifications')}
            </Text>
          </Pressable>
          <Pressable
            style={styles.sessionOptionRow}
            onPress={() => runConversationAction(() => blockConversation(apiBaseUrl, conversationId, token))}
          >
            <Feather name="slash" size={16} color="#111315" />
            <Text style={[styles.sessionOptionText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Block')}
            </Text>
          </Pressable>
          <Pressable
            style={styles.sessionOptionRow}
            onPress={() => runConversationAction(() => unfriendConversation(apiBaseUrl, conversationId, token))}
          >
            <Feather name="user-x" size={16} color="#111315" />
            <Text style={[styles.sessionOptionText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Unfriend')}
            </Text>
          </Pressable>
          <Pressable
            style={styles.sessionOptionRow}
            onPress={() => runConversationAction(() => deleteConversation(apiBaseUrl, conversationId, token))}
          >
            <Feather name="trash-2" size={16} color="#FF383C" />
            <Text
              style={[styles.sessionOptionText, textSize(14), styles.destructiveText]}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {t('Delete chat')}
            </Text>
          </Pressable>
        </View>
        </>
      ) : null}

      <View style={styles.divider} />

      {isPending ? (
        <PendingInvitation
          name={conversationName}
          isRequester={isRequester}
          submitting={inviteSubmitting}
          error={inviteError}
          onAccept={handleAcceptInvite}
          onDecline={handleDeclineInvite}
        />
      ) : isBlocked ? (
        <View style={styles.blockedView}>
          <View style={styles.blockedIcon}>
            <Feather name="slash" size={28} color="#FF383C" />
          </View>
          <Text style={[styles.blockedTitle, textSize(18)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {isBlockedByMe ? t('Contact blocked') : t('Chat unavailable')}
          </Text>
          <Text style={[styles.blockedText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {isBlockedByMe
              ? `${t('You blocked')} ${conversationName}. ${t('Unblock to exchange messages again.')}`
              : t('You can no longer message in this conversation.')}
          </Text>
          {isBlockedByMe ? (
            <Pressable style={styles.blockedButton} onPress={handleUnblock} disabled={actionBusy}>
              {actionBusy ? (
                <ActivityIndicator size="small" color="#111315" />
              ) : (
                <Text style={[styles.blockedButtonText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {t('Unblock')}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : (
      <>
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#FF8A00" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : rendered.length === 0 ? (
          <Text style={styles.emptyText}>{t('No messages yet. Say hello 👋')}</Text>
        ) : (
          rendered.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isMine={message.senderId === selfId}
              seen={!message.pending && latestReadAt >= new Date(message.createdAt).getTime()}
              apiBaseUrl={apiBaseUrl}
              onSwipeReply={() => setReplyTarget(message)}
              onLongPress={() => setActionSheet(message)}
              onReact={(emoji) => handleReactToMessage(message.id, emoji)}
              onOpenImage={openImageViewer}
              onOpenDevice={onOpenDevice}
              onJoinMeeting={onJoinMeeting}
              onRemoteSessionInfo={() => setRemoteInfoOpen(true)}
              onCopyCode={(code) => {
                Clipboard.setStringAsync(code);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 1500);
              }}
            />
          ))
        )}
        {typingUser ? (
          <Text style={[styles.typingText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {`${typingUser} ${t('is typing…')}`}
          </Text>
        ) : null}
      </ScrollView>

      {showSessionOptions ? (
        <View style={styles.composerMenu}>
          <Pressable style={styles.sessionOptionRow} onPress={handlePickImage}>
            <Feather name="image" size={16} color="#111315" />
            <Text style={[styles.sessionOptionText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Photo')}
            </Text>
          </Pressable>
          <Pressable style={styles.sessionOptionRow} onPress={handleStartMeeting}>
            <Feather name="video" size={16} color="#111315" />
            <Text style={[styles.sessionOptionText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Meeting session')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {attachmentSending ? (
        <View style={styles.attachmentSendingRow}>
          <ActivityIndicator size="small" color="#FF8A00" />
          <Text style={[styles.attachmentSendingText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
            {t('Sending photo…')}
          </Text>
        </View>
      ) : null}

      {replyTarget ? (
        <View style={styles.replyBar}>
          <View style={styles.replyBarBody}>
            <Text
              style={[styles.replyBarTitle, textSize(12)]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {t('Replying to')} {replyTarget.sender?.name || (replyTarget.senderId === selfId ? t('yourself') : t('message'))}
            </Text>
            <Text
              style={[styles.replyBarText, textSize(12)]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {replyTarget.content || replyTarget.attachmentName || t('Attachment')}
            </Text>
          </View>
          <Pressable hitSlop={8} onPress={() => setReplyTarget(null)}>
            <Feather name="x" size={18} color="#858687" />
          </Pressable>
        </View>
      ) : null}

      {editingMessage ? (
        <View style={styles.replyBar}>
          <View style={styles.replyBarBody}>
            <Text
              style={[styles.replyBarTitle, textSize(12)]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {t('Editing message')}
            </Text>
            <Text
              style={[styles.replyBarText, textSize(12)]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {editingMessage.content}
            </Text>
          </View>
          <Pressable hitSlop={8} onPress={() => { setEditingMessage(null); setInput(''); }}>
            <Feather name="x" size={18} color="#858687" />
          </Pressable>
        </View>
      ) : null}

      {mentionSuggestions.length > 0 ? (
        <View style={styles.mentionBar}>
          {mentionSuggestions.map((device) => (
            <Pressable key={device.accessKey} style={styles.mentionRow} onPress={() => insertMention(device)}>
              <Feather name="monitor" size={14} color="#FF8A00" />
              <Text
                style={[styles.mentionName, textSize(13)]}
                numberOfLines={1}
                ellipsizeMode="middle"
                maxFontSizeMultiplier={maxFontSizeMultiplier}
              >
                {device.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.composer}>
        <Pressable
          style={styles.plusButton}
          onPress={() => setShowSessionOptions((v) => !v)}
          hitSlop={8}
        >
          <Feather name="plus" size={22} color="#111315" />
        </Pressable>
        <View style={[styles.messageInputWrap, { maxHeight: Math.round(120 * Math.max(1, cappedFontScale)) }]}>
          <TextInput
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            style={[styles.messageInput, textSize(13)]}
            value={input}
            onChangeText={handleInputChange}
            placeholder={t('Type your message here..')}
            placeholderTextColor="#858687"
            multiline
            onSubmitEditing={handleSend}
          />
        </View>
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={!input.trim()}>
          <Feather name="send" size={18} color={input.trim() ? '#FF8A00' : '#858687'} />
        </Pressable>
      </View>
      </>
      )}
      </KeyboardAvoidingView>

      {/* Contact profile modal (tap the name) — mirrors the desktop card. */}
      <Modal visible={showProfile} transparent animationType="fade" onRequestClose={() => setShowProfile(false)}>
        <Pressable style={styles.profileBackdrop} onPress={() => setShowProfile(false)}>
          <ResponsivePanel style={styles.profileCard} onPress={() => {}}>
            <Pressable style={styles.profileClose} hitSlop={8} onPress={() => setShowProfile(false)}>
              <Feather name="x" size={20} color="#111315" />
            </Pressable>
            <View style={styles.profileAvatar}>
              <Text style={[styles.profileAvatarText, textSize(30)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {initialsOf(conversationName)}
              </Text>
              <View style={[styles.profileDot, contactOnline ? styles.profileDotOnline : styles.profileDotOffline]} />
            </View>
            <Text style={[styles.profileName, textSize(20)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {conversationName}
            </Text>
            {otherEmail ? (
              <Text style={[styles.profileEmail, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {otherEmail}
              </Text>
            ) : null}
            <View style={styles.profileStats}>
              <View style={styles.profileStat}>
                <Text style={[styles.profileStatValue, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {t('Direct')}
                </Text>
                <Text style={[styles.profileStatLabel, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {t('Chat')}
                </Text>
              </View>
              <View style={styles.profileStat}>
                <Text style={[styles.profileStatValue, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {contactOnline ? t('Active') : t('Away')}
                </Text>
                <Text
                  style={[styles.profileStatLabel, textSize(12), contactOnline && styles.contactStatusOnline]}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                >
                  {contactOnline ? t('Online') : lastSeenLabel(contactLastSeen, t)}
                </Text>
              </View>
            </View>
          </ResponsivePanel>
        </Pressable>
      </Modal>

      {/* Full-screen gallery viewer: tap any photo, swipe between all photos
          in the conversation, spinner until each image loads. */}
      <Modal visible={viewerIndex !== null} transparent animationType="fade" onRequestClose={closeImageViewer}>
        <View style={styles.viewerBackdrop}>
          <FlatList
            ref={galleryRef}
            data={galleryImages}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.min(viewerIndex ?? 0, Math.max(galleryImages.length - 1, 0))}
            getItemLayout={(_, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
            keyExtractor={(item, index) => `${item.url}-${index}`}
            renderItem={({ item }) => <GalleryPage uri={item.url} width={windowWidth} onClose={closeImageViewer} />}
            onMomentumScrollEnd={(e) =>
              setViewerPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(windowWidth, 1)))
            }
            onScrollToIndexFailed={() => {}}
            showsHorizontalScrollIndicator={false}
          />
          <Pressable
            style={[
              styles.viewerClose,
              // The viewer draws under the system bars (edgeToEdgeEnabled), so
              // clear the cutout/nav insets — never tighter than the design.
              { top: Math.max(48, insets.top + 12), right: Math.max(24, insets.right + 16) },
            ]}
            hitSlop={10}
            onPress={closeImageViewer}
          >
            <Feather name="x" size={26} color="#FFFFFF" />
          </Pressable>
          {galleryImages.length > 1 ? (
            <View
              style={[styles.viewerCounter, { bottom: Math.max(40, insets.bottom + 16) }]}
              pointerEvents="none"
            >
              <Text
                style={[styles.viewerCounterText, textSize(13)]}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
              >
                {Math.min(viewerPage + 1, galleryImages.length)} / {galleryImages.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Remote-session invites can't be started from the phone. */}
      <Modal visible={remoteInfoOpen} transparent animationType="fade" onRequestClose={() => setRemoteInfoOpen(false)}>
        <Pressable style={styles.profileBackdrop} onPress={() => setRemoteInfoOpen(false)}>
          <ResponsivePanel style={styles.remoteInfoCard} onPress={() => {}}>
            <View style={styles.remoteInfoIcon}>
              <Feather name="monitor" size={26} color="#FF8A00" />
            </View>
            <Text style={[styles.remoteInfoTitle, textSize(18)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Open on your computer')}
            </Text>
            <Text style={[styles.remoteInfoText, type(14, 20 / 14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Remote sessions run on a desktop. Please open the Remote 365 app on your desktop or laptop and sign in there to start this remote session.')}
            </Text>
            <Pressable style={styles.remoteInfoButton} onPress={() => setRemoteInfoOpen(false)}>
              <Text style={[styles.remoteInfoButtonText, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {t('Got it')}
              </Text>
            </Pressable>
          </ResponsivePanel>
        </Pressable>
      </Modal>

      {/* Custom message action sheet (replaces the OS alert). */}
      <Modal visible={!!actionSheet} transparent animationType="fade" onRequestClose={() => setActionSheet(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionSheet(null)}>
          <ResponsivePanel style={[styles.actionSheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.actionSheetGrab} />
            <View style={styles.reactionPickerRow}>
              {REACTION_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[styles.reactionPickerButton, circle(36)]}
                  onPress={() => {
                    const target = actionSheet;
                    setActionSheet(null);
                    if (target) void handleReactToMessage(target.id, emoji);
                  }}
                >
                  <Text
                    style={[styles.reactionPickerEmoji, type(19, 24 / 19)]}
                    maxFontSizeMultiplier={maxFontSizeMultiplier}
                  >
                    {emoji}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.actionSheetRow}
              onPress={() => {
                const target = actionSheet;
                setActionSheet(null);
                if (target) setReplyTarget(target);
              }}
            >
              <Feather name="corner-up-left" size={18} color="#111315" />
              <Text style={[styles.actionSheetText, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {t('Reply')}
              </Text>
            </Pressable>
            {actionSheet
              && actionSheet.senderId === selfId
              && !actionSheet.deletedAt
              && !actionSheet.pending
              && actionSheet.content
              && !parseSessionInvite(actionSheet.content) ? (
              <Pressable
                style={styles.actionSheetRow}
                onPress={() => {
                  const target = actionSheet;
                  setActionSheet(null);
                  setReplyTarget(null);
                  setEditingMessage(target);
                  setInput(target.content || '');
                }}
              >
                <Feather name="edit-3" size={18} color="#111315" />
                <Text style={[styles.actionSheetText, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {t('Edit')}
                </Text>
              </Pressable>
            ) : null}
            {actionSheet && canDeleteMessage(actionSheet, actionSheet.senderId === selfId) ? (
              <Pressable
                style={styles.actionSheetRow}
                onPress={() => {
                  const id = actionSheet.id;
                  setActionSheet(null);
                  handleDeleteMessage(id);
                }}
              >
                <Feather name="trash-2" size={18} color="#FF383C" />
                <Text
                  style={[styles.actionSheetText, textSize(15), styles.destructiveText]}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                >
                  {t('Delete for everyone')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.actionSheetRow, styles.actionSheetCancel]} onPress={() => setActionSheet(null)}>
              <Text style={[styles.actionSheetCancelText, textSize(15)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {t('Cancel')}
              </Text>
            </Pressable>
          </ResponsivePanel>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// One page of the full-screen gallery: centered image with a spinner overlay
// until the bitmap has actually decoded. Tapping the page closes the viewer.
function GalleryPage({ uri, width, onClose }: { uri: string; width: number; onClose: () => void }) {
  const [imageLoading, setImageLoading] = useState(true);
  return (
    <Pressable style={[styles.galleryPage, { width }]} onPress={onClose}>
      <Image
        source={{ uri }}
        style={styles.viewerImage}
        resizeMode="contain"
        onLoadStart={() => setImageLoading(true)}
        onLoad={() => setImageLoading(false)}
        onError={() => setImageLoading(false)}
      />
      {imageLoading ? (
        <View style={styles.galleryLoader} pointerEvents="none">
          <ActivityIndicator size="large" color="#FF8A00" />
        </View>
      ) : null}
    </Pressable>
  );
}

// Renders a chat image at its true aspect ratio (so the whole photo is visible).
// Shows immediately at a default size, then adjusts to the real aspect on load.
function ChatImage({ uri, onPress, onLongPress }: { uri: string; onPress: () => void; onLongPress?: () => void }) {
  const { width: screenW } = useWindowDimensions();
  // The photo has to fit the bubble's own content box, not an unrelated
  // fraction of the screen: bubbleWrap is 64% of the list content width
  // (screen − 2×16 list padding) and the image-only bubble pads 4dp a side.
  // Below ~373dp the old 0.58 rule was wider than that box and `overflow:
  // hidden` sliced the right edge off every received photo.
  const MAX_W = Math.min(210, Math.floor((screenW - 32) * 0.64) - 8);
  const MAX_H = 240;
  const [ratio, setRatio] = useState(1);
  const width = MAX_W;
  let height = Math.round(MAX_W / ratio);
  if (height > MAX_H) height = MAX_H;
  if (height < 110) height = 110;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={300}>
      <Image
        source={{ uri }}
        style={{ width, height, borderRadius: 10, backgroundColor: '#00000010' }}
        resizeMode="cover"
        onLoad={(e) => {
          const src = (e.nativeEvent as any)?.source;
          if (src?.width && src?.height) setRatio(src.width / src.height);
        }}
      />
    </Pressable>
  );
}

// Message text with "@[Name](device:KEY)" tokens rendered as tappable device
// mentions (tap → connect), same token format the desktop chat uses.
function renderWithDeviceMentions(
  content: string,
  isMine: boolean,
  onOpenDevice?: (device: { name: string; accessKey: string }) => void,
): React.ReactNode {
  const regex = new RegExp(DEVICE_MENTION_REGEX.source, 'g');
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    const [, name, accessKey] = match;
    parts.push(
      <Text
        key={`mention-${key++}`}
        style={[styles.mentionToken, isMine && styles.mentionTokenMine]}
        onPress={() => onOpenDevice?.({ name, accessKey })}
      >
        @{name}
      </Text>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (parts.length === 0) return content;
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

function MessageBubble({
  message,
  isMine,
  seen,
  apiBaseUrl,
  onSwipeReply,
  onLongPress,
  onReact,
  onOpenImage,
  onJoinMeeting,
  onRemoteSessionInfo,
  onCopyCode,
  onOpenDevice,
}: {
  message: ChatMessage;
  isMine: boolean;
  seen: boolean;
  apiBaseUrl: string;
  onSwipeReply?: () => void;
  onLongPress?: () => void;
  onReact?: (emoji: string) => void;
  onOpenImage?: (uri: string) => void;
  onJoinMeeting?: (code: string) => void;
  onRemoteSessionInfo?: () => void;
  onCopyCode?: (code: string) => void;
  onOpenDevice?: (device: { name: string; accessKey: string }) => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const { type, textSize, maxFontSizeMultiplier } = useResponsive();
  const { t } = useTranslation();
  // Same 64% of the list content box the stylesheet used, but with a ceiling so
  // a tablet/unfolded foldable does not stretch a one-line bubble to 650dp.
  const bubbleMaxWidth = Math.min((screenW - 32) * 0.64, 420);
  const invite = parseSessionInvite(message.content);
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isImage = String(message.attachmentType || '').startsWith('image/');
  const imageOnly = isImage && !!message.attachmentUrl && !message.content && !message.replyTo;
  const swipeable = !message.deletedAt && !message.pending && !!onSwipeReply;
  const reactionEntries = Object.entries(message.reactions || {}).filter(([, userIds]) => userIds.length > 0);

  // WhatsApp-style swipe to reply: drag the bubble sideways past a threshold.
  const translateX = useRef(new Animated.Value(0)).current;
  const triggeredRef = useRef(false);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          swipeable && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderMove: (_evt, g) => {
          const dx = Math.max(-90, Math.min(90, g.dx));
          translateX.setValue(dx);
          if (!triggeredRef.current && Math.abs(g.dx) > 62) {
            triggeredRef.current = true;
            onSwipeReply?.();
          }
        },
        onPanResponderRelease: () => {
          triggeredRef.current = false;
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7, tension: 120 }).start();
        },
        onPanResponderTerminate: () => {
          triggeredRef.current = false;
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [swipeable, onSwipeReply, translateX],
  );

  const replyIconOpacity = translateX.interpolate({
    inputRange: [-70, -12, 0, 12, 70],
    outputRange: [1, 0, 0, 0, 1],
    extrapolate: 'clamp',
  });

  const replyPreview = message.replyTo
    ? humanizeDeviceMentions(String(message.replyTo.content || message.replyTo.attachmentName || t('Attachment')))
    : null;

  if (invite) {
    if (invite.kind === 'meeting-status' || invite.kind === 'remote-session-status') {
      return (
        <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text
              style={[styles.bubbleText, type(12, 16 / 12), isMine && styles.bubbleTextMine]}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {invite.text || t('Session status updated.')}
            </Text>
            <Text
              style={[styles.bubbleTime, textSize(10), isMine && styles.bubbleTimeMine]}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {time}
            </Text>
          </View>
        </View>
      );
    }

    if (invite.kind === 'meeting-invite-response') {
      return (
        <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text
              style={[styles.bubbleText, type(12, 16 / 12), isMine && styles.bubbleTextMine]}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {invite.responderName || t('Someone')}{' '}
              {invite.accepted ? t('accepted the meeting invite.') : t('declined the meeting invite.')}
            </Text>
            <Text
              style={[styles.bubbleTime, textSize(10), isMine && styles.bubbleTimeMine]}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {time}
            </Text>
          </View>
        </View>
      );
    }

    const isMeeting = invite.sessionType === 'VIDEO_MEETING';
    const code = invite.sessionCode || invite.code;
    // Invites carry the session's server-side expiry — render dead ones inert.
    const inviteExpired = Boolean(invite.expiresAt) && new Date(invite.expiresAt).getTime() <= Date.now();
    if (isMeeting) {
      return (
        <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          <View style={styles.meetingCard}>
            <View style={styles.meetingHeader}>
              <View style={styles.meetingIconBox}>
                <Feather name="video" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.meetingHeaderText}>
                <Text style={[styles.meetingTitle, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                  {t('Video meeting invite')}
                </Text>
                <Text
                  style={[styles.meetingSubtitle, textSize(12)]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                >
                  {invite.senderName ? `${invite.senderName} ${t('invited you')}` : t('You are invited')}
                </Text>
              </View>
            </View>
            <View style={styles.meetingBody}>
              <Text style={[styles.meetingLabel, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {t('Meeting')}
              </Text>
              <Text
                style={[styles.meetingName, textSize(14)]}
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
              >
                {invite.sessionName || 'Remote 365 meeting'}
              </Text>
              <Text style={[styles.meetingWaiting, textSize(10)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {inviteExpired ? t('This invite has expired') : t('Waiting for others')}
              </Text>
              {inviteExpired ? null : (
                <View style={styles.meetingActionsRow}>
                  <Pressable style={styles.meetingJoin} onPress={() => code && onJoinMeeting?.(String(code))}>
                    <Feather name="video" size={16} color="#FFFFFF" />
                    <Text style={[styles.meetingJoinText, textSize(14)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                      {t('Join')}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.meetingCopy} onPress={() => code && onCopyCode?.(String(code))}>
                    <Feather name="copy" size={16} color="rgba(26,29,33,0.7)" />
                  </Pressable>
                </View>
              )}
              <Text style={[styles.meetingTimeText, textSize(12)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
                {time}
              </Text>
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        <Pressable style={styles.inviteCard} onPress={() => onRemoteSessionInfo?.()}>
          <Feather name="monitor" size={18} color="#FF8A00" />
          <View style={styles.inviteBody}>
            <Text style={[styles.inviteText, textSize(13)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Remote session invite')}
            </Text>
            <Text style={[styles.inviteJoin, textSize(11)]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
              {t('Tap for details')}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      {swipeable ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.swipeReplyIcon,
            isMine ? styles.swipeReplyIconMine : styles.swipeReplyIconTheirs,
            { opacity: replyIconOpacity },
          ]}
        >
          <Feather name="corner-up-left" size={16} color="#FF8A00" />
        </Animated.View>
      ) : null}
      <Animated.View
        style={[styles.bubbleWrap, { maxWidth: bubbleMaxWidth, transform: [{ translateX }] }]}
        {...(swipeable ? panResponder.panHandlers : {})}
      >
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, imageOnly && styles.bubbleImageOnly]}
      >
        {replyPreview && !message.deletedAt ? (
          <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
            <Text
              style={[styles.replyQuoteName, textSize(11), isMine && styles.bubbleTextMine]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {message.replyTo?.sender?.name || t('Reply')}
            </Text>
            <Text
              style={[styles.replyQuoteText, textSize(12), isMine && styles.bubbleTextMine]}
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            >
              {replyPreview}
            </Text>
          </View>
        ) : null}
        {message.deletedAt ? (
          <Text
            style={[styles.bubbleText, type(12, 16 / 12), styles.deletedText, isMine && styles.bubbleTextMine]}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
          >
            {t('Message deleted')}
          </Text>
        ) : (
          <>
            {message.attachmentUrl ? (
              isImage ? (
                <ChatImage
                  uri={attachmentSrc(apiBaseUrl, message.attachmentUrl)}
                  onPress={() => onOpenImage?.(attachmentSrc(apiBaseUrl, message.attachmentUrl!))}
                  onLongPress={onLongPress}
                />
              ) : (
                <View style={styles.fileChip}>
                  <Feather name="file" size={14} color={isMine ? '#fff' : '#111315'} />
                  <Text
                    style={[styles.fileName, textSize(12), isMine && styles.bubbleTextMine]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={maxFontSizeMultiplier}
                  >
                    {message.attachmentName || t('Attachment')}
                  </Text>
                </View>
              )
            ) : null}
            {message.content ? (
              <Text
                style={[styles.bubbleText, type(12, 16 / 12), isMine && styles.bubbleTextMine]}
                maxFontSizeMultiplier={maxFontSizeMultiplier}
              >
                {renderWithDeviceMentions(message.content, isMine, onOpenDevice)}
              </Text>
            ) : null}
          </>
        )}
        <View style={styles.metaRow}>
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[styles.bubbleTime, textSize(10), isMine && styles.bubbleTimeMine]}
          >
            {time}
            {message.editedAt && !message.pending ? ` · ${t('edited')}` : ''}
          </Text>
          {isMine ? (
            message.pending ? (
              <Feather name="clock" size={12} color="rgba(255,255,255,0.85)" />
            ) : seen ? (
              // Seen — green double tick.
              <View style={styles.tickWrap}>
                <Feather name="check" size={12} color="#27AE60" style={styles.tickBack} />
                <Feather name="check" size={12} color="#27AE60" />
              </View>
            ) : (
              // Delivered — grey double tick.
              <View style={styles.tickWrap}>
                <Feather name="check" size={12} color="rgba(255,255,255,0.7)" style={styles.tickBack} />
                <Feather name="check" size={12} color="rgba(255,255,255,0.7)" />
              </View>
            )
          ) : null}
        </View>
        {reactionEntries.length > 0 ? (
          <View style={styles.reactionBar}>
            {reactionEntries.map(([emoji, userIds]) => (
              <Pressable key={emoji} style={styles.reactionChip} onPress={() => onReact?.(emoji)}>
                <Text
                  style={[styles.reactionChipText, type(11, 14 / 11)]}
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                >
                  {emoji} {userIds.length}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create(monaFontStyles({
  screen: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontWeight: '600', color: '#111315' },
  contactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  // flex/minWidth let a long conversation name give way instead of pushing the
  // search and ⋮ buttons off the right edge of the space-between row.
  contactInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  contactNameWrap: { flex: 1, minWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 138, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '600', color: '#FF8A00' },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#14AE5C',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contactName: { fontWeight: '600', color: '#111315' },
  contactStatus: { color: 'rgba(17, 19, 21, 0.5)', fontFamily: familyForWeight() },
  contactStatusOnline: { color: '#12B76A' },
  contactActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  iconButton: { padding: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2F5',
  },
  // paddingVertical (was 0) keeps descenders and the caret off the pill's edge
  // once the OS font grows; the row's minHeight absorbs it at 1.0x.
  searchInput: { flex: 1, color: '#111315', paddingVertical: 6, fontFamily: familyForWeight() },
  blockedView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  blockedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,56,60,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  blockedTitle: { fontWeight: '600', color: '#111315', textAlign: 'center' },
  blockedText: { color: 'rgba(17,19,21,0.6)', textAlign: 'center' },
  blockedButton: {
    marginTop: 8,
    height: 40,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedButtonText: { fontWeight: '500', color: '#111315' },
  swipeReplyIcon: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,138,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeReplyIconMine: { right: 8 },
  swipeReplyIconTheirs: { left: 8 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 2,
  },
  actionSheetGrab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26,29,33,0.2)',
    marginBottom: 10,
  },
  reactionPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  // Size/radius come from circle(36) inline so the button grows with the emoji
  // instead of clipping it; the values here are the 1.0x baseline.
  reactionPickerButton: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
  },
  // fontSize/lineHeight are supplied inline by type(19, 24 / 19) — RN scales
  // fontSize but not lineHeight, so a literal 24 here becomes a clipping box
  // as text grows.
  reactionPickerEmoji: { fontFamily: familyForWeight() },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionSheetText: { fontWeight: '500', color: '#111315' },
  actionSheetCancel: {
    justifyContent: 'center',
    marginTop: 6,
    backgroundColor: '#F3F4F6',
  },
  actionSheetCancelText: { fontWeight: '600', color: '#111315' },
  profileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  profileCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 6,
  },
  profileClose: { position: 'absolute', top: 12, right: 12, padding: 4 },
  profileAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,179,71,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  profileAvatarText: { fontWeight: '600', color: '#FF8A00' },
  profileDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileDotOnline: { backgroundColor: '#12B76A' },
  profileDotOffline: { backgroundColor: '#9AA0A6' },
  profileName: { fontWeight: '600', color: '#111315', textAlign: 'center' },
  profileEmail: { color: 'rgba(17,19,21,0.6)', textAlign: 'center' },
  profileStats: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  profileStat: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  profileStatValue: { fontWeight: '600', color: '#111315' },
  profileStatLabel: { color: 'rgba(17,19,21,0.6)', fontFamily: familyForWeight() },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: { position: 'absolute', top: 48, right: 24, zIndex: 2, padding: 6 },
  viewerImage: { width: '100%', height: '80%' },
  galleryPage: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCounter: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  viewerCounterText: { color: '#FFFFFF', fontWeight: '500' },
  mentionBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,29,33,0.08)',
    paddingVertical: 4,
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 38,
    paddingVertical: 8,
  },
  mentionName: { color: '#111315', flex: 1, minWidth: 0, fontFamily: familyForWeight() },
  mentionToken: { color: '#FF8A00', fontWeight: '600' },
  mentionTokenMine: { color: '#FFE1BC', textDecorationLine: 'underline' },
  remoteInfoCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  remoteInfoIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,138,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  remoteInfoTitle: { fontWeight: '600', color: '#111315', textAlign: 'center' },
  remoteInfoText: { color: 'rgba(17,19,21,0.6)', textAlign: 'center' },
  remoteInfoButton: {
    marginTop: 8,
    height: 42,
    alignSelf: 'stretch',
    borderRadius: 10,
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteInfoButtonText: { fontWeight: '600', color: '#FFFFFF' },
  sessionOptions: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26, 29, 33, 0.12)',
    overflow: 'hidden',
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  actionsMenu: {
    position: 'absolute',
    top: 96,
    right: 12,
    // minWidth (not width) so a scaled label widens the menu instead of
    // wrapping to three lines inside a fixed box; `top`/`maxWidth` are
    // overridden inline from the measured chrome height.
    minWidth: 188,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(26, 29, 33, 0.1)',
    overflow: 'hidden',
    zIndex: 50,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  sessionOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sessionOptionText: { fontWeight: '500', color: '#111315', flexShrink: 1 },
  destructiveText: { color: '#FF383C' },
  composerMenu: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26, 29, 33, 0.12)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F5',
  },
  attachmentSendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  attachmentSendingText: { color: 'rgba(17, 19, 21, 0.6)', fontFamily: familyForWeight() },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0F2F5',
    borderLeftWidth: 3,
    borderLeftColor: '#FF8A00',
    borderRadius: 8,
  },
  replyBarBody: { flex: 1 },
  replyBarTitle: { fontWeight: '600', color: '#FF8A00' },
  replyBarText: { color: 'rgba(17, 19, 21, 0.6)', fontFamily: familyForWeight() },
  replyQuote: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,138,0,0.8)',
    paddingLeft: 8,
    marginBottom: 4,
    opacity: 0.9,
  },
  replyQuoteMine: { borderLeftColor: 'rgba(255,255,255,0.8)' },
  replyQuoteName: { fontWeight: '600', color: '#FF8A00' },
  replyQuoteText: { color: 'rgba(17, 19, 21, 0.6)', fontFamily: familyForWeight() },
  divider: { height: 1, backgroundColor: 'rgba(26, 29, 33, 0.1)', marginTop: 8 },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 10 },
  centered: { paddingVertical: 40, alignItems: 'center' },
  errorText: { color: '#D92D20', textAlign: 'center', paddingVertical: 20 },
  emptyText: { color: 'rgba(17, 19, 21, 0.4)', textAlign: 'center', paddingVertical: 40 },
  typingText: { color: 'rgba(17, 19, 21, 0.5)', paddingLeft: 4, paddingTop: 4, fontFamily: familyForWeight() },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubbleWrap: { maxWidth: '64%' },
  bubble: { minWidth: 50, borderRadius: 12, paddingHorizontal: 11, paddingTop: 7, paddingBottom: 5, gap: 2, overflow: 'hidden' },
  bubbleImageOnly: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 4 },
  bubbleMine: { backgroundColor: '#FFB347' },
  bubbleTheirs: { backgroundColor: '#F3F4F6' },
  bubbleText: { color: '#111315', fontFamily: familyForWeight() },
  bubbleTextMine: { color: '#fff' },
  deletedText: { fontStyle: 'italic', opacity: 0.7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', maxWidth: '100%' },
  bubbleTime: { fontWeight: '500', color: 'rgba(17, 19, 21, 0.5)', flexShrink: 1, minWidth: 0 },
  bubbleTimeMine: { color: 'rgba(255, 255, 255, 0.85)' },
  reactionBar: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  reactionChip: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderColor: 'rgba(26,29,33,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionChipText: {
    color: '#111315',
    fontWeight: '600',
  },
  tickWrap: { flexDirection: 'row', width: 16, height: 12, alignItems: 'center', flexShrink: 0 },
  tickBack: { position: 'absolute', left: 4 },
  attachmentImage: { width: 224, height: 224, borderRadius: 10, backgroundColor: '#00000010' },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, flexShrink: 1 },
  // No maxWidth: the bubble's own cap already bounds the name, so it uses the
  // room it actually has instead of truncating at a constant 150dp.
  fileName: { fontWeight: '500', color: '#111315', flexShrink: 1, minWidth: 0 },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 138, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inviteBody: { gap: 1 },
  inviteText: { fontWeight: '600', color: '#B54708' },
  inviteJoin: { fontWeight: '500', color: '#FF8A00' },
  meetingCard: {
    // Was a hard 264: on a narrow window (small phone at Display size =
    // Largest, split-screen) that overflowed the list and cut off the Join /
    // copy-code controls. 100% of the row, capped at the design width.
    width: '100%',
    maxWidth: 264,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.7,
    borderColor: 'rgba(255, 179, 71, 0.4)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 179, 71, 0.12)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  meetingIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingHeaderText: { flex: 1 },
  meetingTitle: { fontWeight: '500', color: '#111315' },
  meetingSubtitle: { color: 'rgba(17, 19, 21, 0.7)', fontFamily: familyForWeight() },
  meetingBody: { padding: 16, gap: 4 },
  meetingLabel: { color: 'rgba(17, 19, 21, 0.7)', fontFamily: familyForWeight() },
  meetingName: { fontWeight: '500', color: '#111315', marginTop: 2 },
  meetingWaiting: { color: '#0088FF', marginTop: 2, fontFamily: familyForWeight() },
  meetingActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  meetingJoin: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#FF8A00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  meetingJoinText: { fontWeight: '500', color: '#FFFFFF' },
  meetingCopy: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingTimeText: {
    fontWeight: '500',
    color: 'rgba(26, 29, 33, 0.7)',
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 29, 33, 0.08)',
  },
  messageInputWrap: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    maxHeight: 120,
  },
  messageInput: { color: '#111315', paddingVertical: 4, fontFamily: familyForWeight() },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
