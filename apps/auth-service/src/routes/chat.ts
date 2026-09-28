import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma, verifyToken, redisPublisher, generateToken } from '@remotelink/shared';
import bcrypt from 'bcryptjs';
import { sendTemplatedEmail, escapeHtml } from '../utils/emailTemplates';
import { getPublicWebUrl } from '../utils/publicUrls';
import fs from 'fs';
import path from 'path';
import { randomUUID as uuidv4 } from 'crypto';

const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';
const REMOTE_SESSION_LINK_TTL_MS = Number(process.env.REMOTE_SESSION_LINK_TTL_MINUTES || 1440) * 60 * 1000;
const MEETING_LINK_TTL_MS = Number(process.env.MEETING_LINK_TTL_MINUTES || 30) * 60 * 1000;
// "Meeting for later" links (created from the New meeting menu or scheduled via
// Google Calendar) must outlive the instant-meeting TTL. Default: 7 days.
const MEETING_LATER_TTL_MS = Number(process.env.MEETING_LATER_TTL_MINUTES || 7 * 24 * 60) * 60 * 1000;
// How long an ended meeting stays in Recent Meetings.
const RECENT_MEETING_WINDOW_MS = Number(process.env.RECENT_MEETING_WINDOW_HOURS || 24) * 60 * 60 * 1000;
// A live (IN_PROGRESS) meeting nothing has touched for this long is assumed
// orphaned (the signaling service lost its room state in a restart).
const MEETING_STALE_LIVE_MS = Number(process.env.MEETING_STALE_LIVE_HOURS || 24) * 60 * 60 * 1000;

const getInviteInstallUrl = () => {
  return process.env.DESKTOP_DOWNLOAD_URL || 'https://remote365.ai/downloads/desktop/';
};

