import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  MessageCircle,
  Monitor,
  Plus,
  Search,
  Send,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import { useChatStore, type ChatConversation } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';

const parseInvite = (content: string) => {
  if (!content?.startsWith(SESSION_INVITE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SESSION_INVITE_PREFIX.length));
  } catch {
    return null;
  }
};

// Device mentions travel as "@[Device Name](device:ACCESSKEY)".
const DEVICE_MENTION_REGEX = /@\[([^\]\n]{1,80})\]\(device:([A-Za-z0-9]{4,24})\)/g;
const stripDeviceMentions = (text?: string | null) => String(text || '').replace(DEVICE_MENTION_REGEX, '@$1');

const timeLabel = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const dayLabel = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now.getTime() - 86400000);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric' });
};

const initials = (name?: string | null) =>
  String(name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

interface WebChatMobileProps {
  onJoinMeeting: (meetingId: string) => void;
  onOpenDeviceMention: (accessKey: string) => void;
}

/**
 * Dedicated phone-sized chat experience for the web app: full-screen chats
 * list → full-screen thread → full-screen new-chat picker, WhatsApp-style.
 * Deliberately a separate component from SnowChat (which stays the desktop
 * layout) — this is a redesign, not a responsive squeeze. Shares the same
 * chatStore, so messaging/presence/unread behave identically.
 */
export const WebChatMobile: React.FC<WebChatMobileProps> = ({ onJoinMeeting, onOpenDeviceMention }) => {
  const { user } = useAuthStore();
  const {
    conversations,
    messages,
    unreadCounts,
    onlineUsers,
    typingUsers,
    isLoading,
    setActiveChat,
    markRead,
    fetchConversations,
    fetchMessages,
    createConversation,
    sendMessage,
    sendTyping,
    acceptInvite,
    rejectInvite,
    connectWebSocket,
  } = useChatStore();

  const [view, setView] = useState<'list' | 'thread' | 'new'>('list');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [newBusy, setNewBusy] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const lastTypingSentRef = useRef(0);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  useEffect(() => {
    connectWebSocket();
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phone-style back navigation: opening a subview pushes a history entry so
  // the hardware/browser back gesture returns to the chats list instead of
  // leaving the page.
  useEffect(() => {
    const onPop = () => {
      if (viewRef.current !== 'list') {
        setView('list');
        setOpenId(null);
        setActiveChat(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setActiveChat]);

  const pushView = (next: 'thread' | 'new') => {
    window.history.pushState({ chatMobile: next }, '');
    setView(next);
  };
  const goBack = () => window.history.back();

  const openConversation = (conv: ChatConversation) => {
    setOpenId(conv.id);
    setActiveChat(conv.id);
    markRead(conv.id);
    fetchMessages(conv.id);
    setDraft('');
    pushView('thread');
  };

  const chatName = (conv: ChatConversation) => {
    if (conv.isGroup) return conv.name || 'Group';
    const other = conv.participants.find((p) => p.userId !== user?.id);
    return other?.nickname || other?.user?.name || other?.user?.email || 'Contact';
  };

  const otherUserId = (conv: ChatConversation) => conv.participants.find((p) => p.userId !== user?.id)?.userId;

  const isOnline = (conv: ChatConversation) => {
    if (conv.isGroup) return false;
    const other = otherUserId(conv);
    return Boolean(conv.otherOnline || (other && onlineUsers[other]));
  };

  const previewText = (conv: ChatConversation) => {
    const last = conv.messages?.[conv.messages.length - 1];
    if (!last) return conv.status === 'PENDING' ? 'Invitation' : 'Say hi';
    const invite = parseInvite(last.content);
    if (invite) {
      if (invite.sessionType === 'VIDEO_MEETING') return 'Meeting invitation';
      return 'Remote access request';
    }
    const mine = last.senderId === user?.id ? 'You: ' : '';
    return `${mine}${stripDeviceMentions(last.content)}`;
  };

  const visibleConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations
      .filter((conv) => conv.status !== 'REJECTED')
      .filter((conv) => (filter === 'unread' ? (unreadCounts[conv.id] || 0) > 0 : true))
      .filter((conv) => (query ? chatName(conv).toLowerCase().includes(query) : true))
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, filter, search, unreadCounts, user?.id]);

  const openConv = conversations.find((conv) => conv.id === openId) || null;
  const threadMessages = (openId ? messages[openId] : undefined) || [];
  const typing = openId ? typingUsers[openId] : undefined;
  const typingActive = Boolean(typing && typing.userId !== user?.id && Date.now() - typing.at < 4500);

  // Keep the newest message visible and the thread marked read while open.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' });
    if (view === 'thread' && openId) markRead(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadMessages.length, view]);

  const submitDraft = () => {
    const text = draft.trim();
    if (!text || !openId) return;
    sendMessage(openId, text);
    setDraft('');
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!openId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendTyping(openId, user?.name || undefined);
    }
  };

  const startNewChat = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setNewBusy(true);
    setNewError(null);
    const result = await createConversation(email);
    setNewBusy(false);
    if (!result.success) {
      setNewError(result.error || 'Could not start the chat.');
      return;
    }
    setNewEmail('');
    await fetchConversations();
    const conv = useChatStore
      .getState()
      .conversations.find((c) => !c.isGroup && c.participants.some((p) => p.user?.email?.toLowerCase() === email));
    window.history.back();
    if (conv) window.setTimeout(() => openConversation(conv), 60);
  };

  const renderMessageBody = (content: string, mine: boolean) => {
    const invite = parseInvite(content);
    if (invite) {
      if (invite.sessionType === 'VIDEO_MEETING') {
        return (
          <span className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-[13px] font-semibold"><Video size={15} /> {invite.sessionName || 'Meeting invitation'}</span>
            <button
              type="button"
              onClick={() => invite.sessionCode && onJoinMeeting(String(invite.sessionCode))}
              className="h-9 rounded-lg px-4 text-[13px] font-semibold text-white"
              style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
            >
              Join meeting
            </button>
          </span>
        );
      }
      const label =
        invite.kind === 'remote-access-request'
          ? `${invite.requesterName || 'Someone'} requested remote access`
          : invite.kind === 'remote-access-response'
            ? `${invite.approverName || 'Someone'} ${invite.approved ? 'approved' : 'declined'} remote access`
            : invite.kind === 'meeting-invite-response'
              ? `${invite.responderName || 'Someone'} responded to the invite`
              : 'Session update';
      return <span className="text-[12px] italic opacity-80">{label}</span>;
    }
    // Plain text with tappable device chips.
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(DEVICE_MENTION_REGEX.source, 'g');
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
      const [, name, accessKey] = match;
      parts.push(
        <button
          key={`${accessKey}-${match.index}`}
          type="button"
          onClick={() => onOpenDeviceMention(accessKey)}
          className={`mx-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[12px] font-semibold ${mine ? 'bg-white/60 text-[#7A4A00]' : 'bg-[#FFF1E0] text-[#9A5400]'}`}
        >
          <Monitor size={11} /> {name}
        </button>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) parts.push(content.slice(lastIndex));
    return <span className="whitespace-pre-wrap break-words">{parts}</span>;
  };

  // ---- New chat ------------------------------------------------------------
  if (view === 'new') {
    const contacts = conversations.filter((conv) => !conv.isGroup && conv.status === 'ACCEPTED');
    return (
      <div className="flex h-full w-full flex-col bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
        <div className="flex h-14 flex-none items-center gap-3 border-b border-[rgba(26,29,33,0.1)] px-4">
          <button type="button" onClick={goBack} aria-label="Close new chat" className="flex h-9 w-9 items-center justify-center rounded-full text-[#111315] active:bg-[#F3F4F6]">
            <X size={20} />
          </button>
          <span className="text-[16px] font-semibold text-[#111315]">New chat</span>
        </div>
        <div className="flex-none px-4 py-3">
          <form
            onSubmit={(event) => { event.preventDefault(); startNewChat(); }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="name@company.com"
              className="h-11 min-w-0 flex-1 rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00]"
            />
            <button
              type="submit"
              disabled={newBusy || !newEmail.trim()}
              className="flex h-11 flex-none items-center justify-center rounded-xl px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
            >
              <UserPlus size={16} className="mr-1.5" /> {newBusy ? 'Inviting…' : 'Invite'}
            </button>
          </form>
          {newError && <p className="m-0 mt-2 text-[12px] text-[#D64545]">{newError}</p>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {contacts.length > 0 && <p className="m-0 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#111315]/40">Contacts</p>}
          {contacts.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => { window.history.back(); window.setTimeout(() => openConversation(conv), 60); }}
              className="flex w-full items-center gap-3 border-t border-[rgba(26,29,33,0.06)] px-4 py-3 text-left active:bg-[#F9FAFB]"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#FFF1E0] text-[12px] font-semibold text-[#9A5400]">{initials(chatName(conv))}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#111315]">{chatName(conv)}</span>
              {isOnline(conv) && <span className="h-2 w-2 flex-none rounded-full bg-[#34C759]" />}
            </button>
          ))}
          {contacts.length === 0 && (
            <p className="m-0 px-4 pt-6 text-center text-[13px] text-[#111315]/45">
              Invite a teammate by email to start your first chat.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- Thread --------------------------------------------------------------
  if (view === 'thread' && openConv) {
    const name = chatName(openConv);
    const pendingIncoming = openConv.status === 'PENDING' && openConv.requestedById !== user?.id;
    let lastDay = '';
    return (
      <div className="flex h-full w-full flex-col bg-[#F7F8FA]" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
        <div className="flex h-14 flex-none items-center gap-2 border-b border-[rgba(26,29,33,0.1)] bg-white px-2">
          <button type="button" onClick={goBack} aria-label="Back to chats" className="flex h-10 w-10 items-center justify-center rounded-full text-[#111315] active:bg-[#F3F4F6]">
            <ArrowLeft size={20} />
          </button>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FFF1E0] text-[12px] font-semibold text-[#9A5400]">{initials(name)}</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[14px] font-semibold leading-4 text-[#111315]">{name}</p>
            <p className={`m-0 text-[11px] leading-4 ${typingActive ? 'text-[#FF8A00]' : isOnline(openConv) ? 'text-[#34C759]' : 'text-[#111315]/40'}`}>
              {typingActive ? 'typing…' : isOnline(openConv) ? 'online' : 'offline'}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {pendingIncoming && (
            <div className="mb-3 flex flex-col items-center gap-2 rounded-xl border border-[rgba(26,29,33,0.08)] bg-white p-4 text-center">
              <p className="m-0 text-[13px] text-[#111315]/70">{name} wants to connect with you.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => acceptInvite(openConv.id)} className="flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white" style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}>
                  <Check size={15} /> Accept
                </button>
                <button type="button" onClick={() => { rejectInvite(openConv.id); goBack(); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(26,29,33,0.2)] px-4 text-[13px] font-medium text-[#111315]">
                  <X size={15} /> Decline
                </button>
              </div>
            </div>
          )}
          {threadMessages.map((message) => {
            const mine = message.senderId === user?.id;
            const day = dayLabel(message.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <React.Fragment key={message.id}>
                {showDay && <p className="m-0 py-2 text-center text-[11px] font-medium text-[#111315]/40">{day}</p>}
                <div className={`mb-1.5 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] px-3 py-2 text-[14px] leading-5 text-[#111315] ${
                      mine
                        ? 'rounded-[14px] rounded-br-[4px] bg-[#FFE9D2]'
                        : 'rounded-[14px] rounded-bl-[4px] border border-[rgba(26,29,33,0.06)] bg-white'
                    }`}
                  >
                    {openConv.isGroup && !mine && (
                      <span className="block text-[11px] font-semibold text-[#9A5400]">{message.sender?.name || 'Member'}</span>
                    )}
                    {renderMessageBody(message.content, mine)}
                    <span className="mt-0.5 block text-right text-[10px] text-[#111315]/35">{timeLabel(message.createdAt)}</span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={listEndRef} />
        </div>
        <div
          className="flex flex-none items-end gap-2 border-t border-[rgba(26,29,33,0.08)] bg-white px-3 py-2"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitDraft(); } }}
            placeholder="Message"
            maxLength={2000}
            className="h-11 min-w-0 flex-1 rounded-full border border-[rgba(26,29,33,0.15)] bg-[#F7F8FA] px-4 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00]"
          />
          <button
            type="button"
            onClick={submitDraft}
            disabled={!draft.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    );
  }

  // ---- Chats list ----------------------------------------------------------
  return (
    <div className="relative flex h-full w-full flex-col bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="flex-none px-4 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[20px] font-semibold text-[#111315]">Chats</h2>
          <button
            type="button"
            aria-label="Search chats"
            onClick={() => { setSearchOpen((open) => !open); setSearch(''); }}
            className={`flex h-9 w-9 items-center justify-center rounded-full active:bg-[#F3F4F6] ${searchOpen ? 'text-[#FF8A00]' : 'text-[#111315]/70'}`}
          >
            <Search size={19} />
          </button>
        </div>
        {searchOpen && (
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search chats"
            className="mt-2 h-10 w-full rounded-xl border border-[rgba(26,29,33,0.2)] bg-[#F9FAFB] px-4 text-[14px] text-[#111315] outline-none focus:border-[#FF8A00]"
          />
        )}
        <div className="mt-3 flex gap-2">
          {(['all', 'unread'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`h-8 rounded-full px-4 text-[12px] font-semibold capitalize ${
                filter === key ? 'bg-[#111315] text-white' : 'border border-[rgba(26,29,33,0.15)] text-[#111315]/70'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto border-t border-[rgba(26,29,33,0.06)]">
        {isLoading && conversations.length === 0 && (
          <p className="m-0 px-4 pt-8 text-center text-[13px] text-[#111315]/45">Loading chats…</p>
        )}
        {!isLoading && visibleConversations.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 pt-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1E0] text-[#FF8A00]"><MessageCircle size={26} /></span>
            <p className="m-0 text-[15px] font-semibold text-[#111315]">{filter === 'unread' ? 'No unread chats' : 'Start your first chat'}</p>
            {filter === 'all' && <p className="m-0 text-[13px] text-[#111315]/50">Your messages are private. Invite a teammate to begin.</p>}
          </div>
        )}
        {visibleConversations.map((conv) => {
          const unread = unreadCounts[conv.id] || 0;
          const lastAt = conv.messages?.[conv.messages.length - 1]?.createdAt || conv.updatedAt;
          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => openConversation(conv)}
              className="flex w-full items-center gap-3 border-b border-[rgba(26,29,33,0.06)] px-4 py-3 text-left active:bg-[#F9FAFB]"
            >
              <span className="relative flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#FFF1E0] text-[13px] font-semibold text-[#9A5400]">
                {initials(chatName(conv))}
                {isOnline(conv) && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#34C759]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-[14px] ${unread ? 'font-semibold' : 'font-medium'} text-[#111315]`}>{chatName(conv)}</span>
                  <span className="flex-none text-[11px] text-[#111315]/40">{timeLabel(lastAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-[12px] ${unread ? 'font-medium text-[#111315]/80' : 'text-[#111315]/50'}`}>
                    {conv.status === 'PENDING' && conv.requestedById === user?.id ? 'Invite sent' : previewText(conv)}
                  </span>
                  {unread > 0 && (
                    <span className="flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-[#FF8A00] px-1.5 text-[10px] font-bold text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
        <div className="h-24" />
      </div>
      <button
        type="button"
        onClick={() => { setNewEmail(''); setNewError(null); pushView('new'); }}
        aria-label="New chat"
        className="absolute bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl active:scale-95"
        style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
      >
        <Plus size={26} />
      </button>
    </div>
  );
};

export default WebChatMobile;
