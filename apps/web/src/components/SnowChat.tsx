import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Plus, 
  Video, 
  Phone, 
  MoreHorizontal, 
  Smile, 
  CornerDownLeft,
  FileText,
  X,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Ban,
  UserMinus,
  Unlock,
  Users,
  UserPlus,
  Hash,
  Copy,
  CheckCircle2,
  CheckCheck,
  Monitor,
  Loader2,
  Clock,
  Bell,
  Reply,
  Pin,
  Pencil,
  Mic,
  Square,
  Zap,
  BellOff,
  Download,
  ChevronLeft,
  ChevronRight, Check } from 'lucide-react';
import { LottieScene } from './lottie/LottieScene';
import callAndVideoChatAnimation from '../assets/animations/callAndVideoChat.json';
import groupIcon from '../assets/group.svg';
import { PendingInvitation } from './PendingInvitation';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api, { getBaseURL } from '../lib/api';
import { translateStaticText } from '../lib/translations';
import { preferredAudioConstraints } from '../lib/mediaPreferences';
import { DEFAULT_SERVER_HOST } from '../utils/server';
import { buildWebMeetingUrl } from '../lib/meetingLinks';

const CHAT_FILTER_OPTIONS: { id: 'all' | 'unread' | 'direct' | 'groups' | 'online'; label: string }[] = [
  { id: 'all', label: 'All chats' },
  { id: 'unread', label: 'Unread' },
  { id: 'direct', label: 'Direct messages' },
  { id: 'groups', label: 'Groups' },
  { id: 'online', label: 'Online now' },
];

const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';

const parseSessionInviteContent = (content: string) => {
  if (!content?.startsWith(SESSION_INVITE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SESSION_INVITE_PREFIX.length));
  } catch {
    return null;
  }
};

// Device mentions travel inside the plain message text as
// "@[Device Name](device:ACCESSKEY)" and render as clickable device chips.
const DEVICE_MENTION_REGEX = /@\[([^\]\n]{1,80})\]\(device:([A-Za-z0-9]{4,24})\)/g;

// Sidebar previews / notifications show "@Device Name" instead of the raw token.
const stripDeviceMentionTokens = (text?: string | null) =>
  String(text || '').replace(DEVICE_MENTION_REGEX, '@$1');

const formatChatListTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - startOfMessageDay) / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatRemainingTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const SnowChat: React.FC<{
  setCurrentView?: (view: any) => void;
  localAuthKey?: string | null;
  devicePassword?: string;
  serverIP?: string;
  onJoinSessionInvite?: (code: string, password?: string) => void;
  onJoinMeeting?: (meetingId: string) => void;
  /** Account devices for @-mentions in the composer. */
  devices?: any[];
  /** Clicking a mentioned device connects to it. */
  onOpenDeviceMention?: (accessKey: string, name?: string) => void;
}> = ({ setCurrentView, localAuthKey, devicePassword, serverIP = DEFAULT_SERVER_HOST, onJoinSessionInvite, onJoinMeeting, devices = [], onOpenDeviceMention }) => {
  const { user } = useAuthStore();
  const tx = (text: string) => translateStaticText(text, user?.language);
  const { 
    conversations, 
    messages, 
    unreadCounts,
    readReceipts,
    activeChatId, 
    setActiveChat, 
    markRead,
    loadOlderMessages,
    hasMoreMessages,
    loadingOlder,
    fetchConversations, 
    createConversation, 
    createGroup,
    addGroupMembers,
    sendMessage,
    ingestMessage,
    renameConversation,
    deleteConversation,
    unfriendConversation,
    blockConversation,
    unblockConversation,
    acceptInvite,
    rejectInvite,
    isLoading,
    loadingMessages
  } = useChatStore();

  const [showAddContact, setShowAddContact] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'direct' | 'groups' | 'online'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  // Sidebar search (conversations by name / person, plus message text below).
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [debouncedSidebarSearch, setDebouncedSidebarSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSidebarSearch(sidebarSearch.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [sidebarSearch]);
  // Message text search across every conversation (server side), shown as a
  // "Messages" section under the conversation matches.
  const [messageHits, setMessageHits] = useState<any[]>([]);
  useEffect(() => {
    const term = debouncedSidebarSearch;
    if (term.length < 2) { setMessageHits([]); return; }
    let cancelled = false;
    api.get('/api/chat/messages/search', { params: { q: term } })
      .then(({ data }: any) => { if (!cancelled) setMessageHits(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setMessageHits([]); });
    return () => { cancelled = true; };
  }, [debouncedSidebarSearch]);
  const [addMode, setAddMode] = useState<'contact' | 'group'>('contact');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState('');
  const [memberEmails, setMemberEmails] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');
  const [sessionType, setSessionType] = useState<'REMOTE_CONTROL' | 'VIDEO_MEETING'>('REMOTE_CONTROL');
  const [sessionInviteEmail, setSessionInviteEmail] = useState('');
  const [sessionName, setSessionName] = useState('Remote support session');
  const [sessionInviteStatus, setSessionInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sessionInviteMessage, setSessionInviteMessage] = useState('');
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [accessApprovalRequest, setAccessApprovalRequest] = useState<any | null>(null);
  const [accessDurationMinutes, setAccessDurationMinutes] = useState(30);
  const [selectedActionUserIds, setSelectedActionUserIds] = useState<string[]>([]);
  const [chatToast, setChatToast] = useState<{ title: string; body: string; chatId: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  // Devices picked via "@" in this draft: display name -> access key. On send,
  // each "@Name" in the text is encoded to the clickable mention token.
  const [mentionedDevices, setMentionedDevices] = useState<Record<string, string>>({});
  const typingUsers = useChatStore((s) => s.typingUsers);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const lastSeenByUser = useChatStore((s) => s.lastSeenByUser);
  // Absolute origin for attachment URLs — <img>/<audio> tags need a full URL
  // (api.defaults.baseURL is unset; axios resolves it per-request instead).
  const [fileBaseUrl, setFileBaseUrl] = useState('');
  useEffect(() => { getBaseURL().then(setFileBaseUrl).catch(() => {}); }, []);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; name: string; type: string; size: number } | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showCannedReplies, setShowCannedReplies] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [mutedByMe, setMutedByMe] = useState(false);
  const [usePcLoadingId, setUsePcLoadingId] = useState<string | null>(null);
  const [isApprovingAccess, setIsApprovingAccess] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  // In-app image lightbox / media player (replaces opening images in an OS window)
  const [imageViewer, setImageViewer] = useState<{ images: { url: string; name: string }[]; index: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const inviteSubmitRef = useRef(false);

  useEffect(() => {
    fetchConversations();
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeMessages = activeChatId ? (messages[activeChatId] || []) : [];
  const visibleMessages = searchQuery.trim()
    ? activeMessages.filter((m: any) => !m.deletedAt && String(m.content || m.attachmentName || '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : activeMessages;

  // Open the in-app image viewer. Builds a gallery from every image in the
  // conversation (in order) so the arrows step through them like a media player,
  // starting on the one that was clicked.
  const openImageViewer = (clickedUrl: string) => {
    const images = activeMessages
      .filter((m: any) => !m.deletedAt && m.attachmentUrl && String(m.attachmentType || '').startsWith('image/'))
      .map((m: any) => ({ url: `${fileBaseUrl}${m.attachmentUrl}`, name: m.attachmentName || 'image' }));
    if (images.length === 0) return;
    const idx = Math.max(0, images.findIndex((i) => i.url === clickedUrl));
    setImageViewer({ images, index: idx });
  };

  // Keyboard controls for the viewer: ←/→ to navigate, Esc to close.
  useEffect(() => {
    if (!imageViewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImageViewer(null);
      else if (e.key === 'ArrowRight') setImageViewer((v) => (v ? { ...v, index: (v.index + 1) % v.images.length } : v));
      else if (e.key === 'ArrowLeft') setImageViewer((v) => (v ? { ...v, index: (v.index - 1 + v.images.length) % v.images.length } : v));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imageViewer]);

  // Search / edit / reply state is per-conversation.
  useEffect(() => {
    setSearchQuery('');
    setShowSearchBar(false);
    setEditingMessage(null);
    setReplyTarget(null);
    setReactionPickerFor(null);
    const me = (activeConversation?.participants || []).find((p: any) => p.userId === user?.id);
    setMutedByMe(Boolean((me as any)?.muted));
  }, [activeChatId]);
  const isActiveChatLoading = Boolean(activeChatId && loadingMessages[activeChatId]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  useEffect(() => {
    if (activeChatId) markRead(activeChatId);
  }, [activeChatId, activeMessages.length]);

  useEffect(() => {
    if (!chatToast) return;
    const timeout = setTimeout(() => setChatToast(null), 4500);
    return () => clearTimeout(timeout);
  }, [chatToast]);

  // Auto-clear actionStatus after a few seconds so stale messages don't linger
  useEffect(() => {
    if (!actionStatus) return;
    const timeout = setTimeout(() => setActionStatus(''), 5000);
    return () => clearTimeout(timeout);
  }, [actionStatus]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        emojiPickerRef.current && !emojiPickerRef.current.contains(target) &&
        emojiButtonRef.current && !emojiButtonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [showEmojiPicker]);

  const matchesSearch = (c: any) => {
    if (!debouncedSidebarSearch) return true;
    const people = (c.participants || []).map((p: any) => `${p.user?.name || ''} ${p.user?.email || ''}`);
    return [c.name, ...people].filter(Boolean).join(' ').toLowerCase().includes(debouncedSidebarSearch);
  };
  const passesChatFilter = (c: any) => {
    if (chatFilter === 'unread') return (unreadCounts[c.id] || 0) > 0;
    if (chatFilter === 'direct') return !c.isGroup;
    if (chatFilter === 'groups') return !!c.isGroup;
    if (chatFilter === 'online') {
      if (c.isGroup) return false;
      const myId = useAuthStore.getState().user?.id;
      return (c.participants || []).some((p: any) => p.userId !== myId && !!onlineUsers[p.userId]);
    }
    return true;
  };
  const matchesFilter = (c: any) => passesChatFilter(c) && matchesSearch(c);
  const groups = conversations.filter(c => c.isGroup && matchesFilter(c));
  const directChats = conversations.filter(c => !c.isGroup && matchesFilter(c));
  const hasSearchResults = groups.length > 0 || directChats.length > 0 || messageHits.length > 0;

  const activeConversation = conversations.find(c => c.id === activeChatId);
  const isInviteRequester = activeConversation?.requestedById
    ? activeConversation.requestedById === user?.id
    : activeConversation?.participants?.[0]?.userId === user?.id;
  const isBlockedByMe = activeConversation?.status === 'BLOCKED' && activeConversation.blockedById === user?.id;

  // --- Device @mentions in the composer ---

  // The "@query" currently being typed: an @ at the start or after whitespace,
  // with everything after it (device names may contain spaces). The picker only
  // shows while at least one device still matches, so normal sentences with an
  // email address or a lone @ don't keep it open.
  const mentionMatch = /(^|\s)@([^@\n]{0,40})$/.exec(inputText);
  const mentionQuery = mentionMatch ? mentionMatch[2] : null;
  const mentionCandidates = mentionQuery === null ? [] : (devices || [])
    .filter((device: any) => {
      const key = String(device.access_key || '').replace(/\s/g, '');
      if (!key) return false;
      const name = String(device.device_name || device.name || '').toLowerCase();
      const query = mentionQuery.trim().toLowerCase();
      return !query || name.includes(query) || key.includes(query.replace(/\s/g, ''));
    })
    .slice(0, 6);

  const selectMentionDevice = (device: any) => {
    const key = String(device.access_key || '').replace(/\s/g, '');
    const name = String(device.device_name || device.name || key).trim();
    if (!key || !name) return;
    setInputText((current) => current.replace(/(^|\s)@([^@\n]{0,40})$/, `$1@${name} `));
    setMentionedDevices((current) => ({ ...current, [name]: key }));
  };

  // Replace each picked "@Name" with the structured token other clients render
  // as a clickable device chip. Longest names first so overlapping names nest safely.
  const encodeDeviceMentions = (text: string) => {
    let out = text;
    for (const [name, key] of Object.entries(mentionedDevices).sort((a, b) => b[0].length - a[0].length)) {
      out = out.split(`@${name}`).join(`@[${name}](device:${key})`);
    }
    return out;
  };

  // Message text with "@[Name](device:KEY)" tokens rendered as clickable
  // device chips; clicking one starts a remote session to that device.
  const renderMessageContent = (content: string, isMe: boolean): React.ReactNode => {
    const regex = new RegExp(DEVICE_MENTION_REGEX.source, 'g');
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      if (match.index > cursor) parts.push(content.slice(cursor, match.index));
      const [token, name, key] = match;
      parts.push(
        <button
          key={`${key}-${match.index}`}
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenDeviceMention?.(key, name); }}
          title={`Connect to ${name}`}
          className={`inline-flex items-center gap-1 align-middle rounded-md px-1.5 py-0.5 mx-0.5 text-[13px] font-semibold transition-colors ${isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-[#FFF4E5] text-[#B54708] hover:bg-[#FFE8CC] dark:bg-white/10 dark:text-[#FFB347] dark:hover:bg-white/20'}`}
        >
          <Monitor size={12} className="shrink-0" />
          {name}
        </button>
      );
      cursor = match.index + token.length;
    }
    if (parts.length === 0) return content;
    if (cursor < content.length) parts.push(content.slice(cursor));
    return parts;
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !pendingAttachment) || !activeChatId) return;
    if (editingMessage) {
      const messageId = editingMessage.id;
      const content = encodeDeviceMentions(inputText.trim());
      setEditingMessage(null);
      setInputText('');
      try {
        const { data } = await api.patch(`/api/chat/messages/${messageId}`, { content });
        useChatStore.getState().applyMessageUpdate?.(activeChatId, data);
      } catch (err: any) {
        setActionStatus(err.response?.data?.error || 'Could not edit the message.');
      }
      return;
    }
    sendMessage(activeChatId, encodeDeviceMentions(inputText.trim()), {
      replyToId: replyTarget?.id,
      attachment: pendingAttachment || undefined
    });
    setInputText('');
    setMentionedDevices({});
    setReplyTarget(null);
    setPendingAttachment(null);
    useChatStore.getState().sendTyping?.(activeChatId, user?.name, false);
  };

  // --- Message actions (react / edit / delete / pin) ---
  const reactToMessage = async (messageId: string, emoji: string) => {
    setReactionPickerFor(null);
    if (!activeChatId) return;
    try {
      const { data } = await api.post(`/api/chat/messages/${messageId}/react`, { emoji });
      useChatStore.getState().applyMessageUpdate?.(activeChatId, data);
    } catch (err: any) {
      setActionStatus(err.response?.data?.error || 'Could not add the reaction.');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeChatId) return;
    try {
      const { data } = await api.delete(`/api/chat/messages/${messageId}`);
      useChatStore.getState().applyMessageUpdate?.(activeChatId, data);
    } catch (err: any) {
      setActionStatus(err.response?.data?.error || 'Could not delete the message.');
    }
  };

  const togglePinMessage = async (msg: any) => {
    if (!activeChatId) return;
    try {
      const { data } = await api.post(`/api/chat/messages/${msg.id}/pin`, { pinned: !msg.pinned });
      useChatStore.getState().applyMessageUpdate?.(activeChatId, data);
    } catch (err: any) {
      setActionStatus(err.response?.data?.error || 'Could not pin the message.');
    }
  };

  const startEditMessage = (msg: any) => {
    setEditingMessage(msg);
    setReplyTarget(null);
    setPendingAttachment(null);
    const raw = String(msg.content || '');
    // Show mentions as "@Name" while editing and remember their keys so the
    // edited message re-encodes them into clickable tokens on save.
    const regex = new RegExp(DEVICE_MENTION_REGEX.source, 'g');
    const found: Record<string, string> = {};
    let match: RegExpExecArray | null;
    while ((match = regex.exec(raw))) found[match[1]] = match[2];
    if (Object.keys(found).length) setMentionedDevices((current) => ({ ...current, ...found }));
    setInputText(stripDeviceMentionTokens(raw));
  };

  const applyConversationUpdate = (conversation: any) => {
    if (!conversation?.id) return;
    useChatStore.setState((state: any) => ({
      conversations: state.conversations.map((item: any) => item.id === conversation.id ? conversation : item)
    }));
  };

  const toggleMuteConversation = async () => {
    if (!activeChatId) return;
    const next = !mutedByMe;
    setMutedByMe(next);
    try {
      const { data } = await api.post(`/api/chat/conversations/${activeChatId}/mute`, { muted: next });
      applyConversationUpdate(data.conversation);
      setActionStatus(next ? 'Notifications muted for this chat.' : 'Notifications unmuted for this chat.');
    } catch (err: any) {
      setMutedByMe(!next);
      setActionStatus(err.response?.data?.error || 'Could not update mute preference.');
    }
  };

  // --- Voice notes (MediaRecorder → webm upload) ---
  const toggleVoiceRecording = async () => {
    if (isRecordingVoice) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: preferredAudioConstraints() });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecordingVoice(false);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size > 500) uploadAttachment(blob, `voice-note-${Date.now()}.webm`);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
    } catch {
      setActionStatus('Microphone is unavailable.');
    }
  };

  // WhatsApp-style document card helpers.
  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileBadge = (name?: string) => {
    const ext = String(name || '').split('.').pop()?.toUpperCase() || 'FILE';
    const color =
      ['PDF'].includes(ext) ? 'bg-[#F40F02]'
      : ['DOC', 'DOCX'].includes(ext) ? 'bg-[#2B579A]'
      : ['XLS', 'XLSX', 'CSV'].includes(ext) ? 'bg-[#217346]'
      : ['PPT', 'PPTX'].includes(ext) ? 'bg-[#D24726]'
      : ['ZIP', 'RAR', '7Z'].includes(ext) ? 'bg-[#F5A623]'
      : ['MP4', 'MOV', 'AVI', 'MKV'].includes(ext) ? 'bg-[#8E44AD]'
      : ['TXT', 'LOG', 'JSON', 'XML'].includes(ext) ? 'bg-[#607D8B]'
      : 'bg-[#7A7F87]';
    return { ext: ext.slice(0, 5), color };
  };

  const CANNED_REPLIES = [
    'Please share your Remote365 ID so I can connect.',
    'Can you restart the app and try again?',
    'I am connecting to your PC now — please accept the prompt.',
    'The issue is fixed. Please confirm on your side.',
    'I will follow up with you shortly.',
    'Could you send a screenshot of the error? (Ctrl+V pastes it here)'
  ];

  // --- Attachments (file picker, Ctrl+V screenshot paste, drag & drop) ---
  const uploadAttachment = async (file: File | Blob, name?: string) => {
    if (!activeChatId || isUploadingAttachment) return;
    const fileName = name || (file as File).name || `pasted-${Date.now()}.png`;
    if (file.size > 10 * 1024 * 1024) {
      setActionStatus('Files up to 10 MB are supported.');
      return;
    }
    setIsUploadingAttachment(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.post('/api/chat/uploads', {
        name: fileName,
        type: file.type || 'application/octet-stream',
        data: base64
      });
      setPendingAttachment({ url: data.url, name: data.name, type: data.type, size: data.size });
    } catch (err: any) {
      setActionStatus(err.response?.data?.error || 'Could not upload the file.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    const blob = item.getAsFile();
    if (blob) {
      e.preventDefault();
      uploadAttachment(blob, `screenshot-${Date.now()}.png`);
    }
  };

  // Throttled typing signal (max one every 2.5s while typing).
  const lastTypingSentRef = useRef(0);
  const notifyTyping = () => {
    if (!activeChatId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;
    useChatStore.getState().sendTyping?.(activeChatId, user?.name || undefined, true);
  };

  const addEmoji = (emoji: string) => {
    setInputText((current) => `${current}${emoji}`);
    setShowEmojiPicker(false);
  };

  const handleCreateChat = async () => {
    if (!inviteEmail.trim() || inviteSubmitRef.current) return;
    inviteSubmitRef.current = true;
    setIsInviting(true);
    setInviteError(null);
    try {
      const result = await createConversation(inviteEmail);
      if (result.success) {
        setShowAddContact(false);
        setInviteEmail('');
      } else {
        setInviteError(result.error === 'User not found'
          ? 'User not found. They must have a Remote365 account.'
          : result.error || 'Could not send the invitation.');
      }
    } finally {
      inviteSubmitRef.current = false;
      setIsInviting(false);
    }
  };

  const parseEmails = (value: string) => {
    return value
      .split(/[\s,;]+/)
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);
  };

  const handleCreateGroup = async () => {
    const emails = parseEmails(groupEmails);
    if (!groupName.trim() || emails.length === 0) return;
    setIsInviting(true);
    setInviteError(null);
    const success = await createGroup(groupName.trim(), emails);
    if (success) {
      setShowAddContact(false);
      setGroupName('');
      setGroupEmails('');
      setAddMode('contact');
    } else {
      setInviteError('Could not create group. Check that every email has a Remote365 account.');
    }
    setIsInviting(false);
  };

  const handleAddMembers = async () => {
    const emails = parseEmails(memberEmails);
    if (!activeChatId || emails.length === 0) return;
    setIsInviting(true);
    setInviteError(null);
    const success = await addGroupMembers(activeChatId, emails);
    if (success) {
      setShowAddMembersModal(false);
      setMemberEmails('');
    } else {
      setInviteError('Could not add members. Check that every email has a Remote365 account.');
    }
    setIsInviting(false);
  };

  // Helper to get the other participant in a 1-on-1 chat
  const getOtherParticipant = (conv: any) => {
    if (!conv || !conv.participants) return null;
    const other = conv.participants.find((p: any) => p.userId !== user?.id);
    console.log('[SnowChat] getOtherParticipant:', {
      convId: conv.id,
      myId: user?.id,
      participants: conv.participants.map((p: any) => p.userId),
      foundOther: other?.userId
    });
    if (other) return other.user;
    return conv.participants[0]?.user;
  };

  const getChatName = (chat: any) => {
    if (!chat) return 'Chat';
    
    // 1. Check for nickname in current user's participant record
    const myParticipant = chat.participants?.find((p: any) => p.userId === user?.id);
    if (myParticipant?.nickname) {
      console.log(`[SnowChat] Using nickname for ${chat.id}:`, myParticipant.nickname);
      return myParticipant.nickname;
    }

    // 2. Fallback to conversation name
    if (chat.name) return chat.name;

    // 3. Fallback to other participant's name
    const other = getOtherParticipant(chat);
    if (!other) {
      console.warn(`[SnowChat] No other participant found for ${chat.id}. Participants:`, chat.participants);
    }
    return other?.name || other?.email || 'Unknown Contact';
  };

  const activeParticipant = activeConversation && !activeConversation.isGroup ? getOtherParticipant(activeConversation) : null;
  const contactOnline = activeParticipant?.id
    ? Boolean(onlineUsers[activeParticipant.id] ?? activeConversation?.otherOnline)
    : false;
  const contactLastSeen = activeParticipant?.id ? lastSeenByUser[activeParticipant.id] : undefined;
  const contactStatusLabel = contactOnline
    ? 'Online'
    : (() => {
        if (!contactLastSeen) return 'Offline';
        const mins = Math.floor((Date.now() - new Date(contactLastSeen).getTime()) / 60000);
        if (Number.isNaN(mins)) return 'Offline';
        if (mins < 1) return 'Last seen just now';
        if (mins < 60) return `Last seen ${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Last seen ${hours}h ago`;
        return `Last seen ${Math.floor(hours / 24)}d ago`;
      })();
  const activeGroupMembers = activeConversation?.isGroup ? (activeConversation.participants || []) : [];
  const selectableGroupMembers = activeGroupMembers.filter((member: any) => member.userId !== user?.id);
  const sessionCodeGenerated = (localAuthKey || '').replace(/\s/g, '');
  const sessionLink = `remote365://join?code=${encodeURIComponent(sessionCodeGenerated)}&password=${encodeURIComponent(devicePassword || '')}`;

  useEffect(() => {
    if (!activeConversation?.isGroup) {
      setSelectedActionUserIds(activeParticipant?.id ? [activeParticipant.id] : []);
      return;
    }
    setSelectedActionUserIds(selectableGroupMembers.map((member: any) => member.userId));
  }, [activeChatId, activeConversation?.isGroup, activeParticipant?.id, selectableGroupMembers.length]);

  const createMeetingCode = () => {
    const raw = Math.floor(100000000 + Math.random() * 900000000).toString();
    return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}`;
  };

  const handleOpenSessionModal = () => {
    setSessionInviteEmail(activeConversation?.isGroup ? '' : (activeParticipant?.email || ''));
    setSessionName(activeConversation?.isGroup ? `${getChatName(activeConversation)} support session` : 'Remote support session');
    setSessionInviteStatus('idle');
    setSessionInviteMessage('');
    setShowSessionModal(true);
  };

  const sendStructuredChatMessage = (payload: any) => {
    if (!activeChatId) return;
    sendMessage(activeChatId, `${SESSION_INVITE_PREFIX}${JSON.stringify(payload)}`);
  };

  const getActionTargetUserIds = () => {
    if (activeConversation?.isGroup) return selectedActionUserIds;
    return activeParticipant?.id ? [activeParticipant.id] : [];
  };

  const handleQuickMeetingInvite = () => {
    if (!activeChatId) return;
    const targetUserIds = getActionTargetUserIds();
    if (activeConversation?.isGroup && targetUserIds.length === 0) {
      setActionStatus('Select at least one group member.');
      return;
    }
    const meetingCode = createMeetingCode();
    const meetingLink = buildWebMeetingUrl(meetingCode);
    // Send the invite over the chat socket so the card shows instantly, the same way the
    // remote-access request does, instead of waiting on an HTTP round-trip + rebroadcast.
    sendStructuredChatMessage({
      sessionType: 'VIDEO_MEETING',
      sessionName: `${getChatName(activeConversation)} meeting`,
      sessionCode: meetingCode,
      sessionPassword: '',
      sessionLink: meetingLink,
      senderName: user?.name || user?.email || 'Someone',
      targetUserIds,
      createdAt: new Date().toISOString()
    });
    setShowActionSheet(false);
    setActionStatus('Meeting invite sent.');
  };

  const handleRemoteAccessRequest = () => {
    if (!activeChatId) return;
    const targetUserIds = getActionTargetUserIds();
    if (activeConversation?.isGroup && targetUserIds.length === 0) {
      setActionStatus('Select at least one group member.');
      return;
    }
    sendStructuredChatMessage({
      kind: 'remote-access-request',
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      requesterId: user?.id,
      requesterName: user?.name || user?.email || 'Someone',
      targetUserIds,
      createdAt: new Date().toISOString()
    });
    setShowActionSheet(false);
    setActionStatus('');
  };

  const respondToRemoteAccessRequest = async (requestPayload: any, approved: boolean) => {
    if (!activeChatId) return;
    if (approved && !localAuthKey) {
      setActionStatus('Your device ID is not ready yet.');
      return;
    }
    if (approved && isApprovingAccess) return;
    try {
      if (approved) {
        setIsApprovingAccess(true);
        const duration = Math.max(1, Math.min(480, Number(accessDurationMinutes) || 15));
        const { data } = await api.post('/api/chat/remote-access-grants', {
          conversationId: activeChatId,
          requestId: requestPayload.requestId,
          requesterId: requestPayload.requesterId,
          durationMinutes: duration,
          sessionCode: String(localAuthKey || '').replace(/\s/g, ''),
          // Proves we control this machine even if the device record is owned
          // by a different signed-in account (server verifies against the hash).
          devicePassword: devicePassword || undefined
        });
        // Show the approval card immediately instead of waiting for the socket
        // rebroadcast to round-trip back through the server.
        if (data?.message) ingestMessage(activeChatId, data.message);
      } else {
        sendStructuredChatMessage({
          kind: 'remote-access-response',
          requestId: requestPayload.requestId,
          approverId: user?.id,
          approverName: user?.name || user?.email || 'Someone',
          approved: false,
          durationMinutes: 0,
          targetUserIds: requestPayload.requesterId ? [requestPayload.requesterId] : [],
          createdAt: new Date().toISOString()
        });
      }
      setAccessApprovalRequest(null);
      setActionStatus(approved ? 'Remote access approved.' : 'Remote access denied.');
    } catch (err: any) {
      setActionStatus(err.response?.data?.error || 'Could not update the remote access request.');
    } finally {
      setIsApprovingAccess(false);
    }
  };

  const respondToMeetingInvite = (invitePayload: any, accepted: boolean) => {
    sendStructuredChatMessage({
      kind: 'meeting-invite-response',
      remoteSessionId: invitePayload.remoteSessionId,
      sessionCode: invitePayload.sessionCode,
      responderId: user?.id,
      responderName: user?.name || user?.email || 'Someone',
      accepted,
      createdAt: new Date().toISOString()
    });
    setActionStatus(accepted ? 'Meeting invite accepted.' : 'Meeting invite declined.');
    if (accepted) onJoinMeeting?.(invitePayload.sessionCode);
  };

  const handleUseApprovedPc = async (sessionInvite: any) => {
    const accessKey = String(sessionInvite.sessionCode || '').replace(/\D/g, '');
    const inviteId = sessionInvite.requestId || sessionInvite.sessionCode || accessKey;
    if (!accessKey) {
      setActionStatus('The approved device ID is missing.');
      setChatToast({
        title: 'Could not open PC',
        body: 'The approved device ID is missing from this invite.',
        chatId: activeChatId || ''
      });
      return;
    }

    setUsePcLoadingId(inviteId);
    setActionStatus('Connecting to the approved PC...');

    try {
      if (!sessionInvite.remoteSessionId) throw new Error('This approval does not contain a secure access grant.');
      const { data } = await api.post(`/api/chat/remote-access-grants/${sessionInvite.remoteSessionId}/token`);
      if ((window as any).electronAPI?.openViewerWindow) {
        const opened = await (window as any).electronAPI.openViewerWindow(
          accessKey,
          serverIP,
          data.token,
          sessionInvite.approverName || 'Approved PC',
          'desktop'
        );
        if (opened === false) throw new Error('Viewer window did not open.');
        setChatToast({
          title: 'Opening remote PC',
          body: `Remote viewer is opening in a new window for ${sessionInvite.approverName || 'the approved PC'}.`,
          chatId: activeChatId || ''
        });
        setActionStatus('Remote viewer opened.');
      } else {
        onJoinSessionInvite?.(accessKey);
        setActionStatus('Switched to the connect view. Press Connect to join.');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Could not open the approved PC.';
      setActionStatus(message);
      setChatToast({
        title: 'Could not open PC',
        body: message,
        chatId: activeChatId || ''
      });
    } finally {
      setUsePcLoadingId(null);
    }
  };

  const handleSendSessionInvite = async () => {
    if (!activeChatId || (sessionType === 'REMOTE_CONTROL' && !sessionCodeGenerated)) {
      setSessionInviteStatus('error');
      setSessionInviteMessage('This device is still getting its Remote365 ID.');
      return;
    }

    setSessionInviteStatus('sending');
    setSessionInviteMessage('');
    try {
      const meetingCode = sessionType === 'VIDEO_MEETING' ? createMeetingCode() : sessionCodeGenerated;
      const inviteLink = sessionType === 'VIDEO_MEETING'
        ? buildWebMeetingUrl(meetingCode)
        : sessionLink;

      await api.post('/api/chat/session-invites', {
        conversationId: activeChatId,
        email: sessionInviteEmail.trim() || undefined,
        sessionName,
        sessionCode: meetingCode,
        sessionPassword: sessionType === 'VIDEO_MEETING' ? '' : devicePassword,
        sessionLink: inviteLink,
        type: sessionType
      });
      setSessionInviteStatus('sent');
      setSessionInviteMessage('Session invite sent in chat and by email.');
    } catch (err: any) {
      setSessionInviteStatus('error');
      setSessionInviteMessage(err.response?.data?.error || err.message || 'Could not send session invite.');
    }
  };

  if (isLoading && conversations.length === 0) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white dark:bg-[#080808] font-sans">
        <div className="flex flex-col items-center gap-5">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-[3px] border-[#FF8A00]/15" />
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#FF8A00] border-r-[#FFB347]" />
          </div>
          <span className="animate-pulse text-[15px] font-medium text-[#1A1D21]/50 dark:text-[#A0A0A0]">
            {tx('Loading chats...')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#080808] font-sans">
      {/* Left Sidebar */}
      <div className={`${activeChatId ? 'hidden sm:flex' : 'flex'} h-full w-full flex-shrink-0 flex-col border-r border-[rgba(26,29,33,0.3)] bg-white font-['Mona_Sans',system-ui,sans-serif] dark:border-white/5 dark:bg-[#0A0A0A] sm:w-[280px]`}>
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-5 sm:pt-6 flex flex-col gap-[30px]">
          {/* Header + Search */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-[18px] font-medium leading-[25px] text-black dark:text-[#F5F5F5]">{tx('Chats')}</h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu((open) => !open)}
                    className={`w-[18px] h-[18px] flex items-center justify-center text-[#111315] dark:text-[#A0A0A0] hover:text-[#FF8A00] transition-colors${showFilterMenu || chatFilter !== 'all' ? ' text-[#FF8A00]' : ''}`}
                    title={tx('Filter')}
                    aria-haspopup="menu"
                    aria-expanded={showFilterMenu}
                  >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.375 5.25H14.625M5.25 9H12.75M7.5 12.75H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  </button>
                  {showFilterMenu && (
                    <>
                      <button type="button" aria-label="Close" onClick={() => setShowFilterMenu(false)} className="fixed inset-0 z-[70] cursor-default" />
                      <div role="menu" className="absolute right-0 top-7 z-[80] w-44 overflow-hidden rounded-lg border border-[rgba(26,29,33,0.12)] bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#1C1C1C]">
                        {CHAT_FILTER_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={chatFilter === option.id}
                            onClick={() => { setChatFilter(option.id); setShowFilterMenu(false); }}
                            className={`flex h-9 w-full items-center justify-between px-3 text-left text-[13px] ${chatFilter === option.id ? 'bg-[#FFF4E5] text-[#FF8A00]' : 'text-[#111315] hover:bg-[#F3F4F6] dark:text-[#F5F5F5] dark:hover:bg-white/10'}`}
                          >
                            {tx(option.label)}
                            {chatFilter === option.id ? <Check size={14} /> : null}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    setAddMode('contact');
                    setInviteError(null);
                    setShowAddContact(true);
                  }}
                  className="w-[18px] h-[18px] rounded-[12px] bg-[#F3F4F6] flex items-center justify-center text-[#14AE5C] hover:bg-[#E5E7EB] transition-colors"
                  title={tx('Add')}
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
            {/* Search */}
            <div className="flex items-center gap-2 h-10 px-4 rounded-[4px] border border-[rgba(26,29,33,0.3)] dark:border-white/10 bg-white dark:bg-[#141414] focus-within:border-[#FF8A00] transition-colors">
              <Search size={16} className="text-[rgba(26,29,33,0.3)] shrink-0" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder={tx('Search conversations and messages')}
                className="flex-1 min-w-0 bg-transparent text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] placeholder:text-[rgba(17,19,21,0.3)] outline-none"
              />
              {sidebarSearch && (
                <button type="button" onClick={() => setSidebarSearch('')} title={tx('Clear search')} className="shrink-0 text-[rgba(26,29,33,0.45)] hover:text-[#111315] dark:hover:text-white transition-colors">
                  <X size={15} />
                </button>
              )}
            </div>
            {/* Filter chips */}
            <div className="flex items-center gap-2">
              {(['all', 'unread'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setChatFilter(key)}
                  className={`flex items-center px-3.5 py-1.5 rounded-[32px] text-[13px] font-medium leading-[18px] transition-colors ${
                    chatFilter === key
                      ? 'bg-[#111315] text-white dark:bg-white dark:text-[#111315]'
                      : 'bg-[#F3F4F6] text-[#111315] dark:bg-white/10 dark:text-[#F5F5F5] hover:bg-[#E5E7EB] dark:hover:bg-white/20'
                  }`}
                >
                  {tx(key === 'all' ? 'All' : 'Unread')}
                </button>
              ))}
              {chatFilter !== 'all' && chatFilter !== 'unread' && (
                <button
                  type="button"
                  onClick={() => setChatFilter('all')}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-[32px] text-[13px] font-medium leading-[18px] bg-[#111315] text-white dark:bg-white dark:text-[#111315]"
                >
                  {tx(CHAT_FILTER_OPTIONS.find((option) => option.id === chatFilter)?.label || '')}
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {conversations.length === 0 ? (
            /* First-run empty state: no conversations at all. Shown in the list
               column so it's visible on every viewport (the right-pane empty
               state is hidden under the sm breakpoint). */
            <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10 text-center">
              <LottieScene
                animationData={callAndVideoChatAnimation}
                size={260}
                loop
                staticPercent={38}
                label="Call And Video Chat"
              />
              <div className="flex flex-col items-center gap-2">
                <h3 className="text-[20px] font-medium leading-[28px] text-black dark:text-[#F5F5F5]">{tx('Start Chatting')}</h3>
                <p className="text-[12px] leading-[17px] text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]">{tx('Add a contact to start chatting. Your messages are private here.')}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddMode('contact');
                  setInviteError(null);
                  setShowAddContact(true);
                }}
                className="h-10 w-full max-w-[240px] rounded-[4px] text-[14px] font-medium text-white transition hover:brightness-105"
                style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
              >
                {tx('Add contact')}
              </button>
            </div>
          ) : (<>
          {debouncedSidebarSearch && !hasSearchResults && (
            <div className="px-2 py-6 text-center">
              <p className="m-0 text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5]">{tx('No conversations found')}</p>
              <p className="m-0 mt-1 text-[12px] leading-[17px] text-[rgba(26,29,33,0.6)] dark:text-[#A0A0A0]">{tx('Nothing matches')} “{sidebarSearch.trim()}”.</p>
              <button type="button" onClick={() => setSidebarSearch('')} className="mt-3 text-[12px] font-semibold text-[#FF8A00] hover:underline">{tx('Clear search')}</button>
            </div>
          )}
          {/* Messages matching the search, across all conversations */}
          {debouncedSidebarSearch.length >= 2 && messageHits.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">{tx('Messages')} <span className="text-[12px] font-normal text-[rgba(26,29,33,0.5)] dark:text-[#A0A0A0]">({messageHits.length})</span></h3>
              <div className="flex flex-col gap-1">
                {messageHits.map((hit: any) => {
                  const conv = conversations.find((c: any) => c.id === hit.conversationId);
                  return (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => { setActiveChat(hit.conversationId); setSearchQuery(sidebarSearch.trim()); }}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-[#F3F4F6] dark:hover:bg-white/5"
                    >
                      <span className="flex w-full items-center justify-between gap-2 text-[12px] font-semibold text-[#111315] dark:text-[#F5F5F5]">
                        <span className="truncate">{conv ? getChatName(conv) : (hit.sender?.name || 'Chat')}</span>
                        <span className="shrink-0 text-[10px] font-normal text-[rgba(26,29,33,0.5)] dark:text-[#A0A0A0]">{new Date(hit.createdAt).toLocaleDateString()}</span>
                      </span>
                      <span className="line-clamp-2 text-[12px] leading-[17px] text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]">{hit.sender?.name ? `${hit.sender.name}: ` : ''}{hit.content}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Direct Messages */}
          <div className={`flex flex-col gap-3${debouncedSidebarSearch && !hasSearchResults ? ' hidden' : ''}`}>
            <h3 className="text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">{tx('Direct Messages')}</h3>
            <div className="flex flex-col gap-2">
              {directChats.length === 0 ? (
                <div key="no-direct-chats" className="text-center text-[10px] leading-[14px] text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]">{tx('No direct messages yet.')}</div>
              ) : (
                directChats.map((chat, idx) => {
                  const otherUser = getOtherParticipant(chat);
                  const otherOnline = otherUser?.id ? Boolean(onlineUsers[otherUser.id] ?? chat.otherOnline) : false;
                  const lastInvite = parseSessionInviteContent(chat.messages?.[0]?.content || '');
                  const typingEntry = typingUsers[chat.id];
                  const lastMessage = typingEntry
                    ? `${typingEntry.userName || 'Someone'} is typing...`
                    : lastInvite?.kind === 'remote-access-request'
                    ? 'Remote access request'
                    : lastInvite?.kind === 'remote-access-response'
                      ? 'Remote access response'
                      : lastInvite ? 'Remote session invite' : (stripDeviceMentionTokens(chat.messages?.[0]?.content) || 'Start a conversation');
                  const unread = unreadCounts[chat.id] || 0;
                  const lastAt = formatChatListTime(chat.messages?.[0]?.createdAt || chat.updatedAt);
                  return (
                    <button
                      key={chat.id || `direct-${idx}`}
                      onClick={() => {
                        console.log('[SnowChat] Clicking conversation:', chat.id, 'Full object:', chat);
                        setActiveChat(chat.id);
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        activeChatId === chat.id
                          ? 'bg-[#F3F4F6] dark:bg-[#1C1C1C]'
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {otherUser?.avatar ? (
                          <img src={otherUser.avatar} alt={getChatName(chat)} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[rgba(255,179,71,0.3)] dark:bg-[#3A2E1A] text-[#111315] dark:text-[#FFB347] flex items-center justify-center text-[16px] font-medium">
                            {getChatName(chat).charAt(0)}
                          </div>
                        )}
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white dark:border-[#0A0A0A] rounded-full ${otherOnline ? 'bg-[#34C759]' : 'bg-gray-400'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5 gap-2">
                          <span className={`text-[14px] leading-5 truncate ${unread > 0 ? 'font-bold text-black dark:text-white' : 'font-medium text-black dark:text-[#F5F5F5]'}`}>{getChatName(chat)}</span>
                          <span className={`shrink-0 text-[11px] leading-4 ${unread > 0 ? 'text-[#27AE60] font-semibold' : 'text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]'}`}>{lastAt}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`flex-1 text-[12px] leading-4 truncate ${typingEntry ? 'font-medium text-[#27AE60]' : unread > 0 ? 'text-black dark:text-white font-semibold' : 'text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]'}`}>{lastMessage}</p>
                          {unread > 0 && (
                            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#27AE60] text-white text-[11px] font-semibold flex items-center justify-center">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Group Messages */}
          <div className={`flex flex-col gap-3${debouncedSidebarSearch && !hasSearchResults ? ' hidden' : ''}`}>
            <h3 className="text-[16px] font-semibold leading-[23px] text-black dark:text-[#F5F5F5]">{tx('Group Messages')}</h3>
            <div className="flex flex-col gap-2">
              {groups.length === 0 ? (
                <div key="no-groups" className="text-center text-[10px] leading-[14px] text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]">{tx('No Groups yet.')}</div>
              ) : (
                groups.map((chat, idx) => {
                  const lastInvite = parseSessionInviteContent(chat.messages?.[0]?.content || '');
                  const typingEntry = typingUsers[chat.id];
                  const lastMessage = typingEntry
                    ? `${typingEntry.userName || 'Someone'} is typing...`
                    : lastInvite?.kind === 'remote-access-request'
                    ? 'Remote access request'
                    : lastInvite?.kind === 'remote-access-response'
                      ? 'Remote access response'
                      : lastInvite ? 'Remote session invite' : (stripDeviceMentionTokens(chat.messages?.[0]?.content) || 'Start a conversation');
                  const unread = unreadCounts[chat.id] || 0;
                  const lastAt = formatChatListTime(chat.messages?.[0]?.createdAt || chat.updatedAt);
                  return (
                    <button
                      key={chat.id || `group-${idx}`}
                      onClick={() => setActiveChat(chat.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        activeChatId === chat.id
                          ? 'bg-[#F3F4F6] dark:bg-[#1C1C1C]'
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[rgba(255,179,71,0.3)] dark:bg-[#3A2E1A] flex items-center justify-center shrink-0">
                        <img src={groupIcon} alt="" className="w-5 h-5 object-contain dark:invert" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5 gap-2">
                          <span className={`text-[14px] leading-5 truncate ${unread > 0 ? 'font-bold text-black dark:text-white' : 'font-medium text-black dark:text-[#F5F5F5]'}`}>{chat.name || 'Group Chat'}</span>
                          <span className={`shrink-0 text-[11px] leading-4 ${unread > 0 ? 'text-[#27AE60] font-semibold' : 'text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]'}`}>{lastAt}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`flex-1 text-[12px] leading-4 truncate ${typingEntry ? 'font-medium text-[#27AE60]' : unread > 0 ? 'text-black dark:text-white font-semibold' : 'text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]'}`}>{lastMessage}</p>
                          {unread > 0 && (
                            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#27AE60] text-white text-[11px] font-semibold flex items-center justify-center">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          </>)}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeChatId ? (
        <div className="flex w-full min-w-0 flex-col bg-white dark:bg-[#080808] sm:flex-1">
          {/* Header */}
          <div className="min-h-[61px] px-3 py-2 sm:px-8 flex items-center justify-between gap-3 border-b border-[rgba(26,29,33,0.3)] dark:border-white/5 shrink-0 bg-white dark:bg-[#080808] font-['Mona_Sans',system-ui,sans-serif]">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setActiveChat(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#111315] transition-colors hover:bg-[#F3F4F6] dark:text-[#F5F5F5] dark:hover:bg-white/10 sm:hidden"
                aria-label="Back to chats"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="relative">
                {activeConversation?.isGroup ? (
                  <div className="w-10 h-10 bg-[rgba(255,179,71,0.3)] dark:bg-[#3A2E1A] text-[#111315] dark:text-[#FFB347] rounded-full flex items-center justify-center">
                    <Users size={20} />
                  </div>
                ) : activeParticipant?.avatar ? (
                  <img src={activeParticipant.avatar} alt={getChatName(activeConversation)} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-[rgba(255,179,71,0.3)] dark:bg-[#3A2E1A] text-[#111315] dark:text-[#FFB347] rounded-full flex items-center justify-center text-base font-medium">
                    {getChatName(activeConversation).charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                {activeConversation?.isGroup ? (
                  <h2 className="truncate text-[16px] font-medium leading-4 text-black/85 dark:text-[#F5F5F5]">
                    {getChatName(activeConversation)}
                  </h2>
                ) : (
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="truncate text-left text-[16px] font-medium leading-4 text-black/85 transition-colors hover:text-[#FF8A00] dark:text-[#F5F5F5]"
                    title="View profile"
                  >
                    {getChatName(activeConversation)}
                  </button>
                )}
                {activeConversation?.isGroup ? (
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className="text-left text-[14px] leading-4 text-[#34C759] hover:underline transition-colors"
                  >
                    {activeGroupMembers.length} member{activeGroupMembers.length === 1 ? '' : 's'}
                  </button>
                ) : (
                  <p className={`text-[14px] leading-4 ${contactOnline ? 'text-[#34C759]' : 'text-[#111315]/50 dark:text-[#A0A0A0]'}`}>
                    {contactStatusLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => {
                    setShowOptionsModal(!showOptionsModal);
                    setNewName(activeConversation?.name || activeParticipant?.name || '');
                  }}
                  className="w-6 h-6 flex items-center justify-center text-[#111315] dark:text-[#A0A0A0] hover:text-[#FF8A00] transition-colors"
                  title="More options"
                >
                  <MoreHorizontal size={24} strokeWidth={2.5} />
                </button>
                
                {showOptionsModal && (
                  <div className="absolute right-0 top-12 w-[190px] bg-white dark:bg-[#1A1A1A] rounded-[4px] overflow-hidden z-50 shadow-[-4px_4px_12px_rgba(0,0,0,0.12)] dark:shadow-black/40 dark:border dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 font-['Mona_Sans',system-ui,sans-serif]">
                    {activeConversation?.isGroup ? (
                      <>
                        <button
                          onClick={() => { setIsRenaming(true); setShowOptionsModal(false); }}
                          className="w-full h-10 px-4 flex items-center text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            setInviteError(null);
                            setShowAddMembersModal(true);
                            setShowOptionsModal(false);
                          }}
                          className="w-full h-10 px-4 flex items-center text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition-colors"
                        >
                          Add Members
                        </button>
                      </>
                    ) : (
                      <>
                        {activeConversation?.status === 'BLOCKED' && isBlockedByMe ? (
                          <button
                            onClick={() => { unblockConversation(activeChatId!); setShowOptionsModal(false); }}
                            className="w-full h-10 px-4 flex items-center whitespace-nowrap text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition-colors"
                          >
                            Unblock
                          </button>
                        ) : activeConversation?.status !== 'BLOCKED' ? (
                          <button
                            onClick={() => { blockConversation(activeChatId!); setShowOptionsModal(false); }}
                            className="w-full h-10 px-4 flex items-center whitespace-nowrap text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition-colors"
                          >
                            Block
                          </button>
                        ) : null}
                        {activeConversation?.status === 'ACCEPTED' && (
                          <button
                            onClick={() => { unfriendConversation(activeChatId!); setShowOptionsModal(false); }}
                            className="w-full h-10 px-4 flex items-center whitespace-nowrap text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition-colors"
                          >
                            Unfriend
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => { setShowSearchBar((v) => !v); setShowOptionsModal(false); }}
                      className="w-full h-10 px-4 flex items-center gap-2 whitespace-nowrap text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition-colors"
                    >
                      <Search size={14} className="shrink-0" /> <span className="truncate">Search messages</span>
                    </button>
                    <button
                      onClick={() => { toggleMuteConversation(); setShowOptionsModal(false); }}
                      className={`w-full h-10 px-4 flex items-center gap-2 whitespace-nowrap text-[14px] font-medium leading-5 transition-colors ${
                        mutedByMe
                          ? 'bg-[#FFF4E5] text-[#B54708] hover:bg-[#FFE8C2] dark:bg-[#FF8A00]/10 dark:text-[#FFB347] dark:hover:bg-[#FF8A00]/15'
                          : 'text-[#111315] hover:bg-[#F3F4F6] dark:text-[#F5F5F5] dark:hover:bg-white/5'
                      }`}
                    >
                      {mutedByMe ? <Bell size={14} className="shrink-0" /> : <BellOff size={14} className="shrink-0" />} <span className="truncate">{mutedByMe ? 'Unmute' : 'Mute'} notifications</span>
                    </button>
                    <button
                      onClick={() => { setShowDeleteModal(true); setShowOptionsModal(false); }}
                      className="w-full h-10 px-4 flex items-center whitespace-nowrap text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* In-conversation message search */}
          {showSearchBar && (
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-6 py-2.5 dark:border-white/5 dark:bg-[#080808]">
              <Search size={15} className="shrink-0 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); setShowSearchBar(false); } }}
                placeholder="Search in this conversation..."
                className="flex-1 bg-transparent text-[13px] text-[#111315] outline-none placeholder:text-gray-400 dark:text-white"
              />
              {searchQuery && (
                <span className="shrink-0 text-[12px] font-medium text-gray-400">
                  {visibleMessages.length} {visibleMessages.length === 1 ? 'match' : 'matches'}
                </span>
              )}
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setShowSearchBar(false); }}
                className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                aria-label="Close search"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 bg-white dark:bg-[#080808] sm:px-8 sm:py-6 sm:space-y-6">
            {activeConversation?.status === 'BLOCKED' ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
                  <Ban size={40} />
                </div>
                <h3 className="text-[24px] font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">
                  {isBlockedByMe ? 'Contact Blocked' : 'Chat Unavailable'}
                </h3>
                <p className="text-[15px] text-gray-500 dark:text-[#A0A0A0] mb-8 leading-relaxed">
                  {isBlockedByMe
                    ? "You blocked this contact. They can't send you messages or send a new request."
                    : "This chat is no longer available for messaging."}
                </p>
                {isBlockedByMe && (
                  <button
                    onClick={() => unblockConversation(activeChatId!)}
                    className="px-6 py-3 bg-[#1C202B] text-white text-[14px] font-bold rounded-2xl hover:bg-[#2A2F3D] transition-all shadow-xl shadow-black/10 flex items-center gap-2"
                  >
                    <Unlock size={16} />
                    Unblock Contact
                  </button>
                )}
              </div>
            ) : activeConversation?.status === 'PENDING' ? (
              <PendingInvitation
                name={getChatName(activeConversation)}
                isRequester={isInviteRequester}
                onAccept={() => acceptInvite(activeChatId!)}
                onDecline={() => rejectInvite(activeChatId!)}
                tx={tx}
              />
            ) : (
              <>
                {!isActiveChatLoading && activeMessages.length > 0 && activeChatId && hasMoreMessages[activeChatId] && !searchQuery.trim() && (
                  <div className="flex justify-center pb-2">
                    <button
                      type="button"
                      onClick={() => loadOlderMessages(activeChatId)}
                      disabled={Boolean(loadingOlder[activeChatId])}
                      className="rounded-full bg-[#F3F4F6] px-4 py-1.5 text-[12px] font-medium text-[#111315] transition-colors hover:bg-[#E5E7EB] disabled:opacity-60 dark:bg-white/10 dark:text-white"
                    >
                      {loadingOlder[activeChatId] ? 'Loading...' : 'Load earlier messages'}
                    </button>
                  </div>
                )}
                {isActiveChatLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <Loader2 size={24} className="animate-spin text-[#00193F] dark:text-blue-400 mb-3" />
                    <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">Loading messages...</p>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 text-gray-400 rounded-full flex items-center justify-center mb-4">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-[18px] font-medium text-gray-900 dark:text-gray-100 mb-1">No messages yet</h3>
                    <p className="text-[14px] text-gray-500 dark:text-gray-400">Send a message to start the conversation</p>
                  </div>
                ) : (
                  visibleMessages.map((msg, idx) => {
                    const isMe = msg.senderId === user?.id;
                    const sender = msg.sender;
                    const sessionInvite = parseSessionInviteContent(msg.content);
                    const targetedUserIds = Array.isArray(sessionInvite?.targetUserIds) ? sessionInvite.targetUserIds : [];
                    if (targetedUserIds.length > 0 && !isMe && !targetedUserIds.includes(user?.id)) {
                      return null;
                    }
                    const receiptMap = readReceipts[msg.conversationId] || {};
                    const readerIds = (activeConversation?.participants || [])
                      .map((participant: any) => participant.userId)
                      .filter((id: string) => id && id !== user?.id);
                    const seenByAll = isMe && readerIds.length > 0 && readerIds.every((readerId: string) => {
                      const readAt = receiptMap[readerId];
                      return readAt && new Date(readAt).getTime() >= new Date(msg.createdAt).getTime();
                    });
                    const relatedStatuses = sessionInvite ? activeMessages
                      .map((message) => parseSessionInviteContent(message.content))
                      .filter((payload) => payload && (
                        (sessionInvite.remoteSessionId && payload.remoteSessionId === sessionInvite.remoteSessionId) ||
                        (sessionInvite.sessionCode && payload.sessionCode === sessionInvite.sessionCode) ||
                        (sessionInvite.requestId && payload.requestId === sessionInvite.requestId)
                      )) : [];
                    const meetingEnded = relatedStatuses.some((payload) => payload.kind === 'meeting-status' && payload.status === 'ENDED');
                    const meetingInProgress = relatedStatuses.some((payload) => payload.kind === 'meeting-status' && payload.status === 'IN_PROGRESS');
                    const remoteEnded = relatedStatuses.some((payload) => payload.kind === 'remote-session-status' && payload.status === 'ENDED');
                    const remoteExpiresAt = sessionInvite?.expiresAt ? new Date(sessionInvite.expiresAt).getTime() : 0;
                    const remoteRemaining = remoteExpiresAt ? remoteExpiresAt - clockNow : 0;
                    const remoteExpired = remoteEnded || Boolean(remoteExpiresAt && remoteRemaining <= 0);
                    const requestResponse = relatedStatuses.find((payload) => payload.kind === 'remote-access-response');
                    
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[88%] gap-1.5 sm:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isMe && (
                            <div className="flex-shrink-0">
                              {sender?.avatar ? (
                                <img src={sender.avatar} alt={sender.name} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 bg-[rgba(255,179,71,0.3)] dark:bg-[#3A2E1A] text-[#111315] dark:text-[#FFB347] rounded-full flex items-center justify-center text-[12px] font-medium">
                                  {sender?.name?.charAt(0) || '?'}
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {sessionInvite ? (
                              sessionInvite.kind === 'meeting-status' || sessionInvite.kind === 'remote-session-status' ? (
                                <div className={`flex flex-col gap-1 rounded-[12px] px-[18px] pt-3 pb-1.5 text-[14px] font-medium leading-5 ${
                                  isMe ? 'bg-[#FFB347] text-white items-end' : 'bg-[#F3F4F6] dark:bg-white/5 text-[#111315] dark:text-[#F5F5F5] items-start'
                                }`}>
                                  <span className={isMe ? 'text-right' : ''}>{sessionInvite.text || 'Session status updated.'}</span>
                                  <span className={`flex items-center gap-1.5 text-[12px] font-medium leading-[17px] ${
                                    isMe ? 'text-white/90' : 'text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]'
                                  }`}>
                                    {isMe && (
                                      <span className={`inline-flex items-center ${seenByAll ? 'text-[#27AE60]' : 'text-white/70'}`} title={seenByAll ? 'Read' : 'Delivered'}>
                                        <CheckCheck size={14} strokeWidth={2.5} />
                                      </span>
                                    )}
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ) : sessionInvite.kind === 'meeting-invite-response' ? (
                                <div className={`flex flex-col gap-1 rounded-[12px] px-[18px] pt-3 pb-1.5 text-[14px] font-medium leading-5 ${
                                  isMe ? 'bg-[#FFB347] text-white items-end' : 'bg-[#F3F4F6] dark:bg-white/5 text-[#111315] dark:text-[#F5F5F5] items-start'
                                }`}>
                                  <span className={isMe ? 'text-right' : ''}>
                                    {sessionInvite.responderName || sender?.name || 'Someone'} {sessionInvite.accepted ? 'accepted' : 'declined'} the meeting invite.
                                  </span>
                                  <span className={`flex items-center gap-1.5 text-[12px] font-medium leading-[17px] ${
                                    isMe ? 'text-white/90' : 'text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]'
                                  }`}>
                                    {isMe && (
                                      <span className={`inline-flex items-center ${seenByAll ? 'text-[#27AE60]' : 'text-white/70'}`} title={seenByAll ? 'Read' : 'Delivered'}>
                                        <CheckCheck size={14} strokeWidth={2.5} />
                                      </span>
                                    )}
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ) : sessionInvite.kind === 'remote-access-request' ? (
                                <div className="w-[340px] max-w-full rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-white dark:bg-[#111827] shadow-sm overflow-hidden">
                                  <div className="p-4 bg-amber-50 dark:bg-amber-500/10 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                                      <Monitor size={18} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-bold text-amber-700 dark:text-amber-300">Remote desktop request</p>
                                      <p className="text-[12px] text-amber-600 dark:text-amber-400 truncate">{sessionInvite.requesterName || sender?.name || 'Someone'} wants to use your PC</p>
                                    </div>
                                  </div>
                                  <div className="p-4 space-y-3">
                                    <p className="text-[13px] text-gray-600 dark:text-gray-300">
                                      {requestResponse
                                        ? requestResponse.approved ? 'Remote access was approved.' : 'Remote access was denied.'
                                        : isMe ? 'Waiting for approval from the other person.' : 'Approve only if you trust this person.'}
                                    </p>
                                    {!isMe && requestResponse && (
                                      <button
                                        disabled
                                        className={`w-full py-2.5 rounded-xl text-[13px] font-bold cursor-not-allowed ${
                                          requestResponse.approved
                                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                                        }`}
                                      >
                                        {requestResponse.approved ? 'Access given' : 'Access denied'}
                                      </button>
                                    )}
                                    {!isMe && !requestResponse && (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            setAccessApprovalRequest(sessionInvite);
                                            setAccessDurationMinutes(30);
                                          }}
                                          className="flex-1 py-2.5 rounded-xl text-[13px] font-bold bg-[#1C202B] text-white hover:bg-[#2A2F3D] transition-all"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => respondToRemoteAccessRequest(sessionInvite, false)}
                                          className="px-4 py-2.5 rounded-xl text-[13px] font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/20 transition-all"
                                        >
                                          Deny
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : sessionInvite.kind === 'remote-access-response' ? (
                                <div className={`w-[340px] max-w-full rounded-2xl border ${sessionInvite.approved ? 'border-emerald-100 dark:border-emerald-500/20' : 'border-red-100 dark:border-red-500/20'} bg-white dark:bg-[#111827] shadow-sm overflow-hidden`}>
                                  <div className={`p-4 ${sessionInvite.approved ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'} flex items-center gap-3`}>
                                    <div className={`w-10 h-10 rounded-xl ${sessionInvite.approved ? 'bg-emerald-600' : 'bg-red-500'} text-white flex items-center justify-center`}>
                                      {sessionInvite.approved ? <CheckCircle2 size={18} /> : <X size={18} />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`text-[13px] font-bold ${sessionInvite.approved ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                        {sessionInvite.approved ? 'Remote access approved' : 'Remote access denied'}
                                      </p>
                                      <p className={`text-[12px] ${sessionInvite.approved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} truncate`}>
                                        {sessionInvite.approverName || sender?.name || 'Someone'} responded to the request
                                      </p>
                                    </div>
                                  </div>
                                  <div className="p-4 space-y-3">
                                    <p className="text-[13px] text-gray-600 dark:text-gray-300">
                                      {sessionInvite.approved
                                        ? remoteExpired
                                          ? 'Remote session ended - time limit reached.'
                                          : `Access is approved for ${sessionInvite.durationMinutes || 30} minutes.${remoteExpiresAt ? ` Time remaining: ${formatRemainingTime(remoteRemaining)}.` : ''}`
                                        : 'The person did not grant access.'}
                                    </p>
                                    {sessionInvite.approved && !remoteExpired && remoteRemaining > 0 && remoteRemaining <= 60_000 && (
                                      <p className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">
                                        This remote session will end in less than one minute.
                                      </p>
                                    )}
                                    {sessionInvite.approved && !isMe && (() => {
                                      const inviteId = sessionInvite.requestId || sessionInvite.sessionCode || '';
                                      const isOpening = usePcLoadingId === inviteId;
                                      return (
                                        <button
                                          onClick={() => handleUseApprovedPc(sessionInvite)}
                                          disabled={isOpening || remoteExpired}
                                          className="w-full py-2.5 rounded-xl text-[13px] font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                                        >
                                          {isOpening ? (
                                            <>
                                              <Loader2 size={14} className="animate-spin" />
                                              Opening...
                                            </>
                                          ) : (
                                            <>
                                              <Monitor size={14} />
                                              {remoteExpired ? 'Session ended' : 'Use PC'}
                                            </>
                                          )}
                                        </button>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-[270px] max-w-full rounded-[12px] border-[0.7px] border-[rgba(255,179,71,0.35)] bg-white dark:bg-[#111827] overflow-hidden font-['Mona_Sans',system-ui,sans-serif] shadow-sm">
                                  <div className="flex items-center gap-3 px-4 py-3.5 bg-[rgba(255,179,71,0.1)] rounded-t-[12px]">
                                    <div className="w-8 h-8 rounded-[4px] bg-[#FF8A00] text-white flex items-center justify-center shrink-0">
                                      <Video size={16} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5]">
                                        {sessionInvite.sessionType === 'VIDEO_MEETING' ? 'Video meeting invite' : 'Remote session invite'}
                                      </p>
                                      <p className="text-[12px] leading-[17px] text-[rgba(17,19,21,0.7)] dark:text-[#A0A0A0] truncate">{sessionInvite.senderName || sender?.name || 'Someone'} invited you</p>
                                    </div>
                                  </div>
                                  <div className="p-4 flex flex-col gap-4">
                                    <div className="flex flex-col gap-2">
                                      <p className="text-[12px] leading-[17px] text-[rgba(17,19,21,0.7)] dark:text-[#A0A0A0]">{sessionInvite.sessionType === 'VIDEO_MEETING' ? 'Meeting' : 'Session'}</p>
                                      <p className="text-[14px] font-medium leading-5 text-[#111315] dark:text-white truncate">{sessionInvite.sessionName || 'Remote support session'}</p>
                                      {sessionInvite.sessionType === 'VIDEO_MEETING' && (
                                        <p className={`text-[10px] font-normal leading-[14px] ${meetingEnded ? 'text-gray-400' : meetingInProgress ? 'text-[#27AE60]' : 'text-[#0088FF]'}`}>
                                          {meetingEnded ? 'Ended' : meetingInProgress ? 'In progress' : isMe ? 'Waiting for others' : 'Ready to join'}
                                        </p>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-[minmax(0,1fr)_82px_40px] items-center gap-3">
                                      {(sessionInvite.sessionType === 'VIDEO_MEETING' || !isMe) && <button
                                        onClick={() => {
                                          if (sessionInvite.sessionType === 'VIDEO_MEETING') {
                                            if (isMe) onJoinMeeting?.(sessionInvite.sessionCode);
                                            else respondToMeetingInvite(sessionInvite, true);
                                          } else {
                                            onJoinSessionInvite?.(sessionInvite.sessionCode, sessionInvite.sessionPassword);
                                          }
                                        }}
                                        disabled={sessionInvite.sessionType === 'VIDEO_MEETING' && meetingEnded}
                                        className="min-w-0 h-10 px-3 rounded-[4px] text-[13px] leading-4 font-semibold text-white transition-opacity flex items-center justify-center gap-2 bg-[linear-gradient(110.89deg,#FF8A00_36.19%,#FFB347_93.55%)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <Video size={14} className="shrink-0" />
                                        <span className="truncate">{meetingEnded ? 'Ended' : meetingInProgress ? 'Join now' : 'Join'}</span>
                                      </button>}
                                      {!isMe && sessionInvite.sessionType === 'VIDEO_MEETING' && (
                                        <button
                                          onClick={() => respondToMeetingInvite(sessionInvite, false)}
                                          className="h-10 px-3 rounded-[4px] bg-[#F3F4F6] dark:bg-white/10 text-[#111315] dark:text-gray-300 hover:bg-[#E5E7EB] dark:hover:bg-white/20 transition-colors text-[13px] font-medium"
                                        >
                                          Decline
                                        </button>
                                      )}
                                      <button
                                        onClick={() => navigator.clipboard?.writeText(sessionInvite.sessionLink || '')}
                                        className="w-10 h-10 rounded-[4px] bg-[#F3F4F6] dark:bg-white/10 text-[rgba(26,29,33,0.7)] dark:text-gray-300 hover:bg-[#E5E7EB] dark:hover:bg-white/20 transition-colors flex items-center justify-center shrink-0"
                                        title="Copy join link"
                                      >
                                        <Copy size={16} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className={`group/msg relative flex flex-col gap-1 rounded-[12px] px-[18px] pt-3 pb-1.5 text-[14px] leading-5 ${
                                isMe
                                  ? 'bg-[#FFB347] text-white items-end'
                                  : 'bg-[#F3F4F6] dark:bg-white/5 text-[#111315] dark:text-[#F5F5F5] items-start'
                              }`}>
                                {!(msg as any).deletedAt && (
                                  <div className={`absolute -top-3 z-10 hidden items-center gap-0.5 rounded-full border border-gray-200 bg-white px-1 py-0.5 shadow-md group-hover/msg:flex dark:border-white/10 dark:bg-[#1A1A1A] ${isMe ? 'right-2' : 'left-2'}`}>
                                    <button type="button" title="Reply" onClick={() => { setReplyTarget(msg); setEditingMessage(null); }} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#FF8A00] dark:text-gray-300 dark:hover:bg-white/10">
                                      <Reply size={13} />
                                    </button>
                                    <button type="button" title="React" onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#FF8A00] dark:text-gray-300 dark:hover:bg-white/10">
                                      <Smile size={13} />
                                    </button>
                                    <button type="button" title={(msg as any).pinned ? 'Unpin' : 'Pin'} onClick={() => togglePinMessage(msg)} className={`flex h-6 w-6 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 ${(msg as any).pinned ? 'text-[#FF8A00]' : 'text-gray-500 hover:text-[#FF8A00] dark:text-gray-300'}`}>
                                      <Pin size={13} />
                                    </button>
                                    {isMe && (
                                      <>
                                        <button type="button" title="Edit" onClick={() => startEditMessage(msg)} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#FF8A00] dark:text-gray-300 dark:hover:bg-white/10">
                                          <Pencil size={13} />
                                        </button>
                                        <button type="button" title="Delete" onClick={() => deleteMessage(msg.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 dark:text-gray-300 dark:hover:bg-red-500/10">
                                          <Trash2 size={13} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                                {reactionPickerFor === msg.id && (
                                  <div className={`absolute z-20 ${idx < 2 ? '-bottom-12' : '-top-12'} flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-lg dark:border-white/10 dark:bg-[#1A1A1A] ${isMe ? 'right-0' : 'left-0'}`}>
                                    {['👍', '❤️', '😂', '😮', '✅', '🎉'].map((emoji) => (
                                      <button key={emoji} type="button" onClick={() => reactToMessage(msg.id, emoji)} className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] hover:bg-gray-100 dark:hover:bg-white/10">
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {(msg as any).pinned && (
                                  <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${isMe ? 'text-white/80' : 'text-[#FF8A00]'}`}>
                                    <Pin size={10} /> Pinned
                                  </span>
                                )}
                                {(msg as any).replyTo && (
                                  <span className={`block max-w-full truncate rounded-lg border-l-2 border-[#FF8A00] px-2 py-1 text-[11px] ${isMe ? 'bg-white/15 text-white/80' : 'bg-black/5 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}>
                                    {(msg as any).replyTo.sender?.name || 'Message'}: {stripDeviceMentionTokens(String((msg as any).replyTo.content || (msg as any).replyTo.attachmentName || '')).slice(0, 70)}
                                  </span>
                                )}
                                {(msg as any).deletedAt ? (
                                  <span className={`italic opacity-60 ${isMe ? 'text-right' : ''}`}>Message deleted</span>
                                ) : (
                                  <>
                                    {(msg as any).attachmentUrl && (
                                      String((msg as any).attachmentType || '').startsWith('audio/') ? (
                                        <audio
                                          controls
                                          src={`${fileBaseUrl}${(msg as any).attachmentUrl}`}
                                          className="h-10 max-w-[240px]"
                                        />
                                      ) : String((msg as any).attachmentType || '').startsWith('image/') ? (
                                        /* WhatsApp-style image: large rounded preview, hover download */
                                        <div className="group/img relative -mx-2 overflow-hidden rounded-xl">
                                          <img
                                            src={`${fileBaseUrl}${(msg as any).attachmentUrl}`}
                                            alt={(msg as any).attachmentName || 'image'}
                                            className="max-h-[300px] min-h-[80px] w-full max-w-[320px] cursor-pointer object-cover transition-transform duration-200 group-hover/img:scale-[1.02]"
                                            onClick={() => openImageViewer(`${fileBaseUrl}${(msg as any).attachmentUrl}`)}
                                          />
                                          <a
                                            href={`${fileBaseUrl}${(msg as any).attachmentUrl}`}
                                            download={(msg as any).attachmentName || 'image'}
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 group-hover/img:flex"
                                            title="Download"
                                          >
                                            <Download size={15} />
                                          </a>
                                        </div>
                                      ) : (
                                        /* WhatsApp-style document card: type badge, name, size • ext, download */
                                        <a
                                          href={`${fileBaseUrl}${(msg as any).attachmentUrl}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={`flex w-[260px] max-w-full items-center gap-3 rounded-xl p-2.5 transition-colors ${isMe ? 'bg-white/15 hover:bg-white/25' : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15'}`}
                                        >
                                          <span className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-white ${getFileBadge((msg as any).attachmentName).color}`}>
                                            <FileText size={16} />
                                            <span className="text-[7px] font-bold leading-[9px]">{getFileBadge((msg as any).attachmentName).ext}</span>
                                          </span>
                                          <span className="min-w-0 flex-1">
                                            <span className={`block truncate text-[13px] font-medium leading-[18px] ${isMe ? 'text-white' : 'text-[#111315] dark:text-white'}`}>
                                              {(msg as any).attachmentName || 'Attachment'}
                                            </span>
                                            <span className={`block text-[11px] leading-4 ${isMe ? 'text-white/70' : 'text-[#111315]/60 dark:text-white/60'}`}>
                                              {formatFileSize((msg as any).attachmentSize || 0)}{(msg as any).attachmentSize ? ' • ' : ''}{getFileBadge((msg as any).attachmentName).ext}
                                            </span>
                                          </span>
                                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${isMe ? 'border-white/40 text-white' : 'border-[#111315]/20 text-[#111315]/70 dark:border-white/30 dark:text-white/80'}`}>
                                            <Download size={14} />
                                          </span>
                                        </a>
                                      )
                                    )}
                                    {msg.content && <span className={isMe ? 'text-right' : ''}>{renderMessageContent(String(msg.content), isMe)}{(msg as any).editedAt ? <em className="ml-1 text-[10px] opacity-60">(edited)</em> : null}</span>}
                                  </>
                                )}
                                {(msg as any).reactions && Object.keys((msg as any).reactions).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries((msg as any).reactions as Record<string, string[]>).map(([emoji, userIds]) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => reactToMessage(msg.id, emoji)}
                                        title={userIds.includes(user?.id || '') ? 'Remove your reaction' : 'React'}
                                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] transition-colors ${
                                          userIds.includes(user?.id || '')
                                            ? 'bg-[#FF8A00]/20 ring-1 ring-[#FF8A00]'
                                            : isMe ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'
                                        }`}
                                      >
                                        {emoji} <span className="font-semibold">{userIds.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <span className={`flex items-center gap-1.5 text-[12px] font-medium leading-[17px] ${
                                  isMe ? 'text-white/90' : 'text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0]'
                                }`}>
                                  {isMe && (
                                    <span
                                      className={`inline-flex items-center ${seenByAll ? 'text-[#27AE60]' : 'text-white/70'}`}
                                      title={seenByAll ? 'Read' : 'Delivered'}
                                    >
                                      <CheckCheck size={14} strokeWidth={2.5} />
                                    </span>
                                  )}
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            )}
                            {sessionInvite && !['meeting-status', 'remote-session-status', 'meeting-invite-response'].includes(sessionInvite.kind) && (
                              <span className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isMe && (
                                  <span
                                    className={`inline-flex items-center ${seenByAll ? 'text-blue-500' : 'text-gray-400'}`}
                                    title={seenByAll ? 'Read' : 'Delivered'}
                                  >
                                    <CheckCheck size={14} strokeWidth={2.5} />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {activeChatId && typingUsers[activeChatId] && (
                  <div className="flex items-center gap-2 px-2 py-1 text-[12px] font-medium text-gray-500 dark:text-gray-300">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                    </span>
                    {typingUsers[activeChatId]?.userName || 'Someone'} is typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          {activeConversation?.status === 'ACCEPTED' && (
            <div className="bg-white p-3 dark:bg-[#080808] border-t border-gray-100 dark:border-white/5 shrink-0 sm:p-6">
              {actionStatus && !showActionSheet && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[12px] font-medium">
                  {usePcLoadingId && <Loader2 size={12} className="animate-spin" />}
                  <span className="flex-1">{actionStatus}</span>
                  <button
                    type="button"
                    onClick={() => setActionStatus('')}
                    className="text-blue-500/70 hover:text-blue-700 dark:hover:text-blue-200"
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="relative flex items-center gap-1.5 sm:gap-3">
                {showActionSheet && (
                  <div className="absolute left-0 bottom-[64px] w-[min(86vw,260px)] rounded-[12px] bg-white dark:bg-[#151515] dark:border dark:border-white/10 shadow-[-4px_4px_12px_rgba(0,0,0,0.12)] dark:shadow-black/40 p-3 flex flex-col gap-2 animate-in slide-in-from-bottom-3 fade-in duration-200 z-40 font-['Mona_Sans',system-ui,sans-serif]">
                    <button
                      onClick={handleQuickMeetingInvite}
                      className="w-full px-4 py-2.5 rounded-[4px] bg-[#F3F4F6] dark:bg-white/5 hover:bg-[#E9EAEC] dark:hover:bg-white/10 transition-colors flex items-center gap-2 text-left"
                    >
                      <Video size={16} className="text-[#111315] dark:text-[#F5F5F5] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5]">Meeting session</p>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">Invite this chat to a live meeting.</p>
                      </div>
                    </button>
                    <button
                      onClick={handleRemoteAccessRequest}
                      className="w-full px-4 py-2.5 rounded-[4px] bg-[#F3F4F6] dark:bg-white/5 hover:bg-[#E9EAEC] dark:hover:bg-white/10 transition-colors flex items-center gap-2 text-left"
                    >
                      <Monitor size={16} className="text-[#111315] dark:text-[#F5F5F5] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5]">Desktop remote session</p>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">Ask for approval to use their PC.</p>
                      </div>
                    </button>
                    {activeConversation?.isGroup && selectableGroupMembers.length > 0 && (
                      <div className="mt-1 pt-3 border-t border-gray-100 dark:border-white/10">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Send to</p>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {selectableGroupMembers.map((member: any) => {
                            const checked = selectedActionUserIds.includes(member.userId);
                            const label = member.user?.name || member.user?.email || 'Member';
                            return (
                              <label key={member.userId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    setSelectedActionUserIds((current) => event.target.checked
                                      ? [...new Set([...current, member.userId])]
                                      : current.filter((id) => id !== member.userId)
                                    );
                                  }}
                                  className="w-4 h-4 accent-blue-600"
                                />
                                <span className="text-[12px] font-medium text-gray-700 dark:text-gray-200 truncate">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {actionStatus && (
                      <p className="px-3 pt-2 text-[12px] font-medium text-blue-600 dark:text-blue-300">{actionStatus}</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => {
                    setActionStatus('');
                    setShowActionSheet((value) => !value);
                  }}
                  className={`h-9 w-9 rounded-full flex shrink-0 items-center justify-center transition-colors sm:h-10 sm:w-10 ${showActionSheet ? 'bg-[#1C202B] text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/10'}`}
                  title="More chat actions"
                >
                  <Plus size={22} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAttachment(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAttachment}
                  className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-gray-400 transition-colors hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:hover:text-white dark:hover:bg-white/10 sm:h-10 sm:w-10"
                  title="Attach a file (or paste a screenshot with Ctrl+V)"
                >
                  {isUploadingAttachment ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                </button>
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-colors sm:h-10 sm:w-10 ${isRecordingVoice ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/10'}`}
                  title={isRecordingVoice ? 'Stop recording' : 'Record a voice note'}
                >
                  {isRecordingVoice ? <Square size={16} /> : <Mic size={20} />}
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCannedReplies((v) => !v)}
                    className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-colors sm:h-10 sm:w-10 ${showCannedReplies ? 'bg-[#1C202B] text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-white/10'}`}
                    title="Canned replies"
                  >
                    <Zap size={19} />
                  </button>
                  {showCannedReplies && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowCannedReplies(false)} />
                      <div className="absolute bottom-[52px] left-0 z-40 w-[min(86vw,340px)] overflow-hidden rounded-2xl border border-gray-100 bg-white py-1 shadow-2xl dark:border-white/10 dark:bg-[#151515]">
                        <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">Quick replies</p>
                        {CANNED_REPLIES.map((text) => (
                          <button
                            key={text}
                            type="button"
                            onClick={() => { setInputText(text); setShowCannedReplies(false); }}
                            className="w-full px-4 py-2 text-left text-[13px] text-[#111315] transition-colors hover:bg-gray-50 dark:text-[#F5F5F5] dark:hover:bg-white/5"
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1 relative">
                  {(replyTarget || pendingAttachment || editingMessage) && (
                    <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-[#1A1A1A]">
                      <div className="min-w-0 text-[12px]">
                        {editingMessage && (
                          <p className="m-0 truncate font-semibold text-[#FF8A00]">
                            <Pencil size={11} className="mr-1 inline" /> Editing message
                          </p>
                        )}
                        {replyTarget && (
                          <p className="m-0 truncate text-gray-600 dark:text-gray-300">
                            <span className="font-semibold">Replying to {replyTarget.sender?.name || 'message'}:</span> {stripDeviceMentionTokens(String(replyTarget.content || replyTarget.attachmentName || '')).slice(0, 80)}
                          </p>
                        )}
                        {pendingAttachment && (
                          <div className="flex items-center gap-2.5">
                            {pendingAttachment.type.startsWith('image/') ? (
                              <img
                                src={`${fileBaseUrl}${pendingAttachment.url}`}
                                alt={pendingAttachment.name}
                                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <span className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-white ${getFileBadge(pendingAttachment.name).color}`}>
                                <FileText size={15} />
                                <span className="text-[7px] font-bold leading-[9px]">{getFileBadge(pendingAttachment.name).ext}</span>
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-medium text-gray-700 dark:text-gray-200">{pendingAttachment.name}</span>
                              <span className="block text-[11px] text-gray-400">{formatFileSize(pendingAttachment.size)} • ready to send</span>
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setReplyTarget(null); setPendingAttachment(null); if (editingMessage) { setEditingMessage(null); setInputText(''); } }}
                        className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                        aria-label="Clear"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {mentionQuery !== null && mentionCandidates.length > 0 && (
                    <div className="absolute bottom-[calc(100%+6px)] left-0 w-[min(86vw,320px)] rounded-2xl bg-white dark:bg-[#151515] border border-gray-100 dark:border-white/10 shadow-2xl p-2 z-40 animate-in slide-in-from-bottom-2 fade-in duration-150">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1 px-2 pt-1">Mention a device</p>
                      {mentionCandidates.map((device: any) => (
                        <button
                          key={device.id || device.access_key}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectMentionDevice(device)}
                          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-left"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF4E5] text-[#B54708] dark:bg-white/10 dark:text-[#FFB347]">
                            <Monitor size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-[#111315] dark:text-[#F5F5F5]">{device.device_name || device.name || 'Device'}</span>
                            <span className="block truncate text-[11px] text-gray-400">{device.access_key}</span>
                          </span>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${device.is_online ? 'bg-[#34C759]' : 'bg-gray-300 dark:bg-white/20'}`} title={device.is_online ? 'Online' : 'Offline'} />
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => { setInputText(e.target.value); notifyTyping(); }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      // While the @-picker is open, Enter picks the top device
                      // instead of sending the half-typed mention.
                      if (mentionQuery !== null && mentionCandidates.length > 0) {
                        e.preventDefault();
                        selectMentionDevice(mentionCandidates[0]);
                        return;
                      }
                      handleSend();
                    }}
                    onPaste={handlePaste}
                    placeholder="Type your message... (@ to mention a device)"
                    className="w-full bg-[#F0F2F5] dark:bg-white/5 text-[#111111] dark:text-[#F5F5F5] placeholder:text-gray-400 rounded-2xl py-3.5 pl-4 pr-12 text-[14px] outline-none focus:bg-white dark:focus:bg-[#1A1A1A] border border-transparent focus:border-gray-200 dark:focus:border-white/10 transition-all"
                  />
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute right-0 bottom-[56px] w-[min(86vw,320px)] rounded-3xl bg-white dark:bg-[#151515] border border-gray-100 dark:border-white/10 shadow-2xl p-4 z-40 animate-in slide-in-from-bottom-2 fade-in duration-200"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2 px-1">Emoji</p>
                      <div className="grid grid-cols-8 gap-1 max-h-[240px] overflow-y-auto">
                        {[
                          '😀','😁','😂','🤣','😊','😇','🙂','😉',
                          '😍','🥰','😘','😎','🤩','🥳','😏','🤔',
                          '😴','😢','😭','😡','🤬','😱','🥺','😬',
                          '🙄','😜','🤗','🤝','👍','👎','👏','🙏',
                          '💪','✊','👋','🤞','✌️','🤟','🤘','🫶',
                          '❤️','🧡','💛','💚','💙','💜','🤍','🖤',
                          '🔥','✨','⭐','🎉','🎊','🎁','🎂','🥂',
                          '✅','❌','⚠️','💡','📌','📎','💬','📝',
                          '💻','🖥️','📱','⌨️','🖱️','🛠️','⚙️','🔒',
                          '📞','🎥','🎤','📷','🎮','🚀','☕','🍕'
                        ].map((emoji, idx) => (
                          <button
                            key={`${emoji}-${idx}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addEmoji(emoji)}
                            className="w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center text-[20px] transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    ref={emojiButtonRef}
                    type="button"
                    onClick={() => setShowEmojiPicker((value) => !value)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 transition-colors ${showEmojiPicker ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-[#A0A0A0]'}`}
                    title="Insert emoji"
                  >
                    <Smile size={20} />
                  </button>
                </div>
                <button 
                  onClick={handleSend}
                  className="h-11 w-11 shrink-0 bg-[#1C202B] text-white rounded-2xl flex items-center justify-center hover:bg-[#2A2F3D] transition-all shadow-lg shadow-black/10 active:scale-95 sm:h-12 sm:w-12"
                >
                  <CornerDownLeft size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center bg-white dark:bg-[#080808] font-['Mona_Sans',system-ui,sans-serif] px-6 sm:flex">
          <div className="flex flex-col items-center gap-[45px]">
            {/* Same scene as the desktop app. Loops: the conversation only
                exists in the first half of the timeline, so playing once would
                settle on an empty frame. 520px keeps the baked text legible. */}
            <LottieScene
              animationData={callAndVideoChatAnimation}
              size={520}
              loop
              staticPercent={38}
              label="Call And Video Chat"
            />
            {conversations.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setAddMode('contact');
                  setInviteError(null);
                  setShowAddContact(true);
                }}
                className="h-10 w-[240px] rounded-[4px] text-[14px] font-medium text-white transition hover:brightness-105"
                style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
              >
                {tx('Add contact')}
              </button>
            )}
          </div>
        </div>
      )}

      {chatToast && (
        <div
          role="status"
          style={{ boxShadow: '-6px 6px 18px rgba(0,0,0,0.28)' }}
          className="fixed left-3 right-3 top-[73px] z-[120] flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 font-['Mona_Sans',system-ui,sans-serif] animate-in fade-in slide-in-from-right-4 duration-200 sm:left-auto sm:right-6 sm:w-[460px] sm:max-w-[calc(100vw-32px)]"
          onClick={() => {
            setActiveChat(chatToast.chatId);
            setChatToast(null);
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: 'rgba(0,136,255,0.12)', color: '#0088FF' }}>
              <Bell size={18} />
            </span>
            <div className="min-w-0">
              <p className="m-0 truncate text-[14px] font-medium leading-[20px] text-[#1A1D21]">{chatToast.title}</p>
              <p className="m-0 truncate text-[12px] leading-[17px] text-[#1A1D21]/60">{chatToast.body}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setChatToast(null); }}
            aria-label="Dismiss"
            className="flex h-7 w-7 shrink-0 items-center justify-center text-[#1A1D21] transition-opacity hover:opacity-70"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {accessApprovalRequest && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto flex w-full max-w-[468px] flex-col gap-5 rounded-[12px] bg-white px-4 py-4 shadow-2xl dark:bg-[#1C1C1C] sm:gap-[22px] sm:px-6 sm:py-3 font-['Mona_Sans',system-ui,sans-serif]">
            {/* Header */}
            <div className="flex items-start justify-between gap-6">
              <div className="flex flex-col">
                <h3 className="text-[24px] font-bold leading-[34px] text-[#111315] dark:text-[#F5F5F5]">Approve remote access?</h3>
                <p className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#A0A0A0]">
                  Decide how long {accessApprovalRequest.requesterName || 'this person'} can use your PC.
                </p>
              </div>
              <button
                onClick={() => setAccessApprovalRequest(null)}
                className="w-6 h-6 flex items-center justify-center text-[#111315] dark:text-[#A0A0A0] hover:text-[#FF8A00] transition-colors shrink-0"
                title="Close"
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            {/* Duration presets + custom input */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-5">
                {[15, 30, 60].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => setAccessDurationMinutes(minutes)}
                    className={`px-4 py-2.5 rounded-[32px] text-[14px] font-medium leading-5 transition-colors ${
                      accessDurationMinutes === minutes
                        ? 'bg-[#FFB347] text-[#111315]'
                        : 'bg-white dark:bg-transparent border border-[rgba(26,29,33,0.3)] dark:border-white/10 text-[#111315] dark:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-white/5'
                    }`}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#F5F5F5]">Custom duration in minutes</label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={accessDurationMinutes}
                  onChange={(event) => {
                    const value = Math.max(1, Math.min(480, Number(event.target.value) || 1));
                    setAccessDurationMinutes(value);
                  }}
                  className="w-full h-10 px-4 rounded-[4px] border border-[rgba(26,29,33,0.3)] dark:border-white/10 bg-white dark:bg-transparent text-[14px] font-medium text-[#111315] dark:text-white placeholder:text-[rgba(17,19,21,0.7)] outline-none focus:border-[#FF8A00] transition-colors"
                />
              </div>
            </div>

            {/* Info */}
            <p className="text-[14px] font-medium leading-5 text-[rgba(17,19,21,0.7)] dark:text-[#A0A0A0]">
              Access privileges are valid only for the approved time frame and will expire automatically thereafter
            </p>

            {/* Footer */}
            <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => respondToRemoteAccessRequest(accessApprovalRequest, false)}
                className="h-10 w-full rounded-[32px] border border-[#F3F4F6] bg-white text-[14px] font-medium text-[rgba(26,29,33,0.3)] transition-colors hover:bg-[#F3F4F6] dark:border-white/10 dark:bg-transparent dark:text-[#A0A0A0] dark:hover:bg-white/5 sm:w-[124px]"
              >
                Deny
              </button>
              <button
                onClick={() => respondToRemoteAccessRequest(accessApprovalRequest, true)}
                disabled={isApprovingAccess}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] text-[14px] font-medium text-[#111315] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-[124px]"
              >
                {isApprovingAccess ? <Loader2 size={16} className="animate-spin" /> : null}
                {isApprovingAccess ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Invite Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-4">
          <div className="relative my-auto w-full max-w-[520px] rounded-[20px] bg-white p-5 font-sans shadow-2xl dark:bg-[#1C1C1C] sm:rounded-[24px] sm:p-7">
            <button
              onClick={() => setShowSessionModal(false)}
              className="absolute right-5 top-5 text-gray-400 transition-colors hover:text-gray-800 dark:hover:text-white sm:right-7 sm:top-7"
            >
              <X size={22} strokeWidth={1.5} />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center mb-5">
              <Video size={24} />
            </div>
            <h3 className="text-[22px] font-medium text-[#111111] dark:text-[#F5F5F5] mb-2">Create invitation</h3>
            <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0] mb-6 leading-relaxed">
              Choose the type of session you want to start.
            </p>

            <div className="mb-6 flex flex-col gap-2 rounded-2xl bg-gray-50 p-1 dark:bg-white/5 sm:flex-row">
              <button
                onClick={() => setSessionType('REMOTE_CONTROL')}
                className={`flex-1 py-3.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${sessionType === 'REMOTE_CONTROL' ? 'bg-white dark:bg-white/10 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <Monitor size={16} />
                Remote Control
              </button>
              <button
                onClick={() => setSessionType('VIDEO_MEETING')}
                className={`flex-1 py-3.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${sessionType === 'VIDEO_MEETING' ? 'bg-white dark:bg-white/10 text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <Video size={16} />
                Video Meeting
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Session name"
                className="w-full px-4 py-3 text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-600 transition-colors"
              />
              <input
                type="email"
                value={sessionInviteEmail}
                onChange={(e) => setSessionInviteEmail(e.target.value)}
                placeholder={activeConversation?.isGroup ? "Optional email copy" : "Recipient email"}
                className="w-full px-4 py-3 text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-600 transition-colors"
              />
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-gray-500">Join link</span>
                  <button onClick={() => navigator.clipboard?.writeText(sessionLink)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                    <Copy size={14} />
                  </button>
                </div>
                <p className="text-[12px] font-medium text-[#111111] dark:text-[#F5F5F5] break-all">{sessionLink}</p>
              </div>
            </div>

            {sessionInviteMessage && (
              <div className={`flex items-center gap-2 text-[12px] font-medium mb-5 ${sessionInviteStatus === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                {sessionInviteStatus === 'sent' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {sessionInviteMessage}
              </div>
            )}

            <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={() => setShowSessionModal(false)}
                className="px-4 py-2.5 text-[14px] font-medium text-[#111111] transition-colors hover:text-gray-600 dark:text-[#F5F5F5] dark:hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSendSessionInvite}
                disabled={sessionInviteStatus === 'sending'}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {sessionInviteStatus === 'sending' ? <RefreshCw size={16} className="animate-spin" /> : <Video size={16} />}
                {sessionType === 'VIDEO_MEETING' ? 'Start meeting' : 'Send session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto flex w-full max-w-[468px] flex-col gap-5 rounded-[12px] bg-white px-4 py-4 shadow-2xl dark:bg-[#1C1C1C] sm:gap-[22px] sm:px-6 sm:py-3 font-['Mona_Sans',system-ui,sans-serif]">
            {/* Top row: segmented toggle + close */}
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex min-w-0 flex-1 items-center gap-[7px] rounded-[10px] bg-[#F3F4F6] p-1.5 dark:bg-white/5">
                <button
                  onClick={() => { setAddMode('contact'); setInviteError(null); }}
                  className={`h-10 flex-1 rounded-[4px] text-[14px] font-medium leading-5 transition-colors sm:w-[150px] ${addMode === 'contact' ? 'bg-white dark:bg-[#1C1C1C] text-[#111315] dark:text-white shadow-sm' : 'text-[#111315]/70 dark:text-[#A0A0A0] hover:text-[#111315] dark:hover:text-white'}`}
                >
                  Contact
                </button>
                <button
                  onClick={() => { setAddMode('group'); setInviteError(null); }}
                  className={`h-10 flex-1 rounded-[4px] text-[14px] font-medium leading-5 transition-colors sm:w-[150px] ${addMode === 'group' ? 'bg-white dark:bg-[#1C1C1C] text-[#111315] dark:text-white shadow-sm' : 'text-[#111315]/70 dark:text-[#A0A0A0] hover:text-[#111315] dark:hover:text-white'}`}
                >
                  Group
                </button>
              </div>
              <button
                onClick={() => setShowAddContact(false)}
                className="text-[#111315] dark:text-[#A0A0A0] hover:text-gray-600 dark:hover:text-white transition-colors shrink-0"
              >
                <X size={24} strokeWidth={2} />
              </button>
            </div>

            {/* Title + description */}
            <div className="flex flex-col gap-1.5 w-full">
              <h3 className="text-[24px] font-bold leading-[34px] text-[#111315] dark:text-[#F5F5F5]">
                {addMode === 'contact' ? 'Add contact to your list' : 'Create a group'}
              </h3>
              <p className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#A0A0A0]">
                {addMode === 'contact'
                  ? 'Once the contact accepts your invitation, you can easily start a remote session and exchange messages.'
                  : 'Create a shared space for a team, project, or discussion. Members can start messaging right away.'}
              </p>
            </div>

            {/* Inputs */}
            {addMode === 'contact' ? (
              <div className="flex flex-col gap-2 w-full">
                <label htmlFor="contact-email" className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#F5F5F5]">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && inviteEmail && !isInviting && handleCreateChat()}
                  placeholder="Enter email address"
                  className="w-full h-10 px-4 rounded-[4px] border border-[rgba(26,29,33,0.3)] dark:border-white/10 bg-white dark:bg-transparent text-[14px] font-medium text-[#111315] dark:text-white placeholder:text-[rgba(17,19,21,0.3)] outline-none focus:border-[#FF8A00] transition-colors"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#F5F5F5]">Group name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full h-10 px-4 rounded-[4px] border border-[rgba(26,29,33,0.3)] dark:border-white/10 bg-white dark:bg-transparent text-[14px] font-medium text-[#111315] dark:text-white placeholder:text-[rgba(17,19,21,0.3)] outline-none focus:border-[#FF8A00] transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#F5F5F5]">Members</label>
                  <textarea
                    value={groupEmails}
                    onChange={(e) => setGroupEmails(e.target.value)}
                    placeholder="Member emails, separated by commas or spaces"
                    className="w-full min-h-[88px] px-4 py-2.5 rounded-[4px] border border-[rgba(26,29,33,0.3)] dark:border-white/10 bg-white dark:bg-transparent text-[14px] font-medium text-[#111315] dark:text-white placeholder:text-[rgba(17,19,21,0.3)] outline-none focus:border-[#FF8A00] transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {inviteError && (
              <p className="text-[12px] text-red-500 font-medium animate-in fade-in slide-in-from-top-1">
                {inviteError}
              </p>
            )}

            {/* Actions */}
            <div className="flex w-full flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => setShowAddContact(false)}
                className="h-10 w-full rounded-[32px] border border-[#F3F4F6] bg-white text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.5)] transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-[#A0A0A0] dark:hover:bg-white/5 sm:w-[124px]"
              >
                Cancel
              </button>
              <button
                onClick={addMode === 'contact' ? handleCreateChat : handleCreateGroup}
                disabled={(addMode === 'contact' ? !inviteEmail : !groupName || !groupEmails) || isInviting}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] text-[14px] font-medium leading-5 text-[#111315] transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 sm:w-[124px]"
              >
                {isInviting && <RefreshCw size={16} className="animate-spin" />}
                {isInviting ? 'Working...' : addMode === 'contact' ? 'Send invite' : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Members Modal */}
      {showAddMembersModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-4">
          <div className="relative my-auto flex w-full max-w-[468px] flex-col gap-5 rounded-[12px] bg-white px-4 py-4 shadow-2xl dark:bg-[#1C1C1C] sm:gap-[22px] sm:px-6 sm:py-3 font-['Mona_Sans',system-ui,sans-serif]">
            {/* Header */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-5">
                <h3 className="text-[24px] font-bold leading-[34px] text-[#111315] dark:text-[#F5F5F5]">Add members</h3>
                <button
                  onClick={() => { setShowAddMembersModal(false); setMemberEmails(''); setInviteError(null); }}
                  className="w-6 h-6 flex items-center justify-center text-[#111315] dark:text-[#A0A0A0] hover:text-[#FF8A00] transition-colors"
                  title="Close"
                >
                  <X size={24} strokeWidth={2.5} />
                </button>
              </div>
              <p className="text-[14px] font-normal leading-5 text-[#111315] dark:text-[#A0A0A0]">
                Add people to {getChatName(activeConversation)} by email. They will join the group immediately.
              </p>
            </div>

            {/* Input */}
            <div className="flex flex-col gap-2">
              <textarea
                value={memberEmails}
                onChange={(e) => setMemberEmails(e.target.value)}
                placeholder="Member emails, separated by commas or spaces"
                className="w-full h-20 px-4 py-2.5 text-[14px] font-medium text-[#111315] dark:text-white bg-white dark:bg-transparent rounded-[4px] border border-[rgba(26,29,33,0.3)] dark:border-white/10 placeholder:text-[rgba(17,19,21,0.3)] focus:outline-none focus:border-[#FF8A00] transition-colors resize-none"
              />
              {inviteError && (
                <p className="text-[12px] text-red-500 font-medium animate-in fade-in slide-in-from-top-1">
                  {inviteError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => { setShowAddMembersModal(false); setMemberEmails(''); setInviteError(null); }}
                className="h-10 w-full rounded-[32px] border border-[#F3F4F6] bg-white text-[14px] font-medium text-[rgba(26,29,33,0.3)] transition-colors hover:bg-[#F3F4F6] dark:border-white/10 dark:bg-transparent dark:text-[#A0A0A0] dark:hover:bg-white/5 sm:w-[124px]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                disabled={!memberEmails || isInviting}
                className={`flex h-10 w-full items-center justify-center gap-2 rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] text-[14px] font-medium text-[#111315] transition-opacity sm:w-[124px] ${
                  memberEmails && !isInviting ? 'hover:opacity-90' : 'opacity-50 pointer-events-none'
                }`}
              >
                {isInviting ? <RefreshCw size={16} className="animate-spin" /> : null}
                {isInviting ? 'Adding...' : 'Add members'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Members Modal */}
      {showMembersModal && activeConversation?.isGroup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-4">
          <div className="relative my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-[468px] flex-col gap-5 rounded-[12px] bg-white px-4 py-4 shadow-2xl dark:bg-[#1C1C1C] sm:max-h-[80vh] sm:gap-[22px] sm:px-6 sm:py-3 font-['Mona_Sans',system-ui,sans-serif]">
            {/* Header */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-5">
                <h3 className="text-[24px] font-bold leading-[34px] text-[#111315] dark:text-[#F5F5F5]">Group members</h3>
                <button
                  onClick={() => setShowMembersModal(false)}
                  className="w-6 h-6 flex items-center justify-center text-[#111315] dark:text-[#A0A0A0] hover:text-[#FF8A00] transition-colors"
                  title="Close"
                >
                  <X size={24} strokeWidth={2.5} />
                </button>
              </div>
              <p className="text-[14px] font-medium leading-5 text-[#111315] dark:text-[#A0A0A0]">
                {getChatName(activeConversation)} - {activeGroupMembers.length} member{activeGroupMembers.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* Member list */}
            <div className="flex flex-col gap-[22px] overflow-y-auto pr-1">
              {activeGroupMembers.map((member: any) => {
                const memberName = member.user?.name || member.user?.email || 'Unknown member';
                const isYou = member.userId === user?.id;
                return (
                  <div key={member.userId} className="flex items-center gap-3">
                    {member.user?.avatar ? (
                      <img src={member.user.avatar} alt={memberName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[rgba(255,179,71,0.3)] dark:bg-[#3A2E1A] text-[#111315] dark:text-[#FFB347] flex items-center justify-center text-[16px] font-medium shrink-0">
                        {memberName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                      <p className="text-[16px] font-medium leading-4 text-black/85 dark:text-[#F5F5F5] truncate">
                        {memberName}{isYou ? ' (you)' : ''}
                      </p>
                      <p className="text-[14px] leading-4 text-[rgba(26,29,33,0.7)] dark:text-[#A0A0A0] truncate">{member.user?.email}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => setShowMembersModal(false)}
                className="h-10 w-full rounded-[32px] border border-[#F3F4F6] bg-white text-[14px] font-medium text-[rgba(26,29,33,0.3)] transition-colors hover:bg-[#F3F4F6] dark:border-white/10 dark:bg-transparent dark:text-[#A0A0A0] dark:hover:bg-white/5 sm:w-[124px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowMembersModal(false);
                  setInviteError(null);
                  setShowAddMembersModal(true);
                }}
                className="h-10 w-full rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] text-[14px] font-medium text-[#111315] transition-opacity hover:opacity-90 sm:w-[124px]"
              >
                Add members
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Rename Modal */}
      {isRenaming && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm animate-in fade-in duration-300 sm:p-4">
          <div className="relative flex w-full max-w-[468px] flex-col gap-5 rounded-[12px] bg-white px-4 py-4 shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-[#1C1C1C] sm:gap-[22px] sm:px-6 sm:py-3 font-['Mona_Sans',system-ui,sans-serif]">
            {/* Header */}
            <div className="flex items-center justify-between gap-5">
              <h3 className="text-[24px] font-bold leading-[34px] text-[#111315] dark:text-[#F5F5F5]">Rename Conversation</h3>
              <button
                onClick={() => setIsRenaming(false)}
                className="w-6 h-6 flex items-center justify-center text-[#111315] dark:text-[#A0A0A0] hover:text-[#FF8A00] transition-colors"
                title="Close"
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            {/* Input */}
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  renameConversation(activeChatId!, newName);
                  setIsRenaming(false);
                }
              }}
              className="w-full h-10 px-4 text-[14px] font-medium text-[#111315] dark:text-white bg-white dark:bg-transparent rounded-[4px] border border-[rgba(26,29,33,0.3)] dark:border-white/10 placeholder:text-[rgba(17,19,21,0.3)] focus:outline-none focus:border-[#FF8A00] transition-colors"
              placeholder="New conversation name"
            />

            {/* Footer */}
            <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => setIsRenaming(false)}
                className="h-10 w-full rounded-[32px] border border-[#F3F4F6] bg-white text-[14px] font-medium text-[rgba(26,29,33,0.3)] transition-colors hover:bg-[#F3F4F6] dark:border-white/10 dark:bg-transparent dark:text-[#A0A0A0] dark:hover:bg-white/5 sm:w-[124px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newName.trim()) {
                    renameConversation(activeChatId!, newName);
                    setIsRenaming(false);
                  }
                }}
                disabled={!newName.trim()}
                className={`h-10 w-full rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] text-[14px] font-medium text-[#111315] transition-opacity sm:w-[124px] ${
                  newName.trim() ? 'hover:opacity-90' : 'opacity-50 pointer-events-none'
                }`}
              >
                Update Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Card */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/10 p-3 animate-in fade-in duration-150 sm:p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setShowProfileModal(false)}
        >
          <div className="flex w-full max-w-[340px] flex-col items-end gap-7 rounded-[12px] bg-white px-5 py-5 shadow-[-4px_4px_12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150 dark:bg-[#1C1C1C] sm:gap-9 sm:px-8 font-['Mona_Sans',system-ui,sans-serif]">
            <button
              onClick={() => setShowProfileModal(false)}
              className="text-[#111315] dark:text-[#A0A0A0] transition-colors hover:text-[#FF8A00]"
              title="Close"
            >
              <X size={24} strokeWidth={2.5} />
            </button>

            <div className="flex w-full flex-col items-center gap-9">
              {/* Avatar */}
              <div className="relative">
                {activeParticipant?.avatar ? (
                  <img src={activeParticipant.avatar} alt={getChatName(activeConversation)} className="h-20 w-20 rounded-full object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,179,71,0.3)] dark:bg-[#3A2E1A] text-[30px] font-medium text-[#111315] dark:text-[#FFB347]">
                    {getChatName(activeConversation).charAt(0)}
                  </div>
                )}
                <span className={`absolute bottom-0.5 right-0.5 h-5 w-5 rounded-full border-2 border-white dark:border-[#1C1C1C] ${contactOnline ? 'bg-[#12B76A]' : 'bg-gray-400'}`} />
              </div>

              <div className="flex w-full flex-col gap-7">
                {/* Name + email */}
                <div className="flex flex-col items-center gap-1 text-center">
                  <h3 className="text-[20px] font-medium leading-[28px] text-[#111315] dark:text-[#F5F5F5]">{getChatName(activeConversation)}</h3>
                  <p className="text-[15px] leading-5 text-[#111315]/80 dark:text-[#A0A0A0]">{activeParticipant?.email || 'Direct message'}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-[22px]">
                  <div className="flex flex-1 flex-col items-center gap-0.5 rounded-[4px] bg-[#F3F4F6] dark:bg-white/5 px-4 py-3">
                    <span className="text-[15px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5]">{activeConversation?.isGroup ? 'Group' : 'Direct'}</span>
                    <span className="text-[13px] font-medium leading-[18px] text-[rgba(17,19,21,0.7)] dark:text-[#A0A0A0]">Chat</span>
                  </div>
                  <div className="flex flex-1 flex-col items-center gap-0.5 rounded-[4px] bg-[#F3F4F6] dark:bg-white/5 px-4 py-3">
                    <span className="text-[15px] font-medium leading-5 text-[#111315] dark:text-[#F5F5F5]">{contactOnline ? 'Active' : 'Away'}</span>
                    <span className={`text-[13px] font-medium leading-[18px] ${contactOnline ? 'text-[#12B76A]' : 'text-[#111315]/50 dark:text-[#A0A0A0]'}`}>{contactStatusLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm animate-in fade-in duration-300 sm:p-4">
          <div className="relative w-full max-w-sm rounded-[24px] bg-white p-5 text-center shadow-2xl animate-in zoom-in-95 duration-300 dark:bg-[#111111] sm:rounded-[32px] sm:p-8">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            
            <h3 className="text-[20px] font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">Delete Conversation?</h3>
            <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0] mb-8">
              {activeConversation?.isGroup
                ? 'You will leave this group and stop receiving new messages from it.'
                : 'This will permanently remove this chat and all messages for you. This action cannot be undone.'}
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  deleteConversation(activeChatId!);
                  setShowDeleteModal(false);
                }}
                className="w-full py-3.5 bg-red-500 text-white text-[13px] font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                {activeConversation?.isGroup ? 'Leave Group' : 'Delete for Me'}
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3.5 bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white text-[12px] font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app image viewer / media player — replaces opening images in an OS window.
          Rendered through a portal to <body> so it sits above the global status
          footer and sidebar instead of being trapped in the chat stacking context. */}
      {imageViewer && createPortal((() => {
        const current = imageViewer.images[imageViewer.index];
        const many = imageViewer.images.length > 1;
        const go = (delta: number) =>
          setImageViewer((v) => (v ? { ...v, index: (v.index + delta + v.images.length) % v.images.length } : v));
        return (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setImageViewer(null)}
          >
            {/* Top bar: name, counter, download, close */}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent px-4 py-3" onClick={(e) => e.stopPropagation()}>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/90">{current.name}</span>
              {many && <span className="shrink-0 text-[12px] font-medium text-white/70">{imageViewer.index + 1} / {imageViewer.images.length}</span>}
              <a
                href={current.url}
                download={current.name}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                title="Download"
              >
                <Download size={17} />
              </a>
              <button
                type="button"
                onClick={() => setImageViewer(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Prev / next arrows (media player) */}
            {many && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(-1); }}
                  className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
                  title="Previous"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(1); }}
                  className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
                  title="Next"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            <img
              src={current.url}
              alt={current.name}
              className="max-h-[86vh] max-w-[88vw] rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Thumbnail strip when there are multiple images */}
            {many && (
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 overflow-x-auto bg-gradient-to-t from-black/60 to-transparent px-4 py-3" onClick={(e) => e.stopPropagation()}>
                {imageViewer.images.map((img, i) => (
                  <button
                    key={img.url + i}
                    type="button"
                    onClick={() => setImageViewer((v) => (v ? { ...v, index: i } : v))}
                    className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition-opacity ${i === imageViewer.index ? 'border-[#FF8A00] opacity-100' : 'border-transparent opacity-50 hover:opacity-90'}`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })(), document.body)}
    </div>
  );
};