const getMeetingWebUrl = (code: string) => {
  const webBase = getPublicWebUrl();
  const cleanCode = String(code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${webBase}/meeting/${encodeURIComponent(cleanCode)}`;
};

// Support-session invites point at the public web join page, which hands
// off to the desktop app (remote365://join) or offers the download. Email
// clients refuse custom-scheme links, so the app link alone was a dead button.
const getSessionWebUrl = (code: string) => {
  const webBase = getPublicWebUrl();
  const cleanCode = String(code || '').replace(/\D/g, '');
  return `${webBase}/join/${encodeURIComponent(cleanCode)}`;
};

const getSafeJoinLink = (sessionLink: string) => {
  try {
    const parsed = new URL(sessionLink);
    parsed.searchParams.delete('password');
    return parsed.toString();
  } catch {
    return sessionLink.replace(/([?&])password=[^&]*/i, '$1').replace(/[?&]$/, '');
  }
};

const generateMeetingCode = () => {
  const raw = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}`;
};

const normalizeMeetingCode = (code: string) => String(code || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const getRemoteSessionTtl = (type?: string) => type === 'VIDEO_MEETING' ? MEETING_LINK_TTL_MS : REMOTE_SESSION_LINK_TTL_MS;

const getRemoteSessionExpiresAt = (session: any) =>
  session.expiresAt
    ? new Date(session.expiresAt)
    : new Date(new Date(session.createdAt).getTime() + getRemoteSessionTtl(session.type));

const decorateRemoteSession = (session: any) => {
  const expiresAt = getRemoteSessionExpiresAt(session);
  // A meeting that is IN_PROGRESS is live regardless of its link expiry: the
  // TTL bounds how long an UNUSED link can be joined, not how long a call may
  // run. Only an unused (ACTIVE) link expires.
  const isExpired = session.status !== 'IN_PROGRESS' && expiresAt.getTime() <= Date.now();
  // Who took the seat (support sessions): the collaborator that joined.
  const joined = Array.isArray(session.collaborators)
    ? session.collaborators.find((c: any) => c?.status === 'JOINED' || (session.joinedById && c?.userId === session.joinedById))
    : null;
  return {
    ...session,
    expiresAt,
    isExpired,
    joinedByName: joined ? (joined.user?.name || joined.name || joined.user?.email || joined.email || null) : null,
    status: isExpired && session.status === 'ACTIVE' ? 'EXPIRED' : session.status
  };
};

// Structured cards addressed to specific people (a remote-access request inside
// a group) are only for those people and the sender. They used to be hidden
// client-side only; the server no longer hands them out at all.
const isMessageVisibleTo = (message: any, userId: string) => {
  const content = String(message?.content || '');
  if (!content.startsWith(SESSION_INVITE_PREFIX) || message?.senderId === userId) return true;
  try {
    const payload = JSON.parse(content.slice(SESSION_INVITE_PREFIX.length));
    const targets: string[] = Array.isArray(payload?.targetUserIds) ? payload.targetUserIds.map(String) : [];
    return targets.length === 0 || targets.includes(String(userId));
  } catch {
    return true;
  }
};

const sendSessionInviteEmail = async ({
  to,
  senderName,
  sessionName,
  sessionCode,
  sessionPassword,
  sessionLink,
  isExistingUser,
  sessionType = 'REMOTE_CONTROL'
}: {
  to: string;
  senderName: string;
  sessionName: string;
  sessionCode: string;
  sessionPassword?: string;
  sessionLink: string;
  isExistingUser: boolean;
  sessionType?: string;
}) => {
  const isMeeting = sessionType === 'VIDEO_MEETING';
  const typeLabel = isMeeting ? 'Video Meeting' : 'Remote 365 Session';
  const actionLabel = isMeeting ? 'Join meeting' : 'Join session';

  const installUrl = getInviteInstallUrl();
  const installCopy = isExistingUser
    ? `Open Remote 365 to join from your notification, or use the link below.`
    : `Install Remote 365 first, then open this invite link to join the ${isMeeting ? 'meeting' : 'session'}.`;

  const result = await sendTemplatedEmail({
    to,
    key: 'session-invite',
    vars: {
      senderName,
      typeLabel,
      actionLabel,
      itemLabel: isMeeting ? 'Meeting' : 'Session',
      sessionName,
      sessionCode,
      sessionLink,
      installCopy,
      installUrl,
      passwordLine: sessionPassword ? `\nPassword: ${sessionPassword}` : '',
      passwordBlock: sessionPassword
        ? `\n          <p style="margin:6px 0 0;color:#667085;font-size:13px">Password: <strong style="color:#172033">${escapeHtml(sessionPassword)}</strong></p>`
        : '',
    },
  });
  if (!result.sent) console.log(`[Session Invite] Email skipped (${result.skipped}). Invite for ${to}: ${sessionLink}`);
};

export default async function chatRoutes(fastify: FastifyInstance) {
  const conversationInclude = {
    participants: {
      include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } }
    },
    messages: {
      take: 1,
      orderBy: { createdAt: 'desc' as const }
    }
  };

  const publishConversationEvent = async (event: string, conversation: any, extra: Record<string, any> = {}) => {
    const targetUserIds = conversation?.participants?.map((p: any) => p.userId) || [];
    if (targetUserIds.length === 0) return;

    await redisPublisher.publish('chat:conversation-updated', JSON.stringify({
      type: event,
      conversation,
      conversationId: conversation.id,
      targetUserIds,
      ...extra
    }));
  };

  const publishAccountSync = async (targetUserIds: Array<string | null | undefined>, scope: string, action: string, entityId?: string) => {
    const uniqueUserIds = Array.from(new Set(targetUserIds.filter(Boolean))) as string[];
    if (uniqueUserIds.length === 0) return;
    await redisPublisher.publish('account:sync', JSON.stringify({
      type: 'account-sync',
      scope,
      action,
      entityId,
      targetUserIds: uniqueUserIds,
      changedAt: new Date().toISOString()
    }));
  };

  // Middleware to authenticate user
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const cleanUrl = request.url.split('?')[0];
    const isPublicMeetingCreate =
      request.method === 'POST' &&
      cleanUrl.endsWith('/meetings');
    // Landing-page (logged-out) meeting invite: emails the invitee and, if they
    // are a registered user, pushes an in-app notification. Rate-limited in-handler.
    const isPublicMeetingInvite =
      request.method === 'POST' &&
      cleanUrl.endsWith('/public-meeting-invite');
    // Attachments are loaded by <img>/<audio> tags, which cannot send an
    // Authorization header. File IDs are unguessable UUIDs (unlisted-link model).
    const isPublicFileFetch =
      request.method === 'GET' &&
      /\/files\/[A-Za-z0-9._-]+$/.test(cleanUrl);

    if (!authHeader) {
      if (isPublicMeetingCreate || isPublicFileFetch || isPublicMeetingInvite) return;
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (isPublicFileFetch) return;

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return reply.code(401).send({ error: 'Invalid token' });

    (request as any).userId = decoded.userId;
  });

  // 1. Get all conversations for the user
  fastify.get('/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;

    try {
      const allConversations = await (prisma as any).conversation.findMany({
        where: {
          participants: {
            some: { userId }
          }
        },
        include: conversationInclude,
        orderBy: { updatedAt: 'desc' }
      });

      // "Delete for me" hides a chat from this person until something new
      // arrives in it; the other person's copy is untouched.
      const conversations = allConversations.filter((conversation: any) => {
        const me = conversation.participants?.find((p: any) => p.userId === userId);
        if (!me?.clearedAt) return true;
        const latest = conversation.messages?.[0];
        return Boolean(latest && new Date(latest.createdAt).getTime() > new Date(me.clearedAt).getTime());
      });

      // Unread counts from the server-side read marker, so reading a chat on one
      // device clears its badge everywhere (they used to live in localStorage).
      const unreadByConversation = new Map<string, number>();
      if (conversations.length > 0) {
        const rows: Array<{ conversationId: string; unread: number }> = await (prisma as any).$queryRawUnsafe(
          `SELECT m."conversationId", COUNT(*)::int AS unread
             FROM "Message" m
             JOIN "ConversationParticipant" p
               ON p."conversationId" = m."conversationId" AND p."userId" = $1
            WHERE m."conversationId" = ANY($2::text[])
              AND m."senderId" <> $1
              AND m."deletedAt" IS NULL
              AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
              AND (p."clearedAt" IS NULL OR m."createdAt" > p."clearedAt")
            GROUP BY m."conversationId"`,
          userId,
          conversations.map((c: any) => c.id)
        );
        rows.forEach((row) => unreadByConversation.set(row.conversationId, Number(row.unread) || 0));
      }

      // Annotate each direct chat with whether the other participant is online
      // (the signaling service marks `chat:online:<userId>` in Redis).
      const enriched = await Promise.all(conversations.map(async (conversation: any) => {
        const unreadCount = unreadByConversation.get(conversation.id) || 0;
        if (conversation.isGroup) return { ...conversation, otherOnline: false, unreadCount };
        const other = conversation.participants?.find((p: any) => p.userId !== userId);
        if (!other?.userId) return { ...conversation, otherOnline: false, unreadCount };
        try {
          const online = await redisPublisher.exists(`chat:online:${other.userId}`);
          return { ...conversation, otherOnline: online === 1, unreadCount };
        } catch {
          return { ...conversation, otherOnline: false, unreadCount };
        }
      }));

      console.log(`[Chat API] Fetched ${conversations.length} conversations for user ${userId}`);

      return reply.send(enriched);
    } catch (err) {
      console.error('[Chat API] Failed to fetch conversations', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Register an Expo push token for this user (for offline message notifications).
  fastify.post('/push-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { token } = request.body as { token?: string; platform?: string };
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    if (!token) return reply.code(400).send({ error: 'Token required' });
    try {
      await redisPublisher.sadd(`chat:pushtokens:${userId}`, token);
      await redisPublisher.set(`chat:pushtoken:owner:${token}`, userId);
      return reply.send({ ok: true });
    } catch (err) {
      console.error('[Chat API] Failed to save push token', err);
      return reply.code(500).send({ error: 'Failed to save token' });
    }
  });

  // 2. Get messages for a specific conversation
  // Search message text across every conversation the caller is in (the
  // sidebar search). Respects "delete for me" cut-offs and deleted messages.
  fastify.get('/messages/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { q, limit } = request.query as { q?: string; limit?: string };
    const term = String(q || '').trim();
    if (term.length < 2) return reply.send([]);
    try {
      const parts = await (prisma as any).conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true, clearedAt: true },
      });
      if (parts.length === 0) return reply.send([]);
      const take = Math.min(100, Math.max(10, Number(limit) || 40));
      const rows = await (prisma as any).message.findMany({
        where: {
          content: { contains: term, mode: 'insensitive' },
          deletedAt: null,
          OR: parts.map((part: any) => ({
            conversationId: part.conversationId,
            ...(part.clearedAt ? { createdAt: { gt: new Date(part.clearedAt) } } : {}),
          })),
        },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true, conversationId: true, content: true, createdAt: true, senderId: true,
          sender: { select: { id: true, name: true, email: true } },
        },
      });
      return reply.send(rows.filter((message: any) => isMessageVisibleTo(message, userId)));
    } catch (err) {
      console.error('[Chat API] Message search failed', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/conversations/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      // Diagnostic logging
      const allParticipants = await (prisma as any).conversationParticipant.findMany({
        where: { conversationId: id },
        include: { user: { select: { id: true, email: true } } }
      });
      console.log(`[Chat API] GET messages for ${id}. Participants in DB:`, allParticipants.map((p: any) => p.userId));
      console.log(`[Chat API] Requesting User ID:`, userId);

      // Ensure the user is a participant
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });

      if (!participant) {
        console.warn(`[Chat API] Access denied: User ${userId} is not in conversation ${id}`);
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { search, before, limit } = request.query as { search?: string; before?: string; limit?: string };
      const pageSize = Math.min(500, Math.max(20, Number(limit) || 150));
      const beforeDate = before ? new Date(before) : null;
      const createdAt: Record<string, Date> = {};
      // "Delete for me" hides everything before the participant's cut-off.
      if (participant.clearedAt) createdAt.gt = new Date(participant.clearedAt);
      if (beforeDate && !Number.isNaN(beforeDate.getTime())) createdAt.lt = beforeDate;
      // Newest page first (flipped to chronological below) instead of the whole
      // history in one response; the client asks for earlier pages with ?before=.
      const page = await (prisma as any).message.findMany({
        where: {
          conversationId: id,
          ...(Object.keys(createdAt).length ? { createdAt } : {}),
          ...(search ? { content: { contains: String(search), mode: 'insensitive' }, deletedAt: null } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
          replyTo: { select: { id: true, content: true, senderId: true, attachmentName: true, sender: { select: { name: true, email: true } } } }
        }
      });
      const messages = page.reverse().filter((message: any) => isMessageVisibleTo(message, userId));
      return reply.send(messages);
    } catch (err) {
      console.error('[Chat API] Failed to fetch messages', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Broadcast a message mutation (edit/delete/reaction/pin) to all participants.
  const broadcastMessageUpdate = async (conversationId: string, message: any) => {
    const participants = await (prisma as any).conversationParticipant.findMany({
      where: { conversationId }, select: { userId: true }
    });
    await redisPublisher.publish('chat:new-message', JSON.stringify({
      type: 'chat-message-updated',
      message,
      conversationId,
      targetUserIds: participants.map((p: any) => p.userId)
    }));
  };

  const messageMutationInclude = {
    sender: { select: { id: true, name: true, email: true, avatar: true } },
    replyTo: { select: { id: true, content: true, senderId: true, attachmentName: true, sender: { select: { name: true, email: true } } } }
  };

  // Edit own message.
  fastify.patch('/messages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    const clean = String(content || '').trim();
    if (!clean) return reply.code(400).send({ error: 'Message content is required' });
    try {
      const existing = await (prisma as any).message.findUnique({ where: { id } });
      if (!existing || existing.senderId !== userId) return reply.code(403).send({ error: 'You can only edit your own messages' });
      if (existing.deletedAt) return reply.code(410).send({ error: 'This message was deleted' });
      const message = await (prisma as any).message.update({
        where: { id },
        data: { content: clean, editedAt: new Date() },
        include: messageMutationInclude
      });
      await broadcastMessageUpdate(existing.conversationId, message);
      return reply.send(message);
    } catch (err) {
      console.error('[Chat API] Failed to edit message', err);
      return reply.code(500).send({ error: 'Could not edit message' });
    }
  });

  // Delete own message (soft delete — content is blanked, tombstone remains).
  fastify.delete('/messages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    try {
      const existing = await (prisma as any).message.findUnique({ where: { id } });
      if (!existing || existing.senderId !== userId) return reply.code(403).send({ error: 'You can only delete your own messages' });
      const message = await (prisma as any).message.update({
        where: { id },
        data: { content: '', deletedAt: new Date(), attachmentUrl: null, attachmentName: null, attachmentType: null, attachmentSize: null, pinned: false },
        include: messageMutationInclude
      });
      await broadcastMessageUpdate(existing.conversationId, message);
      return reply.send(message);
    } catch (err) {
      console.error('[Chat API] Failed to delete message', err);
      return reply.code(500).send({ error: 'Could not delete message' });
    }
  });

  // Toggle an emoji reaction on a message.
  fastify.post('/messages/:id/react', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { emoji } = request.body as { emoji: string };
    const cleanEmoji = String(emoji || '').slice(0, 16);
    if (!cleanEmoji) return reply.code(400).send({ error: 'Emoji is required' });
    try {
      const existing = await (prisma as any).message.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: 'Message not found' });
      const member = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: existing.conversationId, userId }
      });
      if (!member) return reply.code(403).send({ error: 'Forbidden' });
      const reactions: Record<string, string[]> = (existing.reactions as any) || {};
      const current = new Set(reactions[cleanEmoji] || []);
      if (current.has(userId)) current.delete(userId); else current.add(userId);
      if (current.size) reactions[cleanEmoji] = Array.from(current); else delete reactions[cleanEmoji];
      const message = await (prisma as any).message.update({
        where: { id },
        data: { reactions },
        include: messageMutationInclude
      });
      await broadcastMessageUpdate(existing.conversationId, message);
      return reply.send(message);
    } catch (err) {
      console.error('[Chat API] Failed to react to message', err);
      return reply.code(500).send({ error: 'Could not update reaction' });
    }
  });

  // Pin / unpin a message (any participant).
  fastify.post('/messages/:id/pin', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { pinned } = request.body as { pinned: boolean };
    try {
      const existing = await (prisma as any).message.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: 'Message not found' });
      const member = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: existing.conversationId, userId }
      });
      if (!member) return reply.code(403).send({ error: 'Forbidden' });
      const message = await (prisma as any).message.update({
        where: { id },
        data: { pinned: Boolean(pinned) },
        include: messageMutationInclude
      });
      await broadcastMessageUpdate(existing.conversationId, message);
      return reply.send(message);
    } catch (err) {
      console.error('[Chat API] Failed to pin message', err);
      return reply.code(500).send({ error: 'Could not pin message' });
    }
  });

  // Mute / unmute a conversation for the current user only.
  fastify.post('/conversations/:id/mute', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { muted } = request.body as { muted: boolean };
    try {
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });
      if (!participant) return reply.code(403).send({ error: 'Forbidden' });
      await (prisma as any).conversationParticipant.update({
        where: { id: participant.id },
        data: { muted: Boolean(muted) }
      });

      const conversation = await (prisma as any).conversation.findUnique({
        where: { id },
        include: conversationInclude
      });
      if (conversation) {
        await publishConversationEvent('chat-conversation-updated', conversation, {
          actorUserId: userId,
          reason: 'mute-updated'
        });
      }

      return reply.send({ muted: Boolean(muted), conversation });
    } catch (err) {
      console.error('[Chat API] Failed to mute conversation', err);
      return reply.code(500).send({ error: 'Could not update mute preference' });
    }
  });

  // Upload a chat attachment (base64 JSON — files land on the service volume).
  fastify.post('/uploads', { bodyLimit: 15 * 1024 * 1024 }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { name, type, data } = request.body as { name: string; type?: string; data: string };
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    if (!data) return reply.code(400).send({ error: 'File data is required' });
    try {
      const buffer = Buffer.from(String(data).replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (!buffer.length) return reply.code(400).send({ error: 'File is empty' });
      if (buffer.length > 10 * 1024 * 1024) return reply.code(413).send({ error: 'Files up to 10 MB are supported' });
      const uploadDir = process.env.CHAT_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'chat');
      await fs.promises.mkdir(uploadDir, { recursive: true });
      const safeName = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
      const fileId = `${uuidv4()}-${safeName}`;
      await fs.promises.writeFile(path.join(uploadDir, fileId), buffer);
      return reply.send({
        url: `/api/chat/files/${fileId}`,
        name: safeName,
        type: type || 'application/octet-stream',
        size: buffer.length
      });
    } catch (err) {
      console.error('[Chat API] Failed to store upload', err);
      return reply.code(500).send({ error: 'Could not upload file' });
    }
  });

  // Serve a chat attachment. File IDs are unguessable UUIDs.
  fastify.get('/files/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const safeId = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeId) return reply.code(400).send({ error: 'Invalid file' });
    try {
      const uploadDir = process.env.CHAT_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'chat');
      const filePath = path.join(uploadDir, safeId);
      const stat = await fs.promises.stat(filePath).catch(() => null);
      if (!stat?.isFile()) return reply.code(404).send({ error: 'File not found' });
      const ext = path.extname(safeId).toLowerCase();
      const mime = ext === '.png' ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : ext === '.gif' ? 'image/gif'
        : ext === '.webp' ? 'image/webp'
        : ext === '.webm' ? 'audio/webm'
        : ext === '.mp3' ? 'audio/mpeg'
        : ext === '.pdf' ? 'application/pdf'
        : 'application/octet-stream';
      reply.header('Content-Type', mime);
      reply.header('Cache-Control', 'private, max-age=86400');
      return reply.send(fs.createReadStream(filePath));
    } catch (err) {
      console.error('[Chat API] Failed to serve file', err);
      return reply.code(500).send({ error: 'Could not read file' });
    }
  });

  // 3. Create a new conversation (invite a contact by email)
  fastify.post('/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { email } = request.body as { email: string };
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    try {
      // Find the target user
      const targetUser = await (prisma as any).user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
      });
      if (!targetUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // A chat with yourself can never be accepted (accepting needs the other
      // side), so it sat in the list as a permanently pending invite.
      if (targetUser.id === userId) {
        return reply.code(400).send({ error: 'You cannot start a conversation with yourself' });
      }

      // Check if a direct conversation already exists
      const existingConversation = await (prisma as any).conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { every: { userId: { in: [userId, targetUser.id] } } } },
            { participants: { some: { userId } } },
            { participants: { some: { userId: targetUser.id } } }
          ]
        },
        include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } } } }
      });

      if (existingConversation) {
        if (existingConversation.status === 'BLOCKED') {
          return reply.code(403).send({ error: 'This contact is blocked' });
        }
        return reply.send(existingConversation);
      }

      // Create new conversation
      const conversation = await (prisma as any).conversation.create({
        data: {
          isGroup: false,
          status: 'PENDING',
          requestedById: userId,
          participants: {
            create: userId === targetUser.id ? [{ userId }] : [{ userId }, { userId: targetUser.id }]
          }
        },
        include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } } } }
      });

      // Broadcast to signaling-service so the target user gets a live notification
      const payload = JSON.stringify({
        targetUserId: targetUser.id,
        conversation
      });
      redisPublisher.publish('chat:new-conversation', payload);

      // Email them too — the Redis ping only reaches someone who is online
      // right now. Fire-and-forget: SMTP being down must not fail the request.
      if (targetUser.id !== userId && targetUser.email) {
        void (async () => {
          try {
            const sender = await (prisma as any).user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
            const chatUrl = `${getPublicWebUrl()}/dashboard/chat`;
            const result = await sendTemplatedEmail({
              to: targetUser.email,
              key: 'contact-invite',
              vars: {
                senderName: sender?.name || sender?.email || 'A Remote 365 user',
                senderEmail: sender?.email || '',
                chatUrl,
                email: targetUser.email,
              },
            });
            if (!result.sent) console.log(`[Chat API] Friend-request email skipped (${result.skipped}) for ${targetUser.email}`);
          } catch (err: any) {
            console.error('[Chat API] Friend-request email failed:', err?.message || err);
          }
        })();
      }

      return reply.send(conversation);
    } catch (err) {
      console.error('[Chat API] Failed to create conversation', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 3b. Create a Meet/Zoom-style remote session invite. If sent inside a chat,
  // the invite is stored as a structured chat message so it appears instantly.
  fastify.post('/session-invites', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { email, conversationId, sessionName, sessionCode, sessionPassword, sessionLink, type, hostAccessKey } = request.body as {
      email?: string;
      conversationId?: string;
      sessionName: string;
      sessionCode: string;
      sessionPassword?: string;
      sessionLink: string;
      type?: string;
      /** The creator's own device: the computer this session shares (support sessions). */
      hostAccessKey?: string;
    };

    const sessionType = type || 'REMOTE_CONTROL';

    const cleanEmail = email?.trim().toLowerCase();
    let cleanCode = sessionType === 'VIDEO_MEETING'
      ? normalizeMeetingCode(sessionCode)
      : String(sessionCode || '').replace(/\s/g, '');
    const cleanName = (sessionName || 'Remote support session').trim();

    // A support session shares the CREATOR's computer. The desktop app sends
    // the device it runs on; a Chat invite from an older build sends that
    // device as the session code itself. Either way the device must belong to
    // the creator, so a code can never hand out someone else's machine.
    let cleanHostKey = '';
    if (sessionType === 'REMOTE_CONTROL') {
      const candidateKey = String(hostAccessKey || '').replace(/\D/g, '') || (cleanCode.length === 9 ? cleanCode : '');
      if (candidateKey) {
        const hostDevice = await (prisma as any).device.findUnique({ where: { accessKey: candidateKey }, select: { ownerId: true } });
        if (!hostDevice || hostDevice.ownerId !== userId) {
          return reply.code(403).send({ error: 'A session can only share a computer that is registered to your account.' });
        }
        cleanHostKey = candidateKey;
      } else if (!conversationId) {
        return reply.code(400).send({ error: 'Create the session from the Remote365 desktop app on the computer you want to share.' });
      }
    }

    // Remote-control sessions get a fresh unique 9-digit code per session
    // (meeting-style) instead of reusing the creator's device ID, and they
    // are passwordless — access is granted via the join flow's token.
    if (sessionType === 'REMOTE_CONTROL' && !cleanCode) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = String(Math.floor(100000000 + Math.random() * 900000000));
        const [codeClash, deviceClash] = await Promise.all([
          (prisma as any).remoteSession.findFirst({ where: { sessionCode: candidate, status: 'ACTIVE' }, select: { id: true } }),
          (prisma as any).device.findUnique({ where: { accessKey: candidate }, select: { id: true } })
        ]);
        if (!codeClash && !deviceClash) { cleanCode = candidate; break; }
      }
      if (!cleanCode) return reply.code(500).send({ error: 'Could not allocate a session code. Try again.' });
    }

    if (sessionType === 'VIDEO_MEETING' && !cleanCode) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = generateMeetingCode();
        // Never reissue a code, even one whose meeting has ended: a reused code
        // shows up as duplicate rows in Recent Meetings and makes join-by-code
        // ambiguous between the old and the new meeting.
        const exists = await (prisma as any).remoteSession.findFirst({
          where: {
            type: 'VIDEO_MEETING',
            sessionCode: normalizeMeetingCode(candidate)
          },
          select: { id: true }
        });
        if (!exists) {
          cleanCode = normalizeMeetingCode(candidate);
          break;
        }
      }
      if (!cleanCode) return reply.code(500).send({ error: 'Could not allocate a meeting code. Try again.' });
    }

    const displayMeetingCode = sessionType === 'VIDEO_MEETING' && cleanCode.length === 9
      ? `${cleanCode.slice(0, 3)}-${cleanCode.slice(3, 6)}-${cleanCode.slice(6, 9)}`
      : cleanCode;
    // Meeting links must be plain https (the public web join page) so email
    // recipients without the app can still join. Older desktop builds send a
    // remote365:// link here — never let that reach an email.
    const clientLink = String(sessionLink || '').trim();
    const effectiveSessionLink = sessionType === 'VIDEO_MEETING'
      ? (/^https?:\/\//i.test(clientLink) ? clientLink : getMeetingWebUrl(displayMeetingCode))
      // Never a remote365:// link here either: the same value goes into the
      // email, and the web page is the one place every recipient can open.
      : getSessionWebUrl(cleanCode);

    if (!cleanCode) {
      return reply.code(400).send({ error: 'Session code is required' });
    }
    try {
      const sender = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true }
      });
      const senderName = sender?.name || sender?.email || 'Someone';

      let conversation: any = null;
      let targetEmails: string[] = cleanEmail ? [cleanEmail] : [];
      let targetUserIds: string[] = [];

      if (conversationId) {
        conversation = await (prisma as any).conversation.findFirst({
          where: {
            id: conversationId,
            status: 'ACCEPTED',
            participants: { some: { userId } }
          },
          include: {
            participants: {
              include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } }
            }
          }
        });

        if (!conversation) {
          return reply.code(403).send({ error: 'Only accepted chats can receive session invites' });
        }

        const otherParticipants = conversation.participants.filter((p: any) => p.userId !== userId);
        if (!cleanEmail) {
          targetEmails = otherParticipants.map((p: any) => p.user.email).filter(Boolean);
        }
        targetUserIds = otherParticipants.map((p: any) => p.userId);
      }

      const targetUser = cleanEmail
        ? await (prisma as any).user.findUnique({ where: { email: cleanEmail }, select: { id: true, email: true } })
        : null;
      if (targetUser && !targetUserIds.includes(targetUser.id)) targetUserIds.push(targetUser.id);

      const collaboratorUsers = conversationId
        ? conversation.participants
            .filter((p: any) => p.userId !== userId)
            .map((p: any) => ({ userId: p.userId, email: p.user.email, name: p.user.name }))
        : [];

      if (targetUser && cleanEmail && !collaboratorUsers.some((c: any) => c.email === cleanEmail)) {
        collaboratorUsers.push({ userId: targetUser.id, email: targetUser.email, name: null });
      } else if (cleanEmail && !collaboratorUsers.some((c: any) => c.email === cleanEmail)) {
        collaboratorUsers.push({ userId: null, email: cleanEmail, name: null });
      }

      const remoteSession = await (prisma as any).remoteSession.create({
        data: {
          name: cleanName,
          sessionCode: cleanCode,
          joinLink: getSafeJoinLink(effectiveSessionLink),
          conversationId: conversationId || null,
          createdById: userId,
          type: sessionType,
          hostAccessKey: cleanHostKey || null,
          expiresAt: new Date(Date.now() + getRemoteSessionTtl(sessionType)),
          collaborators: {
            create: collaboratorUsers.map((collaborator: any) => ({
              userId: collaborator.userId || null,
              email: collaborator.email,
              name: collaborator.name || null
            }))
          }
        },
        include: {
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { createdAt: 'asc' as const }
          },
          createdBy: { select: { id: true, name: true, email: true } }
        }
      });

      const invitePayload = {
        kind: 'remote-session-invite',
        remoteSessionId: remoteSession.id,
        sessionName: cleanName,
        sessionCode: cleanCode,
        sessionPassword: sessionPassword || '',
        sessionLink: effectiveSessionLink,
        sessionType,
        senderName,
        createdAt: new Date().toISOString(),
        expiresAt: getRemoteSessionExpiresAt(remoteSession).toISOString()
      };

      let message = null;
      if (conversationId) {
        message = await (prisma as any).message.create({
          data: {
            conversationId,
            senderId: userId,
            content: `${SESSION_INVITE_PREFIX}${JSON.stringify(invitePayload)}`
          },
          include: {
            sender: { select: { id: true, name: true, email: true, avatar: true } }
          }
        });

        await (prisma as any).conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        await redisPublisher.publish('chat:new-message', JSON.stringify({
          type: 'chat-message-received',
          message,
          conversationId,
          targetUserIds: conversation.participants.map((p: any) => p.userId)
        }));
      }

      if (!conversationId && targetUserIds.length > 0) {
        await redisPublisher.publish('chat:session-invite', JSON.stringify({
          type: 'chat-session-invite',
          invite: invitePayload,
          targetUserIds
        }));
      }

      await Promise.all(Array.from(new Set(targetEmails)).map((to) =>
        sendSessionInviteEmail({
          to,
          senderName,
          sessionName: cleanName,
          sessionCode: cleanCode,
          sessionPassword,
          sessionLink: effectiveSessionLink,
          isExistingUser: Boolean(targetUserIds.length),
          sessionType
        }).catch((err: any) => {
          console.error(`[Session Invite] Email failed for ${to}:`, err.message);
        })
      ));

      return reply.send({
        success: true,
        existingUser: Boolean(targetUser || targetUserIds.length > 0),
        message,
        remoteSession: decorateRemoteSession(remoteSession)
      });
    } catch (err) {
      console.error('[Chat API] Failed to create session invite', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Public (no-login) meeting invite from the landing page. Sends the invitee an
  // email and, if they are a registered Remote 365 user, delivers a live in-app
  // notification/toast to their desktop (same path as authenticated invites).
  // Rate-limited per IP and per target email so the open endpoint can't be
  // abused to blast emails/notifications.
  fastify.post('/public-meeting-invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body || {}) as {
      email?: string; meetingCode?: string; meetingLink?: string; inviterName?: string;
    };
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return reply.code(400).send({ error: 'A valid email address is required.' });
    }
    const meetingCode = normalizeMeetingCode(String(body.meetingCode || ''));
    if (!meetingCode) {
      return reply.code(400).send({ error: 'A meeting code is required.' });
    }

    // Abuse throttle: cap invites per source IP (short window) and per recipient
    // (longer window). Fail-open if Redis is unavailable so invites still work.
    try {
      const ip = String(request.ip || 'unknown').slice(0, 45);
      const ipKey = `pubinvite:ip:${ip}`;
      // Note: behind the Caddy reverse proxy request.ip may collapse to the proxy
      // address, so this bucket is effectively a global short-window cap; the
      // per-recipient cap below is the real anti-spam guard.
      const ipCount = await redisPublisher.incr(ipKey);
      if (ipCount === 1) await redisPublisher.expire(ipKey, 600);
      if (ipCount > 120) return reply.code(429).send({ error: 'Too many invites right now. Please try again in a few minutes.' });

      const toKey = `pubinvite:to:${cleanEmail}`;
      const toCount = await redisPublisher.incr(toKey);
      if (toCount === 1) await redisPublisher.expire(toKey, 3600);
      if (toCount > 5) return reply.code(429).send({ error: 'This address has received too many invites recently.' });
    } catch (rateErr) {
      console.warn('[Public Invite] Rate-limit check skipped:', (rateErr as any)?.message || rateErr);
    }

    const displayCode = meetingCode.length === 9
      ? `${meetingCode.slice(0, 3)}-${meetingCode.slice(3, 6)}-${meetingCode.slice(6, 9)}`
      : meetingCode;
    // Only accept an https link from the client (same-environment web origin);
    // anything else — including remote365:// deep links — falls back to the
    // public web join page so the email works without the app installed.
    const requestedLink = String(body.meetingLink || '').trim();
    const meetingLink = /^https?:\/\//i.test(requestedLink)
      ? requestedLink
      : getMeetingWebUrl(displayCode);
    const senderName = String(body.inviterName || '').trim() || 'A Remote 365 user';
    const sessionName = `${senderName} meeting`;

    try {
      const targetUser = await (prisma as any).user.findUnique({
        where: { email: cleanEmail },
        select: { id: true }
      });

      // Live in-app toast/notification for a registered (and, if online, connected) user.
      if (targetUser) {
        const invitePayload = {
          kind: 'remote-session-invite',
          type: 'VIDEO_MEETING',
          sessionType: 'VIDEO_MEETING',
          sessionName,
          sessionCode: meetingCode,
          sessionPassword: '',
          sessionLink: meetingLink,
          senderName,
          createdAt: new Date().toISOString()
        };
        await redisPublisher.publish('chat:session-invite', JSON.stringify({
          type: 'chat-session-invite',
          invite: invitePayload,
          targetUserIds: [targetUser.id]
        }));
      }

      await sendSessionInviteEmail({
        to: cleanEmail,
        senderName,
        sessionName,
        sessionCode: meetingCode,
        sessionLink: meetingLink,
        isExistingUser: Boolean(targetUser),
        sessionType: 'VIDEO_MEETING'
      }).catch((err: any) => {
        console.error(`[Public Invite] Email failed for ${cleanEmail}:`, err?.message || err);
      });

      return reply.send({ success: true, existingUser: Boolean(targetUser) });
    } catch (err) {
      console.error('[Chat API] Public meeting invite failed', err);
      return reply.code(500).send({ error: 'Could not send the invite.' });
    }
  });

  // Create a time-limited remote access grant and persist the approval message.
  fastify.post('/remote-access-grants', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { conversationId, requestId, requesterId, durationMinutes, sessionCode, devicePassword } = request.body as {
      conversationId: string;
      requestId: string;
      requesterId: string;
      durationMinutes: number;
      sessionCode: string;
      devicePassword?: string;
    };
    const duration = Math.max(1, Math.min(480, Number(durationMinutes) || 15));
    const cleanCode = String(sessionCode || '').replace(/\D/g, '');
    if (!conversationId || !requestId || !requesterId || !cleanCode) {
      return reply.code(400).send({ error: 'Conversation, request, requester, and device are required' });
    }

    try {
      const conversation = await (prisma as any).conversation.findFirst({
        where: {
          id: conversationId,
          status: 'ACCEPTED',
          participants: { some: { userId } }
        },
        include: { participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } } }
      });
      if (!conversation || !conversation.participants.some((p: any) => p.userId === requesterId)) {
        return reply.code(403).send({ error: 'Invalid remote access request' });
      }

      // The approver is granting access to the machine they are sitting at: their
      // client sends its own access key (and its own device password). Because the
      // grant token later bypasses the password (passwordVerified: true), we must
      // still prove the approver controls this device before minting a grant:
      //   - row missing        -> the host hasn't self-registered yet; create it, owned by the approver
      //   - row unowned        -> claim it for the approver (same trust model as device registration)
      //   - owned by approver  -> fine
      //   - owned by another   -> allow only if the approver proves possession with
      //                           the device password (open devices with no password pass too)
      let device = await (prisma as any).device.findUnique({
        where: { accessKey: cleanCode },
        select: { id: true, accessKey: true, name: true, ownerId: true, accessPasswordHash: true, passwordRequired: true }
      });
      if (!device) {
        device = await (prisma as any).device.create({
          data: { accessKey: cleanCode, ownerId: userId },
          select: { id: true, accessKey: true, name: true, ownerId: true, accessPasswordHash: true, passwordRequired: true }
        });
      } else if (!device.ownerId) {
        await (prisma as any).device.update({ where: { id: device.id }, data: { ownerId: userId } });
      } else if (device.ownerId !== userId) {
        const isOpenDevice = !device.accessPasswordHash && device.passwordRequired === false;
        const passwordMatches = Boolean(
          devicePassword && device.accessPasswordHash &&
          await bcrypt.compare(String(devicePassword), device.accessPasswordHash)
        );
        if (!isOpenDevice && !passwordMatches) {
          return reply.code(403).send({ error: 'This device is linked to another account. Grant access from that account, or make sure this app has the current device password.' });
        }
      }

      const approver = conversation.participants.find((p: any) => p.userId === userId)?.user;
      const requester = conversation.participants.find((p: any) => p.userId === requesterId)?.user;
      const existingGrant = await (prisma as any).remoteSession.findUnique({ where: { requestId } });
      if (existingGrant) return reply.code(409).send({ error: 'This remote access request was already approved' });
      const expiresAt = new Date(Date.now() + duration * 60 * 1000);
      const remoteSession = await (prisma as any).remoteSession.create({
        data: {
          requestId,
          name: `${approver?.name || approver?.email || 'Remote 365'} remote access`,
          sessionCode: cleanCode,
          conversationId,
          createdById: userId,
          type: 'REMOTE_CONTROL',
          status: 'ACTIVE',
          expiresAt,
          collaborators: {
            create: [{ userId: requesterId, email: requester.email, name: requester.name || null, status: 'APPROVED' }]
          }
        }
      });

      const payload = {
        kind: 'remote-access-response',
        requestId,
        remoteSessionId: remoteSession.id,
        approverId: userId,
        approverName: approver?.name || approver?.email || 'Someone',
        approved: true,
        durationMinutes: duration,
        sessionCode: cleanCode,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString()
      };
      const message = await (prisma as any).message.create({
        data: { conversationId, senderId: userId, content: `${SESSION_INVITE_PREFIX}${JSON.stringify(payload)}` },
        include: { sender: { select: { id: true, name: true, email: true, avatar: true } } }
      });
      await (prisma as any).conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      await redisPublisher.publish('chat:new-message', JSON.stringify({
        type: 'chat-message-received', message, conversationId,
        targetUserIds: conversation.participants.map((p: any) => p.userId)
      }));
      return reply.send({ remoteSession: decorateRemoteSession(remoteSession), message });
    } catch (err) {
      console.error('[Chat API] Failed to create remote access grant', err);
      if ((err as any)?.code === 'P2002') {
        return reply.code(409).send({ error: 'This remote access request was already approved' });
      }
      return reply.code(500).send({ error: 'Could not grant remote access' });
    }
  });

  // Exchange an active grant for a JWT whose lifetime cannot exceed the grant.
  fastify.post('/remote-access-grants/:id/token', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    try {
      const grant = await (prisma as any).remoteSession.findFirst({
        where: {
          id,
          type: 'REMOTE_CONTROL',
          status: 'ACTIVE',
          collaborators: { some: { userId } }
        }
      });
      if (!grant) return reply.code(403).send({ error: 'Remote access grant is not available' });
      const expiresAt = getRemoteSessionExpiresAt(grant);
      const remainingSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      if (remainingSeconds <= 0) {
        await (prisma as any).remoteSession.update({ where: { id }, data: { status: 'EXPIRED', endedAt: new Date() } });
        return reply.code(410).send({ error: 'Remote access grant has expired' });
      }
      const token = generateToken({
        type: 'remote-access',
        accessKey: grant.sessionCode,
        viewerUserId: userId,
        remoteSessionId: grant.id,
        grantExpiresAt: expiresAt.toISOString(),
        isTrusted: true,
        passwordVerified: true,
        // Explicit: a chat grant lets the viewer IN without a password, but the
        // approval may have been clicked long before the session is actually
        // started, so control is still requested from whoever is at the machine.
        unattended: false
      }, remainingSeconds);
      return reply.send({ token, expiresAt: expiresAt.toISOString(), sessionCode: grant.sessionCode });
    } catch (err) {
      console.error('[Chat API] Failed to issue remote access grant token', err);
      return reply.code(500).send({ error: 'Could not start remote access session' });
    }
  });

  // Use a support session by its code. The session shares the CREATOR's
  // computer: the joiner gets a remote-access token for that device and opens
  // the viewer (desktop or web); nothing is minted against the joiner's own
  // machine. A code works once: the first account to use it takes the seat,
  // and only that account can reconnect with it while the session is live.
  fastify.post('/remote-sessions/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { code } = request.body as { code: string };
    const cleanCode = String(code || '').replace(/\D/g, '');
    if (!cleanCode) return reply.code(400).send({ error: 'Session code is required' });

    try {
      const session = await (prisma as any).remoteSession.findFirst({
        where: { sessionCode: cleanCode, type: 'REMOTE_CONTROL', status: 'ACTIVE', joinLink: { not: null } },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          collaborators: { select: { userId: true, email: true, status: true } }
        }
      });
      if (!session) return reply.code(404).send({ error: 'No active session was found for this code' });
      const sessionExpiresAt = getRemoteSessionExpiresAt(session);
      if (sessionExpiresAt.getTime() <= Date.now()) {
        return reply.code(410).send({ error: 'This session has expired' });
      }
      if (session.createdById === userId) {
        return reply.code(400).send({ error: 'This is your own session. Share the code with the person who should use this computer.' });
      }
      if (!session.hostAccessKey) {
        return reply.code(409).send({ error: 'This session was created with an older version of Remote365. Ask them to create a new one.' });
      }
      if (session.joinedById && session.joinedById !== userId) {
        return reply.code(409).send({ error: 'This code has already been used by someone else. Ask for a new session.' });
      }

      const joiner = await (prisma as any).user.findUnique({
        where: { id: userId }, select: { id: true, name: true, email: true }
      });
      if (!joiner) return reply.code(403).send({ error: 'Sign in to join a session' });

      // Invited = the creator typed this account's email when creating the
      // session. The host's control prompt treats them as expected.
      const joinerEmail = String(joiner.email || '').toLowerCase();
      const invited = (session.collaborators || []).some((c: any) =>
        (c.userId && c.userId === userId) || (c.email && String(c.email).toLowerCase() === joinerEmail)
      );

      const hostDevice = await (prisma as any).device.findUnique({
        where: { accessKey: session.hostAccessKey },
        select: { name: true, ownerId: true }
      });
      if (!hostDevice || (session.createdById && hostDevice.ownerId !== session.createdById)) {
        return reply.code(409).send({ error: 'The computer this session shares is no longer registered to its creator.' });
      }

      const now = new Date();
      await (prisma as any).remoteSessionCollaborator.upsert({
        where: { sessionId_email: { sessionId: session.id, email: joiner.email } },
        update: { status: 'JOINED', joinedAt: now, userId: joiner.id, name: joiner.name || null },
        create: { sessionId: session.id, userId: joiner.id, email: joiner.email, name: joiner.name || null, status: 'JOINED', joinedAt: now }
      });
      if (!session.joinedById) {
        await (prisma as any).remoteSession.update({
          where: { id: session.id },
          data: { joinedById: userId, joinedAt: now }
        });
      }

      // The access grant for the creator's device. It lives as long as the
      // session so a reconnect later in the day still works.
      const requestId = `sessjoin-${session.id}-${userId}`;
      const existingGrant = await (prisma as any).remoteSession.findUnique({ where: { requestId } });
      const grant = existingGrant
        ? await (prisma as any).remoteSession.update({
            where: { id: existingGrant.id },
            data: { status: 'ACTIVE', sessionCode: session.hostAccessKey, expiresAt: sessionExpiresAt, endedAt: null }
          })
        : await (prisma as any).remoteSession.create({
            data: {
              requestId,
              name: `${session.name || 'Support session'} access`,
              sessionCode: session.hostAccessKey,
              createdById: session.createdById,
              type: 'REMOTE_CONTROL',
              status: 'ACTIVE',
              expiresAt: sessionExpiresAt,
              collaborators: {
                create: [{ userId: joiner.id, email: joiner.email, name: joiner.name || null, status: 'APPROVED' }]
              }
            }
          });

      const remainingSeconds = Math.max(60, Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000));
      const token = generateToken({
        type: 'remote-access',
        accessKey: session.hostAccessKey,
        viewerUserId: userId,
        remoteSessionId: grant.id,
        grantExpiresAt: sessionExpiresAt.toISOString(),
        isTrusted: true,
        passwordVerified: true,
        // The creator still decides about keyboard and mouse at their PC; the
        // invited flag only tells that prompt this is the person they asked for.
        unattended: false,
        invited
      }, remainingSeconds);

      // Tell the creator who is coming in, and refresh both session lists.
      await redisPublisher.publish('chat:session-invite', JSON.stringify({
        type: 'chat-session-invite',
        invite: {
          type: 'SESSION_JOINED',
          sessionId: session.id,
          sessionName: session.name,
          sessionCode: session.sessionCode,
          joinerName: joiner.name || joiner.email,
          invited,
          senderName: joiner.name || joiner.email,
          createdAt: now.toISOString()
        },
        targetUserIds: [session.createdById]
      }));
      await publishAccountSync([session.createdById, userId], 'remote-sessions', 'joined', session.id);

      return reply.send({
        session: decorateRemoteSession(session),
        creatorName: session.createdBy?.name || session.createdBy?.email || 'The session creator',
        hostAccessKey: session.hostAccessKey,
        hostName: hostDevice.name || session.createdBy?.name || 'Remote computer',
        token,
        expiresAt: sessionExpiresAt.toISOString(),
        invited
      });
    } catch (err) {
      console.error('[Chat API] Failed to join remote session', err);
      return reply.code(500).send({ error: 'Could not join this session' });
    }
  });

  fastify.get('/remote-sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;

    try {
      const now = new Date();
      await (prisma as any).remoteSession.updateMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { type: 'REMOTE_CONTROL', createdAt: { lt: new Date(now.getTime() - REMOTE_SESSION_LINK_TTL_MS) } },
            { type: 'VIDEO_MEETING', createdAt: { lt: new Date(now.getTime() - MEETING_LINK_TTL_MS) } }
          ]
        },
        data: { status: 'ENDED', endedAt: now }
      });

      const currentUser = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      const visibilityFilters: any[] = [
        { createdById: userId },
        { collaborators: { some: { userId } } }
      ];
      if (currentUser?.email) {
        visibilityFilters.push({ collaborators: { some: { email: currentUser.email } } });
      }

      const sessions = await (prisma as any).remoteSession.findMany({
        where: {
          OR: visibilityFilters,
          // Only surface remote-control sessions started from the Session page (New Session /
          // Join), which always carry a joinLink. This excludes video meetings (their own
          // Meetings view) and the link-less REMOTE_CONTROL records that verify-access mints per
          // direct device connect purely to hold the access-token grant — so the list isn't
          // flooded with meetings or "Remote control for …" rows.
          type: 'REMOTE_CONTROL',
          joinLink: { not: null },
          // Live sessions only. A session the creator closed (or one past its TTL, flipped to
          // ENDED by the sweep above) must drop off the list instead of lingering as a
          // greyed-out "Expired" row that "Close" can never remove.
          status: 'ACTIVE'
        },
        include: {
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { createdAt: 'asc' as const }
          },
          createdBy: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // decorateRemoteSession also honours a per-session expiresAt, which the TTL sweep
      // above does not consult, so drop anything it reports as expired as well.
      return reply.send(sessions.map(decorateRemoteSession).filter((session: any) => !session.isExpired));
    } catch (err) {
      console.error('[Chat API] Failed to fetch remote sessions', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.patch('/remote-sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };
    const cleanName = name?.trim().slice(0, 120);

    if (!cleanName) return reply.code(400).send({ error: 'Session name is required' });

    try {
      const session = await (prisma as any).remoteSession.findFirst({
        where: { id, createdById: userId }
      });
      if (!session) return reply.code(403).send({ error: 'Only the session creator can edit this session' });

      const updated = await (prisma as any).remoteSession.update({
        where: { id },
        data: { name: cleanName },
        include: {
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { createdAt: 'asc' as const }
          },
          createdBy: { select: { id: true, name: true, email: true } }
        }
      });

      await publishAccountSync([userId], 'remote-sessions', 'updated', id);
      return reply.send(decorateRemoteSession(updated));
    } catch (err) {
      console.error('[Chat API] Failed to update remote session', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/remote-sessions/:id/end', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const session = await (prisma as any).remoteSession.findFirst({
        where: { id, createdById: userId }
      });
      if (!session) return reply.code(403).send({ error: 'Only the session creator can close this session' });

      const updated = await (prisma as any).remoteSession.update({
        where: { id },
        data: { status: 'ENDED', endedAt: new Date() },
        include: {
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { createdAt: 'asc' as const }
          },
          createdBy: { select: { id: true, name: true, email: true } }
        }
      });
      // Closing the session also revokes the access it handed out: the joiner's
      // token stops working at signaling on their next connect.
      await (prisma as any).remoteSession.updateMany({
        where: { requestId: { startsWith: `sessjoin-${id}-` }, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: new Date() }
      });

      await publishAccountSync(
        [userId, ...(updated.collaborators || []).map((c: any) => c.userId)],
        'remote-sessions', 'ended', id
      );
      return reply.send(decorateRemoteSession(updated));
    } catch (err) {
      console.error('[Chat API] Failed to close remote session', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/meetings', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string | undefined;
    const { name, variant, kind, conversationId } = request.body as { name?: string; variant?: string; kind?: string; conversationId?: string };
    const cleanName = (name || 'Remote 365 meeting').trim().slice(0, 120);
    const isLater = variant === 'later';
    // Which of the three New Meeting options made this: instant, for later, or
    // scheduled in Google Calendar (a "later" link the client also put on a
    // calendar). Stored so Recent Meetings can tell the three apart.
    const requestedKind = String(kind || '').toLowerCase();
    // The stored kind always agrees with the link lifetime: only a long-lived
    // ("later") link can be a for-later or calendar meeting.
    const meetingVariant = !isLater
      ? 'instant'
      : (requestedKind === 'calendar' ? 'calendar' : 'later');
    if (isLater && !userId) {
      return reply.code(401).send({ error: 'Sign in to create a meeting for later.' });
    }

    try {
      if (userId) {
        const createdBy = await (prisma as any).user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true }
        });
        if (!createdBy) return reply.code(404).send({ error: 'User not found' });
      }

      // A meeting started from a chat carries that conversation, so the join /
      // end status cards land in the thread. Only for a member of an accepted chat.
      let meetingConversationId: string | null = null;
      if (userId && conversationId) {
        const membership = await (prisma as any).conversationParticipant.findFirst({
          where: { conversationId: String(conversationId), userId, conversation: { status: 'ACCEPTED' } },
          select: { id: true }
        });
        if (!membership) return reply.code(403).send({ error: 'You are not a member of that chat' });
        meetingConversationId = String(conversationId);
      }

      let meetingCode = '';
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = generateMeetingCode();
        // Never reissue a code, even one whose meeting has ended: a reused code
        // shows up as duplicate rows in Recent Meetings and makes join-by-code
        // ambiguous between the old and the new meeting.
        const exists = await (prisma as any).remoteSession.findFirst({
          where: {
            type: 'VIDEO_MEETING',
            sessionCode: normalizeMeetingCode(candidate)
          },
          select: { id: true }
        });
        if (!exists) {
          meetingCode = candidate;
          break;
        }
      }

      if (!meetingCode) {
        return reply.code(503).send({ error: 'Could not allocate a meeting code. Please try again.' });
      }

      const normalizedCode = normalizeMeetingCode(meetingCode);
      const joinLink = getMeetingWebUrl(meetingCode);
      const meeting = await (prisma as any).remoteSession.create({
        data: {
          name: cleanName,
          sessionCode: normalizedCode,
          joinLink,
          createdById: userId || null,
          type: 'VIDEO_MEETING',
          status: 'ACTIVE',
          variant: meetingVariant,
          conversationId: meetingConversationId,
          expiresAt: new Date(Date.now() + (isLater ? MEETING_LATER_TTL_MS : MEETING_LINK_TTL_MS))
        },
        include: {
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { createdAt: 'asc' as const }
          },
          createdBy: { select: { id: true, name: true, email: true } }
        }
      });

      await publishAccountSync([userId], 'meetings', 'created', meeting.id);
      return reply.send({ ...decorateRemoteSession(meeting), displayCode: meetingCode });
    } catch (err) {
      console.error('[Meetings API] Failed to create meeting', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/meetings', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;

    try {
      const now = new Date();
      // Expire by each row's own expiresAt so "for later" meetings keep their
      // longer TTL; legacy rows without expiresAt fall back to the instant TTL.
      await (prisma as any).remoteSession.updateMany({
        where: {
          type: 'VIDEO_MEETING',
          OR: [
            // Unused links past their expiry.
            { status: 'ACTIVE', expiresAt: { lt: now } },
            { status: 'ACTIVE', expiresAt: null, createdAt: { lt: new Date(now.getTime() - MEETING_LINK_TTL_MS) } },
            // Live rows nothing has touched for a day. The signaling service
            // normally ends or idles them when the room empties, but a restart
            // loses that timer and would leave the meeting "live" forever.
            { status: 'IN_PROGRESS', updatedAt: { lt: new Date(now.getTime() - MEETING_STALE_LIVE_MS) } }
          ]
        },
        data: { status: 'ENDED', endedAt: now }
      });

      const currentUser = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      const visibilityFilters: any[] = [
        { createdById: userId },
        { collaborators: { some: { userId } } }
      ];
      if (currentUser?.email) {
        visibilityFilters.push({ collaborators: { some: { email: currentUser.email } } });
      }

      // Recent = live now, or ended within the last day. Without the time bound
      // every meeting ever created stayed in the list with no way to clear it.
      const recentCutoff = new Date(now.getTime() - RECENT_MEETING_WINDOW_MS);
      const meetings = await (prisma as any).remoteSession.findMany({
        where: {
          type: 'VIDEO_MEETING',
          AND: [
            { OR: visibilityFilters },
            { OR: [{ status: { in: ['ACTIVE', 'IN_PROGRESS'] } }, { endedAt: { gte: recentCutoff } }] }
          ]
        },
        include: {
          collaborators: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { createdAt: 'asc' as const }
          },
          createdBy: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 30
      });

      return reply.send(meetings.map((meeting: any) => ({
        ...decorateRemoteSession(meeting),
        displayCode: `${meeting.sessionCode.slice(0, 3)}-${meeting.sessionCode.slice(3, 6)}-${meeting.sessionCode.slice(6, 9)}`
      })));
    } catch (err) {
      console.error('[Meetings API] Failed to fetch meetings', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/meetings/:id/end', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const meeting = await (prisma as any).remoteSession.findFirst({
        where: {
          id,
          type: 'VIDEO_MEETING',
          createdById: userId
        }
      });
      if (!meeting) return reply.code(403).send({ error: 'Only the meeting creator can end this meeting' });

      const updated = await (prisma as any).remoteSession.update({
        where: { id },
        data: { status: 'ENDED', endedAt: new Date() },
        include: {
          collaborators: true,
          createdBy: { select: { id: true, name: true, email: true } }
        }
      });

      await publishAccountSync([userId], 'meetings', 'ended', id);
      return reply.send(updated);
    } catch (err) {
      console.error('[Meetings API] Failed to end meeting', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 4. Rename a conversation (Updates NICKNAME for the requester)
  fastify.patch('/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };

    try {
      // Diagnostic logging
      const allParticipants = await (prisma as any).conversationParticipant.findMany({
        where: { conversationId: id },
        include: { user: { select: { id: true, email: true } } }
      });
      console.log(`[Chat API] PATCH rename for ${id}. Participants in DB:`, allParticipants.map((p: any) => p.userId));
      console.log(`[Chat API] Requesting User ID:`, userId);

      const cleanName = String(name || '').trim().slice(0, 120);
      if (!cleanName) return reply.code(400).send({ error: 'Name is required' });
      const membership = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId },
        include: { conversation: { select: { isGroup: true } } }
      });
      if (!membership) return reply.code(403).send({ error: 'Forbidden' });

      if (membership.conversation?.isGroup) {
        // Renaming a group renames it for everyone. It used to set the renamer's
        // private nickname, so nobody else saw it and even the renamer's own
        // sidebar kept the old name.
        const renamed = await (prisma as any).conversation.update({
          where: { id },
          data: { name: cleanName },
          include: conversationInclude
        });
        await publishConversationEvent('chat-conversation-updated', renamed, {
          actorUserId: userId,
          reason: 'renamed'
        });
        return reply.send(renamed);
      }

      // A direct chat keeps a private nickname for the other person.
      await (prisma as any).conversationParticipant.update({
        where: { conversationId_userId: { conversationId: id, userId } },
        data: { nickname: cleanName }
      });

      const updated = await (prisma as any).conversation.findUnique({
        where: { id },
        include: conversationInclude
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to rename conversation', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 4b. Create a group conversation
  fastify.post('/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { name, emails } = request.body as { name: string; emails: string[] };

    const cleanName = (name || '').trim();
    const cleanEmails = Array.isArray(emails)
      ? Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)))
      : [];

    if (!cleanName) return reply.code(400).send({ error: 'Group name is required' });
    if (cleanEmails.length === 0) return reply.code(400).send({ error: 'Add at least one member email' });

    try {
      const users = await (prisma as any).user.findMany({
        where: { email: { in: cleanEmails } },
        select: { id: true, email: true }
      });

      if (users.length !== cleanEmails.length) {
        const found = new Set(users.map((u: any) => u.email.toLowerCase()));
        const missing = cleanEmails.filter((email) => !found.has(email));
        return reply.code(404).send({ error: `Users not found: ${missing.join(', ')}` });
      }

      const memberIds = Array.from(new Set([userId, ...users.map((u: any) => u.id)]));
      const conversation = await (prisma as any).conversation.create({
        data: {
          isGroup: true,
          name: cleanName,
          status: 'ACCEPTED',
          requestedById: userId,
          participants: {
            create: memberIds.map((memberId) => ({ userId: memberId }))
          }
        },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', conversation, {
        actorUserId: userId,
        reason: 'group-created'
      });

      return reply.send(conversation);
    } catch (err) {
      console.error('[Chat API] Failed to create group', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 4c. Add people to an existing group
  fastify.post('/conversations/:id/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { emails } = request.body as { emails: string[] };

    const cleanEmails = Array.isArray(emails)
      ? Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)))
      : [];

    if (cleanEmails.length === 0) return reply.code(400).send({ error: 'Add at least one member email' });

    try {
      const group = await (prisma as any).conversation.findFirst({
        where: { id, isGroup: true, participants: { some: { userId } } },
        include: { participants: true }
      });

      if (!group) return reply.code(403).send({ error: 'Only group members can add people' });

      const users = await (prisma as any).user.findMany({
        where: { email: { in: cleanEmails } },
        select: { id: true, email: true }
      });

      if (users.length !== cleanEmails.length) {
        const found = new Set(users.map((u: any) => u.email.toLowerCase()));
        const missing = cleanEmails.filter((email) => !found.has(email));
        return reply.code(404).send({ error: `Users not found: ${missing.join(', ')}` });
      }

      const existingIds = new Set(group.participants.map((participant: any) => participant.userId));
      const newUsers = users.filter((member: any) => !existingIds.has(member.id));

      if (newUsers.length > 0) {
        await (prisma as any).conversationParticipant.createMany({
          data: newUsers.map((member: any) => ({ conversationId: id, userId: member.id })),
          skipDuplicates: true
        });
      }

      const updated = await (prisma as any).conversation.findUnique({
        where: { id },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', updated, {
        actorUserId: userId,
        reason: 'members-added',
        addedUserIds: newUsers.map((member: any) => member.id)
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to add group members', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 5. Delete/Leave a conversation
  fastify.delete('/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      console.log(`[Chat API] DELETE request for ${id} by user: ${userId}`);
      
      // Diagnostic logging
      const allParticipants = await (prisma as any).conversationParticipant.findMany({
        where: { conversationId: id },
        include: { user: { select: { id: true, email: true } } }
      });
      console.log(`[Chat API] Participants in DB for ${id}:`, allParticipants.map((p: any) => p.userId));

      // Check if user is a participant
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });

      if (!participant) {
        console.warn(`[Chat API] Delete failed: User ${userId} is NOT a participant of ${id}`);
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const conversation = await (prisma as any).conversation.findUnique({
        where: { id },
        include: conversationInclude
      });

      if (conversation?.isGroup) {
        await (prisma as any).conversationParticipant.delete({
          where: { conversationId_userId: { conversationId: id, userId } }
        });

        const remainingCount = await (prisma as any).conversationParticipant.count({
          where: { conversationId: id }
        });

        if (remainingCount === 0) {
          await (prisma as any).conversation.delete({ where: { id } });
        } else {
          const updated = await (prisma as any).conversation.findUnique({
            where: { id },
            include: conversationInclude
          });

          await publishConversationEvent('chat-conversation-updated', updated, {
            actorUserId: userId,
            reason: 'member-left'
          });
        }

        return reply.send({ success: true });
      }

      // "Delete for me": the chat leaves THIS person's list and their history up
      // to now is hidden. The other person keeps everything, and a new message
      // brings the chat back with only what arrived after this point. It used to
      // delete the row for both people despite the "for me" wording.
      const clearedAt = new Date();
      await (prisma as any).conversationParticipant.update({
        where: { conversationId_userId: { conversationId: id, userId } },
        data: { clearedAt, lastReadAt: clearedAt }
      });

      return reply.send({ success: true });
    } catch (err) {
      console.error('[Chat API] Failed to delete conversation', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 6. Accept a conversation invite
  fastify.post('/conversations/:id/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const conversation = await (prisma as any).conversation.findFirst({
        where: {
          id,
          status: 'PENDING',
          OR: [{ requestedById: { not: userId } }, { requestedById: null }],
          participants: { some: { userId } }
        }
      });

      if (!conversation) return reply.code(403).send({ error: 'Only the invited recipient can accept this request' });

      const updated = await (prisma as any).conversation.update({
        where: { id },
        data: { status: 'ACCEPTED' },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', updated, {
        actorUserId: userId,
        reason: 'accepted'
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to accept invite', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 7. Reject a conversation invite
  fastify.post('/conversations/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const conversation = await (prisma as any).conversation.findFirst({
        where: {
          id,
          status: 'PENDING',
          OR: [{ requestedById: { not: userId } }, { requestedById: null }],
          participants: { some: { userId } }
        }
      });

      if (!conversation) return reply.code(403).send({ error: 'Only the invited recipient can ignore this request' });

      const fullConversation = await (prisma as any).conversation.findUnique({
        where: { id },
        include: conversationInclude
      });

      await (prisma as any).conversation.delete({
        where: { id }
      });

      if (fullConversation) {
        await publishConversationEvent('chat-conversation-removed', fullConversation, {
          actorUserId: userId,
          reason: 'rejected'
        });
      }

      return reply.send({ success: true });
    } catch (err) {
      console.error('[Chat API] Failed to reject invite', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 8. Unfriend/remove a direct chat for both people
  fastify.post('/conversations/:id/unfriend', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const conversation = await (prisma as any).conversation.findFirst({
        where: { id, isGroup: false, participants: { some: { userId } } },
        include: conversationInclude
      });

      if (!conversation) return reply.code(403).send({ error: 'Forbidden' });

      await (prisma as any).conversation.delete({ where: { id } });
      await publishConversationEvent('chat-conversation-removed', conversation, {
        actorUserId: userId,
        reason: 'unfriended'
      });

      return reply.send({ success: true });
    } catch (err) {
      console.error('[Chat API] Failed to unfriend contact', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 9. Block a direct chat. Keeps a blocked record so the other person cannot re-invite.
  fastify.post('/conversations/:id/block', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const participant = await (prisma as any).conversationParticipant.findFirst({
        where: { conversationId: id, userId }
      });
      if (!participant) return reply.code(403).send({ error: 'Forbidden' });

      const conversation = await (prisma as any).conversation.findUnique({ where: { id } });
      if (conversation?.status === 'BLOCKED' && conversation.blockedById !== userId) {
        return reply.code(403).send({ error: 'This chat is already blocked' });
      }

      const updated = await (prisma as any).conversation.update({
        where: { id },
        data: { status: 'BLOCKED', blockedById: userId },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', updated, {
        actorUserId: userId,
        reason: 'blocked'
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to block contact', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // 10. Unblock a contact and return to a pending invite so the recipient can accept again.
  fastify.post('/conversations/:id/unblock', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    try {
      const conversation = await (prisma as any).conversation.findFirst({
        where: { id, status: 'BLOCKED', blockedById: userId, participants: { some: { userId } } }
      });
      if (!conversation) return reply.code(403).send({ error: 'Only the person who blocked this contact can unblock' });

      const updated = await (prisma as any).conversation.update({
        where: { id },
        data: { status: 'PENDING', blockedById: null, requestedById: userId },
        include: conversationInclude
      });

      await publishConversationEvent('chat-conversation-updated', updated, {
        actorUserId: userId,
        reason: 'unblocked'
      });

      return reply.send(updated);
    } catch (err) {
      console.error('[Chat API] Failed to unblock contact', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
